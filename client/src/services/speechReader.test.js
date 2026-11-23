// Tests — lecteur vocal : Azure ou voix de l'appareil, repli, commandes (S5R2-07)
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { createSpeechReader } from './speechReader.js';

let synth;
let players;
let clock;
let fetchAudio;

function makeReader() {
  return createSpeechReader({
    fetchAudio,
    getSynth: () => synth,
    makeUtterance: (text) => ({ text }),
    makeAudio: (url) => {
      const player = { url, play: vi.fn(() => Promise.resolve()), pause: vi.fn() };
      players.push(player);
      return player;
    },
    createUrl: () => `blob:${players.length}`,
    revokeUrl: vi.fn(),
    now: () => clock,
  });
}

beforeEach(() => {
  synth = {
    speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    getVoices: () => [{ name: 'Google français', lang: 'fr-FR', voiceURI: 'google-fr' }],
  };
  players = [];
  clock = 0;
  fetchAudio = vi.fn(async () => new Blob(['mp3']));
});

describe('createSpeechReader', () => {
  it('voix de l\'appareil : la voix et la vitesse choisies', async () => {
    const reader = makeReader();
    await reader.speak('Bonjour', { voice: 'appareil:google-fr', rate: 'rapide' });
    const utterance = synth.speak.mock.calls[0][0];
    expect(utterance).toMatchObject({ text: 'Bonjour', lang: 'fr-FR', rate: 1.15 });
    expect(utterance.voice.name).toBe('Google français');
    expect(reader.status).toBe('speaking');
  });

  it('voix Azure : le MP3 de l\'API joué par un lecteur audio ; le même texte n\'est demandé qu\'une fois', async () => {
    const reader = makeReader();
    await reader.speak('Accueil', { voice: 'azure:fr-FR-DeniseNeural', rate: 'normale' });
    await reader.speak('Accueil', { voice: 'azure:fr-FR-DeniseNeural', rate: 'normale' });
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    expect(fetchAudio).toHaveBeenCalledWith('/tts', { text: 'Accueil', voice: 'fr-FR-DeniseNeural', rate: 'normale' });
    expect(players).toHaveLength(2);
    expect(players[1].play).toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('une réponse arrivée trop tard (la souris est déjà ailleurs) n\'est pas lue', async () => {
    let release;
    fetchAudio = vi.fn(() => new Promise((resolve) => { release = () => resolve(new Blob(['mp3'])); }));
    const reader = makeReader();
    const first = reader.speak('Ancien texte', { voice: 'azure:fr-FR-DeniseNeural' });
    reader.stop();
    release();
    await first;
    expect(players).toHaveLength(0);
    expect(reader.status).toBe('idle');
  });

  it('Azure indisponible : la voix de l\'appareil prend le relais, et Azure n\'est plus sollicité pendant 5 minutes', async () => {
    fetchAudio = vi.fn(async () => { throw { status: 503 }; });
    const reader = makeReader();
    await reader.speak('Un', { voice: 'azure:fr-FR-DeniseNeural' });
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(reader.notice).toMatch(/voix de cet appareil/);

    clock = 60 * 1000; // 1 minute plus tard
    await reader.speak('Deux', { voice: 'azure:fr-FR-DeniseNeural' });
    expect(fetchAudio).toHaveBeenCalledTimes(1);

    clock = 6 * 60 * 1000; // 6 minutes plus tard : on réessaie Azure
    fetchAudio.mockImplementation(async () => new Blob(['mp3']));
    await reader.speak('Trois', { voice: 'azure:fr-FR-DeniseNeural' });
    expect(fetchAudio).toHaveBeenCalledTimes(2);
    expect(reader.notice).toBeNull();
  });

  it('Pause / Reprendre / Arrêter, et l\'état annoncé aux abonnés', async () => {
    const reader = makeReader();
    const states = [];
    reader.subscribe(({ status }) => states.push(status));
    await reader.speak('Texte', { voice: 'azure:fr-FR-DeniseNeural' });
    reader.pause();
    expect(players[0].pause).toHaveBeenCalled();
    reader.resume();
    expect(players[0].play).toHaveBeenCalledTimes(2);
    reader.stop();
    expect(states).toEqual(['loading', 'speaking', 'paused', 'speaking', 'idle']);
  });

  it('Pause sans lecture en cours : sans effet', () => {
    const reader = makeReader();
    reader.pause();
    expect(synth.pause).not.toHaveBeenCalled();
    expect(reader.status).toBe('idle');
  });
});
