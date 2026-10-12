// ══════════════════════════════════════════════════════════
// Tests — modèles de proposition (S5R2-12)
// Un modèle qui produirait un texte refusé par l'API (trop court,
// trop long) serait un piège : on le vérifie ici, une fois pour toutes.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { PROPOSAL_TEMPLATES, CONTENT_SECTIONS, hasPlaceholders } from './proposalTemplates.js';

const filled = PROPOSAL_TEMPLATES.filter((t) => t.id !== 'blank');

describe('Modèles de proposition', () => {
  it('page blanche en premier, puis les quatre modèles de la recette', () => {
    expect(PROPOSAL_TEMPLATES.map((t) => t.id)).toEqual(['blank', 'public-space', 'mobility', 'greening', 'event']);
    expect(new Set(PROPOSAL_TEMPLATES.map((t) => t.id)).size).toBe(PROPOSAL_TEMPLATES.length);
  });

  it.each(filled.map((t) => [t.name, t]))('« %s » respecte les longueurs de l’API', (_name, t) => {
    expect(t.title.length).toBeGreaterThanOrEqual(5);
    expect(t.title.length).toBeLessThanOrEqual(200);
    expect(t.summaryText.length).toBeGreaterThanOrEqual(10);
    expect(t.summaryText.length).toBeLessThanOrEqual(300);
    expect(t.content.length).toBeGreaterThanOrEqual(20);
  });

  it.each(filled.map((t) => [t.name, t]))('« %s » : argumentaire en quatre rubriques, dans l’ordre', (_name, t) => {
    const positions = CONTENT_SECTIONS.map((section) => t.content.indexOf(`${section}\n`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('hasPlaceholders repère les passages [à compléter]', () => {
    expect(hasPlaceholders('Aménager [lieu]')).toBe(true);
    expect(hasPlaceholders('Titre fini', 'Accroche finie')).toBe(false);
    expect(hasPlaceholders(undefined, '')).toBe(false);
  });
});
