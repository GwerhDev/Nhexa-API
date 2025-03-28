const router = require("express").Router();

router.get('/', (req, res) => {
  console.log(req.cookies);
  const { userToken } = req.cookies || {};
  try {
    if (!userToken) return res.status(401).json({ loggedIn: false });
    res.json({ loggedIn: true, userToken });
  } catch (error) {
    res.status(401).json({ loggedIn: false });
  }
});

module.exports = router;