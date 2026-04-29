const { v4: uuidv4 } = require('uuid');
const teamModel = require('../models/teamModel');
const userModel = require('../models/userModel');
const { sendTeamInvite } = require('../services/emailService');
const db = require('../config/db');

// POST /api/teams
const createTeam = async (req, res, next) => {
  try {
    const { name, shortName, logoUrl } = req.body;
    const result = await teamModel.create({ name, shortName, logoUrl, createdBy: req.user.id });
    const team = result.rows[0];

    // Auto-add creator as captain
    await teamModel.addMember({ teamId: team.id, userId: req.user.id, role: 'captain' });
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
};

// GET /api/teams  (all teams for logged-in user)
const getMyTeams = async (req, res, next) => {
  try {
    const result = await teamModel.findByUser(req.user.id);
    res.json({ teams: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/teams/:id
const getTeam = async (req, res, next) => {
  try {
    const [teamResult, membersResult] = await Promise.all([
      teamModel.findById(req.params.id),
      teamModel.getMembers(req.params.id),
    ]);
    if (!teamResult.rows.length) {
      return res.status(404).json({ message: 'Team not found' });
    }
    res.json({ team: teamResult.rows[0], members: membersResult.rows });
  } catch (err) {
    next(err);
  }
};

// POST /api/teams/:id/invite  — send email invite
const invitePlayer = async (req, res, next) => {
  try {
    const { email } = req.body;
    const teamId = req.params.id;

    const teamResult = await teamModel.findById(teamId);
    if (!teamResult.rows.length) return res.status(404).json({ message: 'Team not found' });

    // Only captain/vice_captain can invite
    const roleResult = await teamModel.getMemberRole(teamId, req.user.id);
    const role = roleResult.rows[0]?.role;
    if (!['captain', 'vice_captain'].includes(role)) {
      return res.status(403).json({ message: 'Only captain can invite players' });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await teamModel.createInvitation({ teamId, email, invitedBy: req.user.id, token, expiresAt });

    const inviterResult = await userModel.findById(req.user.id);
    await sendTeamInvite({
      toEmail: email,
      inviterName: inviterResult.rows[0].name,
      teamName: teamResult.rows[0].name,
      token,
    });

    res.json({ message: `Invitation sent to ${email}` });
  } catch (err) {
    next(err);
  }
};

// POST /api/teams/join  — join via invite token
const joinTeam = async (req, res, next) => {
  try {
    const { token } = req.body;

    const invResult = await teamModel.findInvitationByToken(token);
    const invite = invResult.rows[0];

    if (!invite) return res.status(404).json({ message: 'Invalid invite link' });
    if (invite.status !== 'pending') return res.status(400).json({ message: 'Invite already used or expired' });
    if (new Date(invite.expires_at) < new Date()) {
      await teamModel.updateInvitationStatus(invite.id, 'expired');
      return res.status(400).json({ message: 'Invite link has expired' });
    }

    await teamModel.addMember({ teamId: invite.team_id, userId: req.user.id, role: 'player' });
    await teamModel.updateInvitationStatus(invite.id, 'accepted');

    res.json({ message: `Joined ${invite.team_name} successfully` });
  } catch (err) {
    next(err);
  }
};

// POST /api/teams/join-code  — join via invite_code (shareable link)
const joinByCode = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    const teamResult = await teamModel.findByInviteCode(inviteCode);
    if (!teamResult.rows.length) return res.status(404).json({ message: 'Invalid team code' });

    const team = teamResult.rows[0];
    await teamModel.addMember({ teamId: team.id, userId: req.user.id, role: 'player' });
    res.json({ message: `Joined ${team.name}`, team });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/teams/:id/members/:userId
const removeMember = async (req, res, next) => {
  try {
    const { id: teamId, userId } = req.params;
    const roleResult = await teamModel.getMemberRole(teamId, req.user.id);
    if (roleResult.rows[0]?.role !== 'captain') {
      return res.status(403).json({ message: 'Only captain can remove members' });
    }
    await teamModel.removeMember(teamId, userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/teams/:id/members/:userId/role
const updateRole = async (req, res, next) => {
  try {
    const { id: teamId, userId } = req.params;
    const { role } = req.body;
    const callerRole = await teamModel.getMemberRole(teamId, req.user.id);
    if (callerRole.rows[0]?.role !== 'captain') {
      return res.status(403).json({ message: 'Only captain can change roles' });
    }
    const result = await teamModel.updateMemberRole(teamId, userId, role);
    res.json({ member: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/teams/search?q=
const searchTeams = async (req, res, next) => {
  try {
    const { q } = req.query;
    const result = await db.query(
      `SELECT id, name, short_name, logo_url,
         (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) AS member_count
       FROM teams
       WHERE name ILIKE $1 OR short_name ILIKE $1
       LIMIT 20`,
      [`%${q}%`]
    );
    res.json({ teams: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTeam, getMyTeams, getTeam, invitePlayer, joinTeam, joinByCode, removeMember, updateRole, searchTeams };
