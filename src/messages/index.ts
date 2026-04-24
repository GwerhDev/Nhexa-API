interface Messages {
  admin: {
    permissionDenied: string;
    createmedia: { success: string; failure: string; error: string; titleAlreadyExists: string };
    updatemedia: { success: string; failure: string; error: string };
    deletemedia: { success: string; failure: string; error: string };
    createuser: { success: string; failure: string; error: string };
    updateuser: { success: string; failure: string; error: string };
    deleteuser: { success: string; failure: string; error: string };
  };
  login: {
    success: string;
    failure: string;
    existinguser: string;
    unverified: string;
    error: string;
  };
  signup: {
    success: string;
    failure: string;
    existinguser: string;
    alreadyExists: string;
    error: string;
  };
  session: {
    expired: string;
    error: string;
  };
  user: {
    error: string;
    existing: string;
    notfound: string;
    unauthorized: string;
  };
  media: {
    error: string;
    existing: string;
    notfound: string;
  };
}

export const message: Messages = {
  admin: {
    permissionDenied: 'Permission denied',
    createmedia: {
      success: 'Media created successfully',
      failure: 'Failed to creating media',
      error: 'Error creating media',
      titleAlreadyExists: 'Title already exists',
    },
    updatemedia: {
      success: 'Media updated successfully',
      failure: 'Media not found',
      error: 'Error updating media',
    },
    deletemedia: {
      success: 'Media deleted successfully',
      failure: 'Media not found',
      error: 'Error deleting media',
    },
    createuser: {
      success: 'User created successfully',
      failure: 'Failed to creating user',
      error: 'Error creating user',
    },
    updateuser: {
      success: 'User updated successfully',
      failure: 'User not found',
      error: 'Error updating user',
    },
    deleteuser: {
      success: 'User deleted successfully',
      failure: 'User not found',
      error: 'Error deleting user',
    },
  },
  login: {
    success: 'Login successfull',
    failure: 'Login failed',
    existinguser: 'User already exists',
    unverified: 'Account not verified',
    error: 'Error logging in',
  },
  signup: {
    success: 'Signup successfull',
    failure: 'Signup failed',
    existinguser: 'User already exists',
    alreadyExists: 'User already exists',
    error: 'Error signing up',
  },
  session: {
    expired: 'Session expired',
    error: 'Session error',
  },
  user: {
    error: 'Error',
    existing: 'User already exists',
    notfound: 'User not found',
    unauthorized: 'Unauthorized',
  },
  media: {
    error: 'Error',
    existing: 'Media already exists',
    notfound: 'Media not found',
  },
};
