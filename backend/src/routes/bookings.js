const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const c  = require('../controllers/bookingController');
const { auth, requireRole } = require('../middlewares/auth');

router.get('/mine',          auth, ah(c.mine));
router.get('/:id',           auth, ah(c.detail));
router.post('/',             auth, ah(c.create));
router.post('/:id/pay',      auth, ah(c.pay));
router.post('/:id/reschedule', auth, ah(c.reschedule));
router.post('/:id/cancel',   auth, ah(c.cancel));
router.post('/:id/confirm',  auth, requireRole('organiser','admin'), ah(c.organiserConfirm));

module.exports = router;
