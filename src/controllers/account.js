const router = require("express").Router();
const { User } = require("../models/User");
const { message } = require("../messages");
const { decodeToken } = require("../integrations/jwt");
const bcrypt = require("bcrypt");

router.patch("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  const userToken = req.headers.authorization;
  if(!userToken) return res.status(403).json({ message: message.admin.permissionDenied });
  
  const decodedToken = await decodeToken(userToken);
  if(decodedToken.data.id !== id) return res.status(403).json({ message: message.admin.permissionDenied });
  
  try {
    const existingUser = await User.findByPk(id);
    if (!existingUser) return res.status(404).json({ message: message.admin.updateuser.failure });
    
    const salt = await bcrypt.genSalt();
    
    if(body?.password) body.password = await bcrypt.hash(body.password, salt);
        
    await User.update(body, { where: { id } });
    
    return res.status(200).json({ message: message.admin.updateuser.success });
  } catch (error) {
    return res.status(500).send({ error : message.admin.updateuser.error });
  }
});

module.exports = router;