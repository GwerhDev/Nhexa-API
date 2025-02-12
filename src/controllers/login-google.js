const express = require("express");
const router = express.Router();
const passport = require("passport");
const { User } = require("../models/User");
const { clientUrl } = require("../config");
const { createToken } = require("../integrations/jwt");
const { loginGoogle } = require("../integrations/google");

passport.use('login-google', loginGoogle);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

router.get('/', passport.authenticate('login-google', { state: '200' }));

router.get('/callback', passport.authenticate('login-google', {
  successRedirect: '/login-google/success',
  failureRedirect: '/login-google/failure'
}));

router.get('/success', async (req, res) => {
  try {
    const user = req.session.passport.user;
    console.log(user);
    const userExist = await User.findOne({ where: { email: user.email }});

    if (userExist) {
      const { id, role } = userExist || {};
      const data_login = { id, role };
      const token = await createToken(data_login, 3);

      return res.status(200).redirect(`${clientUrl}/auth/${token}`);
    } else {
      return res.status(400).redirect(`${clientUrl}/account/not-found`);
    }
  } catch (error) {
    return res.status(400).redirect(`${clientUrl}/auth?token=none`);
  }
});

module.exports = router;