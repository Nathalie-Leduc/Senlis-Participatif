// Tests — le cerf, ses humeurs (S5R2-10)
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Mascot from './Mascot.jsx';

describe('Mascot', () => {
  it('joyeux par défaut : sourire, étoiles, pas de point d\'interrogation', () => {
    const { container } = render(<Mascot />);
    expect(container.querySelector('.mascot-question')).toBeNull();
    expect(container.textContent).toContain('✦');
  });

  it('perplexe : point d\'interrogation, plus d\'étoiles', () => {
    const { container } = render(<Mascot mood="perplexe" />);
    expect(container.querySelector('.mascot-question')).toHaveTextContent('?');
    expect(container.textContent).not.toContain('✦');
  });

  it('en grande taille, le cerf est une image décrite ; ailleurs, il est décoratif', () => {
    const hero = render(<Mascot size="hero" />).container.querySelector('svg');
    expect(hero).toHaveAttribute('role', 'img');
    const small = render(<Mascot size="inline" />).container.querySelector('svg');
    expect(small).toHaveAttribute('aria-hidden', 'true');
  });
});
