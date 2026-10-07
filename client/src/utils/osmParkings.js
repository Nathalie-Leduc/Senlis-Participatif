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

/** Texte de l'infobulle : « Parking de la gare — 120 places, payant » */
export function parkingLabel(properties) {
  const details = [
    properties.capacity ? `${properties.capacity} places` : null,
    properties.fee === true ? 'payant' : (properties.fee === false ? 'gratuit' : null),
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

let promise = null;
/** Charge l'extraction (une fois par visite) ; null si elle n'existe pas encore */
export function loadParkings() {
  promise ??= fetch('/data/parkings-senlis.geojson')
    .then((res) => (res.ok ? res.json() : null))
    // En développement, Vite répond par la page d'accueil (HTML) pour un
    // fichier absent : res.json() échoue → pas de couche, sans erreur
    .catch(() => null);
  return promise;
}
