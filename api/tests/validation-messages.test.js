// ══════════════════════════════════════════════════════════
// Tests — messages de validation EN FRANÇAIS (S5R2-08 partie 2)
//
// Pourquoi ce fichier ? En passant à Zod 4, les 402 tests de l'API
// sont restés verts… alors que plusieurs messages étaient devenus
// ANGLAIS (« Invalid input: expected string, received undefined »).
// Zod 4 ignore en silence les options de Zod 3 (`required_error`,
// `invalid_type_error`, `errorMap`) : aucun test ne lisait le texte.
//
// Ici, on lit le texte. La prochaine montée de version qui casse un
// message fera échouer ce test, au lieu d'arriver chez les citoyens.
//
// Analogie : on ne se contente plus de vérifier que la lettre part,
// on relit ce qui est écrit dessus.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { registerSchema } from '../src/validators/auth.js';
import { voteSchema, proposalStatsQuerySchema } from '../src/validators/proposals.js';
import { updateUserRoleSchema } from '../src/validators/users.js';
import { ttsSchema } from '../src/validators/tts.js';
import { createParkingSchema } from '../src/validators/parkings.js';
import { updateSurveySchema } from '../src/validators/surveys.js';

// Renvoie { champ: message } — la forme exacte que reçoit le formulaire
// (voir middlewares/validate.js)
function messages(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('Messages de validation en français (Zod 4)', () => {
  it('inscription vide : chaque champ a un message français', () => {
    expect(messages(registerSchema, {})).toEqual({
      email: 'Ce champ est obligatoire',
      password: 'Le mot de passe est requis',
      pseudo: 'Ce champ est obligatoire',
      situation: 'Merci de préciser votre situation',
    });
  });

  it('les messages personnalisés des listes de choix sont conservés', () => {
    expect(messages(voteSchema, { value: 'PEUT-ÊTRE' })).toEqual({ value: 'La valeur doit être POUR, CONTRE ou NEUTRE' });
    expect(messages(updateUserRoleSchema, { role: 'ROI' })).toEqual({ role: 'Rôle invalide' });
    expect(messages(proposalStatsQuerySchema, { segmentBy: 'age' })).toEqual({ segmentBy: 'Critère de segmentation inconnu' });
  });

  it('lecture à voix haute : texte absent', () => {
    expect(messages(ttsSchema, {})).toEqual({ text: 'Le texte à lire est requis' });
  });

  it('parkings : les messages précis ne se perdent plus dans « null ou nombre »', () => {
    expect(messages(createParkingSchema, {})).toEqual({ name: 'Le nom est obligatoire' });
    expect(messages(createParkingSchema, { name: 'Parking', places: 'beaucoup' }))
      .toEqual({ places: 'Nombre de places : un nombre est attendu' });
    expect(messages(createParkingSchema, { name: 'Parking', places: 3.5 }))
      .toEqual({ places: 'Nombre de places : un nombre entier est attendu' });
    expect(messages(createParkingSchema, { name: 'Parking', note: 'x'.repeat(301) }))
      .toEqual({ note: 'La remarque ne peut pas dépasser 300 caractères' });
  });

  it('« null » reste accepté là où il veut dire « effacer »', () => {
    const parking = createParkingSchema.parse({ name: 'Parking', places: null, regime: null, note: '', geometry: null });
    expect(parking).toMatchObject({ places: null, regime: null, note: null, geometry: null });
    // Et null ne devient PAS le 1er janvier 1970 (piège de z.coerce.date)
    expect(updateSurveySchema.parse({ closesAt: null }).closesAt).toBeNull();
  });

  it('une date illisible : « Date invalide »', () => {
    expect(messages(updateSurveySchema, { closesAt: 'demain' })).toEqual({ closesAt: 'Date invalide' });
  });
});
