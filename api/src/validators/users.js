import { z } from 'zod';

// Même forme que les autres listes admin paginées du projet.
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().min(1).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['CITIZEN', 'ADMIN'], {
    errorMap: () => ({ message: 'Rôle invalide' }),
  }),
});
