const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/matchController');

router.get('/upcoming', ctrl.getUpcoming);
router.get('/live', ctrl.getLive);

router.use(authenticate);

router.post('/',
  [
    body('team1Id').isUUID(),
    body('team2Id').isUUID(),
    body('overs').isInt({ min: 1, max: 100 }),
  ],
  validate,
  ctrl.createMatch
);

router.get('/my', ctrl.getMyMatches);
router.get('/team/:teamId', ctrl.getTeamMatches);
router.get('/:id', ctrl.getMatch);
router.get('/:id/players', ctrl.getMatchPlayers);

router.put('/:id/toss',
  [
    body('tossWinnerId').isUUID(),
    body('tossDecision').isIn(['bat', 'field']),
  ],
  validate,
  ctrl.setToss
);

router.put('/:matchId/availability',
  [body('availability').isIn(['yes', 'no', 'maybe'])],
  validate,
  ctrl.markAvailability
);

router.put('/:id/playing-xi',
  [
    body('teamId').isUUID(),
    body('playerIds').isArray({ max: 11 }),
  ],
  validate,
  ctrl.selectPlayingXI
);

module.exports = router;
