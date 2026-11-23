// ══════════════════════════════════════════════════════════
// Synthèse vocale Azure AI Speech — relais côté serveur (S5R2-07)
//
// Le navigateur n'appelle JAMAIS Azure directement :
//
//   Navigateur ──(texte)──▶ API /api/v1/tts ──(clé secrète)──▶ Azure (France Centre)
//              ◀──(MP3)───                  ◀──(MP3)──────────
//
// Pourquoi un relais ?
//  - la CLÉ Azure reste dans les variables d'environnement du serveur :
//    dans le code du site, n'importe qui pourrait la lire et épuiser
//    le quota (ou s'en servir pour ses propres projets) ;
//  - un CACHE : un même texte (titres, boutons, menus) n'est synthétisé
//    qu'une fois, puis resservi sans rien demander à Azure ;
//  - un GARDE-FOU mensuel, sous le quota gratuit, pour basculer sur les
//    voix du navigateur avant qu'Azure ne refuse.
//
// Analogie : la standardiste d'une entreprise. Les visiteurs ne
// reçoivent jamais le numéro direct du fournisseur ; elle appelle pour
// eux, note les réponses déjà données (le cache) et surveille le
// forfait téléphonique (le garde-fou).
//
// Offre gratuite F0 : 0,5 million de caractères par mois. Elle ne peut
// PAS être facturée : au-delà, Azure refuse simplement (429), et le
// site repasse sur les voix du navigateur. Le garde-fou en mémoire
// (remis à zéro à chaque redémarrage) n'est donc qu'une précaution.
//
// RGPD : Microsoft est SOUS-TRAITANT (le texte lu lui est envoyé).
// D'où les règles côté client : contenu public seulement, jamais les
// pages de compte ou d'administration, jamais un champ de saisie
// (document 22, registre). Ici, le texte n'est jamais écrit dans les
// journaux.
// ══════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

// Les voix proposées (neuronales, français de France). Les identifiants
// sont ceux d'Azure ; les libellés sont ceux du module d'accessibilité.
export const TTS_VOICES = [
  { id: 'fr-FR-DeniseNeural', label: 'Denise (voix naturelle)' },
  { id: 'fr-FR-HenriNeural', label: 'Henri (voix naturelle)' },
];

// Les vitesses proposées → réglage SSML « prosody rate »
export const TTS_RATES = { lente: '-15%', normale: '-5%', rapide: '+12%' };

// Un texte lu au survol : un titre, un paragraphe, un bouton. Au-delà,
// le client découpe ou tronque (voir client/src/utils/hoverReading.js).
export const TTS_MAX_LENGTH = 600;

const DEFAULT_MONTHLY_CHARS = 450000; // marge sous les 500 000 gratuits
const CACHE_MAX_ENTRIES = 300;
const CACHE_MAX_BYTES = 30 * 1024 * 1024; // ~30 Mo de MP3
const TIMEOUT_MS = 8000;

/** La synthèse Azure est-elle configurée ? (sinon : voix du navigateur) */
export function ttsConfig(env = process.env) {
  const key = env.AZURE_SPEECH_KEY?.trim();
  return {
    enabled: Boolean(key),
    key,
    region: env.AZURE_SPEECH_REGION?.trim() || 'francecentral',
    monthlyChars: Number(env.AZURE_SPEECH_MONTHLY_CHARS) || DEFAULT_MONTHLY_CHARS,
  };
}

/** Échappe le texte pour l'insérer dans le XML (SSML) envoyé à Azure */
export function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Le document SSML : le « texte balisé » qu'Azure sait lire — quelle
 * voix, quelle vitesse, en quelle langue.
 */
export function buildSsml(text, voice, rate) {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">`
    + `<voice name="${voice}"><prosody rate="${TTS_RATES[rate]}">${escapeXml(text)}</prosody></voice></speak>`;
}

