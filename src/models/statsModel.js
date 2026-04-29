const db = require('../config/db');

const getCareerStats = (userId) =>
  db.query(
    `SELECT pcs.*,
       u.name, u.email, u.avatar_url
     FROM player_career_stats pcs
     JOIN users u ON u.id = pcs.user_id
     WHERE pcs.user_id = $1`,
    [userId]
  );

const getLeaderboard = (category = 'runs', limit = 20) => {
  const orderMap = {
    runs:    'pcs.total_runs DESC',
    wickets: 'pcs.wickets_taken DESC',
    sr:      '(pcs.total_runs::float / NULLIF(pcs.innings_batted,0)) DESC',
    economy: '(pcs.runs_conceded::float / NULLIF(pcs.balls_bowled/6.0,0)) ASC',
  };
  const order = orderMap[category] || orderMap.runs;
  return db.query(
    `SELECT u.id, u.name, u.avatar_url,
       pcs.matches_played, pcs.total_runs, pcs.highest_score,
       pcs.wickets_taken, pcs.balls_bowled, pcs.runs_conceded,
       pcs.innings_batted,
       CASE WHEN pcs.innings_batted > 0
         THEN ROUND(pcs.total_runs::numeric / NULLIF((pcs.innings_batted - pcs.not_outs),0), 2)
         ELSE 0
       END AS batting_average,
       CASE WHEN pcs.innings_batted > 0
         THEN ROUND((pcs.total_runs::numeric * 100) / NULLIF(
           (SELECT SUM(balls_faced) FROM batting_performances WHERE player_id = pcs.user_id), 0), 2)
         ELSE 0
       END AS strike_rate
     FROM player_career_stats pcs
     JOIN users u ON u.id = pcs.user_id
     WHERE pcs.matches_played > 0
     ORDER BY ${order}
     LIMIT $1`,
    [limit]
  );
};

const getTeamStats = (teamId) =>
  db.query(
    `SELECT u.id, u.name, u.avatar_url,
       COALESCE(SUM(bp.runs), 0)         AS runs,
       COALESCE(SUM(bp.balls_faced), 0)  AS balls_faced,
       COALESCE(SUM(bp.fours), 0)        AS fours,
       COALESCE(SUM(bp.sixes), 0)        AS sixes,
       COUNT(bp.id)                       AS innings,
       COALESCE(SUM(bwp.wickets), 0)     AS wickets,
       COALESCE(SUM(bwp.balls_bowled), 0) AS balls_bowled,
       COALESCE(SUM(bwp.runs_conceded), 0) AS runs_conceded
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     LEFT JOIN batting_performances bp  ON bp.player_id = u.id
     LEFT JOIN bowling_performances bwp ON bwp.player_id = u.id
     WHERE tm.team_id = $1
     GROUP BY u.id, u.name, u.avatar_url
     ORDER BY runs DESC`,
    [teamId]
  );

const getMatchStats = (matchId) =>
  db.query(
    `SELECT i.innings_number, i.batting_team_id, i.total_runs, i.total_wickets, i.total_overs,
       bt.name AS batting_team_name
     FROM innings i
     JOIN teams bt ON bt.id = i.batting_team_id
     WHERE i.match_id = $1
     ORDER BY i.innings_number`,
    [matchId]
  );

module.exports = { getCareerStats, getLeaderboard, getTeamStats, getMatchStats };
