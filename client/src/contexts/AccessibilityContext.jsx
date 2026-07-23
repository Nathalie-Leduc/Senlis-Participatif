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
  lineSpacing: false,
  underlineLinks: false,
  reduceMotion: false,
};

const AccessibilityContext = createContext(null);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
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
    root.classList.toggle('a11y-line-spacing', settings.lineSpacing);
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
  const applyProfile = useCallback((profile) => {
    if (profile === 'malvoyance') {
      update({ contrast: 'dark', fontScale: 1.3, underlineLinks: true });
    }
    if (profile === 'dyslexie') {
      update({ lineSpacing: true, fontScale: 1.15, underlineLinks: true });
    }
    if (profile === 'calme') {
      update({ reduceMotion: true, contrast: 'none' });
    }
  }, [update]);

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
