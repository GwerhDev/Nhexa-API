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

    const { userData, callback } = user;
    const payload = encodeURIComponent(Buffer.from(JSON.stringify(userData)).toString('base64'));
    const nextUrl = callback || clientAccountsUrl;

    return res.redirect(`/login-google/success?data=${payload}&next=${encodeURIComponent(nextUrl)}`);
  })(req, res, next);
});

router.get('/success', async (req, res) => {
  try {
    const payload = req.query.data;
    const next = req.query.next || clientAccountsUrl;

    if (!payload) {
      return res.redirect(`${clientAccountsUrl}/login/failed?status=403`);
    }

    const userData = JSON.parse(Buffer.from(decodeURIComponent(payload), 'base64').toString());

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

    return res.redirect(next);

  } catch (error) {
    return res.status(500).redirect(`${clientAccountsUrl}/login/failed?status=500`);
  }
});

module.exports = router;
