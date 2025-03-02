const { appList } = require("../misc/app-list");

const router = require("express").Router();

router.get("/", async (req, res) => {
  res.status(200).send(appList);
});

module.exports = router;