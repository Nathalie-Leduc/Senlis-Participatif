// ══════════════════════════════════════════════════════════
// Tests — AccessibilityWidget (S5-04)
//
// Premier fichier de test côté CLIENT de ce projet — l'infra
// (vitest + @testing-library/react + jsdom) était déjà scaffoldée
// dans package.json/vite.config.js, jamais utilisée jusqu'ici.
//
// jsdom n'implémente ni SpeechSynthesis ni SpeechSynthesisUtterance
// (ce sont des API navigateur, pas DOM) — on les fournit nous-mêmes
// en mock, sinon toute la section lecture au survol serait invisible
// (speechSupported === false) et resterait totalement non testée.
// ══════════════════════════════════════════════════════════

import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibilityProvider } from '../../contexts/AccessibilityContext.jsx';
import AccessibilityWidget from './AccessibilityWidget.jsx';

function renderWidget(children = null) {
  return render(
    <AccessibilityProvider>
      {children}
      <AccessibilityWidget />
    </AccessibilityProvider>,
  );
}

describe('AccessibilityWidget', () => {
  beforeEach(() => {
    // Le contexte pose ses classes sur document.documentElement, PAS
    // dans le conteneur que Testing Library démonte entre les tests —
    // sans ce nettoyage manuel, un test "salirait" le suivant.
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';

    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [{ lang: 'fr-FR', name: 'Voix française de test' }]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    global.SpeechSynthesisUtterance = vi.fn().mockImplementation(function SpeechSynthesisUtteranceMock(text) {
      this.text = text;
    });

    // jsdom n'implémente pas innerText (il dépend du rendu visuel réel —
    // absent en environnement de test) : sans ce polyfill, tout ce qui
    // s'appuie dessus (comme le survol de AccessibilityWidget) verrait
    // toujours `undefined`, alors qu'un vrai navigateur le renvoie très
    // bien. On ne polyfille QUE pour ce test, pas dans le code applicatif.
    if (!('innerText' in document.createElement('div'))) {
      Object.defineProperty(HTMLElement.prototype, 'innerText', {
        configurable: true,
        get() { return this.textContent; },
      });
    }
  });

  it("le panneau est fermé par défaut et s'ouvre au clic sur le bouton", () => {
    renderWidget();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('se ferme avec la touche Échap', () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applique la classe de contraste choisie sur <html>, et la retire en repassant à Normal', () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));

    fireEvent.click(screen.getByRole('button', { name: 'Sombre' }));
    expect(document.documentElement.classList.contains('a11y-contrast-dark')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Normal' }));
    expect(document.documentElement.classList.contains('a11y-contrast-dark')).toBe(false);
  });

  it('ajuste la taille du texte et respecte les bornes (100 % → 150 %)', () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));

    const decreaseBtn = screen.getByRole('button', { name: 'Réduire la taille du texte' });
    const increaseBtn = screen.getByRole('button', { name: 'Augmenter la taille du texte' });

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(decreaseBtn).toBeDisabled(); // déjà au minimum, ne doit pas pouvoir descendre plus bas

    fireEvent.click(increaseBtn);
    expect(screen.getByText('115%')).toBeInTheDocument();
    expect(decreaseBtn).not.toBeDisabled();

    fireEvent.click(decreaseBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(decreaseBtn).toBeDisabled();
  });

  it('le bouton de réinitialisation restaure les réglages par défaut', () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));

    fireEvent.click(screen.getByRole('button', { name: 'Sombre' }));
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter la taille du texte' }));
    expect(document.documentElement.classList.contains('a11y-contrast-dark')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser tous les réglages' }));

    expect(document.documentElement.classList.contains('a11y-contrast-dark')).toBe(false);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('la lecture au survol ne parle QUE du texte survolé, jamais de toute la page', async () => {
    renderWidget(<p>Un paragraphe de test à lire</p>);

    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
    fireEvent.click(screen.getByLabelText('Lire le texte survolé par la souris'));

    // Laisse l'effet React (qui attache l'écouteur mouseover sur
    // document) se poser avant de simuler le survol — sans ce tick,
    // le clic et le survol arrivent dans le même passage synchrone et
    // l'écouteur n'est pas encore branché.
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    vi.useFakeTimers();
    fireEvent.mouseOver(screen.getByText('Un paragraphe de test à lire'));
    vi.advanceTimersByTime(250); // le délai anti-survol-fugace (200 ms) doit être écoulé
    vi.useRealTimers();

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith('Un paragraphe de test à lire');
  });

  it("désactiver la lecture au survol arrête immédiatement toute lecture en cours", () => {
    renderWidget(<p>Un paragraphe de test à lire</p>);

    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
    const hoverCheckbox = screen.getByLabelText('Lire le texte survolé par la souris');

    fireEvent.click(hoverCheckbox); // activer
    fireEvent.click(hoverCheckbox); // désactiver

    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it("recliquer sur un profil DÉJÀ actif l'annule entièrement (retour aux valeurs par défaut)", () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));

    const malvoyanceBtn = screen.getByRole('button', { name: '👁️ Malvoyance' });

    fireEvent.click(malvoyanceBtn);
    expect(document.documentElement.classList.contains('a11y-contrast-dark')).toBe(true);
    expect(malvoyanceBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(malvoyanceBtn);
    expect(document.documentElement.classList.contains('a11y-contrast-dark')).toBe(false);
    expect(malvoyanceBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it("appliquer un DEUXIÈME profil désactive visuellement le premier", () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));

    fireEvent.click(screen.getByRole('button', { name: '👁️ Malvoyance' }));
    fireEvent.click(screen.getByRole('button', { name: '🔤 Dyslexie' }));

    expect(screen.getByRole('button', { name: '👁️ Malvoyance' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '🔤 Dyslexie' })).toHaveAttribute('aria-pressed', 'true');
  });

  it("lit le texte brut posé à côté d'un <span> enfant (ex. une stat-pill : <div><span>0</span> participants</div>)", async () => {
    renderWidget(
      <div data-testid="stat-pill"><span>0</span> participants</div>,
    );

    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
    fireEvent.click(screen.getByLabelText('Lire le texte survolé par la souris'));
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    vi.useFakeTimers();
    fireEvent.mouseOver(screen.getByTestId('stat-pill'));
    vi.advanceTimersByTime(250);
    vi.useRealTimers();

    // Sans le correctif (filtre par balise), ce <div> n'aurait jamais
    // déclenché de lecture — "participants" n'appartient à aucune des
    // balises autorisées, seul le <span> "0" l'était.
    expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith('0 participants');
  });
});
