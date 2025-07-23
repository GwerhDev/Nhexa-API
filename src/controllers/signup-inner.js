const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { message } = require("../messages");
const { production } = require("../misc/consts");
const { roles, methods } = require("../misc/consts-user-model");
const { prisma } = require("../integrations/prisma");
const { createToken } = require("../integrations/jwt");

router.post('/', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) return res.status(400).send({ error: message.signup.error });

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) return res.status(409).send({ logged: false, message: message.signup.alreadyExists });

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const userDataToCreate = {
      username: userData.username ?? defaultUsername,
      password: hashedPassword,
      email: userData.email,
      profilePic: null,
      isVerified: true,
      method: methods.google,
      googleId: userData.googleId,
      googlePic: userData.photo ?? null,
      role: roles.user,
    };

    if (adminEmailList?.includes(userData.email)) userDataToCreate.role = roles.admin;
    await prisma.users.create({ data: userDataToCreate });

    return res.status(200).send({ logged: true, message: message.signup.success, token });

  } catch (error) {
    return res.status(400).send({ logged: false, error: message.signup.error });
  }
});

module.exports = router;
