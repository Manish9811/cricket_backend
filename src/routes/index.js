const router = require('express').Router();

router.use('/auth',    require('./auth'));
router.use('/teams',   require('./teams'));
router.use('/matches', require('./matches'));
router.use('/scoring', require('./scoring'));
router.use('/stats',   require('./stats'));

module.exports = router;
