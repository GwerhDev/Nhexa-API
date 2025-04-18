const router = require("express").Router();

router.get('/', (req, res) => {
  const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
  
  try {
    if (!userToken) return res.status(401).json({ loggedIn: false });
    res.status(200).json({ loggedIn: true, userToken });
  } catch (error) {
    res.status(401).json({ loggedIn: false });
  }
});

module.exports = router;