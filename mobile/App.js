import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/lib/auth';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import TipsterScreen from './src/screens/TipsterScreen';
import LoginScreen from './src/screens/LoginScreen';
import WalletScreen from './src/screens/WalletScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.brand,
  },
};

function HeaderRight({ navigation }) {
  const { user } = useAuth();
  return (
    <Pressable
      onPress={() => navigation.navigate(user ? 'Wallet' : 'Login')}
      style={{ paddingHorizontal: 6 }}
    >
      <Text style={{ color: colors.brand, fontWeight: '600' }}>
        {user ? 'Wallet' : 'Connexion'}
      </Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen
              name="Leaderboard"
              component={LeaderboardScreen}
              options={({ navigation }) => ({
                title: '⚽ Pronos',
                headerRight: () => <HeaderRight navigation={navigation} />,
              })}
            />
            <Stack.Screen
              name="Tipster"
              component={TipsterScreen}
              options={({ route }) => ({ title: route.params?.name ?? 'Pronostiqueur' })}
            />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Connexion' }} />
            <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Mon wallet' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
