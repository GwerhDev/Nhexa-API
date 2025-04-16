const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const userSchema = require("../models/User");
const { clientAccountsUrl, privateSecret } = require("../config");
const { createToken } = require("../integrations/jwt");
const { loginGoogle } = require("../integrations/google");
const { production } = require("../misc/consts");

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
    const token = jwt.sign(userData, privateSecret, { expiresIn: '5m' });
    const nextUrl = callback || clientAccountsUrl;

    return res.redirect(`/login-google/success?token=${token}&next=${encodeURIComponent(nextUrl)}`);
  })(req, res, next);
});

router.get('/success', async (req, res) => {
  try {
    const token = req.query.token;
    const next = req.query.next || clientAccountsUrl;

    if (!token) {
      return res.redirect(`${clientAccountsUrl}/login/failed?status=403`);
    }

    const userData = jwt.verify(token, privateSecret);

    const userExist = await userSchema.findOne({ email: userData.email });
    if (!userExist) return res.status(400).redirect(`${clientAccountsUrl}/account/not-found`);

    const { _id, role } = userExist;
    const sessionToken = await createToken({ _id, role }, 3);

    if (process.env.NODE_ENV === production) {
      res.cookie("userToken", sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        domain: ".nhexa.cl",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000
      });
    } else {
      res.cookie("userToken", sessionToken, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000
      });
    }


    return res.redirect(next);

  } catch (error) {
    return res.status(500).redirect(`${clientAccountsUrl}/login/failed?status=500`);
  }
});

module.exports = router;
