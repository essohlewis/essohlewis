import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatXof } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function TipsterProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [picks, setPicks] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  async function load() {
    try {
      const [p, preds] = await Promise.all([
        api.get(`/tipsters/${id}`),
        api.get(`/tipsters/${id}/predictions`),
      ]);
      setProfile(p);
      setPicks(preds.data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function subscribe() {
    setNote(null);
    try {
      await api.post('/subscriptions', { tipster_id: Number(id) });
      setNote('Abonnement activé — les pronostics sont désormais visibles.');
      await load();
    } catch (e) {
      setNote(e.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!profile) return <p>Chargement…</p>;

  const r = profile.reliability;

  return (
    <section>
      <h1>{profile.tipster.display_name}</h1>
      <p className="muted">{profile.tipster.bio}</p>

      {r ? (
        <div className="stats">
          <Stat label="Score" value={r.score} />
          <Stat label="Rendement" value={`${r.yield >= 0 ? '+' : ''}${r.yield}%`} />
          <Stat label="Réussite" value={`${r.win_rate}%`} />
          <Stat label="Réglés" value={r.settled_count} />
          <Stat label="Badge" value={r.badge} />
        </div>
      ) : (
        <p className="muted">Pas encore de statistiques.</p>
      )}

      <div className="subscribe-bar">
        {user ? (
          <button className="primary" onClick={subscribe}>
            S'abonner ({formatXof(500000)}/mois)
          </button>
        ) : (
          <p className="muted">Connecte-toi pour t'abonner et voir les pronostics réservés.</p>
        )}
        {note && <p className="note">{note}</p>}
      </div>

      <h2>Pronostics</h2>
      <div className="cards">
        {picks?.length === 0 && <p className="muted">Aucun pronostic publié.</p>}
        {picks?.map((p) => (
          <div className="card" key={p.id}>
            <div className="row">
              <strong>{p.fixture?.home} — {p.fixture?.away}</strong>
              <span className="muted small grow" />
              <OutcomeTag p={p} />
            </div>
            <div className="muted small">{p.market} · confiance {p.confidence}/5</div>
            {p.locked ? (
              <div className="locked">🔒 Réservé aux abonnés</div>
            ) : (
              <div className="pick">
                <span className="selection">{p.selection}</span>
                {p.odds != null && <span className="odds">@ {p.odds}</span>}
                {p.analysis && <p className="analysis">{p.analysis}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function OutcomeTag({ p }) {
  if (!p.outcome) return <span className="tag pending">à venir</span>;
  const map = {
    won: ['gagné', 'won'],
    half_won: ['demi-gagné', 'won'],
    lost: ['perdu', 'lost'],
    half_lost: ['demi-perdu', 'lost'],
    void: ['annulé', 'void'],
  };
  const [label, cls] = map[p.outcome] || [p.outcome, 'void'];
  return <span className={`tag ${cls}`}>{label}</span>;
}
