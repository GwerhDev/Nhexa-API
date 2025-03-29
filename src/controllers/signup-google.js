const express = require("express");
const router = express.Router();
const passport = require("passport");
const userSchema = require("../models/User");
const { signupGoogle } = require("../integrations/google");
const { clientAccountsUrl, defaultPassword, defaultUsername, adminEmailList } = require("../config");
const { status, methods, roles } = require("../misc/consts-user-model");

passport.use('signup-google', signupGoogle);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

router.get('/', (req, res, next) => {
  const { callback } = req.query || {};
  const state = callback;
  passport.authenticate('signup-google', { state })(req, res, next);
});

router.get('/callback', passport.authenticate('signup-google', {
  successRedirect: '/signup-google/success',
  failureRedirect: '/signup-google/failure'
}));

router.get('/failure', (req, res) => {
  return res.status(400).redirect(`${clientAccountsUrl}/register/failed`);
});

router.get('/success', async (req, res) => {
  try {
    const { userData: user, callback } = req.session.passport.user;
    const existingUser = await userSchema.findOne({ email: user.email }) || null;

    if (existingUser) {
      return res.status(200).redirect(`${clientAccountsUrl}/account/already-exists`);
    }

    const userData = {
      username: user.username ?? defaultUsername,
      password: defaultPassword,
      email: user.email,
      profilePic: null,
      isVerified: true,
      method: methods.google,
      googleId: user.googleId,
      googlePic: user.photo ?? null,
      role: roles.user,
      status: status.active,
    };

    if (adminEmailList?.includes(user.email)) userData.role = roles.admin;
    await userSchema.create(userData);

    return res.status(200).redirect(`${callback}/register/success`);

  } catch (error) {
    return res.status(500).redirect(`${clientAccountsUrl}/register/failed`);
  }
});

module.exports = router;