const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

const userSchema = require("../models/User");
const { signupGoogle } = require("../integrations/google");
const { clientAccountsUrl, defaultPassword, defaultUsername, adminEmailList, privateSecret } = require("../config");
const { status, methods, roles } = require("../misc/consts-user-model");
const { createToken } = require("../integrations/jwt");

passport.use('signup-google', signupGoogle);

router.get('/', (req, res, next) => {
  const { callback } = req.query || {};
  const state = callback;
  passport.authenticate('signup-google', { state })(req, res, next);
});

router.get('/callback', (req, res, next) => {
  passport.authenticate('signup-google', async (err, user, info) => {
    if (err || !user) {
      return res.redirect(`${clientAccountsUrl}/register/failed`);
    }

    const { userData, callback } = user;
    const token = jwt.sign({ userData, callback }, privateSecret, { expiresIn: '5m' });

    return res.redirect(`/signup-google/success?token=${token}`);
  })(req, res, next);
});

router.get('/success', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${clientAccountsUrl}/register/failed`);

    const { userData, callback } = jwt.verify(token, privateSecret);

    const existingUser = await userSchema.findOne({ email: userData.email });
    if (existingUser) {
      return res.redirect(`${clientAccountsUrl}/account/already-exists`);
    }

    const userDataToSave = {
      username: userData.username ?? defaultUsername,
      password: defaultPassword,
      email: userData.email,
      profilePic: null,
      isVerified: true,
      method: methods.google,
      googleId: userData.googleId,
      googlePic: userData.photo ?? null,
      role: roles.user,
      status: status.active,
    };

    if (adminEmailList?.includes(userData.email)) {
      userDataToSave.role = roles.admin;
    }

    const newUser = await userSchema.create(userDataToSave);

    const authToken = await createToken({ _id: newUser._id, role: newUser.role }, 3);

    res.cookie("userToken", authToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      domain: ".nhexa.cl",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.redirect(`${callback}/register/success`);

  } catch (error) {
    return res.status(500).redirect(`${clientAccountsUrl}/register/failed`);
  }
});

router.get('/failure', (req, res) => {
  return res.status(400).redirect(`${clientAccountsUrl}/register/failed`);
});

module.exports = router;
