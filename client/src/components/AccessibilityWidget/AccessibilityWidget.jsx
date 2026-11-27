// ══════════════════════════════════════════════════════════
// Widget Accessibilité — bouton flottant + panneau (S5-04)
//
// Lecture au survol (S5R2-07, recette du 08/10) :
//  - voix NATURELLES (Azure, par le relais de l'API) quand le serveur
//    les propose, sinon les voix de l'APPAREIL — les plus naturelles en
//    premier ; choix de la voix et de la vitesse, gardés d'une visite
//    à l'autre ;
//  - ne lit que les éléments qui portent du texte (utils/hoverReading.js),
//    jamais un champ de saisie, jamais les pages de compte ou
//    d'administration (données personnelles) ;
//  - trois commandes : Pause, Reprendre, Arrêter, dans une barre en bas de
//    l'écran pendant la lecture — « Arrêter » coupe la lecture ET désactive
//    la lecture au survol (avant, elle reprenait au survol suivant).
// Le moteur (Azure ou appareil, repli automatique) est dans
// services/speechReader.js.
// ══════════════════════════════════════════════════════════

import {
  useState, useRef, useEffect, useMemo,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccessibility } from '../../contexts/AccessibilityContext.jsx';
import { api } from '../../services/api.js';
import { createSpeechReader, AZURE_PREFIX, DEVICE_PREFIX } from '../../services/speechReader.js';
import {
  readableTarget, isPrivatePath, fitForSpeech, frenchBrowserVoices,
} from '../../utils/hoverReading.js';

const CONTRAST_OPTIONS = [
  { value: 'none', label: 'Normal' },
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
  { value: 'mono', label: 'Monochrome' },
];

// S5R-03 : 4 niveaux d'interligne au lieu d'un simple « augmenté ».
// 1,5 est la valeur de référence du critère WCAG 1.4.12.
const LINE_HEIGHT_OPTIONS = [
  // « Standard » et non « Normal » : le bouton de contraste s'appelle
  // déjà « Normal », et deux boutons au même nom dans un même panneau
  // seraient ambigus pour un lecteur d'écran (liste des boutons).
  { value: 'normal', label: 'Standard' },
  { value: 1.5, label: '1,5' },
  { value: 1.8, label: '1,8' },
  { value: 2, label: '2' },
];

const RATE_OPTIONS = [
  { value: 'lente', label: 'Lente' },
  { value: 'normale', label: 'Normale' },
  { value: 'rapide', label: 'Rapide' },
];

// Délai avant de parler : qui traverse la page sans s'arrêter ne doit
// pas déclencher une lecture à chaque élément traversé
const HOVER_DELAY_MS = 300;

// Voix et vitesse choisies, gardées d'une visite à l'autre (sur cet
// appareil seulement). try/catch : navigation privée, stockage bloqué.
const PREFS_KEY = 'senlis:lecture';
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {};
  } catch {
    return {};
  }
}
function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* stockage indisponible : réglage gardé pour cette visite seulement */ }
}

