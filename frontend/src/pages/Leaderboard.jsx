import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

const BADGES = {
  gold: { label: 'Or', className: 'badge gold' },
  silver: { label: 'Argent', className: 'badge silver' },
  bronze: { label: 'Bronze', className: 'badge bronze' },
  unrated: { label: 'Non noté', className: 'badge unrated' },
};

export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/tipsters')
      .then((d) => setRows(d.data))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <p>Chargement…</p>;

  return (
    <section>
      <h1>Meilleurs pronostiqueurs</h1>
      <p className="muted">Classés par fiabilité. Un score n'apparaît qu'après 30 pronostics réglés.</p>
      <div className="cards">
        {rows.length === 0 && <p className="muted">Aucun pronostiqueur noté pour l'instant.</p>}
        {rows.map((r, i) => {
          const badge = BADGES[r.badge] || BADGES.unrated;
          return (
            <Link to={`/tipsters/${r.tipster.id}`} key={r.tipster.id} className="card row">
              <span className="rank">#{i + 1}</span>
              <span className="grow">
                <strong>{r.tipster.display_name}</strong>
                <span className="muted small"> · {r.tipster.country_code}</span>
              </span>
              <span className={badge.className}>{badge.label}</span>
              <span className="metric" title="Rendement">
                {r.yield >= 0 ? '+' : ''}{r.yield}%
              </span>
              <span className="score">{r.score}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
