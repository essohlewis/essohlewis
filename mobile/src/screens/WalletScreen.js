import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { colors, formatXof } from '../theme';

const TYPE_LABELS = {
  topup: 'Recharge',
  subscription_debit: 'Abonnement',
  subscription_credit: 'Revenu abonné',
  commission: 'Commission',
  payout: 'Retrait',
  refund: 'Remboursement',
  tip: 'Pourboire',
};

export default function WalletScreen() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState('5000');
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api.get('/wallet').then(setWallet).catch((e) => setError(e.message));
  }, []);

  useFocusEffect(load);

  async function topup() {
    setNote(null);
    try {
      const res = await api.post('/wallet/topup', { amount_cents: Number(amount) * 100 });
      setNote(`Collecte initiée (réf ${res.provider_reference}). Confirme sur ton téléphone.`);
      load();
    } catch (e) {
      setNote(e.message);
    }
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!wallet) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Mon wallet</Text>
      <Text style={styles.balance}>{formatXof(wallet.balance_cents)}</Text>

      <Text style={styles.label}>Recharger (XOF)</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
        />
        <Pressable style={styles.primary} onPress={topup}>
          <Text style={styles.primaryText}>Recharger</Text>
        </Pressable>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <Text style={styles.h2}>Historique</Text>
      {wallet.transactions.length === 0 && <Text style={styles.muted}>Aucune transaction.</Text>}
      {wallet.transactions.map((t) => (
        <View key={t.id} style={styles.txRow}>
          <Text style={styles.txType}>{TYPE_LABELS[t.type] || t.type}</Text>
          <Text style={[styles.txAmount, { color: t.amount_cents < 0 ? colors.danger : colors.brand }]}>
            {t.amount_cents < 0 ? '' : '+'}{formatXof(t.amount_cents)}
          </Text>
          <Text style={styles.txBalance}>{formatXof(t.balance_after_cents)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 6 },
  balance: { color: colors.text, fontSize: 32, fontWeight: '700', marginVertical: 8 },
  label: { color: colors.muted, fontSize: 13, marginTop: 8 },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1,
    color: colors.text, borderRadius: 8, padding: 12, fontSize: 16,
  },
  primary: { backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: 'white', fontWeight: '700' },
  note: { color: colors.text, backgroundColor: colors.surface2, borderRadius: 8, padding: 10, marginTop: 8 },
  txRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomColor: colors.border, borderBottomWidth: 1,
  },
  txType: { color: colors.text, flex: 1 },
  txAmount: { minWidth: 100, textAlign: 'right' },
  txBalance: { color: colors.muted, minWidth: 100, textAlign: 'right' },
});
