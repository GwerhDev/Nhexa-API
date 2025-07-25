const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

const { supabase } = require("../integrations/supabase");
const { signupGoogle } = require("../integrations/google");
const { clientAccountsUrl, defaultPassword, defaultUsername, adminEmailList, privateSecret } = require("../config");
const { status, methods, roles } = require("../misc/consts-user-model");
const { createToken } = require("../integrations/jwt");
const { production } = require("../misc/consts");

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
    const { token } = req.query || {};
    if (!token) return res.redirect(`${clientAccountsUrl}/register/failed`);

    const { userData } = jwt.verify(token, privateSecret);

    const { data: existingUser, error: existingUserError } = await supabase.from('users').select('*').eq('email', userData.email).single();

    if (existingUser) return res.redirect(`${clientAccountsUrl}/account/already-exists`);

    const userDataToCreate = {
      username: userData.username ?? defaultUsername,
      password: defaultPassword,
      email: userData.email,
      profilePic: null,
      isVerified: true,
      method: methods.google,
      googleId: userData.googleId,
      googlePic: userData.photo ?? null,
      role: roles.user,
    };

    if (adminEmailList?.includes(userData.email)) userDataToCreate.role = roles.admin;
    const { error: createError } = await supabase.from('users').insert([userDataToCreate]);

    if (createError) throw createError;

    return res.redirect(`${clientAccountsUrl}/register/success`);

  } catch (error) {
    return res.status(500).redirect(`${clientAccountsUrl}/register/failed?status=500`);
  }
});

router.get('/failure', (req, res) => {
  return res.status(400).redirect(`${clientAccountsUrl}/register/failed?status=500`);
});

module.exports = router;
