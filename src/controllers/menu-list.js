const { laruinaMenu } = require("../misc/laruinarecords/list.js");
const { nhexaMenu } = require("../misc/nhexa/list.js");
const { terminalcoreMenu } = require("../misc/terminalcorelabs/list.js");

const router = require("express").Router();

router.get("/:app", async (req, res) => {
  const { app } = req.params || {};
  if (app === "nhexa") return res.status(200).send(nhexaMenu);
  if (app === "laruina") return res.status(200).send(laruinaMenu);
  if (app === "terminalcore") return res.status(200).send(terminalcoreMenu);
  
  else res.status(404).send("Not found");
});

module.exports = router;