const router = require('express').Router();

const auth = require('../controllers/auth');
const logout = require('../controllers/logout');
const session = require('../controllers/session');
const account = require('../controllers/account');
const appList = require('../controllers/app-list');
const nhexaMenu = require('../controllers/menu-list');
const innerLogin = require('../controllers/login-inner');
const googlLogin = require('../controllers/login-google');
const innerSignup = require('../controllers/signup-inner');
const googleSignup = require('../controllers/signup-google');

router.use("/auth", auth);
router.use("/logout", logout);
router.use("/session", session);
router.use("/account", account);
router.use("/app-list", appList);
router.use("/menu-list", nhexaMenu);
router.use("/login-inner", innerLogin);
router.use("/login-google", googlLogin);
router.use("/signup-inner", innerSignup);
router.use("/signup-google", googleSignup);

module.exports = router;