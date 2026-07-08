// ══════════════════════════════════════════════════════════
// Formulaire admin — créer OU éditer une proposition
//
// Un seul composant pour les deux cas, comme beaucoup d'apps le
// font : la présence de ":slug" dans l'URL (/admin/propositions/:slug/modifier
// vs /admin/propositions/nouvelle) détermine si on est en train
// de créer ou d'éditer.
//
// Analogie : c'est le même carnet de commande, que le serveur
// prenne une NOUVELLE commande ou modifie une commande déjà
// passée — seule la présence d'un numéro de table déjà rempli
// change ce qu'il fait du formulaire une fois complété.
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { STATUS_OPTIONS } from '../constants/proposalStatus.js';

const EMPTY_FORM = {
  title: '', summary: '', content: '', status: 'DRAFT',
  lat: '', lng: '', closesAt: '',
};

export default function AdminPropositionForm() {
  const { slug } = useParams(); // undefined en mode création
  const isEdit = !!slug;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [proposalId, setProposalId] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ── En mode édition, charger la proposition existante ────
  useEffect(() => {
    if (!isEdit) return;

    api.get(`/proposals/${slug}`)
      .then((data) => {
        const p = data.proposal;
        setProposalId(p.id);
        setForm({
          title: p.title,
          summary: p.summary,
          content: p.content,
          status: p.status,
          lat: p.lat ?? '',
          lng: p.lng ?? '',
          // <input type="date"> attend "AAAA-MM-JJ" — la réponse API
          // renvoie une date ISO complète ("2026-08-01T00:00:00.000Z"),
          // on ne garde que les 10 premiers caractères.
          closesAt: p.closesAt ? p.closesAt.slice(0, 10) : '',
        });
      })
      .catch((err) => setError(err.message || 'Impossible de charger cette proposition'))
      .finally(() => setLoading(false));
  }, [slug, isEdit]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // On ne transmet que ce qui a une vraie valeur — un champ vide
    // ("") est envoyé comme "absent" (undefined), jamais comme une
    // chaîne vide, pour laisser l'API distinguer "pas encore rempli"
    // de "explicitement effacé".
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      status: form.status,
      lat: form.lat === '' ? undefined : Number(form.lat),
      lng: form.lng === '' ? undefined : Number(form.lng),
      closesAt: form.closesAt === '' ? undefined : form.closesAt,
    };

    try {
      if (isEdit) {
        await api.patch(`/proposals/${proposalId}`, payload);
      } else {
        await api.post('/proposals', payload);
      }
      navigate('/admin/propositions');
    } catch (err) {
      // Si l'API renvoie des détails de validation (Zod), on affiche
      // la première erreur de champ — même convention que Inscription.jsx.
      if (err.details) {
        setError(Object.values(err.details)[0]);
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 640 }}>
      <Link to="/admin/propositions" style={{ color: '#6B6257', fontSize: 14 }}>← Retour à la liste</Link>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 24px' }}>
        {isEdit ? 'Modifier la proposition' : 'Nouvelle proposition'}
      </h1>

      {error && (
        <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Titre">
          <input
            name="title" value={form.title} onChange={handleChange} required
            style={inputStyle}
          />
        </Field>

        <Field label="Accroche (résumé court, affiché sur les cartes)">
          <textarea
            name="summary" value={form.summary} onChange={handleChange} required
            rows={2} style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        <Field label="Argumentaire complet">
          <textarea
            name="content" value={form.content} onChange={handleChange} required
            rows={8} style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        {/* Le statut ne se change vraiment "à la légère" qu'en édition —
            à la création, DRAFT par défaut est presque toujours le bon
            choix (voir authController pour la même logique de defaults
            appliquée ailleurs dans le projet). On le laisse quand même
            modifiable ici : rien n'empêche de publier dès la création. */}
        <Field label="Statut">
          <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'flex', gap: 14 }}>
          <Field label="Latitude (optionnel)">
            <input
              type="number" step="any" name="lat" value={form.lat} onChange={handleChange}
              placeholder="49.2058" style={inputStyle}
            />
          </Field>
          <Field label="Longitude (optionnel)">
            <input
              type="number" step="any" name="lng" value={form.lng} onChange={handleChange}
              placeholder="2.5847" style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Date de clôture des votes (optionnel)">
          <input
            type="date" name="closesAt" value={form.closesAt} onChange={handleChange}
            style={inputStyle}
          />
        </Field>

        <button type="submit" disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer les modifications' : 'Créer la proposition')}
        </button>
      </form>
    </div>
  );
}

// ── Petit composant local : un label + son champ ─────────
function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, fontWeight: 600, fontSize: 14, color: '#26333A' }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '2px solid #e3dcce',
  fontSize: 15,
  fontFamily: 'inherit',
  minHeight: 48, // cible tactile confortable, même règle que VoteButtons
};
