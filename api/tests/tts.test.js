// ══════════════════════════════════════════════════════════
// S5R2-07 — relais des voix naturelles Azure
//
// Azure n'est jamais appelé pour de vrai : `fetch` est remplacé par un
// faux qui renvoie un « MP3 » de quelques octets. On vérifie ce qui
// part (clé dans l'en-tête, SSML échappé, région) et ce qui revient
// (audio, cache, repli 503).
// ══════════════════════════════════════════════════════════

import {
  describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll,
} from 'vitest';
import request from 'supertest';
import { Buffer } from 'node:buffer';
import app from '../src/app.js';
import {
  resetTtsState, buildSsml, escapeXml, monthlyUsage, synthesize, TTS_MAX_LENGTH,
} from '../src/services/azureSpeech.js';
import { TTS_PER_MINUTE } from '../src/routes/tts.js';

const URL_TTS = '/api/v1/tts';
const FAKE_MP3 = Buffer.from('ID3-faux-mp3');

let fetchSpy;
beforeEach(() => {
  resetTtsState();
  process.env.AZURE_SPEECH_KEY = 'cle-de-test';
  process.env.AZURE_SPEECH_REGION = 'francecentral';
  delete process.env.AZURE_SPEECH_MONTHLY_CHARS;
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new globalThis.Response(FAKE_MP3, { status: 200 }));
});
afterEach(() => {
  fetchSpy.mockRestore();
  delete process.env.AZURE_SPEECH_KEY;
});

// En test, l'API ne fait confiance à aucun intermédiaire : l'en-tête
// X-Forwarded-For serait ignoré et toutes les requêtes viendraient de la
// même adresse. Ici, on lui fait confiance, pour donner à chaque requête
// sa propre « adresse IP » (sauf dans le test de la limite).
let previousTrustProxy;
beforeAll(() => {
  previousTrustProxy = app.get('trust proxy');
  app.set('trust proxy', 1);
});
afterAll(() => app.set('trust proxy', previousTrustProxy));

/** Chaque requête utilise sa propre adresse IP : la limite par minute ne déborde pas d'un test à l'autre */
let ip = 0;
const speak = (body) => request(app).post(URL_TTS).set('X-Forwarded-For', `10.0.0.${(ip += 1) % 250}`).send(body);

describe('GET /tts — disponibilité', () => {
  it('avec une clé : voix naturelles proposées', async () => {
    const res = await request(app).get(URL_TTS);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.voices.map((v) => v.id)).toContain('fr-FR-DeniseNeural');
  });

  it('sans clé : désactivé, aucune voix — le client prend les voix de l\'appareil', async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const res = await request(app).get(URL_TTS);
    expect(res.body).toMatchObject({ enabled: false, voices: [] });
  });

  it('ne divulgue jamais la clé', async () => {
    const res = await request(app).get(URL_TTS);
    expect(JSON.stringify(res.body)).not.toContain('cle-de-test');
  });
});

describe('POST /tts — synthèse', () => {
  it('renvoie le MP3 d\'Azure ; la clé part dans l\'en-tête, vers la région France Centre', async () => {
    const res = await speak({ text: 'Bienvenue sur Senlis Participatif', voice: 'fr-FR-HenriNeural', rate: 'lente' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(Buffer.from(res.body).equals(FAKE_MP3)).toBe(true);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://francecentral.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(options.headers['Ocp-Apim-Subscription-Key']).toBe('cle-de-test');
    expect(options.body).toContain('<voice name="fr-FR-HenriNeural">');
    expect(options.body).toContain('rate="-15%"');
  });

  it('un même texte n\'est demandé à Azure qu\'une fois (cache)', async () => {
    const first = await speak({ text: 'Les propositions' });
    const second = await speak({ text: '  Les    propositions ' }); // mêmes mots, autres espaces
    expect(first.headers['x-tts-cache']).toBe('MISS');
    expect(second.headers['x-tts-cache']).toBe('HIT');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('échappe le texte : une balise dans la page ne peut pas modifier le SSML', async () => {
    await speak({ text: 'Rue <de la> "République" & Cie' });
    const ssml = fetchSpy.mock.calls[0][1].body;
    expect(ssml).toContain('Rue &lt;de la&gt; &quot;République&quot; &amp; Cie');
    expect(escapeXml("l'école")).toBe('l&apos;école');
  });

  it('refuse un texte vide, trop long, ou une voix inconnue (400) — sans appeler Azure', async () => {
    expect((await speak({ text: '   ' })).status).toBe(400);
    expect((await speak({ text: 'a'.repeat(TTS_MAX_LENGTH + 1) })).status).toBe(400);
    expect((await speak({ text: 'Bonjour', voice: 'en-US-JennyNeural' })).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sans clé : 503 TTS_UNAVAILABLE (le client repasse sur les voix de l\'appareil)', async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const res = await speak({ text: 'Bonjour' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('TTS_UNAVAILABLE');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Azure refuse (quota, clé fausse) ou ne répond pas : 503, et le texte n\'est pas mis en cache', async () => {
    fetchSpy.mockResolvedValueOnce(new globalThis.Response('quota', { status: 429 }));
    expect((await speak({ text: 'Bonjour' })).status).toBe(503);
    fetchSpy.mockRejectedValueOnce(new Error('délai dépassé'));
    expect((await speak({ text: 'Bonjour' })).status).toBe(503);
    // Azure revenu : cette fois, ça passe
    expect((await speak({ text: 'Bonjour' })).status).toBe(200);
  });

  it('garde-fou mensuel : au-delà, plus aucun appel à Azure jusqu\'au mois suivant', async () => {
    const env = { AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_MONTHLY_CHARS: '20' };
    const november = new Date('2026-11-18T10:00:00Z');
    await synthesize({ text: 'Quinze caractères', voice: 'fr-FR-DeniseNeural', rate: 'normale' }, { env, now: november });
    expect(monthlyUsage(november)).toBe(17);
    await expect(synthesize({ text: 'Encore un texte', voice: 'fr-FR-DeniseNeural', rate: 'normale' }, { env, now: november }))
      .rejects.toMatchObject({ status: 503, code: 'TTS_UNAVAILABLE' });
    // Le 1er décembre, le compteur repart de zéro
    const december = new Date('2026-12-01T00:00:01Z');
    await expect(synthesize({ text: 'Encore un texte', voice: 'fr-FR-DeniseNeural', rate: 'normale' }, { env, now: december }))
      .resolves.toMatchObject({ cached: false });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it(`limite : ${TTS_PER_MINUTE} lectures par minute et par adresse IP`, async () => {
    const sameIp = () => request(app).post(URL_TTS).set('X-Forwarded-For', '10.9.9.9').send({ text: 'Accueil' });
    for (let i = 0; i < TTS_PER_MINUTE; i += 1) expect((await sameIp()).status).toBe(200);
    const blocked = await sameIp();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('le SSML : langue française, voix et vitesse choisies', () => {
    expect(buildSsml('Bonjour', 'fr-FR-DeniseNeural', 'rapide'))
      .toBe('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">'
        + '<voice name="fr-FR-DeniseNeural"><prosody rate="+12%">Bonjour</prosody></voice></speak>');
  });
});
