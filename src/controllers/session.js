const router = require("express").Router();

router.get('/', (req, res) => {
  const { userToken } = req.cookies || {};
  console.log(userToken);
  try {
    if (!userToken) return res.status(401).json({ loggedIn: false });
    res.status(200).json({ loggedIn: true, userToken });
  } catch (error) {
    res.status(401).json({ loggedIn: false });
  }
});

module.exports = router;