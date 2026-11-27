// ══════════════════════════════════════════════════════════
// Routes — parkings gérés par l'administration (S5R2-05)
//
// Lecture : publique (carte) ; liste complète : toute l'équipe ;
// écriture : ADMIN seulement. Un parking n'est pas un brouillon : le
// rôle Admin-test (S5R2-11) le consulte, mais ne le modifie pas.
// ══════════════════════════════════════════════════════════

import { Router } from 'express';
import * as ctrl from '../controllers/parkingsController.js';
import { auth, isAdmin, isStaff } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createParkingSchema, updateParkingSchema } from '../validators/parkings.js';

const router = Router();

router.get('/', ctrl.list);
// /admin AVANT /:id — sinon « admin » serait pris pour un identifiant
router.get('/admin', auth, isStaff, ctrl.listAdmin);
router.post('/', auth, isAdmin, validate(createParkingSchema), ctrl.create);
router.patch('/:id', auth, isAdmin, validate(updateParkingSchema), ctrl.update);
router.delete('/:id', auth, isAdmin, ctrl.remove);

export default router;
