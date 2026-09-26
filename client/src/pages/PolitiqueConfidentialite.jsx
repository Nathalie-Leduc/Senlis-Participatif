// ══════════════════════════════════════════════════════════
// Politique de confidentialité — S5A-04
//
// Règle de rédaction : décrire ce que l'application fait RÉELLEMENT
// (schema.prisma, authController.js, stockage navigateur…), ni plus
// ni moins. Corrections par rapport à la version précédente :
//  - base légale « art. 6.1.e » retirée : elle est réservée aux
//    autorités publiques (mission d'intérêt public) — le site n'est
//    pas édité par la mairie ;
//  - profil déclaré (résidence, travail) ajouté : il était collecté
//    mais pas mentionné ;
//  - « horodatage de dernière connexion » retiré : ce champ n'existe
//    pas en base ;
//  - « cookies » remplacés par la vraie liste des données stockées
//    dans le navigateur (l'application ne pose aucun cookie) ;
//  - destinataires, durées, droits complets et recours CNIL ajoutés
//    (mentions obligatoires, RGPD art. 13).
//
// Toutes les listes viennent de constants/legal.js.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import {
  SITE, EDITOR, CONTACT_EMAIL, LAST_UPDATED, RECIPIENTS, BROWSER_STORAGE, RETENTION, CNIL,
} from '../constants/legal.js';

