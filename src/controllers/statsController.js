const statsModel = require('../models/statsModel');

// GET /api/stats/me
const getMyStats = async (req, res, next) => {
  try {
    const result = await statsModel.getCareerStats(req.user.id);
    res.json({ stats: result.rows[0] || null });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/player/:userId
const getPlayerStats = async (req, res, next) => {
  try {
    const result = await statsModel.getCareerStats(req.params.userId);
    res.json({ stats: result.rows[0] || null });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/leaderboard?category=runs|wickets|sr|economy&limit=20
const getLeaderboard = async (req, res, next) => {
  try {
    const { category = 'runs', limit = 20 } = req.query;
    const result = await statsModel.getLeaderboard(category, parseInt(limit));
    res.json({ leaderboard: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/team/:teamId
const getTeamStats = async (req, res, next) => {
  try {
    const result = await statsModel.getTeamStats(req.params.teamId);
    res.json({ stats: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/match/:matchId
const getMatchStats = async (req, res, next) => {
  try {
    const result = await statsModel.getMatchStats(req.params.matchId);
    res.json({ stats: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyStats, getPlayerStats, getLeaderboard, getTeamStats, getMatchStats };
