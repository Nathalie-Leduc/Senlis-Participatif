// ══════════════════════════════════════════════════════════
// Widget Accessibilité — bouton flottant + panneau (S5-04)
//
// La lecture à voix haute utilise SpeechSynthesis, une API DU
// NAVIGATEUR (pas un lecteur d'écran tiers qu'on ne peut pas
// piloter depuis un site web) — c'est la seule des fonctions de
// la maquette EqualWeb qui soit authentiquement reproductible
// sans dépendance externe.
// ══════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useAccessibility } from '../../contexts/AccessibilityContext.jsx';

const CONTRAST_OPTIONS = [
  { value: 'none', label: 'Normal' },
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
  { value: 'mono', label: 'Monochrome' },
];

export default function AccessibilityWidget() {
  const {
    settings, update, reset, applyProfile,
  } = useAccessibility();
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const panelRef = useRef(null);

  // Ferme le panneau à l'échap — un widget qui flotte par-dessus
  // tout le site doit pouvoir se fermer au clavier sans avoir à
  // chercher la souris jusqu'au bouton ✕.
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const speak = () => {
    const main = document.querySelector('main');
    if (!main || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(main.innerText);
    utterance.lang = 'fr-FR';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-label="Options d'accessibilité"
        className="a11y-toggle"
      >
        ♿
      </button>

      {open && (
        <div
          id="a11y-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Options d'accessibilité"
          className="a11y-panel"
          ref={panelRef}
        >
          <div className="a11y-panel-header">
            <h2>Accessibilité</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le panneau" className="a11y-close">✕</button>
          </div>

          <section className="a11y-section">
            <h3>Profils rapides</h3>
            <div className="a11y-profiles">
              <button type="button" onClick={() => applyProfile('malvoyance')}>👁️ Malvoyance</button>
              <button type="button" onClick={() => applyProfile('dyslexie')}>🔤 Dyslexie</button>
              <button type="button" onClick={() => applyProfile('calme')}>🧘 Sensible aux animations</button>
            </div>
          </section>

          <section className="a11y-section">
            <h3>Contraste</h3>
            <div className="a11y-options" role="group" aria-label="Mode de contraste">
              {CONTRAST_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={settings.contrast === opt.value}
                  onClick={() => update({ contrast: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section className="a11y-section">
            <h3>Taille du texte</h3>
            <div className="a11y-options">
              <button
                type="button"
                onClick={() => update({ fontScale: Math.round((settings.fontScale - 0.15) * 100) / 100 })}
                disabled={settings.fontScale <= 1}
                aria-label="Réduire la taille du texte"
              >
                A−
              </button>
              <span aria-live="polite">{Math.round(settings.fontScale * 100)}%</span>
              <button
                type="button"
                onClick={() => update({ fontScale: Math.round((settings.fontScale + 0.15) * 100) / 100 })}
                disabled={settings.fontScale >= 1.5}
                aria-label="Augmenter la taille du texte"
              >
                A+
              </button>
            </div>
          </section>

          <section className="a11y-section">
            <h3>Lecture et confort</h3>
            <label className="a11y-toggle-row">
              <input
                type="checkbox" checked={settings.lineSpacing}
                onChange={(e) => update({ lineSpacing: e.target.checked })}
              />
              Interligne augmenté
            </label>
            <label className="a11y-toggle-row">
              <input
                type="checkbox" checked={settings.underlineLinks}
                onChange={(e) => update({ underlineLinks: e.target.checked })}
              />
              Souligner tous les liens
            </label>
            <label className="a11y-toggle-row">
              <input
                type="checkbox" checked={settings.reduceMotion}
                onChange={(e) => update({ reduceMotion: e.target.checked })}
              />
              Réduire les animations
            </label>
          </section>

          {speechSupported && (
            <section className="a11y-section">
              <h3>Lecture à voix haute</h3>
              <div className="a11y-options">
                <button type="button" onClick={speak}>▶ Lire cette page</button>
                <button type="button" onClick={stopSpeaking} disabled={!speaking}>⏹ Arrêter</button>
              </div>
            </section>
          )}

          <button type="button" className="a11y-reset" onClick={reset}>
            Réinitialiser tous les réglages
          </button>
        </div>
      )}
    </>
  );
}
