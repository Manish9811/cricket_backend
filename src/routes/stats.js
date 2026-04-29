const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/statsController');

router.get('/leaderboard', ctrl.getLeaderboard);
router.get('/match/:matchId', ctrl.getMatchStats);

router.use(authenticate);

router.get('/me', ctrl.getMyStats);
router.get('/player/:userId', ctrl.getPlayerStats);
router.get('/team/:teamId', ctrl.getTeamStats);

module.exports = router;
