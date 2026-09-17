import { Router } from 'express';
import * as ctrl from '../controllers/usersController.js';
import { auth, isAdmin } from '../middlewares/auth.js';
import { validate, validateQuery } from '../middlewares/validate.js';
import { listUsersQuerySchema, updateUserRoleSchema } from '../validators/users.js';

const router = Router();

// 👑 GET   /admin/users      liste paginée, recherche par email/pseudo
// 👑 PATCH /admin/users/:id  changer le rôle (CITIZEN ↔ ADMIN)
router.get('/', auth, isAdmin, validateQuery(listUsersQuerySchema), ctrl.list);
router.patch('/:id', auth, isAdmin, validate(updateUserRoleSchema), ctrl.updateRole);

export default router;