export default function AccessibilityWidget() {
  const {
    settings, update, reset, applyProfile,
  } = useAccessibility();
  const [open, setOpen] = useState(false);
  const [hoverRead, setHoverRead] = useState(false);
  const panelRef = useRef(null);
  // S5R-03 : gestion du focus. À l'ouverture, le focus entre dans le
  // panneau (sur ✕) ; à la fermeture, il revient sur le bouton ♿ — au
  // clavier, on ne se retrouve jamais « perdu » en haut de la page.
  const toggleRef = useRef(null);
  const closeRef = useRef(null);
  const wasOpenRef = useRef(false);
  const hoverTimerRef = useRef(null);
  const lastElementRef = useRef(null);
  const { pathname } = useLocation();
  const privatePage = isPrivatePath(pathname);

  // ── Lecteur vocal (un seul pour toute la visite) ──────────
  const reader = useMemo(() => createSpeechReader(), []);
  const [reading, setReading] = useState({ status: 'idle', notice: null });
  useEffect(() => reader.subscribe(setReading), [reader]);

  // Voix naturelles proposées par le serveur : demandé une seule fois,
  // à la première activation (pas de requête pour qui n'en a pas besoin)
  const [azureVoices, setAzureVoices] = useState(null);
  const [deviceVoices, setDeviceVoices] = useState([]);
  const [prefs, setPrefs] = useState(loadPrefs);

  // Ferme le panneau à l'échap — un widget qui flotte par-dessus
  // tout le site doit pouvoir se fermer au clavier sans avoir à
  // chercher la souris jusqu'au bouton ✕.
  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    } else if (wasOpenRef.current) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Les voix de l'appareil arrivent parfois après le premier rendu
  // (chargement asynchrone selon le navigateur) : on les reprend dès
  // que le navigateur les annonce
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;
    const loadVoices = () => setDeviceVoices(frenchBrowserVoices(synth.getVoices?.() ?? []));
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    return () => synth.removeEventListener?.('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    if (!hoverRead || azureVoices !== null) return;
    api.get('/tts')
      .then((info) => setAzureVoices(info?.enabled ? info.voices : []))
      .catch(() => setAzureVoices([])); // API injoignable : voix de l'appareil
  }, [hoverRead, azureVoices]);

  // Toutes les voix proposées, naturelles (serveur) d'abord
  const voiceOptions = useMemo(() => [
    ...(azureVoices ?? []).map((v) => ({ id: AZURE_PREFIX + v.id, label: v.label, azure: true })),
    ...deviceVoices.map((v) => ({ id: DEVICE_PREFIX + v.voiceURI, label: v.name, azure: false })),
  ], [azureVoices, deviceVoices]);

  // La voix choisie si elle existe encore sur cet appareil, sinon la première
  const voice = voiceOptions.some((o) => o.id === prefs.voice) ? prefs.voice : voiceOptions[0]?.id;
  const rate = RATE_OPTIONS.some((o) => o.value === prefs.rate) ? prefs.rate : 'normale';
  const azureSelected = voice?.startsWith(AZURE_PREFIX);

  const changePrefs = (patch) => {
    const next = { ...prefs, voice, rate, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  // Arrêter = couper la lecture ET la désactiver (recette du 08/10)
  const stopReading = () => {
    clearTimeout(hoverTimerRef.current);
    reader.stop();
    setHoverRead(false);
  };

  // ── Mode "lecture au survol" ──────────────────────────
  // On ne lit QUE l'élément sous la souris, après un court délai.
  // Les réglages courants (voix, vitesse) passent par une référence :
  // l'écouteur n'est pas recréé à chaque changement de réglage.
  const settingsRef = useRef({ voice, rate });
  useEffect(() => { settingsRef.current = { voice, rate }; }, [voice, rate]);

  useEffect(() => {
    if (!hoverRead || privatePage) return undefined;

    const handleMouseOver = (e) => {
      // Ignore le panneau lui-même : on ne lit pas ses propres boutons
      // pendant qu'on les survole pour les régler
      if (panelRef.current?.contains(e.target)) return;
      // En pause, le survol ne relance RIEN (recette du 23/11 : en quittant
      // la barre, la souris passait sur un texte, qui se mettait à parler —
      // la pause semblait ne pas tenir). Seuls Reprendre ou Arrêter en sortent.
      if (reader.status === 'paused') return;
      const found = readableTarget(e.target);
      // Rien à lire, ou toujours le même élément (la souris bouge dedans)
      if (!found || found.element === lastElementRef.current) return;

      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        lastElementRef.current = found.element;
        // Recette du 23/11 : le panneau se ferme quand une lecture commence —
        // les commandes sont dans la barre de lecture, et il ne cache plus
        // la page qu'on est en train de lire. On le rouvre avec le bouton ♿.
        setOpen(false);
        reader.speak(fitForSpeech(found.text), settingsRef.current);
      }, HOVER_DELAY_MS);
    };

    const handleMouseOut = (e) => {
      clearTimeout(hoverTimerRef.current);
      // Sorti de l'élément lu : y revenir le relira
      if (lastElementRef.current && !lastElementRef.current.contains(e.relatedTarget)) {
        lastElementRef.current = null;
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      clearTimeout(hoverTimerRef.current);
      lastElementRef.current = null;
      // Lecture désactivée, ou arrivée sur une page privée : silence
      reader.stop();
    };
  }, [hoverRead, privatePage, reader]);

  return (
    <>
      <button
        type="button"
        ref={toggleRef}
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
            <button type="button" ref={closeRef} onClick={() => setOpen(false)} aria-label="Fermer le panneau" className="a11y-close">✕</button>
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
            <p className="a11y-subtitle" id="a11y-line-height-label">Interligne</p>
            <div className="a11y-options" role="group" aria-labelledby="a11y-line-height-label" style={{ marginBottom: 12 }}>
              {LINE_HEIGHT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={settings.lineHeight === opt.value}
                  onClick={() => update({ lineHeight: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="a11y-toggle-row">
              <input
                type="checkbox" checked={settings.textSpacing}
                onChange={(e) => update({ textSpacing: e.target.checked })}
              />
              Espacer les lettres, les mots et les paragraphes
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

          <section className="a11y-section">
            <h3>Lecture au survol</h3>
            <label className="a11y-toggle-row">
              <input
                type="checkbox" checked={hoverRead}
                onChange={(e) => {
                  if (e.target.checked) setHoverRead(true);
                  else stopReading();
                }}
              />
              Lire le texte survolé par la souris
            </label>
            {hoverRead && (
              <>
                <p className="a11y-hint">
                  {privatePage
                    ? 'Pas de lecture sur cette page : elle affiche des données personnelles.'
                    : 'Passez la souris sur un titre, un paragraphe ou un bouton pour l\'entendre.'}
                </p>

                {voiceOptions.length > 0 && (
                  <>
                    <label className="a11y-subtitle" htmlFor="a11y-voice">Voix</label>
                    <select
                      id="a11y-voice" className="a11y-select" value={voice}
                      onChange={(e) => changePrefs({ voice: e.target.value })}
                    >
                      {azureVoices?.length > 0 && (
                        <optgroup label="Voix naturelles">
                          {voiceOptions.filter((o) => o.azure).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </optgroup>
                      )}
                      {deviceVoices.length > 0 && (
                        <optgroup label="Voix de cet appareil">
                          {voiceOptions.filter((o) => !o.azure).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                    {azureSelected && (
                      // RGPD : Microsoft est sous-traitant — on le dit là où l'on choisit
                      <p className="a11y-hint">
                        Voix produites par Microsoft Azure (centre de données en France) : seul le
                        texte lu lui est transmis, jamais vos données de compte.{' '}
                        <Link to="/confidentialite">En savoir plus</Link>
                      </p>
                    )}
                  </>
                )}

                <p className="a11y-subtitle" id="a11y-rate-label">Vitesse</p>
                <div className="a11y-options" role="group" aria-labelledby="a11y-rate-label">
                  {RATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value} type="button" aria-pressed={rate === opt.value}
                      onClick={() => changePrefs({ rate: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Recette du 23/11 : plus de Pause / Reprendre ici. Le panneau est
                    loin du texte lu : le temps d'y venir, une lecture courte était
                    finie et les boutons redevenaient inactifs (curseur « interdit »).
                    Les commandes sont dans la barre en bas de l'écran, qui n'existe
                    QUE pendant une lecture. Pour tout arrêter : décocher la case
                    ci-dessus, ou « Arrêter » dans la barre. */}
                <p className="a11y-hint">
                  <strong>Pause, Reprendre, Arrêter</strong> : dès qu'une lecture commence, ce
                  panneau se ferme et une barre de commandes s'affiche en bas de l'écran. En
                  pause, le survol ne lit plus rien jusqu'à « Reprendre ».
                </p>
              </>
            )}
          </section>

          {/* Recette du 23/11 : « peut-on répondre vocalement ? » — la dictée
              existe déjà dans chaque appareil, gratuitement, dans tous les
              champs de texte du site. On l'explique, sans rien envoyer de plus :
              le site ne reçoit que le texte final, comme s'il avait été tapé. */}
          <section className="a11y-section">
            <h3>Répondre à la voix</h3>
            <p className="a11y-hint">
              Votre appareil sait écrire sous la dictée, dans tous les champs de texte du site
              (réponses d'enquête, propositions) :
            </p>
            <ul className="a11y-dictation">
              <li><strong>Windows</strong> : cliquez dans le champ, puis touches <kbd>⊞ Windows</kbd> + <kbd>H</kbd></li>
              <li><strong>Mac</strong> : touche <kbd>🎤</kbd> du clavier, ou menu Édition → Démarrer la dictée</li>
              <li><strong>Téléphone, tablette</strong> : le micro 🎤 du clavier qui s'affiche</li>
              <li>
                <strong>Linux</strong> : pas de dictée intégrée au système — utilisez un
                téléphone, ou une extension de dictée de votre navigateur
              </li>
            </ul>
            <p className="a11y-hint">
              La dictée est faite par votre appareil (Microsoft, Apple ou Google selon le cas) :
              Senlis Participatif ne reçoit que le texte, que vous pouvez relire avant d'envoyer.
            </p>
          </section>

          <button type="button" className="a11y-reset" onClick={reset}>
            Réinitialiser tous les réglages
          </button>
          <button type="button" className="a11y-close-bottom" onClick={() => setOpen(false)}>
            Fermer
          </button>
        </div>
      )}

      {/* ── Barre de lecture (recette du 23/11) ──────────────
          Un titre se lit en 2 secondes : le temps d'aller jusqu'au panneau,
          la lecture était finie et Pause redevenue inactive. Cette barre
          s'affiche en bas de l'écran PENDANT la lecture seulement, près de
          tout, panneau ouvert ou fermé. data-no-read : elle ne se lit pas
          elle-même quand on la survole.
          Analogie : la télécommande posée sur l'accoudoir plutôt que rangée
          dans le tiroir du meuble télé. */}
      {hoverRead && reading.status !== 'idle' && (
        <div className="a11y-player" role="region" aria-label="Lecture en cours" data-no-read>
          <span className="a11y-player-status">
            <span aria-hidden="true">🔊 </span>
            {{ loading: 'Préparation…', speaking: 'Lecture', paused: 'En pause' }[reading.status]}
          </span>
          {reading.status === 'paused' ? (
            <button type="button" onClick={() => reader.resume()}>
              <span aria-hidden="true">▶ </span>Reprendre
            </button>
          ) : (
            <button type="button" onClick={() => reader.pause()} aria-disabled={reading.status !== 'speaking'}>
              <span aria-hidden="true">⏸ </span>Pause
            </button>
          )}
          <button type="button" onClick={stopReading}>
            <span aria-hidden="true">⏹ </span>Arrêter
          </button>
          {/* Le panneau étant fermé pendant la lecture, le message de repli
              (« voix naturelle indisponible ») s'affiche dans la barre */}
          {reading.notice && <span className="a11y-player-notice" role="status">{reading.notice}</span>}
        </div>
      )}
    </>
  );
}
