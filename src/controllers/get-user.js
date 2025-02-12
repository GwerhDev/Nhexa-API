const router = require("express").Router();
const { User } = require("../models/User");
const { message } = require("../messages");

router.get("/", async (req, res) => {
  try {
    const response = await User.findAll();
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).send({ error : message.user.error });
  }
})

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const response = await User.findByPk(id);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).send({ error : message.user.error })
  }
})

module.exports = router;