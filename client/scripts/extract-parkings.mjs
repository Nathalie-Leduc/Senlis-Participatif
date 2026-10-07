// ══════════════════════════════════════════════════════════
// Extraction des parkings de Senlis depuis OpenStreetMap (S5R-11)
//
// Usage (depuis la racine du projet, avec une connexion Internet) :
//   node client/scripts/extract-parkings.mjs
// → écrit client/public/data/parkings-senlis.geojson, à commiter.
//
// Interroge l'API Overpass (lecture seule, gratuite, sans compte) :
// tous les objets amenity=parking situés dans la commune dont le code
// INSEE est 60612 (Senlis). À relancer 1 ou 2 fois par an.
// ══════════════════════════════════════════════════════════

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { overpassToGeoJson } from '../src/utils/osmParkings.js';

const QUERY = `
[out:json][timeout:60];
area["ref:INSEE"="60612"]["boundary"="administrative"]->.senlis;
(
  node["amenity"="parking"](area.senlis);
  way["amenity"="parking"](area.senlis);
  relation["amenity"="parking"](area.senlis);
);
out center tags;
`;

const OUTPUT = fileURLToPath(new URL('../public/data/parkings-senlis.geojson', import.meta.url));

const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  // Overpass demande d'identifier qui l'interroge (règles d'usage)
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SenlisParticipatif/1.0 (extraction ponctuelle)' },
  body: `data=${encodeURIComponent(QUERY)}`,
});
if (!response.ok) {
  console.error(`❌ Overpass a répondu ${response.status} — réessayez dans quelques minutes.`);
  process.exit(1);
}

const collection = overpassToGeoJson(await response.json());
await writeFile(OUTPUT, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`✅ ${collection.features.length} parkings écrits dans client/public/data/parkings-senlis.geojson`);
