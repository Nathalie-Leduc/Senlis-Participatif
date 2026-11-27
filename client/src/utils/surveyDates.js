// ══════════════════════════════════════════════════════════
// Dates d'ouverture et de clôture d'une enquête (recette du 13/10)
//
// Un champ <input type="date"> donne « 2026-10-31 », sans heure.
// Envoyé tel quel, le serveur le lit comme « 31/10 à 00 h 00 (heure
// de Londres) » : une enquête « close le 31 » fermait donc… le 31 au
// matin, voire le 30 au soir. On précise l'heure côté navigateur,
// en heure de Senlis :
//  - clôture  : le jour choisi à 23 h 59 (on peut répondre toute la journée) ;
//  - ouverture : le jour choisi à 0 h 00.
//
// Analogie : « soldes jusqu'au 31 » veut dire jusqu'à la fermeture du
// magasin le 31, pas jusqu'à minuit la veille.
// ══════════════════════════════════════════════════════════

/** « 2026-10-31 » → Date locale, à l'heure donnée */
function localDate(day, hours, minutes, seconds, ms) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hours, minutes, seconds, ms);
}

/** Jour choisi → ISO, à 23:59:59.999 heure locale (fin de journée) */
export const endOfDayIso = (day) => localDate(day, 23, 59, 59, 999).toISOString();

/** Jour choisi → ISO, à 00:00 heure locale (début de journée) */
export const startOfDayIso = (day) => localDate(day, 0, 0, 0, 0).toISOString();

/**
 * Date ISO venant de l'API → valeur pour <input type="date">, en
 * heure LOCALE (iso.slice(0, 10) donnerait le jour de Londres).
 */
export function toDateInput(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Aujourd'hui, au format de <input type="date"> (pour l'attribut min) */
export const todayInput = () => toDateInput(new Date().toISOString());

/** La date est-elle déjà passée ? */
export const isPast = (iso) => Boolean(iso) && new Date(iso) < new Date();

/** « 31/10/2026 » */
export const formatDay = (iso) => new Date(iso).toLocaleDateString('fr-FR');
