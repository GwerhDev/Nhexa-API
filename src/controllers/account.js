const router = require("express").Router();
const { message } = require("../messages");
const { decodeToken } = require("../integrations/jwt");
const bcrypt = require("bcrypt");
const { supabase } = require("../integrations/supabase");

router.get("/", async (req, res) => {
  try {
    const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')[1];
    if (!userToken) return res.status(401).send({ logged: false, message: message.user.unauthorized });

    const decodedToken = await decodeToken(userToken);
    const { data: user, error } = await supabase.from('users').select('*').eq('id', decodedToken.data?.id).single();

    if (error || !user) return res.status(404).send({ logged: false, message: message.user.notfound });

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      isVerified: user.isVerified,
      role: user.role,
      profilePic: user.profilePic || user.googlePic
    };

    return res.status(200).send({ logged: true, userData });

  } catch (error) {
    return res.status(500).send({ error: message.user.error })
  }
});

router.patch("/update/:id", async (req, res) => {
  const { body } = req;
  const { id } = req.params;
  const { userToken } = req.cookies || {};

  if (!userToken) return res.status(403).json({ message: message.admin.permissionDenied });

  try {
    const decodedToken = await decodeToken(userToken);
    const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', decodedToken.data?.id).single();

    if (userError || !user) return res.status(404).send({ logged: false, message: message.user.notfound });

    if (user.id !== id) return res.status(403).json({ message: message.admin.permissionDenied });

    const { data: existingUser, error: existingUserError } = await supabase.from('users').select('*').eq('id', id).single();
    if (existingUserError || !existingUser) return res.status(404).json({ message: message.admin.updateuser.failure });

    const salt = await bcrypt.genSalt();

    if (body?.password) body.password = await bcrypt.hash(body.password, salt);

    const { error: updateError } = await supabase.from('users').update(body).eq('id', id);

    if (updateError) throw updateError;

    return res.status(200).json({ message: message.admin.updateuser.success });
  } catch (error) {
    console.error(error); // For debugging
    return res.status(500).send({ error: message.admin.updateuser.error });
  }
});

module.exports = router;