// ── Cache en mémoire (le plus ancien sort en premier) ─────
// Une Map garde l'ordre d'insertion : en relisant une entrée, on la
// remet à la fin ; quand c'est plein, on retire la première (la moins
// récemment servie). Analogie : la pile de journaux du café — on
// remet sur le dessus celui qu'on vient de lire, on jette celui du dessous.
const cache = new Map();
let cacheBytes = 0;

const cacheKey = (text, voice, rate) => createHash('sha256').update(`${voice}|${rate}|${text}`).digest('hex');

function cacheGet(key) {
  const audio = cache.get(key);
  if (audio) {
    cache.delete(key);
    cache.set(key, audio);
  }
  return audio;
}

function cacheSet(key, audio) {
  cache.set(key, audio);
  cacheBytes += audio.length;
  while (cache.size > CACHE_MAX_ENTRIES || cacheBytes > CACHE_MAX_BYTES) {
    const [oldestKey, oldest] = cache.entries().next().value;
    cache.delete(oldestKey);
    cacheBytes -= oldest.length;
  }
}

// ── Garde-fou mensuel ─────────────────────────────────────
const usage = { month: '', chars: 0 };
const currentMonth = (now) => now.toISOString().slice(0, 7); // « 2026-11 »

/** Caractères envoyés à Azure ce mois-ci (pour les tests et le journal) */
export function monthlyUsage(now = new Date()) {
  return usage.month === currentMonth(now) ? usage.chars : 0;
}

/** Pour les tests : repart d'un cache et d'un compteur vides */
export function resetTtsState() {
  cache.clear();
  cacheBytes = 0;
  usage.month = '';
  usage.chars = 0;
}

function unavailable(message) {
  const error = new Error(message);
  error.status = 503;
  error.code = 'TTS_UNAVAILABLE';
  // Erreur attendue : le client doit recevoir ce code pour basculer
  // sur les voix de l'appareil (voir middlewares/errorHandler.js)
  error.expose = true;
  return error;
}

/**
 * Le MP3 d'un texte : depuis le cache, sinon demandé à Azure.
 *
 * @returns {Promise<{ audio: Buffer, cached: boolean }>}
 * @throws {Error} 503 TTS_UNAVAILABLE — le client repasse alors sur
 *   les voix du navigateur (pas configuré, quota atteint, Azure en panne)
 */
export async function synthesize({ text, voice, rate }, { env = process.env, now = new Date() } = {}) {
  const key = cacheKey(text, voice, rate);
  const hit = cacheGet(key);
  if (hit) return { audio: hit, cached: true };

  const config = ttsConfig(env);
  if (!config.enabled) throw unavailable('La lecture par voix naturelle n\'est pas configurée sur ce serveur.');

  const month = currentMonth(now);
  if (usage.month !== month) {
    usage.month = month;
    usage.chars = 0;
  }
  if (usage.chars + text.length > config.monthlyChars) {
    throw unavailable('Le quota mensuel des voix naturelles est atteint : voix du navigateur jusqu\'au mois prochain.');
  }

  let res;
  try {
    res = await globalThis.fetch(`https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': 'application/ssml+xml',
        // MP3 mono 24 kHz, 48 kbit/s : ~6 Ko par seconde, bonne qualité de voix
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'senlis-participatif',
      },
      body: buildSsml(text, voice, rate),
      signal: globalThis.AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw unavailable('Le service de voix naturelles ne répond pas.');
  }

  if (!res.ok) {
    // Jamais le texte dans le journal : seulement le code d'Azure.
    // 401 = clé fausse ; 429 = quota ou trop de requêtes.
    console.warn(`[tts] Azure a répondu ${res.status}`);
    throw unavailable('Le service de voix naturelles est indisponible pour le moment.');
  }

  const audio = Buffer.from(await res.arrayBuffer());
  usage.chars += text.length;
  cacheSet(key, audio);
  return { audio, cached: false };
}
