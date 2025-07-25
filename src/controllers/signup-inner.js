const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { message } = require("../messages");
const { production } = require("../misc/consts");
const { roles, methods } = require("../misc/consts-user-model");
const { supabase } = require("../integrations/supabase");
const { createToken } = require("../integrations/jwt");

router.post('/', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) return res.status(400).send({ error: message.signup.error });

    const { data: existingUser, error: existingUserError } = await supabase.from('users').select('*').eq('email', email).single();
    if (existingUser) return res.status(409).send({ logged: false, message: message.signup.alreadyExists });

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const userDataToCreate = {
      username: username,
      password: hashedPassword,
      email: email,
      profilePic: null,
      isVerified: true,
      method: methods.inner,
      role: roles.user,
    };

    if (adminEmailList?.includes(email)) userDataToCreate.role = roles.admin;
    const { data: newUser, error: createError } = await supabase.from('users').insert([userDataToCreate]).select().single();

    if (createError) throw createError;

    const { id, role } = newUser;
    const token = await createToken({ id, role }, 24);

    return res.status(200).send({ logged: true, message: message.signup.success, token });

  } catch (error) {
    return res.status(400).send({ logged: false, error: message.signup.error });
  }
});

module.exports = router;
