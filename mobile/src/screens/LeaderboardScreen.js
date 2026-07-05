import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { badgeColor, badgeLabel, colors } from '../theme';

export default function LeaderboardScreen({ navigation }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    api.get('/tipsters')
      .then((d) => setRows(d.data))
      .catch((e) => setError(e.message));
  }, []);

  useFocusEffect(load);

  if (error) return <Center><Text style={styles.error}>{error}</Text></Center>;
  if (!rows) return <Center><ActivityIndicator color={colors.brand} /></Center>;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(r) => String(r.tipster.id)}
      ListHeaderComponent={
        <Text style={styles.sub}>
          Classés par fiabilité. Un score n'apparaît qu'après 30 pronostics réglés.
        </Text>
      }
      ListEmptyComponent={<Text style={styles.muted}>Aucun pronostiqueur noté.</Text>}
      renderItem={({ item, index }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('Tipster', {
            id: item.tipster.id,
            name: item.tipster.display_name,
          })}
        >
          <Text style={styles.rank}>#{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.tipster.display_name}</Text>
            <Text style={styles.muted}>{item.tipster.country_code}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeColor[item.badge] + '26' }]}>
            <Text style={{ color: badgeColor[item.badge], fontSize: 12, fontWeight: '600' }}>
              {badgeLabel[item.badge]}
            </Text>
          </View>
          <Text style={styles.yield}>
            {item.yield >= 0 ? '+' : ''}{item.yield}%
          </Text>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>{item.score}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

function Center({ children }) {
  return <View style={styles.center}>{children}</View>;
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.bg },
  content: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  sub: { color: colors.muted, marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rank: { color: colors.muted, width: 30 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  yield: { color: colors.brand, minWidth: 48, textAlign: 'right' },
  scoreBox: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  score: { color: colors.text, fontWeight: '700' },
});
