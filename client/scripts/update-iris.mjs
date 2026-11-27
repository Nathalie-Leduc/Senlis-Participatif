// ══════════════════════════════════════════════════════════
// Mise à jour des contours des quartiers (S5R-13)
//
//   cd client
//   node scripts/update-iris.mjs                        → télécharge les IRIS de l'IGN
//   node scripts/update-iris.mjs --source iris.geojson  → part d'un fichier déjà téléchargé
//   node scripts/update-iris.mjs --essai                → calcule et compare, sans rien écrire
//
// Ce que fait le script, dans l'ordre :
//  1. récupère les 7 IRIS de Senlis (code commune INSEE 60612) au
//     service cartographique de l'IGN (Géoplateforme, flux WFS « contours
//     IRIS », Licence Ouverte Etalab) ;
//  2. vérifie qu'il y a bien 7 quartiers, tous de Senlis, dont le
//     « Centre Ville » ;
//  3. redécoupe le « Centre Ville » en Centre historique et Quartier
//     Saint-Vincent avec la FORME de Saint-Vincent déjà en place dans
//     public/data/iris-senlis.geojson (rien à retracer) ;
//  4. affiche, quartier par quartier, l'écart de surface avec le fichier
//     actuel — pour repérer d'un coup d'œil un changement anormal ;
//  5. écrit le nouveau fichier (sauf --essai), à relire puis commiter.
//
// Analogie : remplacer le fond de carte sous un calque. Le calque (la
// limite de Saint-Vincent, validée en 2026) ne bouge pas ; seul le fond
// INSEE est mis à jour.
//
// Procédure complète : document 32 du dépôt de documentation.
// ══════════════════════════════════════════════════════════

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { splitWithShape, planarArea, CENTRE_IRIS } from '../src/utils/quartierSplit.js';

const FILE = fileURLToPath(new URL('../public/data/iris-senlis.geojson', import.meta.url));
const INSEE_SENLIS = '60612';
export const WFS_URL = 'https://data.geopf.fr/wfs/ows?service=WFS&version=2.0.0&request=GetFeature'
  + '&typeName=STATISTICALUNITS.IRIS:contours_iris&outputFormat=application/json&srsName=EPSG:4326'
  + `&CQL_FILTER=code_insee='${INSEE_SENLIS}'`;

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const sourcePath = sourceIndex >= 0 ? args[sourceIndex + 1] : null;
const dryRun = args.includes('--essai');

/** Le fichier IRIS tel que fourni par l'IGN (ou depuis --source) */
async function loadNewIris() {
  if (sourcePath) return JSON.parse(await readFile(sourcePath, 'utf8'));
  let res;
  try {
    res = await fetch(WFS_URL);
  } catch {
    // « fetch failed » ne dit rien : on traduit
    throw new Error("Impossible de joindre le service de l'IGN (data.geopf.fr) : vérifiez la connexion, ou téléchargez le fichier dans le navigateur (adresse dans le document 32) et relancez avec --source.");
  }
  if (!res.ok) throw new Error(`Le service de l'IGN a répondu ${res.status}. Réessayez plus tard, ou utilisez --source.`);
  return res.json();
}

/** Contrôles avant de toucher à quoi que ce soit */
function check(iris) {
  const features = iris?.features ?? [];
  const codes = features.map((f) => f.properties?.code_iris);
  if (features.length !== 7) throw new Error(`7 IRIS attendus pour Senlis, ${features.length} reçus : l'INSEE a peut-être changé le découpage — à examiner à la main.`);
  if (!codes.every((c) => String(c).startsWith(INSEE_SENLIS))) throw new Error('Des IRIS ne sont pas de Senlis (code commune 60612).');
  if (!codes.includes(CENTRE_IRIS)) throw new Error(`Le « Centre Ville » (${CENTRE_IRIS}) est absent : le découpage de l'INSEE a changé — à examiner à la main.`);
  if (features.some((f) => !f.geometry)) throw new Error('Des contours sont vides (géométrie absente).');
}

/** Surface de chaque quartier, en pourcentage de la commune */
function shares(file) {
  const areas = new Map();
  for (const f of file.features) {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    areas.set(f.properties.quartier ?? f.properties.nom_iris, planarArea(polygons));
  }
  const total = [...areas.values()].reduce((a, b) => a + b, 0);
  return new Map([...areas].map(([k, v]) => [k, (v / total) * 100]));
}

async function main() {
  const current = JSON.parse(await readFile(FILE, 'utf8'));
  const sv = current.features.find((f) => f.properties?.quartier === 'SAINT_VINCENT');
  if (!sv) throw new Error('Saint-Vincent est absent du fichier actuel : tracez-le d\'abord avec /admin/quartiers.');
  const shape = sv.geometry.type === 'Polygon' ? [sv.geometry.coordinates] : sv.geometry.coordinates;

  console.log(sourcePath ? `📂 Lecture de ${sourcePath}…` : '🌐 Téléchargement des IRIS de Senlis (IGN)…');
  const fresh = await loadNewIris();
  check(fresh);

  const date = new Date().toLocaleDateString('fr-FR');
  const { file, outsideShare } = splitWithShape(
    fresh, shape,
    `IRIS INSEE « Centre Ville » (contours IGN du ${date}) découpé d'après le plan municipal de 2018 (forme de Saint-Vincent reprise)`,
  );
  // Ce qui est propre à la réponse du service (horodatage, nombres) ne sert à rien
  const output = { type: 'FeatureCollection', features: file.features };

  // Comparaison avec le fichier actuel
  const before = shares(current);
  const after = shares(output);
  console.log('\nQuartier                 avant    après    écart');
  let biggest = 0;
  for (const [quartier, now] of after) {
    const old = before.get(quartier) ?? 0;
    biggest = Math.max(biggest, Math.abs(now - old));
    console.log(`${quartier.padEnd(24)} ${old.toFixed(2).padStart(6)} % ${now.toFixed(2).padStart(6)} % ${(now - old >= 0 ? '+' : '') + (now - old).toFixed(2)}`);
  }
  if (outsideShare > 0.01) console.log(`\nℹ️  ${(outsideShare * 100).toFixed(1)} % de la forme de Saint-Vincent déborde du nouveau centre (ignoré).`);
  if (biggest > 1) console.log('\n⚠️  Un quartier change de plus d\'un point de surface : vérifiez sur la carte avant de publier.');
  else console.log('\n✅ Changements minimes (moins d\'un point de surface par quartier).');

  if (dryRun) {
    console.log('\nEssai : aucun fichier écrit.');
    return;
  }
  await writeFile(FILE, `${JSON.stringify(output)}\n`);
  console.log('\n✅ public/data/iris-senlis.geojson mis à jour. Vérifiez la carte (npm run dev, /carte), puis commitez.');
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exitCode = 1;
});
