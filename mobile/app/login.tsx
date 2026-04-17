import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/store/AuthContext';

export default function LoginScreen() {
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace('/');
  }, [user]);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1020' }}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1, justifyContent: 'center', padding: 20 }}
      >
        <View style={{ gap: 12, marginBottom: 24 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 28, fontWeight: '700' }}>ISG Mobile</Text>
          <Text style={{ color: '#94A3B8', fontSize: 14 }}>
            OSGB admin paneli için mobil giriş.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="E-posta"
            placeholderTextColor="#64748B"
            style={{
              backgroundColor: '#111827',
              borderColor: '#1F2937',
              borderRadius: 12,
              borderWidth: 1,
              color: '#F8FAFC',
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
            value={email}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="Şifre"
            placeholderTextColor="#64748B"
            secureTextEntry
            style={{
              backgroundColor: '#111827',
              borderColor: '#1F2937',
              borderRadius: 12,
              borderWidth: 1,
              color: '#F8FAFC',
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
            value={password}
          />
          {error ? <Text style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</Text> : null}

          <Pressable
            disabled={loading}
            onPress={onSubmit}
            style={{
              alignItems: 'center',
              backgroundColor: '#0EA5E9',
              borderRadius: 12,
              marginTop: 6,
              opacity: loading ? 0.7 : 1,
              paddingVertical: 12,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#E0F2FE" />
            ) : (
              <Text style={{ color: '#E0F2FE', fontSize: 15, fontWeight: '700' }}>Giriş Yap</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
