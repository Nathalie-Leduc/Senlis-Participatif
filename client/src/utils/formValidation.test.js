// Tests — règles de saisie et suggestion d'email (S5R-02)
import { describe, it, expect } from 'vitest';
import {
  validateEmail, validatePseudo, validateNewPassword, validatePasswordConfirm, suggestEmail, levenshtein,
} from './formValidation.js';

describe('validateEmail', () => {
  it('accepte une adresse bien formée', () => {
    expect(validateEmail('nath@exemple.fr')).toBeNull();
    expect(validateEmail('  prenom.nom+senlis@ville-senlis.fr  ')).toBeNull();
  });

  it('refuse une saisie vide, sans @, sans domaine ou avec espace', () => {
    expect(validateEmail('')).toMatch(/Saisissez/);
    for (const bad of ['nath', 'nath@', 'nath@exemple', 'na th@exemple.fr', '@exemple.fr']) {
      expect(validateEmail(bad)).toMatch(/invalide/);
    }
  });
});

describe('autres règles (identiques à celles de l’API)', () => {
  it('pseudo : 2 à 30 caractères', () => {
    expect(validatePseudo('n')).toMatch(/2 caractères/);
    expect(validatePseudo('nath')).toBeNull();
    expect(validatePseudo('x'.repeat(31))).toMatch(/30 caractères/);
  });

  it('mot de passe : 12 caractères et 4 familles', () => {
    expect(validateNewPassword('Court1!')).toMatch(/12 caractères/);
    expect(validateNewPassword('toutenminuscules123!')).toMatch(/majuscule/);
    expect(validateNewPassword('MotDePasse123!')).toBeNull();
  });

  it('confirmation : vide ou différente', () => {
    expect(validatePasswordConfirm('', 'MotDePasse123!')).toMatch(/Retapez/);
    expect(validatePasswordConfirm('Autre', 'MotDePasse123!')).toMatch(/ne correspondent pas/);
    expect(validatePasswordConfirm('MotDePasse123!', 'MotDePasse123!')).toBeNull();
  });
});

describe('suggestEmail — fautes de frappe courantes', () => {
  it('propose une correction pour un fournisseur mal orthographié', () => {
    expect(suggestEmail('nath@gmial.com')).toBe('nath@gmail.com');
    expect(suggestEmail('nath@hotmial.fr')).toBe('nath@hotmail.fr');
    expect(suggestEmail('nath@orange.ff')).toBe('nath@orange.fr');
    expect(suggestEmail('Nath@GMAIL.CON')).toBe('nath@gmail.com');
  });

  it("ne propose rien pour une adresse correcte ou un domaine simplement inconnu", () => {
    expect(suggestEmail('nath@gmail.com')).toBeNull();
    expect(suggestEmail('contact@ville-senlis.fr')).toBeNull();
    expect(suggestEmail('nath')).toBeNull();
  });

  it('levenshtein compte les lettres à changer', () => {
    expect(levenshtein('gmial', 'gmail')).toBe(2);
    expect(levenshtein('free', 'free')).toBe(0);
  });
});
