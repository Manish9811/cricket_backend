const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const create = ({ name, shortName, logoUrl, createdBy }) => {
  const inviteCode = uuidv4().replace(/-/g, '').substring(0, 12);
  return db.query(
    `INSERT INTO teams (name, short_name, logo_url, created_by, invite_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, shortName, logoUrl, createdBy, inviteCode]
  );
};

const findById = (id) =>
  db.query('SELECT * FROM teams WHERE id = $1', [id]);

const findByInviteCode = (code) =>
  db.query('SELECT * FROM teams WHERE invite_code = $1', [code]);

// All teams a user belongs to
const findByUser = (userId) =>
  db.query(
    `SELECT t.*, tm.role,
       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     WHERE tm.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );

const getMembers = (teamId) =>
  db.query(
    `SELECT u.id, u.name, u.email, u.avatar_url, tm.role, tm.jersey_number, tm.joined_at
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.role, u.name`,
    [teamId]
  );

const addMember = ({ teamId, userId, role = 'player' }) =>
  db.query(
    `INSERT INTO team_members (team_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (team_id, user_id) DO NOTHING
     RETURNING *`,
    [teamId, userId, role]
  );

const removeMember = (teamId, userId) =>
  db.query(
    'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );

const getMemberRole = (teamId, userId) =>
  db.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );

const updateMemberRole = (teamId, userId, role) =>
  db.query(
    'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3 RETURNING *',
    [role, teamId, userId]
  );

const createInvitation = ({ teamId, email, invitedBy, token, expiresAt }) =>
  db.query(
    `INSERT INTO team_invitations (team_id, email, invited_by, token, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [teamId, email, invitedBy, token, expiresAt]
  );

const findInvitationByToken = (token) =>
  db.query(
    `SELECT ti.*, t.name AS team_name, u.name AS inviter_name
     FROM team_invitations ti
     JOIN teams t ON t.id = ti.team_id
     JOIN users u ON u.id = ti.invited_by
     WHERE ti.token = $1`,
    [token]
  );

const updateInvitationStatus = (id, status) =>
  db.query('UPDATE team_invitations SET status = $1 WHERE id = $2', [status, id]);

module.exports = {
  create, findById, findByInviteCode, findByUser,
  getMembers, addMember, removeMember, getMemberRole, updateMemberRole,
  createInvitation, findInvitationByToken, updateInvitationStatus,
};
