// ══════════════════════════════════════════════════════════
// Politique de confidentialité — reflète ce que l'application
// fait RÉELLEMENT (pas un texte générique copié-collé) : les
// données collectées, leur base légale, la durée de conservation
// et le droit à l'effacement correspondent exactement à ce que
// authController.js / schema.prisma implémentent déjà.
// ══════════════════════════════════════════════════════════

export default function PolitiqueConfidentialite() {
  return (
    <div className="wrap" style={{ padding: '40px 20px 60px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, marginBottom: 8 }}>
        Politique de confidentialité
      </h1>
      <p style={{ color: '#6B6257', marginBottom: 28 }}>
        Dernière mise à jour : [date de mise en ligne]
      </p>

      <Section title="Qui sommes-nous ?">
        <p>
          Senlis Participatif est une plateforme de participation citoyenne éditée par
          [structure éditrice — voir mentions légales]. Cette politique explique quelles
          données nous collectons, pourquoi, et comment vous pouvez y accéder ou les
          effacer.
        </p>
      </Section>

      <Section title="Données que nous collectons">
        <ul style={listStyle}>
          <li><strong>À l'inscription :</strong> votre pseudo, votre adresse email, et un mot de passe (jamais stocké en clair — uniquement sous forme de hash Argon2, impossible à retrouver même par nous).</li>
          <li><strong>Votre participation :</strong> vos votes sur les propositions, vos réponses aux enquêtes, et les propositions ou commentaires que vous publiez.</li>
          <li><strong>Technique :</strong> un jeton de connexion (JWT) le temps de votre session, et l'horodatage de votre dernière connexion.</li>
        </ul>
        <p>Nous ne collectons jamais votre adresse postale, votre numéro de téléphone, ni aucune donnée de localisation précise en dehors de ce que vous indiquez volontairement dans une proposition.</p>
      </Section>

      <Section title="Pourquoi nous les utilisons">
        <p>
          Ces données servent uniquement à faire fonctionner la plateforme : vous identifier,
          comptabiliser un vote ou une réponse une seule fois par personne, et vous permettre
          de suivre vos propres contributions. Base légale : l'exécution du service que vous
          nous demandez en créant un compte (art. 6.1.b du RGPD), et l'intérêt légitime de la
          collectivité à recueillir l'avis des habitants pour les enquêtes (art. 6.1.e).
        </p>
      </Section>

      <Section title="Emails et pixels de suivi">
        <p>
          Nous vous envoyons des emails strictement liés à votre compte (vérification
          d'adresse, réinitialisation de mot de passe) et, si vous y consentez, des
          notifications sur les nouvelles propositions ou enquêtes.
        </p>
        <p>
          Conformément à la recommandation de la CNIL du 14 avril 2026 sur les pixels de
          suivi dans les emails, <strong>nous n'insérons aucun pixel espion dans nos
          messages</strong> : nous ne cherchons pas à savoir si, quand, ni depuis quel
          appareil vous avez ouvert un email.
        </p>
      </Section>

      <Section title="Combien de temps conservons-nous vos données ?">
        <p>
          Tant que votre compte existe. Un compte inactif depuis plus de [durée — ex. 3 ans]
          peut être supprimé automatiquement. Vous pouvez aussi supprimer votre compte à
          tout moment, immédiatement et vous-même, depuis <em>Mon compte</em>.
        </p>
      </Section>

      <Section title="Vos droits">
        <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et d'effacement de vos données.</p>
        <ul style={listStyle}>
          <li><strong>Accès et rectification :</strong> directement depuis la page <em>Mon compte</em>.</li>
          <li>
            <strong>Effacement :</strong> le bouton "Supprimer mon compte" dans <em>Mon compte</em> supprime
            immédiatement votre compte et vos votes ; vos réponses aux enquêtes sont conservées de
            façon anonyme (elles ne sont plus rattachées à vous) pour ne pas fausser les résultats déjà publiés.
          </li>
          <li><strong>Autre demande :</strong> écrivez-nous à [email de contact].</li>
        </ul>
      </Section>

      <Section title="Cookies">
        <p>
          Nous n'utilisons que des cookies strictement nécessaires au fonctionnement du
          site (maintenir votre connexion) — aucun cookie publicitaire, aucun traceur
          tiers, donc pas de bandeau de consentement requis pour ceux-ci.
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
