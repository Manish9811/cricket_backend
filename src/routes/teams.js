const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/teamController');

router.use(authenticate); // all team routes require auth

router.post('/',
  [body('name').trim().notEmpty().withMessage('Team name required')],
  validate,
  ctrl.createTeam
);

router.get('/', ctrl.getMyTeams);
router.get('/search', ctrl.searchTeams);
router.get('/:id', ctrl.getTeam);

router.post('/:id/invite',
  [body('email').isEmail().normalizeEmail()],
  validate,
  ctrl.invitePlayer
);

router.post('/join',
  [body('token').notEmpty()],
  validate,
  ctrl.joinTeam
);

router.post('/join-code',
  [body('inviteCode').notEmpty()],
  validate,
  ctrl.joinByCode
);

router.delete('/:id/members/:userId', ctrl.removeMember);

router.put('/:id/members/:userId/role',
  [body('role').isIn(['captain', 'vice_captain', 'player'])],
  validate,
  ctrl.updateRole
);

module.exports = router;
