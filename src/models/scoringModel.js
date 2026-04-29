const db = require('../config/db');

// ── Innings ────────────────────────────────────────────────────
const createInnings = ({ matchId, battingTeamId, bowlingTeamId, inningsNumber, target }) =>
  db.query(
    `INSERT INTO innings (match_id, batting_team_id, bowling_team_id, innings_number, target, status)
     VALUES ($1,$2,$3,$4,$5,'in_progress')
     RETURNING *`,
    [matchId, battingTeamId, bowlingTeamId, inningsNumber, target || null]
  );

const getInnings = (matchId) =>
  db.query(
    `SELECT i.*, bt.name AS batting_team_name, bwt.name AS bowling_team_name
     FROM innings i
     JOIN teams bt  ON bt.id  = i.batting_team_id
     JOIN teams bwt ON bwt.id = i.bowling_team_id
     WHERE i.match_id = $1
     ORDER BY i.innings_number`,
    [matchId]
  );

const getInningsById = (id) =>
  db.query('SELECT * FROM innings WHERE id = $1', [id]);

const updateInningsState = (id, fields) => {
  // fields: { total_runs, total_wickets, total_overs, total_balls, extras,
  //           current_batsman1_id, current_batsman2_id, current_bowler_id, striker_id, status }
  const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = Object.values(fields);
  return db.query(`UPDATE innings SET ${sets} WHERE id = $1 RETURNING *`, [id, ...values]);
};

// ── Balls ──────────────────────────────────────────────────────
const recordBall = ({
  inningsId, overNumber, ballNumber, deliveryNumber,
  batsmanId, nonStrikerId, bowlerId,
  runsOffBat, extrasType, extrasRuns,
  isWicket, wicketType, dismissedPlayerId, fielderId,
  isFour, isSix, commentary,
}) =>
  db.query(
    `INSERT INTO balls
       (innings_id, over_number, ball_number, delivery_number,
        batsman_id, non_striker_id, bowler_id,
        runs_off_bat, extras_type, extras_runs,
        is_wicket, wicket_type, dismissed_player_id, fielder_id,
        is_four, is_six, commentary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      inningsId, overNumber, ballNumber, deliveryNumber,
      batsmanId, nonStrikerId, bowlerId,
      runsOffBat, extrasType || 'none', extrasRuns || 0,
      isWicket || false, wicketType || null, dismissedPlayerId || null, fielderId || null,
      isFour || false, isSix || false, commentary || null,
    ]
  );

const getBalls = (inningsId) =>
  db.query(
    `SELECT b.*,
       bat.name AS batsman_name, ns.name AS non_striker_name, bwl.name AS bowler_name,
       dp.name  AS dismissed_player_name, f.name AS fielder_name
     FROM balls b
     LEFT JOIN users bat ON bat.id = b.batsman_id
     LEFT JOIN users ns  ON ns.id  = b.non_striker_id
     LEFT JOIN users bwl ON bwl.id = b.bowler_id
     LEFT JOIN users dp  ON dp.id  = b.dismissed_player_id
     LEFT JOIN users f   ON f.id   = b.fielder_id
     WHERE b.innings_id = $1
     ORDER BY b.over_number, b.delivery_number`,
    [inningsId]
  );

const getOverBalls = (inningsId, overNumber) =>
  db.query(
    `SELECT * FROM balls
     WHERE innings_id = $1 AND over_number = $2
     ORDER BY delivery_number`,
    [inningsId, overNumber]
  );

// ── Batting Performances ───────────────────────────────────────
const upsertBattingPerf = ({
  inningsId, playerId, teamId, battingOrder,
  runs, ballsFaced, fours, sixes,
  isOut, dismissalType, bowlerId, fielderId,
}) =>
  db.query(
    `INSERT INTO batting_performances
       (innings_id, player_id, team_id, batting_order, runs, balls_faced, fours, sixes,
        is_out, dismissal_type, bowler_id, fielder_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (innings_id, player_id) DO UPDATE SET
       runs          = EXCLUDED.runs,
       balls_faced   = EXCLUDED.balls_faced,
       fours         = EXCLUDED.fours,
       sixes         = EXCLUDED.sixes,
       is_out        = EXCLUDED.is_out,
       dismissal_type= EXCLUDED.dismissal_type,
       bowler_id     = EXCLUDED.bowler_id,
       fielder_id    = EXCLUDED.fielder_id
     RETURNING *`,
    [inningsId, playerId, teamId, battingOrder, runs, ballsFaced, fours, sixes,
     isOut, dismissalType || null, bowlerId || null, fielderId || null]
  );

// ── Bowling Performances ───────────────────────────────────────
const upsertBowlingPerf = ({ inningsId, playerId, teamId, ballsBowled, runsConceded, wickets, maidens, wides, noBalls }) =>
  db.query(
    `INSERT INTO bowling_performances
       (innings_id, player_id, team_id, balls_bowled, runs_conceded, wickets, maidens, wides, no_balls)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (innings_id, player_id) DO UPDATE SET
       balls_bowled  = EXCLUDED.balls_bowled,
       runs_conceded = EXCLUDED.runs_conceded,
       wickets       = EXCLUDED.wickets,
       maidens       = EXCLUDED.maidens,
       wides         = EXCLUDED.wides,
       no_balls      = EXCLUDED.no_balls
     RETURNING *`,
    [inningsId, playerId, teamId, ballsBowled, runsConceded, wickets, maidens, wides, noBalls]
  );

// ── Full Scorecard ─────────────────────────────────────────────
const getBattingScorecard = (inningsId) =>
  db.query(
    `SELECT bp.*,
       u.name AS player_name, u.avatar_url,
       bwl.name AS bowler_name, f.name AS fielder_name
     FROM batting_performances bp
     JOIN users u   ON u.id   = bp.player_id
     LEFT JOIN users bwl ON bwl.id = bp.bowler_id
     LEFT JOIN users f   ON f.id   = bp.fielder_id
     WHERE bp.innings_id = $1
     ORDER BY bp.batting_order`,
    [inningsId]
  );

const getBowlingScorecard = (inningsId) =>
  db.query(
    `SELECT bwp.*, u.name AS player_name, u.avatar_url
     FROM bowling_performances bwp
     JOIN users u ON u.id = bwp.player_id
     WHERE bwp.innings_id = $1
     ORDER BY bwp.balls_bowled DESC`,
    [inningsId]
  );

// ── Partnerships ───────────────────────────────────────────────
const upsertPartnership = ({ inningsId, batsman1Id, batsman2Id, wicketNumber, runs, balls }) =>
  db.query(
    `INSERT INTO partnerships (innings_id, batsman1_id, batsman2_id, wicket_number, runs, balls)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (innings_id, wicket_number)
     DO UPDATE SET runs = EXCLUDED.runs, balls = EXCLUDED.balls
     RETURNING *`,
    [inningsId, batsman1Id, batsman2Id, wicketNumber, runs, balls]
  );

module.exports = {
  createInnings, getInnings, getInningsById, updateInningsState,
  recordBall, getBalls, getOverBalls,
  upsertBattingPerf, upsertBowlingPerf,
  getBattingScorecard, getBowlingScorecard,
  upsertPartnership,
};
