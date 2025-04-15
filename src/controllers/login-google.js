const express = require("express");
const router = express.Router();
const passport = require("passport");
const userSchema = require("../models/User");
const { clientAccountsUrl } = require("../config");
const { createToken } = require("../integrations/jwt");
const { loginGoogle } = require("../integrations/google");

passport.use('login-google', loginGoogle);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

router.get('/', (req, res, next) => {
  const { callback } = req.query || {};
  const state = callback;
  passport.authenticate('login-google', { state })(req, res, next);
});

router.get('/callback', passport.authenticate('login-google', {
  successRedirect: '/login-google/success',
  failureRedirect: '/login-google/failure'
}));

router.get('/failure', (req, res) => {
  return res.status(400).redirect(`${clientAccountsUrl}/login/failed`);
});

router.get('/success', async (req, res) => {
  const userSession = req.session.passport?.user;

  if (!userSession) {
    return res.status(401).redirect(`${clientAccountsUrl}/login/failed`);
  }

  const { userData, callback } = userSession;

  try {
    const userExist = await userSchema.findOne({ email: userData.email });
    if (!userExist) return res.status(400).redirect(`${clientAccountsUrl}/account/not-found`);

    const { _id, role } = userExist;
    const data_login = { _id, role };
    const token = await createToken(data_login, 3);

    res.cookie("userToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
      domain: '.nhexa.cl',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.redirect(callback || clientAccountsUrl);

  } catch (error) {
    return res.status(500).redirect(`${clientAccountsUrl}/login/failed`);
  }
});

module.exports = router;