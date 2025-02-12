const router = require('express').Router();
const { User } = require('../models/User');
const { decodeToken } = require('../integrations/jwt');
const { message } = require('../messages');

router.get("/", async(req, res) => {
  try {
    const userToken = req.headers.authorization;
    const decodedToken = await decodeToken(userToken);
    const user = await User.findByPk(decodedToken.data.id);
    
    if(!user) return res.status(404).send({ logged: false, message: message.user.notfound });
    
    const userData = {
      id: user.dataValues.id,
      username: user.dataValues.username,
      email: user.dataValues.email,
      isVerified: user.dataValues.isVerified,
      role: user.dataValues.role,
      profilePic: user.dataValues.profilePic || user.dataValues.googlePic
    }
    
    return res.status(200).send({ logged: true, userData });
    
  } catch (error) {
    return res.status(500).send({ error: message.user.error })
  }
});

module.exports = router;