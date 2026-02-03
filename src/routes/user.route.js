const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const { validateSearch } = require('../middleware/validation.middleware');
const { searchUsers, getCallHistory, clearCallHistory } = require('../controllers/user.controller');

router.get('/search', auth, validateSearch, searchUsers);
router.get('/call-history', auth, getCallHistory);
router.delete('/call-history', auth, clearCallHistory);

module.exports = router;

