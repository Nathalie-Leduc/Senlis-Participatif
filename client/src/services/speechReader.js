// ══════════════════════════════════════════════════════════
// Lecteur vocal — COMMENT lire (S5R2-07)
//
// Deux moteurs derrière une seule télécommande (speak, pause, resume,
// stop) :
//  - les voix NATURELLES (Azure, par le relais de l'API /tts) : un
//    fichier MP3 joué par un lecteur audio ;
//  - les voix de l'APPAREIL (SpeechSynthesis du navigateur), toujours
//    disponibles, gratuites, sans rien envoyer.
//
// Repli automatique : si Azure ne répond pas (quota du mois atteint,
// panne, limite par minute), la phrase est dite par la voix de l'appareil,
// et on ne redemande pas Azure pendant 5 minutes.
//
// Analogie : une chaîne hi-fi avec deux sources, le lecteur CD (Azure,
// plus beau son) et la radio (l'appareil, toujours là). Si le CD saute,
// on bascule sur la radio sans couper la musique.
//
// Le lecteur annonce son état (« idle », « loading », « speaking »,
// « paused ») à qui s'abonne : le module d'accessibilité active ou non
// ses boutons Pause / Reprendre selon cet état.
// ══════════════════════════════════════════════════════════

import { api } from './api.js';
import { frenchBrowserVoices } from '../utils/hoverReading.js';

// Vitesse : le serveur applique la sienne aux voix Azure ; pour les voix
// de l'appareil, c'est un facteur (1 = vitesse par défaut du navigateur)
export const RATES = { lente: 0.8, normale: 0.95, rapide: 1.15 };

export const AZURE_PREFIX = 'azure:';
export const DEVICE_PREFIX = 'appareil:';
const COOLDOWN_MS = 5 * 60 * 1000;
const AUDIO_CACHE_MAX = 60;

/**
 * @param {object} [deps] - remplaçables dans les tests
 */
export function createSpeechReader({
  fetchAudio = api.audio,
  // Fonctions plutôt que valeurs : les tests posent leurs faux
  // window.speechSynthesis APRÈS l'import de ce fichier
  getSynth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined),
  makeAudio = (url) => new window.Audio(url),
  makeUtterance = (text) => new window.SpeechSynthesisUtterance(text),
  createUrl = (blob) => URL.createObjectURL(blob),
  revokeUrl = (url) => URL.revokeObjectURL(url),
  now = () => Date.now(),
} = {}) {
  let status = 'idle';
  let notice = null; // ex. « voix naturelle indisponible »
  let audio = null; // lecteur audio en cours (voix Azure)
  let seq = 0; // numéro de la lecture en cours : une réponse arrivée trop tard est ignorée
  let azureBlockedUntil = 0;
  const audioCache = new Map(); // « voix|vitesse|texte » → adresse blob: du MP3
  const listeners = new Set();

  const emit = () => listeners.forEach((fn) => fn({ status, notice }));
  const setStatus = (next) => {
    status = next;
    emit();
  };

  function halt() {
    seq += 1;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio = null;
    }
    getSynth()?.cancel();
  }

  /** Voix de l'appareil : id « appareil:<voiceURI> », sinon la meilleure française */
  function speakWithDevice(text, voiceId, rate, id) {
    const synth = getSynth();
    if (!synth) {
      setStatus('idle');
      return;
    }
    const utterance = makeUtterance(text);
    utterance.lang = 'fr-FR';
    const voices = synth.getVoices?.() ?? [];
    const wanted = voiceId?.startsWith(DEVICE_PREFIX) ? voiceId.slice(DEVICE_PREFIX.length) : null;
    // lang='fr-FR' n'est qu'une indication : sans voix française choisie
    // explicitement, certains navigateurs prennent une voix anglaise, qui
    // ânonne le français lettre à lettre
    const voice = voices.find((v) => v.voiceURI === wanted) ?? frenchBrowserVoices(voices)[0];
    if (voice) utterance.voice = voice;
    utterance.rate = RATES[rate] ?? RATES.normale;
    utterance.onend = () => { if (id === seq) setStatus('idle'); };
    utterance.onerror = () => { if (id === seq) setStatus('idle'); };
    synth.speak(utterance);
    setStatus('speaking');
  }

  /** Voix Azure : le MP3 (en cache, sinon demandé à l'API), joué par un lecteur audio */
  async function speakWithAzure(text, voiceId, rate, id) {
    const voice = voiceId.slice(AZURE_PREFIX.length);
    const key = `${voice}|${rate}|${text}`;
    let url = audioCache.get(key);
    if (!url) {
      setStatus('loading');
      const blob = await fetchAudio('/tts', { text, voice, rate });
      url = createUrl(blob);
      audioCache.set(key, url);
      if (audioCache.size > AUDIO_CACHE_MAX) {
        const [oldestKey, oldestUrl] = audioCache.entries().next().value;
        audioCache.delete(oldestKey);
        revokeUrl(oldestUrl);
      }
    }
    if (id !== seq) return; // la souris est déjà ailleurs : on ne lit pas l'ancien texte

    const player = makeAudio(url);
    audio = player;
    player.onended = () => { if (id === seq) setStatus('idle'); };
    player.onerror = () => { if (id === seq) speakWithDevice(text, null, rate, id); };
    await player.play();
    if (id === seq) setStatus('speaking');
  }

  return {
    get status() { return status; },
    get notice() { return notice; },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Lit un texte (et interrompt la lecture en cours).
     * @param {{ voice?: string, rate?: 'lente'|'normale'|'rapide' }} options
     */
    async speak(text, { voice, rate = 'normale' } = {}) {
      halt();
      const id = seq;
      if (voice?.startsWith(AZURE_PREFIX) && now() >= azureBlockedUntil) {
        try {
          await speakWithAzure(text, voice, rate, id);
          if (notice) {
            notice = null;
            emit();
          }
          return;
        } catch {
          if (id !== seq) return;
          // Quota, panne, limite, lecture audio bloquée : la voix de
          // l'appareil prend le relais, et on laisse Azure tranquille 5 min
          azureBlockedUntil = now() + COOLDOWN_MS;
          notice = 'Voix naturelle indisponible pour le moment : lecture avec la voix de cet appareil.';
        }
      }
      speakWithDevice(text, voice, rate, id);
    },

    pause() {
      if (status !== 'speaking') return;
      if (audio) audio.pause();
      else getSynth()?.pause();
      setStatus('paused');
    },

    resume() {
      if (status !== 'paused') return;
      if (audio) audio.play();
      else getSynth()?.resume();
      setStatus('speaking');
    },

    stop() {
      halt();
      setStatus('idle');
    },
  };
}
