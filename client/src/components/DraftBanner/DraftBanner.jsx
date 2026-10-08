// ══════════════════════════════════════════════════════════
// Bandeau « Aperçu d'un brouillon » (S5R-12)
//
// Avec le bouton « Voir » des listes admin, l'administration peut
// ouvrir la page PUBLIQUE d'un brouillon (l'API le lui permet, à elle
// seule). Sans bandeau, rien ne distinguerait cet aperçu d'une page
// déjà en ligne : on le dit clairement.
// role="status" : annoncé par les lecteurs d'écran à l'arrivée.
// ══════════════════════════════════════════════════════════

export default function DraftBanner({ status }) {
  if (status !== 'DRAFT') return null;
  return (
    <p role="status" style={{
      background: '#FFF4DB', border: '2px solid #D4A84A', borderRadius: 12,
      padding: '10px 14px', fontSize: 15, margin: '0 0 12px', color: '#26333A',
    }}>
      <span aria-hidden="true">👁 </span>
      <strong>Aperçu d'un brouillon</strong> : cette page n'est visible que par l'administration,
      tant qu'elle n'est pas publiée.
    </p>
  );
}
