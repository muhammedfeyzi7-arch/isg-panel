import { Linking, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { useAyarlarData } from '@/hooks/useOsgbAdminData';
import { useAuth } from '@/store/AuthContext';
import { useOsgb } from '@/store/OsgbContext';
import { useThemeMode } from '@/store/ThemeContext';

export default function AyarlarScreen() {
  const { theme, toggleTheme } = useThemeMode();
  const dark = theme === 'dark';
  const { signOut } = useAuth();
  const { orgId } = useOsgb();
  const { loading, error, orgName, isActive } = useAyarlarData(orgId);

  return (
    <SafeAreaView
      className={`flex-1 ${dark ? 'bg-bgDark' : 'bg-bgLight'}`}
      style={{ flex: 1, backgroundColor: dark ? '#0a0f1a' : '#f8fafc' }}
    >
      <ScrollView className="flex-1" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 26 }}>
        <Text className={`text-2xl font-black ${dark ? 'text-textDark' : 'text-textLight'}`}>Ayarlar</Text>

        <View className={`mt-4 rounded-2xl border p-4 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
          <Text className={`text-base font-extrabold ${dark ? 'text-textDark' : 'text-textLight'}`}>Organizasyon Bilgileri</Text>
          {loading ? <Text className={`mt-2 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Yükleniyor...</Text> : null}
          {!loading ? (
            <>
              <Text className={`mt-2 text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{orgName}</Text>
              <Text className={`mt-1 text-xs ${isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isActive ? 'Abonelik aktif' : 'Hesap devre dışı'}
              </Text>
            </>
          ) : null}
          {error ? <Text className="mt-2 text-sm text-red-400">{error}</Text> : null}
        </View>

        <SettingRow
          dark={dark}
          title="Tema"
          subtitle={dark ? 'Karanlık mod açık' : 'Aydınlık mod açık'}
          right={<Switch value={dark} onValueChange={() => void toggleTheme()} />}
        />

        <SettingRow
          dark={dark}
          title="Bildirimler"
          subtitle="Yakında push bildirim ayarları eklenecek"
          right={<Switch value={false} disabled />}
        />

        <Pressable
          className="mt-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4"
          onPress={() => void Linking.openURL('mailto:destek@isgdenetim.com.tr')}
        >
          <Text className="text-sm font-bold text-sky-400">Destek</Text>
          <Text className="mt-1 text-xs text-slate-400">destek@isgdenetim.com.tr</Text>
        </Pressable>

        <Pressable
          className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4"
          onPress={() => void signOut()}
        >
          <Text className="text-sm font-bold text-red-400">Çıkış Yap</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  dark,
  title,
  subtitle,
  right,
}: {
  dark: boolean;
  title: string;
  subtitle: string;
  right: React.ReactNode;
}) {
  return (
    <View className={`mt-3 rounded-2xl border p-4 ${dark ? 'border-slate-700 bg-cardDark' : 'border-slate-200 bg-white'}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className={`text-sm font-bold ${dark ? 'text-textDark' : 'text-textLight'}`}>{title}</Text>
          <Text className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</Text>
        </View>
        {right}
      </View>
    </View>
  );
}
