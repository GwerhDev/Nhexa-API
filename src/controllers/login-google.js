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
  console.log(req)
  const callback = req.query.callback;
  const state = callback;
  passport.authenticate('login-google', { state })(req, res, next);
});

router.get('/callback', passport.authenticate('login-google', {
  successRedirect: '/login-google/success',
  failureRedirect: '/login-google/failure'
}));

router.get('/success', async (req, res) => {
  const { userData, callback } = req.session.passport.user;

  try {
    const userExist = await userSchema.findOne({ email: userData.email });

    if (!userExist) return res.status(400).redirect(`${clientAccountsUrl}/account/not-found`);

    const { _id, role } = userExist || {};
    const data_login = { _id, role };
    const token = await createToken(data_login, 3);

    if (callback) return res.status(200).redirect(`${clientAccountsUrl}/auth?token=${token}&callback=${callback}`);

    return res.status(200).redirect(`${clientAccountsUrl}/auth?token=${token}`);

  } catch (error) {
    return res.status(400).redirect(`${clientAccountsUrl}/auth?token=none`);
  }
});

module.exports = router;