const { google } = require("googleapis");
const { refreshToken, mediaClientId, mediaClientSecret } = require("../config");

const oauth2Client = new google.auth.OAuth2(
  mediaClientId,
  mediaClientSecret,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({ refresh_token: refreshToken });

async function refreshAccessToken() {
  try {
    const token = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials({ refresh_token: token.credentials.refresh_token });
    return token.credentials.refresh_token
  } catch (error) {
    console.error('Error al actualizar los tokens:', error);
  }
};

setInterval(() => {
  refreshAccessToken();
}, 5000 * 60);

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

const saveImageToDrive = async (imageBase64, folderId, filename) => {
  const fileMetadata = {
    name: filename,
    parents: [folderId],
  };

  const media = {
    mimeType: 'image/jpg',
    body: imageBase64,
  };

  try {
    const response = await drive.files.create(
      {
        resource: fileMetadata,
        media: media,
        fields: 'id',
      },
    );
    return response.data.id;
    
  } catch (error) {
    return error;
  };
};

module.exports = {
  saveImageToDrive
};