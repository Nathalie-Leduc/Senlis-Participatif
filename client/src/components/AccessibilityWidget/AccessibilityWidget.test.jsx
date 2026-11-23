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
import {
  render, screen, fireEvent, waitFor, act, within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccessibilityProvider } from '../../contexts/AccessibilityContext.jsx';

// S5R2-07 : l'API (disponibilité des voix naturelles, audio) est simulée.
// Par défaut, pas de voix naturelles : voix de l'appareil seulement.
const apiMock = vi.hoisted(() => ({ get: vi.fn(), audio: vi.fn() }));
vi.mock('../../services/api.js', () => ({ api: apiMock }));
const { default: AccessibilityWidget } = await import('./AccessibilityWidget.jsx');

function renderWidget(children = null, { path = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AccessibilityProvider>
        {children}
        <AccessibilityWidget />
      </AccessibilityProvider>
    </MemoryRouter>,
  );
}

/** Ouvre le panneau, active la lecture au survol, laisse les effets se poser */
async function enableHoverReading() {
  fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
  fireEvent.click(screen.getByLabelText('Lire le texte survolé par la souris'));
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
}

/** Survole un élément et laisse passer le délai avant lecture (300 ms) */
async function hover(element) {
  vi.useFakeTimers();
  fireEvent.mouseOver(element);
  vi.advanceTimersByTime(350);
  vi.useRealTimers();
  await act(async () => { await Promise.resolve(); });
}

