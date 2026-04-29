const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/scoringController');

router.use(authenticate);

router.get('/:matchId/scorecard', ctrl.getScorecard);
router.get('/:matchId/innings', ctrl.getInnings);

router.post('/:matchId/innings',
  [
    body('battingTeamId').isUUID(),
    body('bowlingTeamId').isUUID(),
    body('inningsNumber').isInt({ min: 1, max: 4 }),
  ],
  validate,
  ctrl.startInnings
);

router.post('/innings/:inningsId/ball',
  [
    body('batsmanId').isUUID(),
    body('nonStrikerId').isUUID(),
    body('bowlerId').isUUID(),
    body('runsOffBat').isInt({ min: 0, max: 6 }),
    body('overNumber').isInt({ min: 0 }),
    body('ballNumber').isInt({ min: 1 }),
    body('deliveryNumber').isInt({ min: 1 }),
  ],
  validate,
  ctrl.recordBall
);

router.put('/innings/:inningsId/complete', ctrl.completeInnings);

module.exports = router;
