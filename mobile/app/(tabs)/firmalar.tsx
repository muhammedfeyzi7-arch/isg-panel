import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useFirmalarData } from '@/hooks/useOsgbAdminData';
import { useOsgb } from '@/store/OsgbContext';
import { useThemeMode } from '@/store/ThemeContext';

export default function FirmalarScreen() {
  const { orgId } = useOsgb();
  const { theme } = useThemeMode();
  const dark = theme === 'dark';

  const [search, setSearch] = useState('');
  const { rows, loading, refreshing, refresh, error } = useFirmalarData(orgId, search);

  return (
    <SafeAreaView
      className={`flex-1 ${dark ? 'bg-bgDark' : 'bg-bgLight'}`}
      style={{ flex: 1, backgroundColor: dark ? '#0a0f1a' : '#f8fafc' }}
    >
      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <Text className={`text-2xl font-black ${dark ? 'text-textDark' : 'text-textLight'}`}>Müşteri Firmalar</Text>

        <TextInput
          className={`mt-3 rounded-xl border px-3 py-3 ${dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
          onChangeText={setSearch}
          placeholder="Firma ara..."
          placeholderTextColor={dark ? '#64748b' : '#94a3b8'}
          value={search}
        />

        {error ? <Text className="mt-2 text-sm text-red-400">{error}</Text> : null}

        {!loading && rows.length === 0 ? (
          <View className={`mt-5 rounded-2xl border p-5 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
            <Text className={dark ? 'text-slate-300' : 'text-slate-600'}>
              Firma bulunamadı. Aramayı temizleyip tekrar deneyin.
            </Text>
          </View>
        ) : null}

        {rows.map((firma) => (
          <Pressable
            className={`mt-3 rounded-2xl border p-4 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}
            key={firma.id}
            onPress={() => router.push({ pathname: '/(tabs)/firma-detay/[id]', params: { id: firma.id } })}
          >
            <View className="flex-row items-center justify-between">
              <Text className={`text-base font-extrabold ${dark ? 'text-textDark' : 'text-textLight'}`}>{firma.name}</Text>
              <Text className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-400">{firma.inviteCode}</Text>
            </View>
            <Text className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Kayıt: {firma.createdAt}</Text>
            <View className="mt-3 flex-row gap-2">
              <Chip label={`${firma.personelSayisi} personel`} />
              <Chip label={`${firma.uygunsuzlukSayisi} uygunsuzluk`} />
            </View>
            <Text className={`mt-2 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Uzman: {firma.uzmanAd}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label }: { label: string }) {
  return <Text className="rounded-full bg-slate-600/20 px-3 py-1 text-xs text-slate-300">{label}</Text>;
}
