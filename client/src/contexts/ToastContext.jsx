// ══════════════════════════════════════════════════════════
// Contexte Toast — un seul toast affiché à la fois, avec
// disparition automatique. N'importe quel composant peut en
// déclencher un via useToast(), sans avoir à gérer lui-même
// son propre minuteur ou état local (voir l'ancienne version
// dupliquée dans PropositionDetail.jsx, désormais remplacée).
// ══════════════════════════════════════════════════════════

import {
  createContext, useContext, useState, useCallback, useRef,
} from 'react';
import Toast from '../components/Toast/Toast.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);

  // duration configurable au cas par cas (un message plus long peut
  // avoir besoin d'un peu plus de temps à l'écran) — 3s par défaut,
  // identique à ce que faisait déjà PropositionDetail.jsx.
  const showToast = useCallback((text, duration = 3000) => {
    clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = setTimeout(() => setMessage(null), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast message={message} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast doit être utilisé dans un <ToastProvider>');
  }
  return ctx;
}
