import { z } from 'zod';

export const LoginInnerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SignupInnerSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

export const AccountUpdateSchema = z
  .object({
    username: z.string().min(1).max(50).optional(),
    password: z.string().min(8).optional(),
    profilePic: z.string().url().nullable().optional(),
  })
  .strict();

export type LoginInnerInput = z.infer<typeof LoginInnerSchema>;
export type SignupInnerInput = z.infer<typeof SignupInnerSchema>;
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>;
