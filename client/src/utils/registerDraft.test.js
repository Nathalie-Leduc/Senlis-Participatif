import { describe, it, expect, beforeEach } from 'vitest';
import { loadRegisterDraft, saveRegisterDraft, clearRegisterDraft } from './registerDraft.js';

describe('brouillon d’inscription', () => {
  beforeEach(() => sessionStorage.clear());

  it('conserve la saisie, mais JAMAIS les mots de passe ni la case de confirmation', () => {
    saveRegisterDraft({
      pseudo: 'nath', email: 'nath@exemple.fr', situation: 'CENTRE_RESIDENT',
      password: 'MotDePasse123!', passwordConfirm: 'MotDePasse123!', consent: true,
    });
    const draft = loadRegisterDraft();
    expect(draft).toMatchObject({ pseudo: 'nath', email: 'nath@exemple.fr', situation: 'CENTRE_RESIDENT' });
    expect(draft.password).toBeUndefined();
    expect(draft.passwordConfirm).toBeUndefined();
    expect(draft.consent).toBeUndefined();
    expect(sessionStorage.getItem('senlis:registerDraft')).not.toContain('MotDePasse');
  });

  it("s'efface après une inscription réussie", () => {
    saveRegisterDraft({ pseudo: 'nath' });
    clearRegisterDraft();
    expect(loadRegisterDraft()).toEqual({});
  });

  it('résiste à un contenu abîmé', () => {
    sessionStorage.setItem('senlis:registerDraft', '{pas du json');
    expect(loadRegisterDraft()).toEqual({});
  });
});
