const { decodeToken } = require("./jwt");
const { createStreamByRouter } = require("streamby-core");
const { awsBucket, awsBucketRegion, awsAccessKey, awsSecretKey, mongodbString, supabaseString } = require("../config");
const { supabase } = require("./supabase");

const authProvider = async (req) => {
  const userToken = req.cookies['userToken'] || req.headers.authorization?.split(' ')?.[1];
  const decoded = await decodeToken(userToken);
  const { data: user, error } = await supabase.from('users').select('*').eq('id', decoded.data.id).single();

  if (error) throw new Error("User not found");

  const authObject = {
    role: user.role,
    userId: user.id,
    username: user.username,
    profilePic: user.profilePic || user.googlePic
  };

  return authObject;
};

module.exports = () => createStreamByRouter({
  authProvider,
  databases: [
    {
      id: 'mongo',
      type: 'nosql',
      connectionString: mongodbString,
    }, {
      id: 'supabase',
      type: 'sql',
      main: true,
      connectionString: supabaseString,
    }
  ],
  storageProviders: [
    {
      type: 's3',
      config: {
        bucket: awsBucket,
        region: awsBucketRegion,
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
      }
    }
  ],
});