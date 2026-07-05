import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, formatXof } from '../theme';

const OUTCOME = {
  won: ['gagné', colors.brand],
  half_won: ['demi-gagné', colors.brand],
  lost: ['perdu', colors.danger],
  half_lost: ['demi-perdu', colors.danger],
  void: ['annulé', colors.muted],
};

export default function TipsterScreen({ route }) {
  const { id } = route.params;
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [picks, setPicks] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    Promise.all([api.get(`/tipsters/${id}`), api.get(`/tipsters/${id}/predictions`)])
      .then(([p, preds]) => { setProfile(p); setPicks(preds.data); })
      .catch((e) => setError(e.message));
  }, [id]);

  useFocusEffect(load);

  async function subscribe() {
    setNote(null);
    try {
      await api.post('/subscriptions', { tipster_id: Number(id) });
      setNote('Abonnement activé — pronostics désormais visibles.');
      load();
    } catch (e) {
      setNote(e.message);
    }
  }

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!profile) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  const r = profile.reliability;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{profile.tipster.display_name}</Text>
      {profile.tipster.bio ? <Text style={styles.muted}>{profile.tipster.bio}</Text> : null}

      {r ? (
        <View style={styles.stats}>
          <Stat label="Score" value={r.score} />
          <Stat label="Rendement" value={`${r.yield >= 0 ? '+' : ''}${r.yield}%`} />
          <Stat label="Réussite" value={`${r.win_rate}%`} />
          <Stat label="Réglés" value={r.settled_count} />
        </View>
      ) : (
        <Text style={styles.muted}>Pas encore de statistiques.</Text>
      )}

      {user ? (
        <Pressable style={styles.primary} onPress={subscribe}>
          <Text style={styles.primaryText}>S'abonner ({formatXof(500000)}/mois)</Text>
        </Pressable>
      ) : (
        <Text style={styles.muted}>Connecte-toi pour t'abonner et voir les pronostics réservés.</Text>
      )}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <Text style={styles.h2}>Pronostics</Text>
      {picks?.length === 0 && <Text style={styles.muted}>Aucun pronostic publié.</Text>}
      {picks?.map((p) => {
        const [label, color] = p.outcome ? OUTCOME[p.outcome] : ['à venir', colors.muted];
        return (
          <View key={p.id} style={styles.pick}>
            <View style={styles.pickHead}>
              <Text style={styles.match}>{p.fixture?.home} — {p.fixture?.away}</Text>
              <Text style={[styles.tag, { color }]}>{label}</Text>
            </View>
            <Text style={styles.muted}>{p.market} · confiance {p.confidence}/5</Text>
            {p.locked ? (
              <Text style={styles.locked}>🔒 Réservé aux abonnés</Text>
            ) : (
              <Text style={styles.selection}>
                {p.selection}{p.odds != null ? <Text style={styles.odds}>  @ {p.odds}</Text> : null}
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 18 },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  stat: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, minWidth: 78, alignItems: 'center',
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 11, textTransform: 'uppercase' },
  primary: { backgroundColor: colors.brand, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  primaryText: { color: 'white', fontWeight: '700' },
  note: { color: colors.text, backgroundColor: colors.surface2, borderRadius: 8, padding: 10 },
  pick: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: 12, padding: 14, marginTop: 8,
  },
  pickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  match: { color: colors.text, fontWeight: '700', flex: 1 },
  tag: { fontSize: 12, marginLeft: 8 },
  selection: { color: colors.text, fontWeight: '700', marginTop: 6, textTransform: 'capitalize' },
  odds: { color: colors.brand, fontWeight: '400' },
  locked: { color: colors.muted, fontStyle: 'italic', marginTop: 6 },
});
