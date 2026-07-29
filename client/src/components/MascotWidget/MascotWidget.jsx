// ══════════════════════════════════════════════════════════
// MascotWidget — guide-citoyen (S5-06, palier 2)
//
// Une petite mascotte persistante en bas à gauche (l'accessibilité
// occupe déjà le bas à droite), qui propose une astuce différente
// selon la page — pas un gadget statique, un vrai repère contextuel.
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Mascot from '../Mascot/Mascot.jsx';

// Testé dans l'ordre, la première correspondance gagne — d'où les
// routes les plus spécifiques (ex. /admin/...) avant les plus
// génériques si jamais elles se recoupaient un jour.
//
// Volontairement COURTES (35 caractères max) : la bulle reste en
// une seule ligne (voir le correctif CSS ci-dessous) — une phrase
// trop longue déborderait du bord de l'écran, le widget étant collé
// au coin bas-gauche.
const TIPS = [
  { match: (path) => path === '/', text: 'Découvrez le site !' },
  { match: (path) => path.startsWith('/propositions'), text: 'Votez en un clic' },
  { match: (path) => path.startsWith('/enquetes'), text: 'Votre avis compte !' },
  { match: (path) => path.startsWith('/inscription'), text: 'Vérifiez votre email' },
  { match: (path) => path.startsWith('/mon-compte'), text: 'Gérez votre compte ici' },
  { match: (path) => path.startsWith('/admin'), text: 'Un brouillon reste privé' },
];
const DEFAULT_TIP = 'Besoin d\'aide ?';

export default function MascotWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const tip = TIPS.find((t) => t.match(location.pathname))?.text || DEFAULT_TIP;

  // Referme la bulle à chaque changement de page — une astuce valable
  // sur /propositions n'a aucune raison de rester affichée une fois
  // sur /enquetes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-label="Astuce de la mascotte"
      style={{
        position: 'fixed', left: 20, bottom: 20, zIndex: 1500,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        borderRadius: '50%',
      }}
    >
      <Mascot size="widget" speech={open ? tip : null} className="mascot-guide" />
    </button>
  );
}
