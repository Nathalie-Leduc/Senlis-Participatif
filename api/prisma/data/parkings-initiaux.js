// ══════════════════════════════════════════════════════════
// Parkings — données initiales (S5R2-05, lues le 14/10/2026)
//
// Deux documents de la Ville, qui se complètent :
//  - « Plan stationnement parking centre Senlis », septembre 2023 :
//    NOMS des parkings et nombre de PLACES (repère vert sur le plan) ;
//  - « Guide du stationnement en centre-ville » (Indigo / Ville de
//    Senlis, janvier 2025) : ZONES à jour (gratuit, zone rouge, zone
//    verte, gare…) et BORNES DE RECHARGE existantes ou en projet.
// Quand les deux diffèrent, le guide 2025 l'emporte (plus récent) ; la
// remarque le signale.
//
// Ce qui n'est PAS ici :
//  - les COORDONNÉES : un plan imprimé n'en donne pas. On place chaque
//    parking d'un clic sur la carte, dans l'écran d'administration
//    « Parkings » ; un parking non placé n'apparaît pas sur la carte
//    publique ;
//  - la vingtaine de petits parkings SANS NOM du plan 2023 (3 à 45
//    places) : on les ajoute depuis le même écran, si besoin.
//
// Inséré par le seed (seed.js en développement, seed-prod.js en
// production) SEULEMENT si la table est vide : une fois la liste
// modifiée par l'administration, le seed n'y touche plus jamais.
//
// Analogie : le premier remplissage d'un carnet d'adresses depuis deux
// vieux annuaires — ensuite, on le tient à jour à la main.
// ══════════════════════════════════════════════════════════

export const PARKINGS_SOURCE = 'Plan des parkings du centre-ville (Ville de Senlis, septembre 2023) et guide du stationnement (Ville de Senlis / Indigo, janvier 2025)';

/** @type {Array<{ name: string, places?: number, regime?: string, charging?: string, pmrPlaces?: number, note?: string }>} */
export const INITIAL_PARKINGS = [
  // ── Parkings publics gratuits ──────────────────────────
  { name: 'Parking du Tribunal', places: 93, regime: 'GRATUIT', charging: 'EN_PROJET', note: 'Borne de recharge en projet (guide 2025).' },
  { name: 'Parking du Stade', places: 92, regime: 'GRATUIT' },
  { name: 'Parking Saint-Pierre', places: 43, regime: 'GRATUIT' },
  { name: 'Parking Saint-Rieul', places: 98, regime: 'GRATUIT' },
  { name: 'Parking du Cerf (ancienne Gendarmerie)', places: 98, regime: 'GRATUIT' },
  { name: 'Parking des Arènes', places: 37, regime: 'GRATUIT' },
  { name: 'Parking du Heaume', places: 42, regime: 'GRATUIT' },
  { name: 'Parking de la Place du Chalet', places: 54, regime: 'GRATUIT', charging: 'EXISTANTE', note: 'Sans nom sur le plan 2023 ; « Place du Chalet » sur le guide 2025.' },
  { name: "Parking d'Ordener", places: 231, regime: 'GRATUIT', charging: 'EXISTANTE' },
  { name: 'Parking Saint-Lazare', places: 172, regime: 'GRATUIT' },
  { name: "Parking de l'Hôpital", places: 184, regime: 'GRATUIT' },

  // ── Zone verte (payant, longue durée) ─────────────────
  { name: 'Parking de la Sous-Préfecture', places: 21, regime: 'ZONE_VERTE' },
  { name: 'Parking des Bordeaux', places: 64, regime: 'ZONE_VERTE' },
  { name: 'Parking de la Poste', places: 17, regime: 'ZONE_VERTE' },
  { name: 'Parking du square des États-Unis', places: 35, regime: 'ZONE_VERTE', charging: 'EN_PROJET', note: 'Zone rouge sur le plan 2023, zone verte sur le guide 2025 ; borne de recharge en projet.' },

  // ── Durée limitée (disque obligatoire) ────────────────
  { name: 'Parking Thomas Couture', places: 25, regime: 'DUREE_LIMITEE', note: 'Disque : 2 h max, 9 h–12 h 30 et 14 h–18 h, du lundi au samedi. Jours de marché (mardi, vendredi) : libre jusqu’à 15 h, puis 2 h max de 15 h à 18 h. Libre les jours fériés et en août.' },
  { name: 'Avenue Foch (rond-point du Cerf – avenue Clemenceau)', places: 14, regime: 'DUREE_LIMITEE', note: 'Disque : 30 min max, 9 h–12 h 30 et 14 h–18 h, du lundi au samedi. Libre les jours fériés et en août.' },

  // ── Parcs à tarif propre ──────────────────────────────
  { name: 'Parking Brunehaut (ÉcoQuartier)', places: 150, regime: 'PARC_PAYANT', charging: 'EXISTANTE', note: '1re heure gratuite, puis tarif dégressif ; journée 8,50 €. Abonnements 24 h/24 : 60 €/mois, 170 €/trimestre, 600 €/an (tarifs 2023, à vérifier).' },
  { name: 'Parking de la Gare', regime: 'GARE', charging: 'EXISTANTE', note: 'Abonnement professionnel : 20 €/mois, 200 €/an. Ouvert aussi aux résidents ayant un droit en zone verte (guide 2025).' },
];

/**
 * Insère les parkings initiaux SEULEMENT si la table est vide.
 * @param {import('../../src/generated/prisma/index.js').PrismaClient} prisma
 * @returns {Promise<number>} le nombre de parkings créés (0 si la table en avait déjà)
 */
export async function seedInitialParkings(prisma) {
  const existing = await prisma.parking.count();
  if (existing > 0) {
    console.log(`ℹ️  ${existing} parking(s) déjà en base — aucun créé.`);
    return 0;
  }
  const { count } = await prisma.parking.createMany({ data: INITIAL_PARKINGS });
  console.log(`✅ ${count} parkings créés (plan 2023 + guide 2025) — à placer sur la carte depuis Administration › Parkings.`);
  return count;
}
