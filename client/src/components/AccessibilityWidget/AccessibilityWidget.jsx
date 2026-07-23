// ══════════════════════════════════════════════════════════
// Widget Accessibilité — bouton flottant + panneau (S5-04)
//
// La lecture à voix haute utilise SpeechSynthesis, une API DU
// NAVIGATEUR (pas un lecteur d'écran tiers qu'on ne peut pas
// piloter depuis un site web) — c'est la seule des fonctions de
// la maquette EqualWeb qui soit authentiquement reproductible
// sans dépendance externe.
// ══════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccessibility } from '../../contexts/AccessibilityContext.jsx';

const CONTRAST_OPTIONS = [
  { value: 'none', label: 'Normal' },
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
  { value: 'mono', label: 'Monochrome' },
];

// Pas de filtre par balise (essayé, mais le projet mélange des
// textes bruts posés directement dans des <div> avec des <span>
// enfants pour la mise en forme — ex. `<div><span>0</span>
// participants</div>` : le mot "participants" n'appartient à AUCUNE
// balise de la liste, donc jamais lu). À la place, un plafond de
// longueur : `e.target` est déjà l'élément le plus précis sous le
// curseur, donc le vrai risque n'est pas "quelle balise" mais "un
// grand conteneur sans enfant plus précis à cet endroit précis",
// qu'on écarte simplement s'il contient trop de texte d'un coup.
const MAX_HOVER_READ_LENGTH = 400;

// Retire émojis/pictogrammes avant lecture : une synthèse vocale qui
// tombe sur "♿" ou "🦌" au milieu d'une phrase produit un son
// incohérent (elle tente de le "prononcer") plutôt que de l'ignorer.
function cleanTextForSpeech(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AccessibilityWidget() {
  const {
    settings, update, reset, applyProfile,
  } = useAccessibility();
  const [open, setOpen] = useState(false);
  const [hoverRead, setHoverRead] = useState(false);
  const panelRef = useRef(null);
  const voicesRef = useRef([]);
  const hoverTimerRef = useRef(null);

  // Ferme le panneau à l'échap — un widget qui flotte par-dessus
  // tout le site doit pouvoir se fermer au clavier sans avoir à
  // chercher la souris jusqu'au bouton ✕.
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Les voix ne sont pas toujours prêtes au premier rendu (chargement
  // asynchrone selon le navigateur) — on les récupère dès qu'elles le
  // sont, pour ne pas avoir à y repenser au moment de parler.
  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;

    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const speakText = useCallback((rawText) => {
    if (!window.speechSynthesis) return;
    const text = cleanTextForSpeech(rawText);
    if (!text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    // lang='fr-FR' n'est qu'une INDICATION — sans voix française
    // explicitement choisie, certains navigateurs prennent la
    // première voix disponible (souvent anglaise), qui prononce le
    // texte français lettre à lettre de façon incompréhensible.
    const frenchVoice = voicesRef.current.find((v) => v.lang?.toLowerCase().startsWith('fr'));
    if (frenchVoice) utterance.voice = frenchVoice;
    // Un peu plus lent que le défaut (1) : plus clair à l'oreille,
    // surtout pour quelqu'un qui s'appuie dessus pour comprendre.
    utterance.rate = 0.95;

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
  };

  // ── Mode "lecture au survol" ──────────────────────────
  // Remplace la lecture de toute la page : on ne lit QUE l'élément
  // sous la souris, avec un court délai avant de parler (l'utilisateur
  // qui traverse la page sans s'arrêter ne doit pas déclencher une
  // lecture à chaque élément qu'il ne fait que traverser du regard).
  useEffect(() => {
    if (!hoverRead) return undefined;

    const handleMouseOver = (e) => {
      // Ignore le panneau lui-même : on ne veut pas lire ses propres
      // boutons/options pendant qu'on les survole pour les régler.
      if (panelRef.current?.contains(e.target)) return;

      const text = e.target.innerText;
      if (!text?.trim() || text.length > MAX_HOVER_READ_LENGTH) return;

      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => speakText(text), 200);
    };

    const handleMouseOut = () => clearTimeout(hoverTimerRef.current);

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      clearTimeout(hoverTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, [hoverRead, speakText]);

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
            <div className="a11y-profiles" role="group" aria-label="Profils rapides">
              <button
                type="button"
                aria-pressed={settings.activeProfile === 'malvoyance'}
                onClick={() => applyProfile('malvoyance')}
              >
                👁️ Malvoyance
              </button>
              <button
                type="button"
                aria-pressed={settings.activeProfile === 'dyslexie'}
                onClick={() => applyProfile('dyslexie')}
              >
                🔤 Dyslexie
              </button>
              <button
                type="button"
                aria-pressed={settings.activeProfile === 'calme'}
                onClick={() => applyProfile('calme')}
              >
                🧘 Sensible aux animations
              </button>
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
              <h3>Lecture au survol</h3>
              <label className="a11y-toggle-row">
                <input
                  type="checkbox" checked={hoverRead}
                  onChange={(e) => {
                    setHoverRead(e.target.checked);
                    if (!e.target.checked) stopSpeaking();
                  }}
                />
                Lire le texte survolé par la souris
              </label>
              {hoverRead && (
                <p style={{ fontSize: 12, color: '#6B6257', margin: '6px 0 0' }}>
                  Passez la souris sur un titre, un paragraphe ou un bouton pour l'entendre.
                </p>
              )}
              <button type="button" onClick={stopSpeaking} style={{ marginTop: 8 }}>⏹ Arrêter la lecture</button>
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
