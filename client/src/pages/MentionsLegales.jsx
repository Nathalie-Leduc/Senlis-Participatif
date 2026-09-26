// ══════════════════════════════════════════════════════════
// Mentions légales — obligatoires pour tout site publié en France
// (loi n° 2004-575 du 21 juin 2004, dite LCEN).
//
// S5A-04 : plus aucun placeholder [ENTRE CROCHETS]. Toutes les
// informations viennent de constants/legal.js — la même source que
// la politique de confidentialité, pour que les deux pages ne se
// contredisent jamais.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import { SITE, EDITOR, HOST, CONTACT_EMAIL, LAST_UPDATED } from '../constants/legal.js';

export default function MentionsLegales() {
  return (
    <div className="wrap" style={{ padding: '40px 20px 60px', maxWidth: 720, margin: '0 auto' }}>
      {/* Titre de l'onglet (RGAA 8.6) — React 19 le place dans le <head> */}
      <title>{`Mentions légales — ${SITE.name}`}</title>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, marginBottom: 8 }}>
        Mentions légales
      </h1>
      <p style={{ color: '#6B6257', marginBottom: 28 }}>Dernière mise à jour : {LAST_UPDATED}</p>

      <Section title="Éditeur du site">
        {EDITOR.name ? (
          <p>
            {SITE.name} ({SITE.url}) est édité par {EDITOR.name} — {EDITOR.status.toLowerCase()}.<br />
            Directrice de la publication : {EDITOR.name}.<br />
            Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        ) : (
          // Mode « éditeur non professionnel » de la LCEN : voir le
          // commentaire de EDITOR dans constants/legal.js.
          <p>
            {SITE.name} ({SITE.url}) est édité par une personne physique, à titre non
            professionnel et bénévole. Conformément à la loi n° 2004-575 du 21 juin 2004 pour
            la confiance dans l'économie numérique, son identité a été communiquée à
            l'hébergeur ci-dessous, qui la tient à la disposition des autorités.<br />
            Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        )}
      </Section>

      <Section title="Hébergement">
        <p>
          {HOST.name}<br />
          {HOST.address}<br />
          Téléphone : {HOST.phone}<br />
          {HOST.registration} — {HOST.dataLocation.toLowerCase()}
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          Les textes, le logo, la mascotte et les éléments graphiques de {SITE.name} sont
          protégés par le droit d'auteur : toute reproduction, même partielle, est soumise à
          autorisation préalable. Les contributions des citoyens (réponses aux enquêtes,
          propositions et arguments) restent la propriété de leurs auteurs.
        </p>
        <p style={{ marginTop: 10 }}>
          Ressources tierces utilisées sous licence libre :
        </p>
        <ul style={listStyle}>
          <li>Fonds de carte © contributeurs OpenStreetMap, sous licence ODbL.</li>
          <li>Contours des quartiers IRIS : INSEE et IGN, sous Licence Ouverte Etalab.</li>
          <li>Polices Fraunces et Public Sans, sous licence SIL Open Font License 1.1.</li>
        </ul>
      </Section>

      <Section title="Données personnelles">
        <p>
          Le traitement de vos données est décrit dans la{' '}
          <Link to="/confidentialite">politique de confidentialité</Link>.
        </p>
      </Section>

      <Section title="Signaler un contenu">
        <p>
          Pour signaler un contenu qui vous semble illicite, écrivez à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> en précisant l'adresse de
          la page concernée et la raison du signalement.
        </p>
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
