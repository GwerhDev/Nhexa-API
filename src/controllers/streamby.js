const express = require('express');
const router = express.Router();
const { decodeToken } = require('../integrations/jwt');
const User = require('../models/User');

router.get('/auth', async (req, res) => {
  try {
    const token = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ logged: false });

    const decoded = await decodeToken(token);
    const user = await User.findById(decoded.data._id);
    if (!user) return res.status(404).json({ logged: false });

    return res.status(200).json({
      logged: true,
      role: user.role,
      userId: user._id,
      projects: user.projects,
      profilePic: user.profilePic || user.googlePic,
    });
  } catch (err) {
    return res.status(401).json({ logged: false, error: err.message });
  }
});

module.exports = router;
