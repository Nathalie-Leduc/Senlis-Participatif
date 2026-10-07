// ══════════════════════════════════════════════════════════
// Plan du site (S5A-07 — RGAA 12.1 : au moins deux systèmes de
// navigation). Le menu en est un ; le plan du site est le second :
// toutes les pages, sur une seule page, dans une liste simple.
//
// Analogie : le plan affiché à l'entrée d'un centre commercial —
// utile à qui ne trouve pas son chemin avec les panneaux.
//
// Les rubriques « Mon compte » et « Administration » n'apparaissent
// qu'aux personnes qui peuvent y accéder.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const PUBLIC_SECTIONS = [
  {
    title: 'Participer',
    links: [
      { to: '/', label: 'Accueil' },
      { to: '/propositions', label: 'Propositions et votes' },
      { to: '/enquetes', label: 'Enquêtes' },
      { to: '/carte', label: 'Carte des quartiers' },
    ],
  },
  {
    title: 'Compte',
    links: [
      { to: '/inscription', label: 'Créer un compte' },
      { to: '/connexion', label: 'Se connecter' },
      { to: '/mot-de-passe-oublie', label: 'Mot de passe oublié' },
    ],
  },
  {
    title: 'Informations',
    links: [
      { to: '/mentions-legales', label: 'Mentions légales' },
      { to: '/confidentialite', label: 'Politique de confidentialité' },
      { to: '/accessibilite', label: "Déclaration d'accessibilité" },
    ],
  },
];

const ADMIN_LINKS = [
  { to: '/admin/propositions', label: 'Gérer les propositions' },
  { to: '/admin/enquetes', label: 'Gérer les enquêtes' },
  { to: '/admin/comptes', label: 'Gérer les comptes' },
];

export default function PlanDuSite() {
  usePageTitle('Plan du site');
  const { isLogged, isAdmin } = useAuth();

  const sections = [
    ...PUBLIC_SECTIONS,
    ...(isLogged ? [{ title: 'Mon espace', links: [{ to: '/mon-compte', label: 'Mon compte' }] }] : []),
    ...(isAdmin ? [{ title: 'Administration', links: ADMIN_LINKS }] : []),
  ];

  return (
    <div className="wrap" style={{ padding: '40px 20px 60px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, marginBottom: 24 }}>Plan du site</h1>

      {sections.map((section) => (
        <section key={section.title} style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 8 }}>{section.title}</h2>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 17 }}>
            {section.links.map((link) => (
              <li key={link.to}><Link to={link.to}>{link.label}</Link></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