export default function PolitiqueConfidentialite() {
  const mailto = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <div className="wrap" style={{ padding: '40px 20px 60px', maxWidth: 760, margin: '0 auto' }}>
      {/* Titre de l'onglet (RGAA 8.6) — React 19 le place dans le <head> */}
      <title>{`Politique de confidentialité — ${SITE.name}`}</title>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, marginBottom: 8 }}>
        Politique de confidentialité
      </h1>
      <p style={{ color: '#6B6257', marginBottom: 28 }}>Dernière mise à jour : {LAST_UPDATED}</p>

      <Section title="En bref">
        <ul style={listStyle}>
          <li>Nous collectons le minimum pour faire fonctionner le service : un pseudo, un email, un mot de passe, votre situation à Senlis, et vos participations.</li>
          <li>Vos votes et réponses ne sont <strong>jamais publiés individuellement</strong> : seuls des totaux sont affichés, et un groupe de moins de 5 personnes n'est jamais détaillé.</li>
          <li>Aucune publicité, aucune revente, aucun pixel espion, aucun cookie.</li>
          <li>Vos données sont hébergées en France. Vous pouvez supprimer votre compte vous-même, à tout moment.</li>
        </ul>
      </Section>

      <Section title="Qui est responsable de vos données ?">
        <p>
          Le responsable du traitement est l'éditeur du site
          {EDITOR.name ? ` : ${EDITOR.name}` : ', une personne physique agissant à titre non professionnel'}
          {' '}(voir les <Link to="/mentions-legales">mentions légales</Link>). Pour toute question
          ou demande concernant vos données : {mailto}.
        </p>
      </Section>

      <Section title="Quelles données, pourquoi, et sur quelle base légale ?">
        <Table
          caption="Données collectées, finalité et base légale"
          headers={['Données', 'À quoi elles servent', 'Base légale (RGPD)']}
          rows={[
            [
              'Compte : pseudo, adresse email, mot de passe (jamais stocké en clair : seule une empreinte Argon2 est conservée), date de création',
              'Vous identifier, sécuriser votre compte, vous envoyer les emails indispensables (vérification d’adresse, mot de passe oublié)',
              'Exécution du service que vous demandez (art. 6.1.b)',
            ],
            [
              'Profil déclaré : lieu de résidence (centre historique, autre quartier — lequel —, hors Senlis) et, si vous le précisez, quartier de travail et rôle (commerçant·e ou salarié·e)',
              'Vous proposer les enquêtes qui vous concernent, et produire des résultats agrégés par type de public (ex. « résidents du centre »)',
              'Exécution du service (art. 6.1.b) ; pour les statistiques agrégées, notre intérêt légitime à montrer que chaque public a été entendu (art. 6.1.f)',
            ],
            [
              'Participation : vos votes (pour / contre / neutre) et vos réponses aux enquêtes',
              'Comptabiliser une seule participation par personne et publier des résultats d’ensemble',
              'Exécution du service (art. 6.1.b)',
            ],
            [
              'Sécurité : jetons à usage unique envoyés par email, code de connexion des administrateurs, journaux techniques du serveur',
              'Protéger les comptes et le service contre les abus',
              'Intérêt légitime (art. 6.1.f)',
            ],
          ]}
        />
        <p style={{ marginTop: 12 }}>
          Nous ne collectons ni votre nom, ni votre adresse postale, ni votre téléphone, ni votre
          position géographique. Votre profil déclaré est <strong>auto-déclaratif</strong> : nous
          ne demandons aucun justificatif. Conseil : choisissez un pseudo qui ne permet pas de
          vous reconnaître, et n'indiquez pas d'information personnelle dans les réponses libres
          des enquêtes.
        </p>
      </Section>

      <Section title="Ce que nous ne faisons jamais">
        <ul style={listStyle}>
          <li>Publier votre vote ou vos réponses individuellement — ni même les résultats d'un groupe de moins de 5 personnes, pour qu'on ne puisse pas deviner qui a répondu quoi.</li>
          <li>Vendre, louer ou céder vos données, ou les utiliser à des fins publicitaires.</li>
          <li>Suivre l'ouverture de nos emails : conformément à la recommandation de la CNIL du 14 avril 2026, nos messages ne contiennent aucun pixel de suivi.</li>
          <li>Prendre une décision automatisée vous concernant sur la base de votre profil.</li>
        </ul>
      </Section>

      <Section title="Qui d'autre voit passer vos données ?">
        <Table
          caption="Destinataires des données"
          headers={['Destinataire', 'Rôle', 'Données concernées']}
          rows={RECIPIENTS.map((r) => [r.name, r.role, r.data])}
        />
        <p style={{ marginTop: 12 }}>
          Aucune donnée n'est transférée hors de l'Union européenne, à l'exception de l'affichage
          des fonds de carte OpenStreetMap (Royaume-Uni, pays reconnu par la Commission européenne
          comme offrant une protection adéquate). Les polices de caractères sont hébergées par
          nos soins : aucun service de Google n'est appelé.
        </p>
      </Section>

      <Section title="Combien de temps ?">
        <Table
          caption="Durées de conservation"
          headers={['Données', 'Durée de conservation']}
          rows={RETENTION.map((r) => [r.data, r.duration])}
        />
      </Section>

      <Section title="Cookies et stockage dans votre navigateur">
        <p>
          Ce site <strong>ne dépose aucun cookie</strong>. Il enregistre seulement quelques
          informations dans le stockage de votre navigateur, toutes indispensables au service ou
          choisies par vous — c'est pourquoi aucun bandeau de consentement n'est nécessaire
          (délibération CNIL n° 2020-091).
        </p>
        <Table
          caption="Données enregistrées dans votre navigateur"
          headers={['Nom', 'À quoi il sert', 'Durée']}
          rows={BROWSER_STORAGE.map((s) => [<code key={s.key}>{s.key}</code>, s.purpose, s.duration])}
        />
      </Section>

      <Section title="Sécurité">
        <p>
          Connexions chiffrées (HTTPS), mots de passe hachés avec Argon2, double authentification
          par email pour les comptes administrateurs, limitation des tentatives de connexion,
          hébergement en France chez un prestataire certifié ISO 27001.
        </p>
      </Section>

      <Section title="Vos droits">
        <ul style={listStyle}>
          <li><strong>Accès et rectification</strong> : consultez et modifiez votre pseudo, votre email et votre profil dans <Link to="/mon-compte">Mon compte</Link>.</li>
          <li>
            <strong>Effacement</strong> : le bouton « Supprimer mon compte » de <em>Mon compte </em>
            supprime immédiatement votre compte et vos votes ; vos réponses aux enquêtes ne sont
            plus rattachées à vous et restent seulement comme bulletins anonymes.
          </li>
          <li><strong>Portabilité</strong> : recevoir vos données dans un format lisible par une machine.</li>
          <li><strong>Opposition</strong> : vous opposer à l'utilisation de votre profil déclaré dans les statistiques agrégées — il suffit aussi de ne pas le renseigner ou de l'effacer.</li>
          <li><strong>Limitation</strong>, et <strong>directives</strong> sur le sort de vos données après votre décès.</li>
        </ul>
        <p style={{ marginTop: 10 }}>
          Pour exercer un droit qui ne se fait pas directement depuis <em>Mon compte</em>,
          écrivez à {mailto} depuis l'adresse de votre compte. Nous répondons sous un mois.
        </p>
        <p style={{ marginTop: 10 }}>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une
          réclamation à la CNIL :{' '}
          <a href={CNIL.complaintUrl} target="_blank" rel="noopener noreferrer">
            cnil.fr/fr/plaintes<span className="sr-only"> (s'ouvre dans un nouvel onglet)</span>
          </a>.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 10 }}>{title}</h2>
      <div style={{ color: '#26333A', fontSize: 16, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

// Vrai <table> avec <caption> et <th scope="col"> : un lecteur d'écran
// annonce l'en-tête de colonne à chaque cellule (RGAA 5.4 à 5.7).
// Le conteneur défile horizontalement sur mobile au lieu de déborder.
function Table({ caption, headers, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, lineHeight: 1.5 }}>
        <caption style={{ textAlign: 'left', fontSize: 13, color: '#6B6257', marginBottom: 6 }}>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #D9D2C3', verticalAlign: 'bottom' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((cell, j) => (
                <td key={j} style={{ padding: '8px 10px', borderBottom: '1px solid #E8E2D6', verticalAlign: 'top' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const listStyle = { paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 };
