// ══════════════════════════════════════════════════════════
// Liste de blocage des mots de passe courants (S5R-13b)
//
//   cd api
//   node scripts/build-password-blocklist.mjs                    → télécharge les listes publiques
//   node scripts/build-password-blocklist.mjs --source a.txt b.txt → part de fichiers déjà téléchargés
//
// Ce que fait le script :
//  1. récupère deux listes publiques de mots de passe réellement
//     utilisés (projet SecLists, licence MIT) :
//       - les 100 000 plus courants publiés par le NCSC britannique
//         (issus de Have I Been Pwned) ;
//       - le « top 1 000 000 » Pwdb ;
//  2. ne garde que ceux qui font AU MOINS 15 caractères : les autres
//     sont déjà refusés par la longueur minimale, inutile de les
//     embarquer (on passe d'un million de lignes à quelques milliers) ;
//  3. les écrit en minuscules, triés, dans
//     src/lib/data/mots-de-passe-courants.txt.
//
// Analogie : la liste des faux billets connus que la banque donne aux
// caissiers. Inutile d'y mettre les billets de 5 € si la caisse
// n'accepte que les billets de 20 € et plus.
//
// À relancer une fois par an environ (document 21, § 8.5), puis
// commiter le fichier produit. Rien n'est téléchargé quand l'API
// tourne : la vérification se fait entièrement sur le serveur.
// ══════════════════════════════════════════════════════════

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { MIN_LENGTH, MAX_LENGTH, codePointLength } from '../src/lib/passwordPolicy.js';

const OUTPUT = fileURLToPath(new URL('../src/lib/data/mots-de-passe-courants.txt', import.meta.url));
const SECLISTS = 'https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials';
export const SOURCES = [
  `${SECLISTS}/100k-most-used-passwords-NCSC.txt`,
  `${SECLISTS}/Pwdb_top-1000000.txt`,
];

const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const localFiles = sourceIndex >= 0 ? args.slice(sourceIndex + 1) : [];

/** Le texte brut d'une liste (fichier local ou téléchargement) */
async function loadList(location) {
  if (!location.startsWith('https://')) return readFile(location, 'utf8');
  const res = await globalThis.fetch(location);
  if (!res.ok) throw new Error(`${location} a répondu ${res.status}`);
  return res.text();
}

/**
 * Les lignes à garder : longueur entre 15 et 128 caractères, et rien
 * d'illisible (certaines listes contiennent des octets mal encodés,
 * qui s'affichent « � » ou sont notés « $hex[…] » : ils ne peuvent
 * correspondre à aucune saisie).
 */
export function keepLongPasswords(text) {
  const kept = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.normalize('NFC').toLowerCase();
    const length = codePointLength(line);
    if (length < MIN_LENGTH || length > MAX_LENGTH) continue;
    if (line.includes('�') || /[\p{Cc}]/u.test(line)) continue;
    // « $hex[…] » : notation d'un outil de cassage pour les octets
    // illisibles, pas un vrai mot de passe tapé au clavier
    if (line.startsWith('$hex[')) continue;
    kept.add(line);
  }
  return kept;
}

async function main() {
  const locations = localFiles.length ? localFiles : SOURCES;
  const all = new Set();
  for (const location of locations) {
    console.log(`📥 ${location}`);
    for (const line of keepLongPasswords(await loadList(location))) all.add(line);
  }
  const sorted = [...all].sort();
  const header = [
    '# Mots de passe courants de 15 caractères et plus — S5R-13b',
    '# Source : projet SecLists (licence MIT, © Daniel Miessler), listes',
    '# « 100k-most-used-passwords-NCSC » et « Pwdb_top-1000000 ».',
    `# Généré le ${new Date().toLocaleDateString('fr-FR')} par scripts/build-password-blocklist.mjs — ne pas modifier à la main.`,
  ];
  await writeFile(OUTPUT, `${[...header, ...sorted].join('\n')}\n`);
  console.log(`✅ ${sorted.length} mots de passe écrits dans src/lib/data/mots-de-passe-courants.txt`);
}

// Lancé directement (pas importé par un test)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
  });
}
