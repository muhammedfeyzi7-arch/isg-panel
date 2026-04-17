import { useMemo, useState } from 'react';
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
import { usePersonelData } from '@/hooks/useOsgbAdminData';
import { useOsgb } from '@/store/OsgbContext';
import { useThemeMode } from '@/store/ThemeContext';

export default function PersonelScreen() {
  const { orgId } = useOsgb();
  const { theme } = useThemeMode();
  const dark = theme === 'dark';
  const data = usePersonelData(orgId);

  const [assignOpen, setAssignOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [selectedFirmaIds, setSelectedFirmaIds] = useState<string[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'gezici_uzman' | 'isyeri_hekimi'>('gezici_uzman');
  const [inviteName, setInviteName] = useState('');

  const targetPersonel = useMemo(
    () => data.personeller.find((personel) => personel.user_id === targetUserId) ?? null,
    [data.personeller, targetUserId],
  );

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
        <View className="flex-row items-center justify-between">
          <Text className={`text-2xl font-black ${dark ? 'text-textDark' : 'text-textLight'}`}>Personel</Text>
          <Pressable className="rounded-xl bg-primary px-4 py-2" onPress={() => setInviteOpen(true)}>
            <Text className="text-xs font-bold text-white">Personel Ekle</Text>
          </Pressable>
        </View>

        {data.error ? <Text className="mt-2 text-sm text-red-400">{data.error}</Text> : null}

        {data.personeller.map((personel) => {
          const firmaNames = (personel.active_firm_ids ?? [])
            .map((id) => data.firmaNameMap.get(id))
            .filter(Boolean) as string[];

          return (
            <View
              className={`mt-3 rounded-2xl border p-4 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}
              key={personel.user_id}
            >
              <View className="flex-row items-center justify-between">
                <Text className={`text-base font-bold ${dark ? 'text-textDark' : 'text-textLight'}`}>
                  {personel.display_name || personel.email || 'Bilinmeyen'}
                </Text>
                <Text
                  className={`rounded-full px-3 py-1 text-xs font-bold ${personel.osgb_role === 'isyeri_hekimi' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}
                >
                  {personel.osgb_role === 'isyeri_hekimi' ? 'İşyeri Hekimi' : 'Gezici Uzman'}
                </Text>
              </View>

              <Text className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {personel.is_active ? 'Aktif' : 'Pasif'} • {firmaNames.length > 0 ? firmaNames.join(', ') : 'Firma atanmadı'}
              </Text>

              <Pressable
                className="mt-3 self-start rounded-lg bg-primaryDark px-3 py-2"
                onPress={() => {
                  setTargetUserId(personel.user_id);
                  setSelectedFirmaIds(personel.active_firm_ids ?? []);
                  setAssignOpen(true);
                }}
              >
                <Text className="text-xs font-bold text-white">Firma Ata</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Modal animationType="slide" transparent visible={assignOpen} onRequestClose={() => setAssignOpen(false)}>
        <View className="flex-1 justify-end bg-black/45">
          <View className={`rounded-t-3xl border p-5 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
            <Text className={`text-lg font-black ${dark ? 'text-textDark' : 'text-textLight'}`}>
              {targetPersonel?.display_name || targetPersonel?.email || 'Personel'} - Firma Atama
            </Text>

            <ScrollView className="mt-3 max-h-60">
              {data.firmalar.map((firma) => {
                const selected = selectedFirmaIds.includes(firma.id);
                return (
                  <Pressable
                    className={`mb-2 rounded-xl border px-3 py-3 ${selected ? 'border-primary bg-primary/15' : dark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}
                    key={firma.id}
                    onPress={() => {
                      setSelectedFirmaIds((prev) =>
                        prev.includes(firma.id) ? prev.filter((x) => x !== firma.id) : [...prev, firma.id],
                      );
                    }}
                  >
                    <Text className={`${dark ? 'text-textDark' : 'text-textLight'} text-sm font-semibold`}>{firma.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mt-4 flex-row gap-2">
              <Pressable className="flex-1 rounded-xl bg-slate-500 py-3" onPress={() => setAssignOpen(false)}>
                <Text className="text-center font-bold text-white">İptal</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-xl bg-primary py-3"
                onPress={async () => {
                  if (!targetUserId) return;
                  const result = await data.assignFirmalar(targetUserId, selectedFirmaIds);
                  if (result.error) {
                    Alert.alert('Hata', result.error);
                    return;
                  }
                  setAssignOpen(false);
                }}
              >
                <Text className="text-center font-bold text-white">Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={inviteOpen} onRequestClose={() => setInviteOpen(false)}>
        <View className="flex-1 justify-end bg-black/45">
          <View className={`rounded-t-3xl border p-5 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
            <Text className={`text-lg font-black ${dark ? 'text-textDark' : 'text-textLight'}`}>Personel Davet Et</Text>

            <TextInput
              className={`mt-3 rounded-xl border px-3 py-3 ${dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
              onChangeText={setInviteEmail}
              placeholder="E-posta"
              placeholderTextColor={dark ? '#64748b' : '#94a3b8'}
              value={inviteEmail}
            />

            <TextInput
              className={`mt-2 rounded-xl border px-3 py-3 ${dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
              onChangeText={setInviteName}
              placeholder="Ad Soyad"
              placeholderTextColor={dark ? '#64748b' : '#94a3b8'}
              value={inviteName}
            />

            <View className="mt-2 flex-row gap-2">
              <Pressable
                className={`flex-1 rounded-xl py-3 ${inviteRole === 'gezici_uzman' ? 'bg-primary' : 'bg-slate-500'}`}
                onPress={() => setInviteRole('gezici_uzman')}
              >
                <Text className="text-center text-xs font-bold text-white">Gezici Uzman</Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-xl py-3 ${inviteRole === 'isyeri_hekimi' ? 'bg-primary' : 'bg-slate-500'}`}
                onPress={() => setInviteRole('isyeri_hekimi')}
              >
                <Text className="text-center text-xs font-bold text-white">İşyeri Hekimi</Text>
              </Pressable>
            </View>

            <View className="mt-4 flex-row gap-2">
              <Pressable className="flex-1 rounded-xl bg-slate-500 py-3" onPress={() => setInviteOpen(false)}>
                <Text className="text-center font-bold text-white">İptal</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-xl bg-primary py-3"
                onPress={async () => {
                  const result = await data.invitePersonel({
                    email: inviteEmail,
                    role: inviteRole,
                    displayName: inviteName,
                  });

                  if (result.error) {
                    Alert.alert('Hata', result.error);
                    return;
                  }

                  setInviteOpen(false);
                  setInviteEmail('');
                  setInviteName('');
                }}
              >
                <Text className="text-center font-bold text-white">Davet Et</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
