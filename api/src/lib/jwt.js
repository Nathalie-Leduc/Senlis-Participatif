// ══════════════════════════════════════════════════════════
// JWT — génération et vérification des tokens d'accès
//
// Analogie : le JWT c'est un bracelet de festival. Quand tu
// t'inscris (register → login), on te donne un bracelet
// signé. À chaque entrée de zone VIP (route protégée), le
// vigile (middleware auth) vérifie le bracelet. Il n'a pas
// besoin de rappeler l'accueil : le bracelet porte toutes
// les infos (userId, role) et la signature prouve qu'il
// est authentique. C'est le "stateless" de JWT.
// ══════════════════════════════════════════════════════════

import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7h';

if (!SECRET) {
  throw new Error('JWT_SECRET manquant dans .env — impossible de signer les tokens');
}

/**
 * Crée un JWT contenant l'id et le rôle de l'utilisateur.
 * @param {{ id: string, role: string }} user
 * @returns {string} Token signé
 */
export function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

/**
 * Vérifie et décode un JWT.
 * @param {string} token
 * @returns {{ userId: string, role: string }} Payload décodé
 * @throws {Error} Si le token est invalide, expiré ou falsifié
 */
export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
