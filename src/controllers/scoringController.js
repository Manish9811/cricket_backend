const scoringModel = require('../models/scoringModel');
const matchModel   = require('../models/matchModel');
const { updateCareerStats } = require('../services/statsService');

// POST /api/scoring/:matchId/innings  — start an innings
const startInnings = async (req, res, next) => {
  try {
    const { battingTeamId, bowlingTeamId, inningsNumber, target } = req.body;

    // Mark match as live on first innings
    if (inningsNumber === 1) {
      await matchModel.updateStatus(req.params.matchId, 'live');
    }

    const result = await scoringModel.createInnings({
      matchId: req.params.matchId,
      battingTeamId, bowlingTeamId, inningsNumber, target,
    });
    res.status(201).json({ innings: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/scoring/innings/:inningsId/ball  — record a delivery
const recordBall = async (req, res, next) => {
  try {
    const { inningsId } = req.params;
    const {
      overNumber, ballNumber, deliveryNumber,
      batsmanId, nonStrikerId, bowlerId,
      runsOffBat, extrasType, extrasRuns,
      isWicket, wicketType, dismissedPlayerId, fielderId,
      commentary,
    } = req.body;

    // treat null/undefined/missing extrasType the same as 'none'
    const isFour = runsOffBat === 4 && !extrasType;
    const isSix  = runsOffBat === 6 && !extrasType;

    // 1. Persist ball
    const ballResult = await scoringModel.recordBall({
      inningsId, overNumber, ballNumber, deliveryNumber,
      batsmanId, nonStrikerId, bowlerId,
      runsOffBat, extrasType, extrasRuns,
      isWicket, wicketType, dismissedPlayerId, fielderId,
      isFour, isSix, commentary,
    });
    const ball = ballResult.rows[0];

    // 2. Fetch current innings state to compute new totals
    const inningsResult = await scoringModel.getInningsById(inningsId);
    const innings = inningsResult.rows[0];
    const extras = innings.extras || { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 };

    // Update extras breakdown
    if (extrasType && extrasType !== 'none') {
      extras[extrasType] = (extras[extrasType] || 0) + (extrasRuns || 1);
    }

    // Legal ball only increments ball count when not wide/noball
    const isLegalBall   = !['wide', 'noball'].includes(extrasType);
    const newTotalBalls = innings.total_balls + (isLegalBall ? 1 : 0);
    const newTotalOvers = Math.floor(newTotalBalls / 6); // always 6 balls per over
    const totalRuns     = innings.total_runs + (runsOffBat || 0) + (extrasRuns || 0);
    const totalWickets  = innings.total_wickets + (isWicket ? 1 : 0);

    // 3. Update innings totals
    await scoringModel.updateInningsState(inningsId, {
      total_runs:     totalRuns,
      total_wickets:  totalWickets,
      total_balls:    newTotalBalls,
      total_overs:    newTotalOvers,
      extras:         JSON.stringify(extras),
      striker_id:     isWicket ? null : (runsOffBat % 2 !== 0 ? nonStrikerId : batsmanId),
    });

    // 4. Upsert batting perf for batsman
    const existingBatResult = await scoringModel.getBattingScorecard(inningsId);
    const batRow = existingBatResult.rows.find(r => r.player_id === batsmanId);
    await scoringModel.upsertBattingPerf({
      inningsId,
      playerId:     batsmanId,
      teamId:       innings.batting_team_id,
      battingOrder: batRow?.batting_order,
      runs:         (batRow?.runs || 0) + runsOffBat,
      ballsFaced:   (batRow?.balls_faced || 0) + (isLegalBall ? 1 : 0),
      fours:        (batRow?.fours || 0) + (isFour ? 1 : 0),
      sixes:        (batRow?.sixes || 0) + (isSix  ? 1 : 0),
      isOut:        isWicket && dismissedPlayerId === batsmanId,
      dismissalType: isWicket ? wicketType : null,
      bowlerId:     isWicket ? bowlerId : null,
      fielderId:    isWicket ? fielderId : null,
    });

    // 5. Upsert bowling perf for bowler
    const existingBwlResult = await scoringModel.getBowlingScorecard(inningsId);
    const bwlRow = existingBwlResult.rows.find(r => r.player_id === bowlerId);
    const wicketCredited = isWicket && !['run_out', 'obstructing_field'].includes(wicketType);
    await scoringModel.upsertBowlingPerf({
      inningsId,
      playerId:     bowlerId,
      teamId:       innings.bowling_team_id,
      ballsBowled:  (bwlRow?.balls_bowled || 0) + (isLegalBall ? 1 : 0),
      runsConceded: (bwlRow?.runs_conceded || 0) + (runsOffBat || 0) + (['wide','noball'].includes(extrasType) ? extrasRuns || 1 : 0),
      wickets:      (bwlRow?.wickets || 0) + (wicketCredited ? 1 : 0),
      maidens:      bwlRow?.maidens || 0,
      wides:        (bwlRow?.wides || 0) + (extrasType === 'wide' ? 1 : 0),
      noBalls:      (bwlRow?.no_balls || 0) + (extrasType === 'noball' ? 1 : 0),
    });

    // 6. Emit socket event — handled by scoringSocket reading from req.app.get('io')
    const io = req.app.get('io');
    if (io) {
      const [updatedInnings] = await Promise.all([
        scoringModel.getInningsById(inningsId),
      ]);
      io.to(`match:${innings.match_id}`).emit('ball:update', {
        ball,
        innings: updatedInnings.rows[0],
      });
    }

    res.status(201).json({ ball, message: 'Ball recorded' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/scoring/innings/:inningsId/complete
const completeInnings = async (req, res, next) => {
  try {
    const { inningsId } = req.params;
    await scoringModel.updateInningsState(inningsId, { status: 'completed' });

    const inningsResult = await scoringModel.getInningsById(inningsId);
    const innings = inningsResult.rows[0];

    // Update career stats for all players in this innings
    const [batting, bowling] = await Promise.all([
      scoringModel.getBattingScorecard(inningsId),
      scoringModel.getBowlingScorecard(inningsId),
    ]);
    const playerIds = [
      ...batting.rows.map(r => r.player_id),
      ...bowling.rows.map(r => r.player_id),
    ];
    await Promise.all([...new Set(playerIds)].map(updateCareerStats));

    const io = req.app.get('io');
    if (io) {
      io.to(`match:${innings.match_id}`).emit('innings:complete', { inningsId });
    }

    res.json({ message: 'Innings completed', innings: innings });
  } catch (err) {
    next(err);
  }
};

// GET /api/scoring/:matchId/scorecard
const getScorecard = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const inningsResult = await scoringModel.getInnings(matchId);

    const scorecards = await Promise.all(
      inningsResult.rows.map(async (inn) => ({
        innings: inn,
        batting: (await scoringModel.getBattingScorecard(inn.id)).rows,
        bowling: (await scoringModel.getBowlingScorecard(inn.id)).rows,
        balls:   (await scoringModel.getBalls(inn.id)).rows,
      }))
    );

    res.json({ scorecards });
  } catch (err) {
    next(err);
  }
};

// GET /api/scoring/:matchId/innings
const getInnings = async (req, res, next) => {
  try {
    const result = await scoringModel.getInnings(req.params.matchId);
    res.json({ innings: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { startInnings, recordBall, completeInnings, getScorecard, getInnings };
