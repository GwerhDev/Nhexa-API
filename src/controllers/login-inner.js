const router = require("express").Router();
const { createToken } = require("../integrations/jwt");
const { message } = require("../messages");
const userSchema = require("../models/User");
const bcrypt = require("bcrypt");

router.post("/", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userSchema.findOne({ email });

    if (!user) {
      return res.status(400).send({ logged: false, message: message.login.failure });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const { _id, role } = user;
      const data = { _id, role };
      const token = await createToken(data, 24);

      res.cookie("userToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        domain: ".nhexa.cl",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.status(200).send({ logged: true, message: message.login.success, token });
    } else {
      return res.status(400).send({ logged: false, message: message.login.error });
    }
  } catch (error) {
    return res.status(400).send({ logged: false, message: message.login.error });
  }
});

module.exports = router;
