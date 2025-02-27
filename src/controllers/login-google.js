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
  const callbackUrl = req.query.callback || clientAccountsUrl;
  const state = callbackUrl;
  passport.authenticate('login-google', { state })(req, res, next);
});

router.get('/callback', passport.authenticate('login-google', {
  successRedirect: '/login-google/success',
  failureRedirect: '/login-google/failure'
}));

router.get('/success', async (req, res) => {
  try {
    const { userData, callbackUrl } = req.session.passport.user;
    const userExist = await userSchema.findOne({ email: userData.email });

    if (userExist) {
      const { _id, role } = userExist || {};
      const data_login = { _id, role };
      const token = await createToken(data_login, 3);

      const callback = decodeURIComponent(callbackUrl || clientAccountsUrl);

      return res.status(200).redirect(`${callback}/auth?token=${token}`);
    } else {
      return res.status(400).redirect(`${callback}/account/not-found`);
    }
  } catch (error) {
    return res.status(400).redirect(`${callback}/auth?token=none`);
  }
});

module.exports = router;