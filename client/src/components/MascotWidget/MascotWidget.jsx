// ══════════════════════════════════════════════════════════
// Guide « Cerf-tifié utile ! » — S5R-04 (recette du 30/09)
//
// Avant : un deuxième cerf en pied (petit, avec sa bulle « Découvrez le
// site ! ») flottait à côté du grand cerf de l'accueil, qui disait déjà
// « Bienvenue à Senlis ! ». Deux cerfs, deux bulles, le même message.
//
// Maintenant, comme dans la maquette (prototype 17) : le grand cerf
// reste dans la page d'accueil, et le guide devient un BOUTON ROND
// (le visage du cerf) qui ouvre un petit panneau d'aide — une
// astuce adaptée à la page, et des questions fréquentes.
//
// Analogie : à l'accueil d'une mairie, la statue dans le hall et le
// guichet « Renseignements ». Les deux ont leur rôle, mais on ne les
// confond pas.
//
// Différences volontaires avec la maquette :
//  - coin BAS-GAUCHE (et non bas-droit) : le bas-droit est déjà pris
//    par le bouton d'accessibilité ♿, qui doit rester à sa place ;
//  - textes en Ardoise sur Doré (5,9:1) : le blanc et le doré de la
//    maquette n'atteignaient que 2,2:1 (illisible, RGAA 3.2) ;
//  - un bouton ✕ et la touche Échap pour fermer, le focus déplacé dans
//    le panneau puis rendu au bouton (même logique que le module ♿).
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PAGE_TIPS, DEFAULT_TIP, FAQ } from './guideContent.jsx';

/** Le visage du cerf, en version « bouton » (repris de la maquette) */
function DeerFace({ size = 42 }) {
  // className « mascot-… » : en contraste « Sombre », le module ♿
  // inverse les couleurs de toute la page, puis RÉ-inverse la mascotte
  // (sélecteur [class*='mascot']) pour qu'elle garde ses vraies couleurs
  return (
    <svg className="mascot-face" viewBox="0 0 42 42" width={size} height={size} fill="none" aria-hidden="true" focusable="false">
      <circle cx="21" cy="21" r="18" fill="#D4A84A" />
      <circle cx="21" cy="23" r="12" fill="#F6F1E7" />
      <circle cx="16" cy="19" r="2.5" fill="#26333A" /><circle cx="15" cy="18" r="1" fill="#fff" />
      <circle cx="26" cy="19" r="2.5" fill="#26333A" /><circle cx="25" cy="18" r="1" fill="#fff" />
      <ellipse cx="21" cy="22" rx="3" ry="2" fill="#26333A" />
      <path d="M17 26 Q21 30 25 26" stroke="#26333A" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <g stroke="#8B6914" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M12 11 L8 3 L5 0" /><path d="M8 3 L11 1" />
        <path d="M30 11 L34 3 L37 0" /><path d="M34 3 L31 1" />
      </g>
    </svg>
  );
}

export default function MascotWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  // Pastille « 1 » tant que le guide n'a jamais été ouvert pendant la
  // visite (simple état React : rien n'est stocké dans le navigateur)
  const [seen, setSeen] = useState(false);
  // Fil de la conversation : les questions posées et leurs réponses
  const [thread, setThread] = useState([]);

  const toggleRef = useRef(null);
  const closeRef = useRef(null);
  const messagesRef = useRef(null);
  const wasOpenRef = useRef(false);

  const tip = PAGE_TIPS.find((t) => t.match(pathname))?.text ?? DEFAULT_TIP;

  // Nouvelle page : le panneau se referme et la conversation repart
  // de zéro (l'astuce d'accueil change avec la page)
  useEffect(() => {
    setOpen(false);
    setThread([]);
  }, [pathname]);

  // Focus : dans le panneau à l'ouverture, rendu au bouton à la fermeture
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpenRef.current) toggleRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  // Échap ferme le panneau
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Chaque nouvelle réponse reste visible : on fait défiler vers le bas
  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [thread]);

  const toggle = () => {
    setOpen((o) => !o);
    setSeen(true);
  };

  const ask = (item) => setThread((t) => [...t, item]);

  return (
    <div className="guide-widget">
      {open && (
        <div id="guide-panel" className="guide-panel" role="dialog" aria-modal="false" aria-labelledby="guide-title">
          <div className="guide-head">
            <DeerFace size={40} />
            <div className="guide-head-text">
              <h2 id="guide-title">Cerf-tifié utile ! <span aria-hidden="true">🦌</span></h2>
              <p>Votre guide citoyen</p>
            </div>
            <button type="button" ref={closeRef} className="guide-close" onClick={() => setOpen(false)} aria-label="Fermer le guide">✕</button>
          </div>

          {/* aria-live : chaque réponse ajoutée est lue à voix haute */}
          <div className="guide-msgs" ref={messagesRef} aria-live="polite">
            <p className="guide-msg">👋 Bienvenue ! Je suis le cerf de Senlis, je vous aide à vous repérer.</p>
            <p className="guide-msg">💡 {tip}</p>
            {thread.map((item, i) => (
              <div key={`${item.id}-${i}`}>
                <p className="guide-msg guide-msg--user">{item.question}</p>
                <p className="guide-msg">{item.answer}</p>
              </div>
            ))}
          </div>

          <div className="guide-actions" role="group" aria-label="Questions fréquentes">
            {FAQ.map((item) => (
              <button key={item.id} type="button" className="guide-btn" onClick={() => ask(item)}>
                {item.question}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        ref={toggleRef}
        onClick={toggle}
        aria-expanded={open}
        aria-controls="guide-panel"
        // Nom FIXE : c'est aria-expanded qui dit « ouvert / fermé ». Un nom
        // qui change (« Fermer le guide ») ferait doublon avec le ✕
        aria-label="Guide citoyen"
        className={`guide-toggle${seen ? '' : ' guide-toggle--new'}`}
      >
        <DeerFace />
      </button>
    </div>
  );
}
