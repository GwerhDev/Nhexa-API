const express = require("express");
const router = express.Router();
const passport = require("passport");
const userSchema = require("../models/User");
const { signupGoogle } = require("../integrations/google");
const { createToken } = require("../integrations/jwt");
const { clientUrl, defaultPassword, defaultUsername, adminEmailList } = require("../config");
const { status, methods, roles } = require("../misc/consts-user-model");

passport.use('signup-google', signupGoogle);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

router.get('/', passport.authenticate('signup-google', { state: '200' }));

router.get('/callback', passport.authenticate('signup-google', {
  successRedirect: '/signup-google/success',
  failureRedirect: '/signup-google/failure'
}));

router.get('/failure', (req, res) => {
  return res.status(400).redirect(`${clientUrl}/register/failed`);
});

router.get('/success', async (req, res) => {
  try {
    const user = req.session.passport.user;
    const existingUser = await userSchema.findOne({ email: user.email }) || null;
    
    if (existingUser) {
      const tokenData = {
        _id: existingUser._id,
        role: existingUser.role,
      };
      const token = await createToken(tokenData, 3);
      return res.status(200).redirect(`${clientUrl}/auth/${token}`);
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
      role: roles.freemium,
      status: status.active,
    };

    if (adminEmailList?.includes(user.email)) userData.role = roles.admin;

    const userCreated = await userSchema.create(userData);

    const tokenData = {
      _id: userCreated._id,
      role: userCreated.role,
    };

    const token = await createToken(tokenData, 3);

    return res.status(200).redirect(`${clientUrl}/auth/${token}`);

  } catch (error) {
    return res.send(error);
  }
});

module.exports = router;