import { RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useZiyaretlerData } from '@/hooks/useOsgbAdminData';
import { useOsgb } from '@/store/OsgbContext';
import { useThemeMode } from '@/store/ThemeContext';

export default function ZiyaretlerScreen() {
  const { orgId } = useOsgb();
  const { theme } = useThemeMode();
  const dark = theme === 'dark';
  const data = useZiyaretlerData(orgId);

  return (
    <SafeAreaView
      className={`flex-1 ${dark ? 'bg-bgDark' : 'bg-bgLight'}`}
      style={{ flex: 1, backgroundColor: dark ? '#0a0f1a' : '#f8fafc' }}
    >
      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 26 }}
        refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void data.refresh()} />}
      >
        <Text className={`text-2xl font-black ${dark ? 'text-textDark' : 'text-textLight'}`}>Saha Ziyaretleri</Text>
        <Text className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Son 50 ziyaret ve aktif planlar</Text>

        {data.error ? <Text className="mt-2 text-sm text-red-400">{data.error}</Text> : null}

        <View className={`mt-4 rounded-2xl border p-4 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
          <Text className={`text-base font-extrabold ${dark ? 'text-textDark' : 'text-textLight'}`}>Ziyaret Listesi</Text>

          {data.ziyaretler.length === 0 ? (
            <Text className={`mt-2 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Henüz ziyaret kaydı yok.</Text>
          ) : (
            data.ziyaretler.map((visit) => (
              <View className="mt-3 border-b border-slate-700/30 pb-3" key={visit.id}>
                <Text className={`text-sm font-semibold ${dark ? 'text-textDark' : 'text-textLight'}`}>
                  {visit.uzman_ad || visit.uzman_email || 'Bilinmeyen'} • {visit.firma_ad || 'Bilinmeyen Firma'}
                </Text>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{data.trDateTime(visit.created_at)}</Text>
                  <Text className={`text-xs font-semibold ${visit.bitis_zamani ? 'text-emerald-400' : 'text-sky-400'}`}>
                    {visit.bitis_zamani ? 'Tamamlandı' : 'Devam Ediyor'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View className={`mt-4 rounded-2xl border p-4 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
          <Text className={`text-base font-extrabold ${dark ? 'text-textDark' : 'text-textLight'}`}>Ziyaret Planları</Text>

          {data.planlar.length === 0 ? (
            <Text className={`mt-2 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Aktif ziyaret planı bulunmuyor.</Text>
          ) : (
            data.planlar.map((plan) => (
              <View className="mt-3 border-b border-slate-700/30 pb-3" key={plan.id}>
                <Text className={`text-sm font-semibold ${dark ? 'text-textDark' : 'text-textLight'}`}>
                  {data.firmaMap.get(plan.firma_org_id) ?? plan.firma_org_id}
                </Text>
                <Text className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Günler: {(plan.gunler ?? []).join(', ') || '-'}
                </Text>
                {plan.notlar ? (
                  <Text className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{plan.notlar}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
