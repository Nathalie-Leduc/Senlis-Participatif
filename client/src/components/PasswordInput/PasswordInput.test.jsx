// Tests — PasswordInput transmet id et attributs ARIA (S5A-06)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PasswordInput from './PasswordInput.jsx';

describe('PasswordInput', () => {
  it('peut être relié à un <label> (id) et à son message d’erreur (aria-describedby)', () => {
    render(
      <>
        <label htmlFor="pw">Mot de passe</label>
        <PasswordInput id="pw" value="" onChange={() => {}} aria-invalid aria-describedby="pw-error" />
        <p id="pw-error">Mot de passe incorrect</p>
      </>,
    );
    const input = screen.getByLabelText('Mot de passe');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Mot de passe incorrect');
  });
});