describe('AccessibilityWidget', () => {
  beforeEach(() => {
    // Le contexte pose ses classes sur document.documentElement, PAS
    // dans le conteneur que Testing Library démonte entre les tests —
    // sans ce nettoyage manuel, un test "salirait" le suivant.
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';

    apiMock.get.mockReset().mockResolvedValue({ enabled: false, voices: [] });
    apiMock.audio.mockReset();

    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn(() => [{ lang: 'fr-FR', name: 'Voix française de test', voiceURI: 'voix-test' }]),
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
    await enableHoverReading();
    await hover(screen.getByText('Un paragraphe de test à lire'));

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
    renderWidget(<div data-testid="stat-pill"><span>0</span> participants</div>);
    await enableHoverReading();
    // Survoler le « 0 » lit toute la phrase, pas seulement le chiffre
    await hover(screen.getByText('0'));
    expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith('0 participants');
  });

  // ── S5R2-07 (recette du 08/10) ───────────────────────────
  it('ne lit pas le vide : un conteneur sans texte propre, ni un champ de saisie', async () => {
    renderWidget(
      <div data-testid="grille">
        <section><p>Un texte</p></section>
        <input aria-label="Votre email" defaultValue="nath@exemple.fr" />
      </div>,
    );
    await enableHoverReading();
    await hover(screen.getByTestId('grille'));
    await hover(screen.getByLabelText('Votre email'));
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('Pause, Reprendre, puis Arrêter (barre de lecture) — Arrêter coupe la lecture ET désactive la lecture au survol', async () => {
    renderWidget(<p>Un paragraphe de test à lire</p>);
    await enableHoverReading();
    // Recette du 23/11 : plus de commandes dans le panneau (souvent inactives), un renvoi vers la barre
    expect(screen.queryByRole('group', { name: 'Commandes de lecture' })).not.toBeInTheDocument();
    expect(screen.getByText(/panneau se ferme et une barre de\s+commandes s'affiche/)).toBeInTheDocument();

    await hover(screen.getByText('Un paragraphe de test à lire'));
    // Recette du 23/11 : la lecture commence → le panneau se ferme, la barre prend le relais
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Lire le texte survolé par la souris')).not.toBeInTheDocument();
    const bar = within(screen.getByRole('region', { name: 'Lecture en cours' }));
    // Pause « maison » (voix de l'appareil) : on coupe… — speechSynthesis.pause()
    // ne marche pas sous Linux, on ne s'y fie plus
    window.speechSynthesis.cancel.mockClear();
    fireEvent.click(bar.getByRole('button', { name: 'Pause' }));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    // … et on reprend en relisant ce qui restait
    window.speechSynthesis.speak.mockClear();
    fireEvent.click(bar.getByRole('button', { name: 'Reprendre' }));
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);

    fireEvent.click(bar.getByRole('button', { name: 'Arrêter' }));
    // On rouvre le panneau : la case est décochée
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
    expect(screen.getByLabelText('Lire le texte survolé par la souris')).not.toBeChecked();
    expect(screen.queryByRole('region', { name: 'Lecture en cours' })).not.toBeInTheDocument();

    // Le survol suivant ne relance PLUS la lecture (le défaut constaté en recette)
    window.speechSynthesis.speak.mockClear();
    await hover(screen.getByText('Un paragraphe de test à lire'));
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('recette du 23/11 : une barre de lecture apparaît PENDANT la lecture, panneau fermé, et disparaît ensuite', async () => {
    renderWidget(<p>Un paragraphe de test à lire</p>);
    await enableHoverReading();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    expect(screen.queryByRole('region', { name: 'Lecture en cours' })).not.toBeInTheDocument();

    await hover(screen.getByText('Un paragraphe de test à lire'));
    const bar = within(screen.getByRole('region', { name: 'Lecture en cours' }));
    fireEvent.click(bar.getByRole('button', { name: 'Pause' }));
    expect(bar.getByText('En pause')).toBeInTheDocument();
    // Le même bouton devient « Reprendre »
    window.speechSynthesis.speak.mockClear();
    fireEvent.click(bar.getByRole('button', { name: 'Reprendre' }));
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);

    // Fin de la phrase : la barre s'en va
    const utterance = window.SpeechSynthesisUtterance.mock.results.at(-1).value;
    act(() => utterance.onend());
    expect(screen.queryByRole('region', { name: 'Lecture en cours' })).not.toBeInTheDocument();
  });

  it('recette du 23/11 : en pause, survoler un autre texte ne relance pas la lecture', async () => {
    renderWidget(<><p>Premier paragraphe</p><p>Second paragraphe</p></>);
    await enableHoverReading();
    await hover(screen.getByText('Premier paragraphe'));
    const bar = within(screen.getByRole('region', { name: 'Lecture en cours' }));
    fireEvent.click(bar.getByRole('button', { name: 'Pause' }));

    window.speechSynthesis.speak.mockClear();
    await hover(screen.getByText('Second paragraphe'));
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(bar.getByText('En pause')).toBeInTheDocument();
  });

  it('survoler la barre de lecture ne la lit pas elle-même', async () => {
    renderWidget(<p>Un paragraphe de test à lire</p>);
    await enableHoverReading();
    await hover(screen.getByText('Un paragraphe de test à lire'));
    window.speechSynthesis.speak.mockClear();
    await hover(within(screen.getByRole('region', { name: 'Lecture en cours' })).getByRole('button', { name: 'Arrêter' }));
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('« Répondre à la voix » : explique la dictée de l’appareil (rien d’envoyé par le site)', () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: "Options d'accessibilité" }));
    expect(screen.getByRole('heading', { name: 'Répondre à la voix' })).toBeInTheDocument();
    expect(screen.getByText(/ne reçoit que le texte/)).toBeInTheDocument();
  });

  it('jamais de lecture sur les pages de compte (données personnelles), avec un message', async () => {
    renderWidget(<p>Votre adresse : nath@exemple.fr</p>, { path: '/mon-compte' });
    await enableHoverReading();
    expect(screen.getByText(/Pas de lecture sur cette page/)).toBeInTheDocument();
    await hover(screen.getByText('Votre adresse : nath@exemple.fr'));
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    expect(apiMock.audio).not.toHaveBeenCalled();
  });

  it('voix naturelles proposées par le serveur : choisies par défaut, avec la mention du sous-traitant', async () => {
    apiMock.get.mockResolvedValue({ enabled: true, voices: [{ id: 'fr-FR-DeniseNeural', label: 'Denise (voix naturelle)' }] });
    apiMock.audio.mockResolvedValue(new Blob(['mp3']));
    const play = vi.fn(() => Promise.resolve());
    window.Audio = vi.fn(function AudioMock() { this.play = play; this.pause = vi.fn(); });
    URL.createObjectURL = vi.fn(() => 'blob:audio-test');

    renderWidget(<p>Les enquêtes en cours</p>);
    await enableHoverReading();
    await waitFor(() => expect(screen.getByLabelText('Voix')).toHaveValue('azure:fr-FR-DeniseNeural'));
    expect(screen.getByText(/Microsoft Azure/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lente' }));
    await hover(screen.getByText('Les enquêtes en cours'));
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(apiMock.audio).toHaveBeenCalledWith('/tts', { text: 'Les enquêtes en cours', voice: 'fr-FR-DeniseNeural', rate: 'lente' });
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    // Vitesse gardée pour la prochaine visite
    expect(JSON.parse(localStorage.getItem('senlis:lecture')).rate).toBe('lente');
  });

  it('voix naturelle indisponible (quota, panne) : la voix de l\'appareil prend le relais, et on le dit', async () => {
    apiMock.get.mockResolvedValue({ enabled: true, voices: [{ id: 'fr-FR-DeniseNeural', label: 'Denise (voix naturelle)' }] });
    apiMock.audio.mockRejectedValue({ status: 503, code: 'TTS_UNAVAILABLE' });

    renderWidget(<p>Les enquêtes en cours</p>);
    await enableHoverReading();
    await waitFor(() => expect(screen.getByLabelText('Voix')).toHaveValue('azure:fr-FR-DeniseNeural'));
    await hover(screen.getByText('Les enquêtes en cours'));

    await waitFor(() => expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith('Les enquêtes en cours'));
    // Le panneau s'est fermé : le message s'affiche dans la barre de lecture
    const bar = within(screen.getByRole('region', { name: 'Lecture en cours' }));
    expect(bar.getByRole('status')).toHaveTextContent('voix de cet appareil');
  });
});
