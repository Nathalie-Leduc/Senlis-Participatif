// ══════════════════════════════════════════════════════════
// Validation — lecture par voix naturelle (S5R2-07)
// ══════════════════════════════════════════════════════════

import { z } from 'zod';
import { TTS_VOICES, TTS_RATES, TTS_MAX_LENGTH } from '../services/azureSpeech.js';

export const ttsSchema = z.object({
  // Espaces multiples réduits à un seul : « Bonjour   Senlis » et
  // « Bonjour Senlis » donnent le même audio, donc la même entrée de cache
  text: z.string({ required_error: 'Le texte à lire est requis' })
    .transform((t) => t.replace(/\s+/g, ' ').trim())
    .pipe(z.string()
      .min(1, 'Le texte à lire est vide')
      .max(TTS_MAX_LENGTH, `Texte trop long (${TTS_MAX_LENGTH} caractères au plus)`)),
  // Seulement les voix proposées : on n'envoie à Azure que ce qu'on a choisi
  voice: z.enum(TTS_VOICES.map((v) => v.id)).default(TTS_VOICES[0].id),
  rate: z.enum(Object.keys(TTS_RATES)).default('normale'),
});
