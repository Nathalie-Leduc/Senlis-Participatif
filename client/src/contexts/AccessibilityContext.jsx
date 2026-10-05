// ══════════════════════════════════════════════════════════
// Contexte Accessibilité — les réglages du widget (S5-04)
//
// Persisté en localStorage (pas sessionStorage) : un réglage
// d'accessibilité doit survivre à la fermeture de l'onglet — ce
// n'est pas une préférence de session, c'est un besoin durable.
//
// Chaque réglage est traduit en classe CSS (ou variable custom
// pour la taille de texte) posée sur <html>, pas sur un simple
// wrapper interne : les styles doivent s'appliquer à TOUTE la
// page, y compris des éléments qui pourraient un jour être montés
// ailleurs dans le DOM (portails, modales).
// ══════════════════════════════════════════════════════════

import {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';

const STORAGE_KEY = 'senlis-a11y-settings';

const DEFAULTS = {
  contrast: 'none', // 'none' | 'dark' | 'light' | 'mono'
  fontScale: 1, // 1 → 1.5
  // S5R-03 (recette) : l'interligne n'avait qu'un cran (« augmenté ou
  // non »). Désormais 4 niveaux : 'normal' (celui du site) puis 1.5,
  // 1.8 et 2 — 1.5 étant la valeur de référence du critère WCAG 1.4.12.
  lineHeight: 'normal', // 'normal' | 1.5 | 1.8 | 2
  // Espacement des lettres (0,12 × la taille du texte), des mots (0,16 ×)
  // et des paragraphes (2 ×) : les valeurs exactes du critère WCAG
  // 1.4.12 / RGAA 10.12. Utile notamment en cas de dyslexie.
  textSpacing: false,
  underlineLinks: false,
  reduceMotion: false,
  // Quel profil rapide est actuellement appliqué ('malvoyance' |
  // 'dyslexie' | 'calme' | null) — permet à applyProfile() de savoir
  // s'il faut appliquer le profil ou l'ANNULER (reclic sur le même).
  activeProfile: null,
};

const AccessibilityContext = createContext(null);

/**
 * Réglages enregistrés AVANT S5R-03 : `lineSpacing: true` voulait dire
 * « interligne 2 ». On le traduit dans le nouveau format, pour que la
 * personne retrouve exactement ce qu'elle avait choisi.
 * Exportée pour les tests.
 */
export function migrateSettings(saved) {
  const { lineSpacing, ...rest } = saved;
  if (lineSpacing === true && rest.lineHeight === undefined) rest.lineHeight = 2;
  return rest;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...migrateSettings(JSON.parse(raw)) } : DEFAULTS;
  } catch {
    // localStorage indisponible (navigation privée stricte, quota) ou
    // JSON corrompu — on repart des valeurs par défaut plutôt que de
    // planter toute l'application pour un réglage de confort.
    return DEFAULTS;
  }
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove('a11y-contrast-dark', 'a11y-contrast-light', 'a11y-contrast-mono');
    if (settings.contrast !== 'none') {
      root.classList.add(`a11y-contrast-${settings.contrast}`);
    }

    root.style.setProperty('--a11y-font-scale', settings.fontScale);
    // La variable CSS seule ne suffit pas : le projet compte 158
    // déclarations `fontSize` en pixels FIXES posées en style inline
    // sur les composants — elles ignorent complètement une variable
    // héritée par `body`. `zoom` (implémenté par tous les navigateurs
    // majeurs, Firefox y compris depuis 2024) agrandit la page ENTIÈRE
    // comme le ferait le zoom natif du navigateur — indépendant de la
    // façon dont chaque composant a écrit sa taille de police.
    root.style.zoom = settings.fontScale === 1 ? '' : String(settings.fontScale);
    // Interligne : une variable CSS (la valeur) + une classe (le
    // déclencheur), comme pour la taille du texte
    const customLineHeight = settings.lineHeight !== 'normal';
    root.classList.toggle('a11y-line-height', customLineHeight);
    if (customLineHeight) root.style.setProperty('--a11y-line-height', String(settings.lineHeight));
    else root.style.removeProperty('--a11y-line-height');
    root.classList.toggle('a11y-text-spacing', settings.textSpacing);
    root.classList.toggle('a11y-underline-links', settings.underlineLinks);
    root.classList.toggle('a11y-reduce-motion', settings.reduceMotion);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Idem : un échec d'écriture ne doit jamais casser la navigation.
    }
  }, [settings]);

  const update = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  // Un profil = plusieurs réglages appliqués d'un coup — un raccourci,
  // pas une catégorie à part : rien n'empêche de les affiner ensuite
  // un par un dans les sections détaillées du panneau.
  //
  // Recliquer sur le profil DÉJÀ actif l'annule entièrement (retour
  // aux valeurs par défaut) plutôt que de réappliquer les mêmes
  // réglages en boucle — setSettings((prev) => ...) plutôt que
  // update() : on a besoin de lire prev.activeProfile pour décider,
  // update() ne fait qu'ajouter un patch sans regarder l'état actuel.
  const applyProfile = useCallback((profile) => {
    setSettings((prev) => {
      if (prev.activeProfile === profile) {
        return { ...DEFAULTS };
      }

      const profileSettings = {
        malvoyance: { contrast: 'dark', fontScale: 1.3, underlineLinks: true },
        dyslexie: { lineHeight: 1.8, textSpacing: true, fontScale: 1.15, underlineLinks: true },
        calme: { reduceMotion: true, contrast: 'none' },
      }[profile];

      return { ...prev, ...profileSettings, activeProfile: profile };
    });
  }, []);

  return (
    <AccessibilityContext.Provider value={{
      settings, update, reset, applyProfile,
    }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibility doit être utilisé dans un <AccessibilityProvider>');
  }
  return ctx;
}
