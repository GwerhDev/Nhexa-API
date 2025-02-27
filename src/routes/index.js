const router = require('express').Router();

const auth = require('../controllers/auth');
const account = require('../controllers/account');
const innerLogin = require('../controllers/login-inner');
const googlLogin = require('../controllers/login-google');
const innerSignup = require('../controllers/signup-inner');
const googleSignup = require('../controllers/signup-google');

router.use("/auth", auth);
router.use("/account", account);
router.use("/login-inner", innerLogin);
router.use("/login-google", googlLogin);
router.use("/signup-inner", innerSignup);
router.use("/signup-google", googleSignup);

module.exports =  router;