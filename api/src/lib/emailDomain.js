// ══════════════════════════════════════════════════════════
// Le domaine d'une adresse email peut-il recevoir du courrier ? (S5R-02b)
//
// Complète la vérification du FORMAT (Zod) et la suggestion de faute
// de frappe (client) : on interroge le DNS, l'annuaire d'Internet,
// pour savoir si le domaine existe et accepte des emails.
//
// Analogie : avant d'envoyer une lettre, demander à La Poste s'il
// existe un bureau de distribution pour cette ville. Ça ne prouve PAS
// que la boîte aux lettres de la personne existe (seul l'email de
// vérification le prouve) — mais une ville qui n'existe pas, on peut
// le dire tout de suite.
//
// Principe : refuser seulement ce qui est CERTAIN, accepter dans le doute.
//  - MX (Mail eXchanger) : le serveur qui reçoit le courrier du domaine ;
//  - pas de MX → on essaie l'adresse principale du domaine (A puis
//    AAAA) : c'est le « MX implicite » prévu par la norme du courrier
//    (RFC 5321, §5.1) — un domaine sans MX peut recevoir des emails ;
//  - « null MX » (RFC 7505) : un seul MX vers « . » = le domaine
//    déclare explicitement refuser tout courrier → refusé ;
//  - panne DNS, délai dépassé → « on ne sait pas » → ACCEPTÉ. Le jour
//    où le réseau hésite, on ne bloque personne de bonne foi.
// ══════════════════════════════════════════════════════════

import { Resolver } from 'node:dns/promises';
import { domainToASCII } from 'node:url';

// Résolveur dédié : 2 s maximum, un seul essai — au-delà, on laisse passer
const resolver = new Resolver({ timeout: 2000, tries: 1 });

// Codes DNS qui PROUVENT l'absence (domaine inexistant, ou aucun
// enregistrement de ce type). Tous les autres codes (ETIMEOUT,
// ESERVFAIL, ECONNREFUSED…) veulent dire « je n'ai pas pu savoir ».
const DEFINITELY_ABSENT = new Set(['ENOTFOUND', 'ENODATA']);

// Petit cache en mémoire : « gmail.com » n'a pas besoin d'être
// revérifié à chaque inscription. 10 minutes, puis on redemande.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // domaine → { result, expiresAt }

/**
 * @param {string} email - adresse DÉJÀ validée par Zod (format correct)
 * @returns {Promise<'ok' | 'no-mail' | 'unknown'>}
 *   ok      : le domaine peut recevoir du courrier
 *   no-mail : certain que non → l'adresse doit être refusée
 *   unknown : impossible de savoir (panne, délai) → l'adresse est acceptée
 *
 * @example
 * await checkEmailDomain('nath@gmail.com')            // 'ok'
 * await checkEmailDomain('nath@domaine-invente.zzz')  // 'no-mail'
 */
export async function checkEmailDomain(email) {
  // « mairie-é.fr » → « xn--mairie--hya.fr » : la seule forme que le
  // DNS comprend (les accents sont convertis en « punycode »)
  const domain = domainToASCII(String(email).split('@').pop().toLowerCase());
  if (!domain) return 'no-mail';

  const cached = cache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = await resolveDomain(domain);
  // On ne garde en cache que les réponses CERTAINES : un « unknown »
  // (panne passagère) doit être retenté à la prochaine demande
  if (result !== 'unknown') cache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

async function resolveDomain(domain) {
  try {
    const mx = await resolver.resolveMx(domain);
    // « Null MX » : un unique MX dont le serveur est vide (« . »)
    if (mx.length === 1 && (mx[0].exchange === '' || mx[0].exchange === '.')) return 'no-mail';
    if (mx.length > 0) return 'ok';
  } catch (err) {
    if (!DEFINITELY_ABSENT.has(err.code)) return 'unknown';
    if (err.code === 'ENOTFOUND') return 'no-mail'; // le domaine n'existe pas du tout
    // ENODATA : le domaine existe mais n'a pas de MX → MX implicite
  }

  // MX implicite : l'adresse IPv4 (A), sinon IPv6 (AAAA), du domaine
  for (const resolve of [() => resolver.resolve4(domain), () => resolver.resolve6(domain)]) {
    try {
      const addresses = await resolve();
      if (addresses.length > 0) return 'ok';
    } catch (err) {
      if (!DEFINITELY_ABSENT.has(err.code)) return 'unknown';
    }
  }
  return 'no-mail';
}

/**
 * Lève une erreur 400 si le domaine ne peut CERTAINEMENT pas recevoir
 * de courrier. `details` reprend le format des erreurs Zod : le client
 * affiche ainsi le message sous le champ Email (S5R-02).
 */
export async function assertEmailDomainCanReceive(email) {
  if ((await checkEmailDomain(email)) === 'no-mail') {
    const message = 'Ce domaine ne peut pas recevoir d’emails — vérifiez l’adresse (après le @)';
    const error = new Error(message);
    error.status = 400;
    error.code = 'EMAIL_DOMAIN_INVALID';
    error.details = { email: message };
    throw error;
  }
}

/** Pour les tests uniquement : vider le cache. */
export function clearEmailDomainCache() {
  cache.clear();
}
