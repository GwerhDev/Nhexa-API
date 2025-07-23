const router = require("express").Router();
const { createToken } = require("../integrations/jwt");
const { message } = require("../messages");
const { prisma } = require("../integrations/prisma");
const bcrypt = require("bcrypt");
const { production } = require("../misc/consts");

router.post("/", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.users.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).send({ logged: false, message: message.login.failure });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const { id, role } = user;
      const data = { id, role };
      const token = await createToken(data, 24);

    if (process.env.NODE_ENV === production) {
      res.cookie("userToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        domain: ".nhexa.cl",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000
      });
    } else {
      res.cookie("userToken", token, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000
      });
    }

      return res.status(200).send({ logged: true, message: message.login.success, token });
    } else {
      return res.status(400).send({ logged: false, message: message.login.error });
    }
  } catch (error) {
    return res.status(400).send({ logged: false, message: message.login.error });
  }
});

module.exports = router;
