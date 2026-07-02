import { useEffect, useState } from 'react';
import { api, formatXof } from '../lib/api.js';

const TYPE_LABELS = {
  topup: 'Recharge',
  subscription_debit: 'Abonnement',
  subscription_credit: 'Revenu abonné',
  commission: 'Commission',
  payout: 'Retrait',
  refund: 'Remboursement',
  tip: 'Pourboire',
};

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState(5000);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setWallet(await api.get('/wallet'));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function topup(e) {
    e.preventDefault();
    setNote(null);
    try {
      const res = await api.post('/wallet/topup', { amount_cents: amount * 100 });
      setNote(
        `Collecte Mobile Money initiée (réf ${res.provider_reference}). ` +
        `Confirme sur ton téléphone — le solde est crédité à la confirmation.`
      );
      await load();
    } catch (e) {
      setNote(e.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!wallet) return <p>Chargement…</p>;

  return (
    <section>
      <h1>Mon wallet</h1>
      <div className="balance">{formatXof(wallet.balance_cents)}</div>

      <form className="topup" onSubmit={topup}>
        <label>Recharger (XOF)</label>
        <input
          type="number"
          min="100"
          step="500"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <button className="primary">Recharger via Mobile Money</button>
      </form>
      {note && <p className="note">{note}</p>}

      <h2>Historique</h2>
      <table className="ledger">
        <thead>
          <tr><th>Type</th><th>Montant</th><th>Solde</th><th>Statut</th></tr>
        </thead>
        <tbody>
          {wallet.transactions.map((t) => (
            <tr key={t.id}>
              <td>{TYPE_LABELS[t.type] || t.type}</td>
              <td className={t.amount_cents < 0 ? 'debit' : 'credit'}>
                {t.amount_cents < 0 ? '' : '+'}{formatXof(t.amount_cents)}
              </td>
              <td>{formatXof(t.balance_after_cents)}</td>
              <td><span className={`tag ${t.status}`}>{t.status}</span></td>
            </tr>
          ))}
          {wallet.transactions.length === 0 && (
            <tr><td colSpan="4" className="muted">Aucune transaction.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
