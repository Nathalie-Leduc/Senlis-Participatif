// ══════════════════════════════════════════════════════════
// Contrôleur — lecture par voix naturelle (S5R2-07)
//
//   GET  /tts         public : la voix naturelle est-elle disponible ? quelles voix ?
//   POST /tts         public : { text, voice, rate } → audio MP3
//
// Public : la lecture au survol sert aussi aux visiteurs non connectés
// (c'est même pour eux qu'elle existe). Les abus sont freinés par une
// limite par adresse IP (routes/tts.js), la longueur maximale du texte
// et le garde-fou mensuel (services/azureSpeech.js).
// ══════════════════════════════════════════════════════════

import { synthesize, ttsConfig, TTS_VOICES, TTS_RATES } from '../services/azureSpeech.js';

// ── GET /tts ──────────────────────────────────────────────
export function status(req, res) {
  const { enabled } = ttsConfig();
  res.json({
    enabled,
    // Sans clé configurée, aucune voix naturelle : le client propose
    // alors seulement les voix de l'appareil
    voices: enabled ? TTS_VOICES : [],
    rates: Object.keys(TTS_RATES),
  });
}

// ── POST /tts ─────────────────────────────────────────────
export async function speak(req, res, next) {
  try {
    const { audio, cached } = await synthesize(req.body);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      // Le navigateur peut garder l'audio : le même texte donne toujours
      // le même son. « private » : pas dans les caches partagés.
      'Cache-Control': 'private, max-age=86400',
      // Pour vérifier le cache dans l'onglet Réseau des outils de développement
      'X-TTS-Cache': cached ? 'HIT' : 'MISS',
    });
    res.send(audio);
  } catch (err) {
    next(err);
  }
}
