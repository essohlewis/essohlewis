import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors } from '../theme';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('+2250700000002');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [debugCode, setDebugCode] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(null); setBusy(true);
    try {
      const res = await api.post('/auth/request-otp', { phone });
      setStep('code');
      if (res.debug_code) setDebugCode(res.debug_code);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function verify() {
    setError(null); setBusy(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone, code });
      await login(res.token);
      navigation.goBack();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Connexion</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'phone' ? (
        <>
          <Text style={styles.label}>Numéro de téléphone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+225…"
            placeholderTextColor={colors.muted}
          />
          <Pressable style={styles.primary} disabled={busy} onPress={requestOtp}>
            <Text style={styles.primaryText}>Recevoir le code</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>Code reçu par SMS</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="6 chiffres"
            placeholderTextColor={colors.muted}
          />
          {debugCode ? <Text style={styles.muted}>Code (dev) : {debugCode}</Text> : null}
          <Pressable style={styles.primary} disabled={busy} onPress={verify}>
            <Text style={styles.primaryText}>Se connecter</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 8 },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 13, marginTop: 8 },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger },
  input: {
    backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1,
    color: colors.text, borderRadius: 8, padding: 12, fontSize: 16,
  },
  primary: { backgroundColor: colors.brand, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  primaryText: { color: 'white', fontWeight: '700' },
});
