const db = require('../config/db');

// Recalculates and upserts career stats for a player after every ball
const updateCareerStats = async (userId) => {
  // Aggregate from batting_performances and bowling_performances tables
  const battingAgg = await db.query(
    `SELECT
       COUNT(DISTINCT m.id)                                    AS matches_played,
       COUNT(bp.id)                                            AS innings_batted,
       COALESCE(SUM(bp.runs), 0)                               AS total_runs,
       COALESCE(MAX(bp.runs), 0)                               AS highest_score,
       COUNT(*) FILTER (WHERE NOT bp.is_out)                   AS not_outs,
       COALESCE(SUM(bp.fours), 0)                              AS fours,
       COALESCE(SUM(bp.sixes), 0)                              AS sixes,
       COUNT(*) FILTER (WHERE bp.runs >= 50 AND bp.runs < 100) AS fifties,
       COUNT(*) FILTER (WHERE bp.runs >= 100)                  AS hundreds
     FROM batting_performances bp
     JOIN innings i ON i.id = bp.innings_id
     JOIN matches m ON m.id = i.match_id
     WHERE bp.player_id = $1 AND m.status = 'completed'`,
    [userId]
  );

  const bowlingAgg = await db.query(
    `SELECT
       COUNT(DISTINCT bwp.innings_id) FILTER (WHERE bwp.balls_bowled > 0) AS innings_bowled,
       COALESCE(SUM(bwp.balls_bowled), 0)   AS balls_bowled,
       COALESCE(SUM(bwp.runs_conceded), 0)  AS runs_conceded,
       COALESCE(SUM(bwp.wickets), 0)        AS wickets_taken,
       COUNT(*) FILTER (WHERE bwp.wickets >= 5) AS five_wickets
     FROM bowling_performances bwp
     JOIN innings i ON i.id = bwp.innings_id
     JOIN matches m ON m.id = i.match_id
     WHERE bwp.player_id = $1 AND m.status = 'completed'`,
    [userId]
  );

  // Best bowling figures (most wickets, then least runs)
  const bestBowling = await db.query(
    `SELECT wickets, runs_conceded
     FROM bowling_performances
     WHERE player_id = $1
     ORDER BY wickets DESC, runs_conceded ASC
     LIMIT 1`,
    [userId]
  );

  const fieldingAgg = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE b.wicket_type = 'caught' AND b.fielder_id = $1)     AS catches,
       COUNT(*) FILTER (WHERE b.wicket_type = 'run_out' AND b.fielder_id = $1)    AS run_outs,
       COUNT(*) FILTER (WHERE b.wicket_type = 'stumped' AND b.fielder_id = $1)    AS stumpings
     FROM balls b`,
    [userId]
  );

  const batting  = battingAgg.rows[0];
  const bowling  = bowlingAgg.rows[0];
  const fielding = fieldingAgg.rows[0];
  const bb       = bestBowling.rows[0] || { wickets: 0, runs_conceded: 999 };

  await db.query(
    `INSERT INTO player_career_stats (
       user_id, matches_played, innings_batted, total_runs, highest_score,
       not_outs, fours, sixes, fifties, hundreds,
       innings_bowled, balls_bowled, runs_conceded, wickets_taken,
       best_bowling_wickets, best_bowling_runs, five_wickets,
       catches, run_outs, stumpings
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (user_id) DO UPDATE SET
       matches_played       = EXCLUDED.matches_played,
       innings_batted       = EXCLUDED.innings_batted,
       total_runs           = EXCLUDED.total_runs,
       highest_score        = EXCLUDED.highest_score,
       not_outs             = EXCLUDED.not_outs,
       fours                = EXCLUDED.fours,
       sixes                = EXCLUDED.sixes,
       fifties              = EXCLUDED.fifties,
       hundreds             = EXCLUDED.hundreds,
       innings_bowled       = EXCLUDED.innings_bowled,
       balls_bowled         = EXCLUDED.balls_bowled,
       runs_conceded        = EXCLUDED.runs_conceded,
       wickets_taken        = EXCLUDED.wickets_taken,
       best_bowling_wickets = EXCLUDED.best_bowling_wickets,
       best_bowling_runs    = EXCLUDED.best_bowling_runs,
       five_wickets         = EXCLUDED.five_wickets,
       catches              = EXCLUDED.catches,
       run_outs             = EXCLUDED.run_outs,
       stumpings            = EXCLUDED.stumpings`,
    [
      userId,
      batting.matches_played, batting.innings_batted, batting.total_runs,
      batting.highest_score, batting.not_outs, batting.fours, batting.sixes,
      batting.fifties, batting.hundreds,
      bowling.innings_bowled, bowling.balls_bowled, bowling.runs_conceded,
      bowling.wickets_taken, bb.wickets, bb.runs_conceded, bowling.five_wickets,
      fielding.catches, fielding.run_outs, fielding.stumpings,
    ]
  );
};

module.exports = { updateCareerStats };
