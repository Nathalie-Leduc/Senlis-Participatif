// ══════════════════════════════════════════════════════════
// Tests — sauvegarde automatique des saisies (S5R2-13)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDraft, loadDraft, clearDraft, clearAllDrafts, formatDraftDate, DRAFT_MAX_AGE_MS,
} from './draftStorage.js';

beforeEach(() => localStorage.clear());

describe('draftStorage', () => {
  it('enregistre puis relit un brouillon, avec sa date', () => {
    saveDraft('u1', 'survey-form:new', { title: 'Stationnement' });
    const draft = loadDraft('u1', 'survey-form:new');
    expect(draft.data).toEqual({ title: 'Stationnement' });
    expect(new Date(draft.savedAt).getTime()).not.toBeNaN();
  });

  it('un brouillon appartient à UN compte : un autre compte ne le voit pas', () => {
    saveDraft('u1', 'survey-form:new', { title: 'À moi' });
    expect(loadDraft('u2', 'survey-form:new')).toBeNull();
  });

  it('sans compte connecté, rien n’est enregistré', () => {
    saveDraft(undefined, 'survey-form:new', { title: 'x' });
    expect(localStorage.length).toBe(0);
  });

  it('au-delà de 7 jours, le brouillon est oublié — et effacé', () => {
    saveDraft('u1', 'survey-form:new', { title: 'Vieux' });
    const later = Date.now() + DRAFT_MAX_AGE_MS + 1000;
    expect(loadDraft('u1', 'survey-form:new', later)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('un contenu illisible est effacé sans erreur', () => {
    localStorage.setItem('senlis:draft:u1:survey-form:new', '{pas du json');
    expect(loadDraft('u1', 'survey-form:new')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('clearDraft efface un brouillon ; clearAllDrafts efface tous les brouillons, et seulement eux', () => {
    saveDraft('u1', 'a', 1);
    saveDraft('u1', 'b', 2);
    saveDraft('u2', 'a', 3);
    localStorage.setItem('senlis-a11y-settings', '{}');

    clearDraft('u1', 'a');
    expect(loadDraft('u1', 'a')).toBeNull();
    expect(loadDraft('u1', 'b')).not.toBeNull();

    clearAllDrafts();
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('senlis-a11y-settings')).toBe('{}');
  });

  it('formatDraftDate : « 12/10 à 09 h 05 »', () => {
    expect(formatDraftDate(new Date(2026, 9, 12, 9, 5).toISOString())).toBe('12/10 à 09 h 05');
  });
});
