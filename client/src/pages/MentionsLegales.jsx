// ══════════════════════════════════════════════════════════
// Page Mentions légales — obligatoire pour tout site publié en
// France (art. 6-III de la LCEN). Contenu volontairement en
// placeholders [ENTRE CROCHETS] : ces informations dépendent de qui
// héberge et édite réellement le site en production (mairie de
// Senlis ? une association ? un développeur indépendant ?) —
// à remplir avant la mise en ligne (S5-10, release v1.0.0).
// ══════════════════════════════════════════════════════════

export default function MentionsLegales() {
  return (
    <div className="wrap" style={{ padding: '40px 20px 60px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, marginBottom: 24 }}>
        Mentions légales
      </h1>

      <Section title="Éditeur du site">
        <p>
          [Nom de la structure éditrice — ex. Mairie de Senlis / association organisatrice]<br />
          [Adresse postale]<br />
          [Téléphone] — [Email de contact]<br />
          Directeur·rice de la publication : [Nom, fonction]
        </p>
      </Section>

      <Section title="Hébergement">
        <p>
          [Nom de l'hébergeur]<br />
          [Adresse de l'hébergeur]<br />
          [Téléphone de l'hébergeur]
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus présents sur Senlis Participatif (textes, logo, mascotte,
          éléments graphiques) est protégé par le droit d'auteur. Toute reproduction, même
          partielle, est soumise à autorisation préalable, à l'exception des contenus soumis
          par les citoyens (propositions, réponses aux enquêtes) qui restent leur propriété.
        </p>
      </Section>

      <Section title="Signaler un contenu">
        <p>
          Pour signaler un contenu qui vous semble contraire à la loi ou aux présentes
          mentions, contactez-nous à [email de contact].
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
