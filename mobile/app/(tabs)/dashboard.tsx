import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDashboardData, useFirmalarData } from '@/hooks/useOsgbAdminData';
import { useOsgb } from '@/store/OsgbContext';
import { useThemeMode } from '@/store/ThemeContext';

function StatSkeleton() {
  return <View className="h-32 w-[48%] rounded-2xl border border-slate-700 bg-slate-800/50" />;
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <View className="h-32 w-[48%] rounded-2xl border border-sky-500/30 bg-cardDark p-4">
      <View className="flex-1 justify-between">
        <Text className="text-[11px] font-semibold uppercase tracking-wider text-sky-300" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-3xl font-black leading-none text-textDark">{value}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { orgId } = useOsgb();
  const { theme } = useThemeMode();
  const dark = theme === 'dark';
  const dashboard = useDashboardData(orgId);
  const firmalar = useFirmalarData(orgId, '');

  const [modalOpen, setModalOpen] = useState(false);
  const [newFirma, setNewFirma] = useState('');

  const bg = dark ? 'bg-bgDark' : 'bg-bgLight';
  const panel = dark ? 'bg-cardDark border-slate-700/60' : 'bg-white border-slate-200';
  const text = dark ? 'text-textDark' : 'text-textLight';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';

  return (
    <SafeAreaView className={`flex-1 ${bg}`} style={{ flex: 1, backgroundColor: dark ? '#0a0f1a' : '#f8fafc' }}>
      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={dashboard.refreshing} onRefresh={() => void dashboard.refresh()} />}
      >
        <Text className={`text-2xl font-black ${text}`}>Genel Bakış</Text>
        <Text className={`mt-1 text-xs ${muted}`}>OSGB operasyon özeti</Text>

        <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
          {dashboard.loading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard title="Toplam Firmalar" value={dashboard.stats.totalFirmalar} />
              <StatCard title="Toplam Personel" value={dashboard.stats.totalPersonel} />
              <StatCard title="Açık Uygunsuzluk" value={dashboard.stats.acikUygunsuzluk} />
              <StatCard title="Aktif Uzman" value={dashboard.stats.aktifUzman} />
            </>
          )}
        </View>

        <View className="mt-5 flex-row gap-2">
          <Pressable className="flex-1 rounded-xl bg-primary py-3" onPress={() => setModalOpen(true)}>
            <Text className="text-center text-sm font-bold text-white">Firma Ekle</Text>
          </Pressable>
          <Pressable
            className="flex-1 rounded-xl bg-primaryDark py-3"
            onPress={() => Alert.alert('Bilgi', 'Personel ekleme işlemi Personel sekmesinden yapılır.')}
          >
            <Text className="text-center text-sm font-bold text-white">Personel Ekle</Text>
          </Pressable>
        </View>

        {dashboard.error ? <Text className="mt-2 text-sm text-red-400">{dashboard.error}</Text> : null}

        <View className={`mt-5 rounded-2xl border p-4 ${panel}`}>
          <Text className={`text-base font-extrabold ${text}`}>Son Aktiviteler</Text>
          {dashboard.recentVisits.length === 0 ? (
            <Text className={`mt-3 text-sm ${muted}`}>Henüz ziyaret kaydı yok.</Text>
          ) : (
            dashboard.recentVisits.map((visit) => (
              <View className="mt-3 border-b border-slate-700/30 pb-3" key={visit.id}>
                <Text className={`text-sm font-semibold ${text}`}>{visit.uzman} → {visit.firma}</Text>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className={`text-xs ${muted}`}>{visit.createdAt}</Text>
                  <Text className={`text-xs font-semibold ${visit.status === 'Tamamlandı' ? 'text-emerald-400' : 'text-sky-400'}`}>
                    {visit.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={modalOpen} onRequestClose={() => setModalOpen(false)}>
        <View className="flex-1 justify-end bg-black/45">
          <View className={`rounded-t-3xl border p-5 ${panel}`}>
            <Text className={`text-lg font-black ${text}`}>Firma Ekle</Text>
            <TextInput
              className={`mt-3 rounded-xl border px-3 py-3 ${dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
              onChangeText={setNewFirma}
              placeholder="Firma adı"
              placeholderTextColor={dark ? '#64748b' : '#94a3b8'}
              value={newFirma}
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable className="flex-1 rounded-xl bg-slate-500 py-3" onPress={() => setModalOpen(false)}>
                <Text className="text-center font-bold text-white">Vazgeç</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-xl bg-primary py-3"
                onPress={async () => {
                  if (!newFirma.trim()) return;
                  const result = await firmalar.addFirma(newFirma.trim());
                  if (result.error) {
                    Alert.alert('Hata', result.error);
                    return;
                  }
                  setNewFirma('');
                  setModalOpen(false);
                  await dashboard.refresh();
                }}
              >
                <Text className="text-center font-bold text-white">Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
