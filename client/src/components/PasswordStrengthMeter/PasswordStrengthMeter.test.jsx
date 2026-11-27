// Tests — jauge du mot de passe fondée sur la longueur (S5R-13b)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PasswordStrengthMeter, { strengthLevel } from './PasswordStrengthMeter.jsx';

describe('strengthLevel', () => {
  it('moins de 15 caractères : « trop court », avec le nombre qui manque', () => {
    expect(strengthLevel('pivoine').label).toBe('Trop court — encore 8 caractères');
    expect(strengthLevel('quatorzecaract').label).toBe('Trop court — encore 1 caractère');
  });

  it('la longueur seule fait monter la jauge — aucune famille de caractères exigée', () => {
    expect(strengthLevel('quinzecaractere').label).toBe('Correct'); // 15, minuscules seules
    expect(strengthLevel('lanterne remparts tilleul').label).toBe('Bon'); // 25
    expect(strengthLevel('lanterne remparts tilleul orage du soir').label).toBe('Excellent'); // 39
  });

  it('long mais répétitif : jamais présenté comme solide', () => {
    expect(strengthLevel('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').label).toMatch(/Trop prévisible/);
  });

  it('un emoji compte pour un caractère, comme dans l’API', () => {
    expect(strengthLevel('tilleul orag 🦌').label).toBe('Trop court — encore 1 caractère');
  });
});

describe('PasswordStrengthMeter', () => {
  it('affiche l’astuce de la phrase de passe dès le départ, sans jauge', () => {
    render(<PasswordStrengthMeter password="" />);
    expect(screen.getByText(/phrase de passe/)).toBeInTheDocument();
    expect(screen.queryByText(/Trop court/)).not.toBeInTheDocument();
  });

  it('annonce le niveau aux lecteurs d’écran (zone aria-live)', () => {
    render(<PasswordStrengthMeter password="pivoine" />);
    const level = screen.getByText('Trop court — encore 8 caractères');
    expect(level.closest('[aria-live="polite"]')).not.toBeNull();
  });
});
