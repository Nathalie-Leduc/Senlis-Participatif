// ══════════════════════════════════════════════════════════
// Composant Mascot — Le cerf de Senlis 🦌
//
// SVG inline : zéro requête réseau, stylable en CSS,
// animable sans JavaScript. Le cerf existe en 4 tailles
// et porte les animations CSS définies dans _mascot.scss.
//
// Props :
//   size     : 'hero' | 'section' | 'inline' | 'widget' (default: 'inline')
//   speech   : string | null — texte de la bulle (optionnel)
//   className: string — classes CSS supplémentaires
//
// Accessibilité :
//   - En taille hero : role="img" + aria-label (significatif)
//   - Autres tailles : aria-hidden="true" (décoratif)
// ══════════════════════════════════════════════════════════

export default function Mascot({ size = 'inline', speech = null, className = '' }) {
  // Le cerf hero est significatif (il accueille), les autres sont décoratifs
  const isDecorative = size !== 'hero';

  return (
    <div className={`mascot-container ${className}`} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bulle de parole (optionnelle) */}
      {speech && (
        <div className="speech-bubble">
          {speech}
        </div>
      )}

      {/* Le cerf SVG — toutes les classes d'animation sont dans _mascot.scss */}
      <svg
        className={`mascot mascot--${size}`}
        viewBox="0 0 200 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...(isDecorative
          ? { 'aria-hidden': 'true' }
          : { role: 'img', 'aria-label': 'Cerf, mascotte de Senlis Participatif' }
        )}
      >
        {/* ── Corps ─────────────────────────────────────── */}
        <ellipse cx="100" cy="158" rx="44" ry="38" fill="#C89B3C" />
        <ellipse cx="100" cy="158" rx="38" ry="32" fill="#D4A84A" />
        {/* Ventre */}
        <ellipse cx="100" cy="165" rx="24" ry="18" fill="#F6F1E7" />

        {/* ── Pattes ────────────────────────────────────── */}
        <rect x="68" y="184" width="11" height="28" rx="5.5" fill="#C89B3C" />
        <rect x="120" y="184" width="11" height="28" rx="5.5" fill="#C89B3C" />
        {/* Sabots */}
        <rect x="66" y="208" width="15" height="8" rx="4" fill="#26333A" />
        <rect x="118" y="208" width="15" height="8" rx="4" fill="#26333A" />

        {/* ── Queue (animée) ─────────────────────────────── */}
        <g className="tail-wag">
          <ellipse cx="144" cy="148" rx="10" ry="7" fill="#F6F1E7" transform="rotate(-20 144 148)" />
        </g>

        {/* ── Tête ──────────────────────────────────────── */}
        <ellipse cx="100" cy="96" rx="34" ry="30" fill="#D4A84A" />
        <ellipse cx="100" cy="102" rx="22" ry="18" fill="#E8BD6A" />

        {/* ── Museau ────────────────────────────────────── */}
        <ellipse cx="100" cy="112" rx="14" ry="9" fill="#F6F1E7" />
        <ellipse cx="100" cy="108" rx="7" ry="4.5" fill="#26333A" />
        {/* Sourire */}
        <path d="M93 116 Q100 121 107 116" stroke="#26333A" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* ── Yeux (animés — clignement) ─────────────────── */}
        <g className="eye-blink" style={{ transformOrigin: '86px 96px' }}>
          <circle cx="86" cy="96" r="5.5" fill="#26333A" />
          <circle cx="84" cy="94" r="2" fill="#fff" />
        </g>
        <g className="eye-blink" style={{ transformOrigin: '114px 96px' }}>
          <circle cx="114" cy="96" r="5.5" fill="#26333A" />
          <circle cx="112" cy="94" r="2" fill="#fff" />
        </g>

        {/* ── Sourcils (joyeux) ──────────────────────────── */}
        <path d="M78 88 Q83 84 89 87" stroke="#C89B3C" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M111 87 Q117 84 122 88" stroke="#C89B3C" strokeWidth="2" fill="none" strokeLinecap="round" />

        {/* ── Joues rosées ──────────────────────────────── */}
        <circle cx="76" cy="105" r="7" fill="#E8A090" opacity="0.3" />
        <circle cx="124" cy="105" r="7" fill="#E8A090" opacity="0.3" />

        {/* ── Oreilles (animées — curiosité) ─────────────── */}
        <g className="ear-wiggle" style={{ transformOrigin: '74px 78px' }}>
          <ellipse cx="68" cy="68" rx="10" ry="18" fill="#D4A84A" transform="rotate(-25 68 68)" />
          <ellipse cx="68" cy="68" rx="5" ry="12" fill="#E8BD6A" transform="rotate(-25 68 68)" />
        </g>
        <g className="ear-wiggle" style={{ transformOrigin: '126px 78px', animationDelay: '0.3s' }}>
          <ellipse cx="132" cy="68" rx="10" ry="18" fill="#D4A84A" transform="rotate(25 132 68)" />
          <ellipse cx="132" cy="68" rx="5" ry="12" fill="#E8BD6A" transform="rotate(25 132 68)" />
        </g>

        {/* ── Bois ──────────────────────────────────────── */}
        <g stroke="#8B6914" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M78 66 L68 38 L58 27" />
          <path d="M68 38 L78 30" />
          <path d="M122 66 L132 38 L142 27" />
          <path d="M132 38 L122 30" />
        </g>

        {/* ── Écharpe Bleu Nonette (la rivière !) ────────── */}
        <path d="M64 126 Q100 138 136 126 Q140 132 134 138 Q100 148 66 138 Q60 132 64 126 Z" fill="#1E5F7C" />
        <path d="M128 132 L136 156 L124 152 Z" fill="#1E5F7C" />

        {/* ── Étoiles décoratives ────────────────────────── */}
        <text x="40" y="56" fontSize="14" fill="#F0C45A" opacity="0.7">✦</text>
        <text x="155" y="48" fontSize="10" fill="#fff" opacity="0.4">✦</text>
      </svg>
    </div>
  );
}
