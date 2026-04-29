const db = require('../config/db');

const create = ({ title, matchType, overs, team1Id, team2Id, venue, scheduledAt, createdBy, tournamentId }) =>
  db.query(
    `INSERT INTO matches (title, match_type, overs, team1_id, team2_id, venue, scheduled_at, created_by, tournament_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [title, matchType, overs, team1Id, team2Id, venue, scheduledAt, createdBy, tournamentId]
  );

const findById = (id) =>
  db.query(
    `SELECT m.*,
       t1.name AS team1_name, t1.short_name AS team1_short,
       t2.name AS team2_name, t2.short_name AS team2_short,
       u.name  AS created_by_name
     FROM matches m
     JOIN teams t1 ON t1.id = m.team1_id
     JOIN teams t2 ON t2.id = m.team2_id
     JOIN users u  ON u.id  = m.created_by
     WHERE m.id = $1`,
    [id]
  );

const findByTeam = (teamId, status) => {
  const statusClause = status ? 'AND m.status = $2' : '';
  const params = status ? [teamId, status] : [teamId];
  return db.query(
    `SELECT m.*,
       t1.name AS team1_name, t1.short_name AS team1_short,
       t2.name AS team2_name, t2.short_name AS team2_short
     FROM matches m
     JOIN teams t1 ON t1.id = m.team1_id
     JOIN teams t2 ON t2.id = m.team2_id
     WHERE (m.team1_id = $1 OR m.team2_id = $1) ${statusClause}
     ORDER BY m.scheduled_at DESC`,
    params
  );
};

const findByUser = (userId) =>
  db.query(
    `SELECT DISTINCT m.*,
       t1.name AS team1_name, t2.name AS team2_name
     FROM matches m
     JOIN teams t1 ON t1.id = m.team1_id
     JOIN teams t2 ON t2.id = m.team2_id
     JOIN team_members tm ON (tm.team_id = m.team1_id OR tm.team_id = m.team2_id)
     WHERE tm.user_id = $1
     ORDER BY m.scheduled_at DESC
     LIMIT 20`,
    [userId]
  );

const updateStatus = (id, status) =>
  db.query('UPDATE matches SET status = $1 WHERE id = $2 RETURNING *', [status, id]);

const setToss = (id, { tossWinnerId, tossDecision }) =>
  db.query(
    'UPDATE matches SET toss_winner_id = $1, toss_decision = $2 WHERE id = $3 RETURNING *',
    [tossWinnerId, tossDecision, id]
  );

const setResult = (id, { result, winningTeamId }) =>
  db.query(
    `UPDATE matches SET status = 'completed', result = $1, winning_team_id = $2
     WHERE id = $3 RETURNING *`,
    [result, winningTeamId, id]
  );

// Playing XI / availability
const upsertMatchPlayer = ({ matchId, teamId, userId, isPlaying, battingOrder, availability }) =>
  db.query(
    `INSERT INTO match_players (match_id, team_id, user_id, is_playing, batting_order, availability)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (match_id, user_id) DO UPDATE
       SET is_playing = EXCLUDED.is_playing,
           batting_order = EXCLUDED.batting_order,
           availability = EXCLUDED.availability
     RETURNING *`,
    [matchId, teamId, userId, isPlaying, battingOrder, availability]
  );

const getMatchPlayers = (matchId) =>
  db.query(
    `SELECT mp.*, u.name, u.avatar_url, t.name AS team_name
     FROM match_players mp
     JOIN users u ON u.id = mp.user_id
     JOIN teams t ON t.id = mp.team_id
     WHERE mp.match_id = $1
     ORDER BY mp.team_id, mp.batting_order`,
    [matchId]
  );

module.exports = {
  create, findById, findByTeam, findByUser,
  updateStatus, setToss, setResult,
  upsertMatchPlayer, getMatchPlayers,
};
