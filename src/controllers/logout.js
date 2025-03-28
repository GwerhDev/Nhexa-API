const router = require("express").Router();

router.get("/", (req, res) => {
  res.clearCookie("userToken", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/"
  });

  res.status(200).json({ loggedOut: true });
});

module.exports = router;