// ══════════════════════════════════════════════════════════
// Tests — validateEnv (S5-10)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { databaseUrl } from '../src/lib/databaseUrl.js';
import { validateEnv, assertValidEnv } from '../src/lib/validateEnv.js';

const VALID_DEV_ENV = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'un-secret-suffisamment-long-et-aleatoire',
  SMTP_HOST: 'sandbox.smtp.mailtrap.io',
  SMTP_USER: 'test',
  SMTP_PASS: 'test',
  CLIENT_URL: 'http://localhost:5173',
};

const VALID_PROD_ENV = {
  ...VALID_DEV_ENV,
  NODE_ENV: 'production',
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_USER: 'contact@senlis-participatif.fr',
  SMTP_PASS: 'une-vraie-cle-smtp-brevo',
  CLIENT_URL: 'https://senlis-participatif.fr',
};

describe('validateEnv — environnement de développement', () => {
  it('ne remonte aucune erreur pour une config de dev complète (Mailtrap/localhost acceptés)', () => {
    expect(validateEnv(VALID_DEV_ENV)).toEqual([]);
  });

  it('Mailtrap et localhost ne sont PAS des erreurs en dev (seulement en prod)', () => {
    const errors = validateEnv({ ...VALID_DEV_ENV, SMTP_HOST: 'sandbox.smtp.mailtrap.io', CLIENT_URL: 'http://localhost:5173' });
    expect(errors).toEqual([]);
  });
});

describe('validateEnv — variables toujours requises, dev comme prod', () => {
  it('signale DATABASE_URL manquant', () => {
    const { DATABASE_URL, ...rest } = VALID_DEV_ENV;
    expect(validateEnv(rest).some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('signale JWT_SECRET manquant', () => {
    const { JWT_SECRET, ...rest } = VALID_DEV_ENV;
    expect(validateEnv(rest).some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it("signale JWT_SECRET resté à sa valeur d'exemple", () => {
    const errors = validateEnv({ ...VALID_DEV_ENV, JWT_SECRET: 'REMPLACER_PAR_64_CARACTERES_ALEATOIRES' });
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });
});

describe('validateEnv — production uniquement (la bascule Brevo, S5-10)', () => {
  it('ne remonte aucune erreur pour une config de prod complète et correcte', () => {
    expect(validateEnv(VALID_PROD_ENV)).toEqual([]);
  });

  it('accepte POSTGRESQL_ADDON_URI à la place de DATABASE_URL (Clever Cloud, S5-22)', () => {
    const { DATABASE_URL, ...withoutUrl } = VALID_PROD_ENV;
    void DATABASE_URL;
    expect(validateEnv({ ...withoutUrl, POSTGRESQL_ADDON_URI: 'postgresql://u:p@h:5432/db' })).toEqual([]);
    expect(validateEnv(withoutUrl).some((e) => e.includes('DATABASE_URL manquant'))).toBe(true);
  });

  it('signale un JWT_SECRET trop court en production (OWASP A04)', () => {
    const errors = validateEnv({ ...VALID_PROD_ENV, JWT_SECRET: 'senlis2026' });
    expect(errors.some((e) => e.includes('JWT_SECRET trop court'))).toBe(true);
    // En dev, un secret court reste accepté (rien à protéger)
    expect(validateEnv({ ...VALID_DEV_ENV, JWT_SECRET: 'senlis2026' })).toEqual([]);
  });

  it('signale un SMTP manquant en production', () => {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS, ...rest } = VALID_PROD_ENV;
    expect(validateEnv(rest).some((e) => e.includes('SMTP'))).toBe(true);
  });

  it("signale explicitement un SMTP_HOST resté sur Mailtrap en production — l'oubli exact que ce ticket doit empêcher", () => {
    const errors = validateEnv({ ...VALID_PROD_ENV, SMTP_HOST: 'sandbox.smtp.mailtrap.io' });
    expect(errors.some((e) => e.includes('Mailtrap'))).toBe(true);
  });

  it('signale un CLIENT_URL resté sur localhost en production', () => {
    const errors = validateEnv({ ...VALID_PROD_ENV, CLIENT_URL: 'http://localhost:5173' });
    expect(errors.some((e) => e.includes('CLIENT_URL'))).toBe(true);
  });
});

describe('assertValidEnv', () => {
  it('ne lève rien pour une configuration valide', () => {
    expect(() => assertValidEnv(VALID_PROD_ENV)).not.toThrow();
  });

  it('lève une erreur listant TOUS les problèmes à la fois, pas un seul', () => {
    const { JWT_SECRET, ...incomplete } = VALID_PROD_ENV;
    try {
      assertValidEnv({ ...incomplete, SMTP_HOST: 'sandbox.smtp.mailtrap.io' });
      expect.fail('assertValidEnv aurait dû lever une erreur');
    } catch (err) {
      expect(err.message).toContain('JWT_SECRET');
      expect(err.message).toContain('Mailtrap');
    }
  });
});

describe('databaseUrl (S5-22)', () => {
  it('DATABASE_URL en priorité, sinon POSTGRESQL_ADDON_URI (Clever Cloud)', () => {
    expect(databaseUrl({ DATABASE_URL: 'a', POSTGRESQL_ADDON_URI: 'b' })).toBe('a');
    expect(databaseUrl({ POSTGRESQL_ADDON_URI: 'b' })).toBe('b');
    expect(databaseUrl({ DATABASE_URL: '', POSTGRESQL_ADDON_URI: 'b' })).toBe('b');
    expect(databaseUrl({})).toBeUndefined();
  });
});
