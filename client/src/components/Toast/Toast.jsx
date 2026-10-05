// ══════════════════════════════════════════════════════════
// Composant Toast — juste l'affichage. La logique (délai avant
// disparition, un seul toast à la fois) vit dans ToastContext —
// ce composant ne fait qu'afficher ce qu'on lui donne.
// ══════════════════════════════════════════════════════════

export default function Toast({ message }) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="toast"
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: '#26333A', color: '#fff', padding: '12px 24px', borderRadius: 999,
        fontWeight: 600, fontSize: 15, zIndex: 3500, boxShadow: '0 8px 24px rgba(0,0,0,.2)',
        maxWidth: 'calc(100vw - 40px)', textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
