const express = require("express");
const router = express.Router();
const userSchema = require("../models/User");
const bcrypt = require("bcrypt");
const { message } = require("../messages");
const { status, roles, methods } = require("../misc/consts-user-model");
const { createToken } = require("../integrations/jwt");

router.post('/', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) return res.status(400).send({ error: message.signup.error });

    const existingUser = await userSchema.findOne({ email: email });

    if (existingUser) {
      const tokenData = {
        _id: existingUser._id,
        role: existingUser.role,
      };
      const token = await createToken(tokenData, 3);
      return res.status(200).send({ token });
    };

    const userData = {
      username,
      password,
      email,
      profilePic: null,
      status: status.inactive,
      isVerified: false,
      method: methods.inner,
      role: roles.user,
      googleId: null,
      googlePic: null
    };

    const salt = await bcrypt.genSalt();
    userData.password = await bcrypt.hash(password, salt);

    const userCreated = await userSchema.create(userData);

    const tokenData = {
      _id: userCreated._id,
      role: userCreated.role,
    };
    const token = await createToken(tokenData, 3);

    return res.status(200).send({ msg: message.signup.success, token });

  } catch (error) {
    return res.status(400).send({ error: message.signup.error });
  };
});

module.exports = router;