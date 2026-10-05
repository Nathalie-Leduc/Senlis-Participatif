// Tests — messages d'erreur reliés aux champs (S5A-07, RGAA 11.10)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormError, { errorProps } from './FormError.jsx';

describe('FormError', () => {
  it("n'affiche rien sans message (pas d'alerte muette)", () => {
    const { container } = render(<FormError id="e">{null}</FormError>);
    expect(container).toBeEmptyDOMElement();
  });

  it('relie le message au champ : invalide + description', () => {
    render(
      <>
        <label htmlFor="email">Email</label>
        <input id="email" {...errorProps(true, 'email-error')} />
        <FormError id="email-error">Adresse déjà utilisée</FormError>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Adresse déjà utilisée');
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Adresse déjà utilisée');
  });

  it("sans erreur, le champ n'a aucun attribut ARIA d'erreur", () => {
    expect(errorProps(false, 'x')).toEqual({});
  });
});
