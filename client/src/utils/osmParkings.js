// ══════════════════════════════════════════════════════════
// Parkings réels de Senlis, depuis OpenStreetMap (S5R-11)
//
// Recette du 30/09 : « ajouter les vrais emplacements des parkings ».
// Ils remplacent les 3 points « d'exemple » inventés jusque-là.
//
// Les données viennent d'OpenStreetMap (contributeurs bénévoles,
// licence ODbL — crédit affiché sur la carte et dans les mentions
// légales). On en fait une EXTRACTION FIGÉE, enregistrée dans
// public/data/parkings-senlis.geojson par scripts/extract-parkings.mjs :
//  - aucune requête vers un service tiers quand un visiteur ouvre la
//    carte (son adresse IP ne part nulle part — même logique que les
//    polices auto-hébergées, S5A-03) ;
//  - la carte ne dépend pas de la disponibilité de ce service.
// À relancer de temps en temps (1 ou 2 fois par an suffit).
//
// Ce fichier contient les fonctions PURES (testées) ; le script ne
// fait que télécharger et appeler overpassToGeoJson().
// ══════════════════════════════════════════════════════════

// Parkings qu'un visiteur ne peut pas utiliser : on ne les affiche pas
const EXCLUDED_ACCESS = new Set(['private', 'no', 'residents', 'customers', 'permit']);

/**
 * Réponse de l'API Overpass (format JSON, « out center tags ») →
 * FeatureCollection GeoJSON de points.
 * Un parking dessiné comme une SURFACE (way/relation) est réduit à son
 * centre : sur une carte de ville, un repère suffit.
 */
export function overpassToGeoJson(overpass, extractedAt = new Date().toISOString()) {
  const features = [];
  for (const el of overpass.elements ?? []) {
    const tags = el.tags ?? {};
    if (tags.amenity !== 'parking' || EXCLUDED_ACCESS.has(tags.access)) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] }, // GeoJSON : longitude d'abord
      properties: {
        osmId: `${el.type}/${el.id}`,
        name: tags.name ?? null,
        capacity: tags.capacity ? Number(tags.capacity) || null : null,
        fee: tags.fee === 'yes' ? true : (tags.fee === 'no' ? false : null),
        kind: tags.parking ?? null, // surface, underground, multi-storey…
      },
    });
  }
  return {
    type: 'FeatureCollection',
    // Membres « étrangers » autorisés par la norme GeoJSON : la source
    // et la date voyagent avec les données
    source: '© contributeurs OpenStreetMap — licence ODbL',
    extractedAt,
    features,
  };
}

/** Texte de l'infobulle : « Parking de la gare — 120 places, payant » ;
 *  un renseignement inconnu le dit (au lieu de se taire) */
export function parkingLabel(properties) {
  const details = [
    properties.capacity ? `${properties.capacity} places` : 'places : non renseigné',
    properties.fee === true ? 'payant' : (properties.fee === false ? 'gratuit' : 'tarif : non renseigné'),
    properties.kind === 'underground' ? 'souterrain' : null,
  ].filter(Boolean);
  return `${properties.name ?? 'Parking'}${details.length ? ` — ${details.join(', ')}` : ''}`;
}

/** FeatureCollection → repères pour MapView ({ id, lat, lng, label }) */
export function parkingMarkers(collection) {
  return (collection?.features ?? []).map((f) => ({
    id: f.properties.osmId,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    label: parkingLabel(f.properties),
  }));
}

// ══ Compléments locaux (S5R-11 v2, retour du 07/10) ══════════
// Recette : « des noms, des nombres de places, des tarifs manquent — ce
// sont des infos que j'ai ». Deux façons de les ajouter :
//  1. À LA SOURCE, sur openstreetmap.org (recommandé : tout le monde en
//     profite, et la prochaine extraction les récupère) ;
//  2. ICI, dans public/data/parkings-complements.json, pour ce qui ne
//     doit pas (ou pas encore) aller dans OpenStreetMap — appliqué
//     PAR-DESSUS l'extraction, sans rien re-télécharger. Format :
//     {
//       "corrections": { "way/123456": { "name": "…", "capacity": 80, "fee": true } },
//       "ajouts": [ { "name": "…", "lat": 49.2, "lng": 2.58, "capacity": 20, "fee": false } ],
//       "masques": ["node/789"]
//     }
// Analogie : les annotations au crayon dans la marge d'un plan imprimé
// — le plan d'origine reste intact, et on peut le réimprimer.

/**
 * @param {object|null} collection - l'extraction OpenStreetMap
 * @param {object|null} complements - le contenu de parkings-complements.json
 */
export function applyComplements(collection, complements) {
  if (!collection && !complements?.ajouts?.length) return collection;
  const hidden = new Set(complements?.masques ?? []);
  const corrections = complements?.corrections ?? {};

  const features = (collection?.features ?? [])
    .filter((f) => !hidden.has(f.properties.osmId))
    .map((f) => {
      const fix = corrections[f.properties.osmId];
      // On ne reprend que les champs connus : une faute de frappe dans
      // le fichier (« capacite ») ne casse rien
      return fix
        ? { ...f, properties: { ...f.properties, ...pick(fix, ['name', 'capacity', 'fee', 'kind']) } }
        : f;
    });

  (complements?.ajouts ?? []).forEach((a, i) => {
    if (typeof a.lat !== 'number' || typeof a.lng !== 'number') return;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: { osmId: `ajout/${i + 1}`, name: a.name ?? null, capacity: a.capacity ?? null, fee: a.fee ?? null, kind: a.kind ?? null },
    });
  });

  return { ...(collection ?? { type: 'FeatureCollection', source: '' }), features };
}

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

const getJson = (url) => fetch(url)
  .then((res) => (res.ok ? res.json() : null))
  // En développement, Vite répond par la page d'accueil (HTML) pour un
  // fichier absent : res.json() échoue → null, sans erreur
  .catch(() => null);

let promise = null;
/** Charge l'extraction ET ses compléments (une fois par visite) ; null si rien */
export function loadParkings() {
  promise ??= Promise.all([
    getJson('/data/parkings-senlis.geojson'),
    getJson('/data/parkings-complements.json'),
  ]).then(([collection, complements]) => applyComplements(collection, complements));
  return promise;
}
