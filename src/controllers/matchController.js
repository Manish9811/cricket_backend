const matchModel = require('../models/matchModel');
const teamModel  = require('../models/teamModel');
const db = require('../config/db');

// POST /api/matches
const createMatch = async (req, res, next) => {
  try {
    const { title, matchType, overs, ballsPerOver, team1Id, team2Id, venue, scheduledAt, tournamentId } = req.body;

    // Verify requester is captain of at least one team
    const [r1, r2] = await Promise.all([
      teamModel.getMemberRole(team1Id, req.user.id),
      teamModel.getMemberRole(team2Id, req.user.id),
    ]);
    const isCaptain = r1.rows[0]?.role === 'captain' || r2.rows[0]?.role === 'captain';
    if (!isCaptain) {
      return res.status(403).json({ message: 'You must be captain of one of the teams' });
    }

    const result = await matchModel.create({
      title, matchType, overs: overs || 20, ballsPerOver: ballsPerOver || 6,
      team1Id, team2Id, venue, scheduledAt, tournamentId: tournamentId || null,
      createdBy: req.user.id,
    });

    // Auto-add all team members as match_players with availability=maybe
    const [t1Members, t2Members] = await Promise.all([
      teamModel.getMembers(team1Id),
      teamModel.getMembers(team2Id),
    ]);
    const matchId = result.rows[0].id;
    const allPlayers = [
      ...t1Members.rows.map(m => ({ ...m, teamId: team1Id })),
      ...t2Members.rows.map(m => ({ ...m, teamId: team2Id })),
    ];
    await Promise.all(allPlayers.map(p =>
      matchModel.upsertMatchPlayer({ matchId, teamId: p.teamId, userId: p.id, availability: 'maybe' })
    ));

    res.status(201).json({ match: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/matches/upcoming
const getUpcoming = async (req, res, next) => {
  try {
    const result = await matchModel.findUpcoming();
    res.json({ matches: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/matches/live
const getLive = async (req, res, next) => {
  try {
    const result = await matchModel.findLive();
    res.json({ matches: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/matches/my
const getMyMatches = async (req, res, next) => {
  try {
    const result = await matchModel.findByUser(req.user.id);
    res.json({ matches: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/matches/:id
const getMatch = async (req, res, next) => {
  try {
    const result = await matchModel.findById(req.params.id);
    if (!result.rows.length) return res.status(404).json({ message: 'Match not found' });
    res.json({ match: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/matches/:id/toss
const setToss = async (req, res, next) => {
  try {
    const { tossWinnerId, tossDecision } = req.body;
    const result = await matchModel.setToss(req.params.id, { tossWinnerId, tossDecision });
    res.json({ match: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/matches/:id/availability
const markAvailability = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { availability } = req.body; // 'yes' | 'no' | 'maybe'

    // Find which team this user belongs to for this match
    const matchResult = await matchModel.findById(matchId);
    const match = matchResult.rows[0];
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const [r1, r2] = await Promise.all([
      teamModel.getMemberRole(match.team1_id, req.user.id),
      teamModel.getMemberRole(match.team2_id, req.user.id),
    ]);
    const teamId = r1.rows.length ? match.team1_id : r2.rows.length ? match.team2_id : null;
    if (!teamId) return res.status(403).json({ message: 'You are not part of this match' });

    const result = await matchModel.upsertMatchPlayer({
      matchId, teamId, userId: req.user.id, availability,
    });
    res.json({ player: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/matches/:id/playing-xi
const selectPlayingXI = async (req, res, next) => {
  try {
    const { teamId, playerIds } = req.body;
    if (playerIds.length > 11) return res.status(400).json({ message: 'Maximum 11 players allowed' });

    const roleResult = await teamModel.getMemberRole(teamId, req.user.id);
    if (roleResult.rows[0]?.role !== 'captain') {
      return res.status(403).json({ message: 'Only captain can select playing XI' });
    }

    await matchModel.selectPlayingXI(req.params.id, teamId, playerIds);
    res.json({ message: 'Playing XI selected' });
  } catch (err) {
    next(err);
  }
};

// GET /api/matches/:id/players
const getMatchPlayers = async (req, res, next) => {
  try {
    const result = await matchModel.getMatchPlayers(req.params.id);
    res.json({ players: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/matches/team/:teamId
const getTeamMatches = async (req, res, next) => {
  try {
    const result = await matchModel.findByTeam(req.params.teamId);
    res.json({ matches: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { createMatch, getUpcoming, getLive, getMyMatches, getMatch, setToss, markAvailability, selectPlayingXI, getMatchPlayers, getTeamMatches };
