const { decodeToken } = require("../integrations/jwt");
const { appList } = require("../misc/app-list");
const { roles } = require("../misc/consts-user-model");

const router = require("express").Router();

router.get("/", async (req, res) => {
  const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
  if (!userToken) return res.status(200).send(appList.user);

  const decoded = await decodeToken(userToken) || null;
  const { role } = decoded.data || {};

  if (role === roles.admin) return res.status(200).send(appList.admin);
  return res.status(200).send(appList.user);
});

module.exports = router;