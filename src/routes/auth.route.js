const router = require('express').Router();
const { register, login } = require('../controllers/auth.controller.js');
const { validateAuth } = require('../middleware/validation.middleware');

router.post('/register', validateAuth, register);
router.post('/login', validateAuth, login);

module.exports = router;

