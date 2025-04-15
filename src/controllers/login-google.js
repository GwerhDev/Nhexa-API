const express = require("express");
const router = express.Router();
const passport = require("passport");
const userSchema = require("../models/User");
const { clientAccountsUrl } = require("../config");
const { createToken } = require("../integrations/jwt");
const { loginGoogle } = require("../integrations/google");

passport.use('login-google', loginGoogle);

router.get('/', (req, res, next) => {
  const { callback } = req.query || {};
  const state = callback;
  passport.authenticate('login-google', { state })(req, res, next);
});

router.get('/callback', (req, res, next) => {
  passport.authenticate('login-google', (err, user, info) => {
    if (err || !user) {
      return res.redirect(`${clientAccountsUrl}/login/failed?status=401`);
    }

    req.logIn(user, (err) => {
      if (err) {
        return res.redirect(`${clientAccountsUrl}/login/failed?status=500`);
      }

      return res.redirect('/login-google/success');
    });
  })(req, res, next);
});

router.get('/failure', (req, res) => {
  return res.status(400).redirect(`${clientAccountsUrl}/login/failed?status=400`);
});

router.get('/success', async (req, res) => {
  const { user } = req.session.passport || {};
  const { userData, callback } = user || {};

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
      domain: ".nhexa.cl",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.redirect(callback || clientAccountsUrl);

  } catch (error) {
    return res.status(500).redirect(`${clientAccountsUrl}/login/failed?status=500`);
  }
});

module.exports = router;
