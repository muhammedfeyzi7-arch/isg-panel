import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useFirmaDetailData } from '@/hooks/useOsgbAdminData';
import { useThemeMode } from '@/store/ThemeContext';

type TabKey = 'personel' | 'uygunsuzluk' | 'tutanak' | 'egitim';

export default function FirmaDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const firmaId = typeof params.id === 'string' ? params.id : null;
  const { theme } = useThemeMode();
  const dark = theme === 'dark';
  const detail = useFirmaDetailData(firmaId);
  const [activeTab, setActiveTab] = useState<TabKey>('personel');

  const title = useMemo(() => detail.firma?.name ?? 'Firma Detayı', [detail.firma?.name]);

  return (
    <SafeAreaView className={`flex-1 ${dark ? 'bg-bgDark' : 'bg-bgLight'}`}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 26 }}
        refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={() => void detail.refresh()} />}
      >
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Text className="text-sm font-bold text-sky-400">← Geri</Text>
          </Pressable>
          <Text className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{firmaId ?? '-'}</Text>
        </View>

        <Text className={`mt-3 text-2xl font-black ${dark ? 'text-textDark' : 'text-textLight'}`}>{title}</Text>

        <View className="mt-4 flex-row gap-2">
          <TabButton active={activeTab === 'personel'} label="Personel" onPress={() => setActiveTab('personel')} />
          <TabButton active={activeTab === 'uygunsuzluk'} label="Uygunsuzluk" onPress={() => setActiveTab('uygunsuzluk')} />
          <TabButton active={activeTab === 'tutanak'} label="Tutanak" onPress={() => setActiveTab('tutanak')} />
          <TabButton active={activeTab === 'egitim'} label="Eğitim" onPress={() => setActiveTab('egitim')} />
        </View>

        {detail.error ? <Text className="mt-2 text-sm text-red-400">{detail.error}</Text> : null}

        <View className={`mt-4 rounded-2xl border p-4 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
          {detail.loading ? <Text className={`${dark ? 'text-slate-300' : 'text-slate-600'}`}>Yükleniyor...</Text> : null}

          {!detail.loading && activeTab === 'personel'
            ? detail.personeller.map((row) => (
                <Row
                  key={row.id}
                  title={detail.dataString(row.data, 'adSoyad') || 'İsimsiz Personel'}
                  subtitle={`${detail.dataString(row.data, 'gorev') || '-'} • ${detail.dataString(row.data, 'telefon') || '-'}`}
                  dark={dark}
                />
              ))
            : null}

          {!detail.loading && activeTab === 'uygunsuzluk'
            ? detail.uygunsuzluklar.map((row) => (
                <Row
                  key={row.id}
                  title={detail.dataString(row.data, 'baslik') || 'Başlık yok'}
                  subtitle={`${detail.dataString(row.data, 'durum') || '-'} • ${detail.dataString(row.data, 'oncelik') || '-'}`}
                  dark={dark}
                />
              ))
            : null}

          {!detail.loading && activeTab === 'tutanak'
            ? detail.tutanaklar.map((row) => (
                <Row
                  key={row.id}
                  title={detail.dataString(row.data, 'baslik') || 'Tutanak'}
                  subtitle={row.created_at ? detail.toDateTR(row.created_at) : '-'}
                  dark={dark}
                />
              ))
            : null}

          {!detail.loading && activeTab === 'egitim'
            ? detail.egitimler.map((row) => (
                <Row
                  key={row.id}
                  title={detail.dataString(row.data, 'egitimAdi') || detail.dataString(row.data, 'baslik') || 'Eğitim'}
                  subtitle={row.created_at ? detail.toDateTR(row.created_at) : '-'}
                  dark={dark}
                />
              ))
            : null}

          {!detail.loading &&
          ((activeTab === 'personel' && detail.personeller.length === 0) ||
            (activeTab === 'uygunsuzluk' && detail.uygunsuzluklar.length === 0) ||
            (activeTab === 'tutanak' && detail.tutanaklar.length === 0) ||
            (activeTab === 'egitim' && detail.egitimler.length === 0)) ? (
            <Text className={`${dark ? 'text-slate-300' : 'text-slate-600'}`}>Kayıt bulunamadı.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable className={`rounded-xl px-3 py-2 ${active ? 'bg-primary' : 'bg-slate-700/40'}`} onPress={onPress}>
      <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-200'}`}>{label}</Text>
    </Pressable>
  );
}

function Row({ title, subtitle, dark }: { title: string; subtitle: string; dark: boolean }) {
  return (
    <View className="mb-3 border-b border-slate-700/30 pb-3">
      <Text className={`text-sm font-bold ${dark ? 'text-textDark' : 'text-textLight'}`}>{title}</Text>
      <Text className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</Text>
    </View>
  );
}