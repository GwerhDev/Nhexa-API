import type { UserStatus, UserRole, AuthMethod } from '../types';

export const status: Record<string, UserStatus> = {
  active: 'active',
  inactive: 'inactive',
};

export const roles: Record<string, UserRole> = {
  user: 'user',
  admin: 'admin',
  subscriptor: 'subscriptor',
};

export const methods: Record<string, AuthMethod> = {
  inner: 'inner',
  google: 'google',
  adminManagement: 'admin-management',
};
