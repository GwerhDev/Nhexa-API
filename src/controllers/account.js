const router = require("express").Router();
const { message } = require("../messages");
const { decodeToken } = require("../integrations/jwt");
const bcrypt = require("bcrypt");
const { prisma } = require("../integrations/prisma");

router.get("/", async (req, res) => {
  try {
    const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
    if (!userToken) return res.status(401).send({ logged: false, message: message.user.unauthorized });

    const decodedToken = await decodeToken(userToken);
    const user = await prisma.users.findUnique({ where: { id: decodedToken.data?.id } });

    if (!user) return res.status(404).send({ logged: false, message: message.user.notfound });

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      isVerified: user.isVerified,
      role: user.role,
      profilePic: user.profilePic || user.googlePic
    };

    return res.status(200).send({ logged: true, userData });

  } catch (error) {
    return res.status(500).send({ error: message.user.error })
  }
});

router.patch("/update/:id", async (req, res) => {
  const { body } = req;
  const { id } = req.params;
  const { userToken } = req.cookies || {};

  if (!userToken) return res.status(403).json({ message: message.admin.permissionDenied });

  const decodedToken = await decodeToken(userToken);
  const user = await prisma.users.findUnique({ where: { id: decodedToken.data?.id } });

  if (!user) return res.status(404).send({ logged: false, message: message.user.notfound });

  if (user.id !== id) return res.status(403).json({ message: message.admin.permissionDenied });

  try {
    const existingUser = await prisma.users.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ message: message.admin.updateuser.failure });

    const salt = await bcrypt.genSalt();

    if (body?.password) body.password = await bcrypt.hash(body.password, salt);

    await prisma.users.update({ where: { id }, data: body });

    return res.status(200).json({ message: message.admin.updateuser.success });
  } catch (error) {
    return res.status(500).send({ error: message.admin.updateuser.error });
  }
});

module.exports = router;