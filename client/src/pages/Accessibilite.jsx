// ══════════════════════════════════════════════════════════
// Déclaration d'accessibilité (S5A-07)
//
// Obligatoire pour les sites publics (loi n° 2005-102, art. 47) —
// donc dès que la mairie deviendra éditrice. Rédigée dès maintenant
// sur le modèle officiel du RGAA : état de conformité, contenus non
// accessibles, contact, et voies de recours.
//
// Règle d'or : dire la vérité. Une déclaration « conforme » sans
// audit serait plus grave qu'une déclaration « non conforme » honnête.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { SITE, CONTACT_EMAIL, ACCESSIBILITY } from '../constants/legal.js';

export default function Accessibilite() {
  usePageTitle("Déclaration d'accessibilité");

  return (
    <div className="wrap" style={{ padding: '40px 20px 60px', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, marginBottom: 8 }}>
        Déclaration d'accessibilité
      </h1>
      <p style={{ color: '#6B6257', marginBottom: 28 }}>Établie le {ACCESSIBILITY.declarationDate}</p>

      <Section title="Engagement">
        <p>
          {SITE.name} s'engage à rendre son site accessible à toutes et tous, conformément à
          l'article 47 de la loi n° 2005-102 du 11 février 2005. Cette déclaration s'applique
          au site {SITE.url}.
        </p>
      </Section>

      <Section title="État de conformité">
        <p>
          {SITE.name} est <strong>{ACCESSIBILITY.status}</strong> avec le référentiel général
          d'amélioration de l'accessibilité ({ACCESSIBILITY.standard})
          {ACCESSIBILITY.rate
            ? `, avec un taux de conformité de ${ACCESSIBILITY.rate} (audit du ${ACCESSIBILITY.auditDate}).`
            : ' : aucun audit complet n’a encore été réalisé.'}
        </p>
        <p style={{ marginTop: 10 }}>
          Une auto-évaluation a toutefois guidé la conception du site. Parmi les mesures en place :
        </p>
        <ul style={listStyle}>
          <li>navigation complète au clavier, lien d'évitement « Aller au contenu » ;</li>
          <li>un titre de page unique, et l'annonce de chaque changement de page aux lecteurs d'écran ;</li>
          <li>messages d'erreur des formulaires reliés aux champs concernés et lus à voix haute ;</li>
          <li>contrastes de couleurs vérifiés (au moins 4,5:1 pour le texte) ;</li>
          <li>respect du réglage « réduire les animations » du système ;</li>
          <li>un module d'accessibilité (taille du texte, contrastes renforcés, espacement, police adaptée…) ;</li>
          <li>deux moyens de navigation : le menu et le <Link to="/plan-du-site">plan du site</Link>.</li>
        </ul>
      </Section>

      <Section title="Contenus non accessibles">
        <ul style={listStyle}>
          <li>
            <strong>La carte interactive</strong> est difficile à utiliser au clavier et avec un
            lecteur d'écran. Toutes les informations qu'elle présente sont aussi disponibles sous
            forme de texte, dans la <Link to="/propositions">liste des propositions</Link> et sur
            chaque page de proposition.
          </li>
          <li>
            <strong>Les formulaires d'administration</strong> (réservés aux administrateurs)
            annoncent leurs erreurs de façon globale, sans toujours désigner le champ concerné.
          </li>
          <li>
            <strong>Les graphiques de résultats</strong> (barres de vote) sont doublés par les
            nombres et pourcentages écrits en toutes lettres.
          </li>
        </ul>
      </Section>

      <Section title="Établissement de cette déclaration">
        <p>
          Technologies utilisées : HTML, CSS, JavaScript, WAI-ARIA. Vérifications effectuées :
          navigation au clavier, outils d'analyse automatique (Lighthouse, axe) et tests
          automatisés intégrés au projet.
        </p>
      </Section>

      <Section title="Retour d'information et contact">
        <p>
          Si vous n'arrivez pas à accéder à un contenu ou à un service, écrivez-nous à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : nous vous indiquerons une
          autre façon d'y accéder, ou vous transmettrons l'information sous une autre forme.
        </p>
      </Section>

      <Section title="Voies de recours">
        <p>
          Si vous nous avez signalé un défaut d'accessibilité et n'avez pas obtenu de réponse
          satisfaisante, vous pouvez saisir le Défenseur des droits :
        </p>
        <ul style={listStyle}>
          <li>
            par le formulaire en ligne :{' '}
            <a href="https://formulaire.defenseurdesdroits.fr/" target="_blank" rel="noopener noreferrer">
              formulaire.defenseurdesdroits.fr<span className="sr-only"> (s'ouvre dans un nouvel onglet)</span>
            </a> ;
          </li>
          <li>en contactant un délégué du Défenseur des droits dans votre région ;</li>
          <li>par courrier, gratuit et sans timbre : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 10 }}>{title}</h2>
      <div style={{ color: '#26333A', fontSize: 16, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

const listStyle = { paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 };
