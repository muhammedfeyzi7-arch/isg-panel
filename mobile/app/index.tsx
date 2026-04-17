import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';

function LoadingView({ label }: { label: string }) {
  return (
    <SafeAreaView className="flex-1 bg-bgDark">
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <ActivityIndicator color="#0EA5E9" size="large" />
        <Text className="text-center text-sm text-slate-300">{label}</Text>
      </View>
    </SafeAreaView>
  );
}

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkAccess = async () => {
      setResolving(true);

      const { data: membership, error: membershipError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .or('osgb_role.eq.osgb_admin,role.eq.admin')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membershipError || !membership?.organization_id) {
        setAllowed(false);
        setBlockedReason('OSGB admin yetkiniz bulunmuyor.');
        setResolving(false);
        return;
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('is_active')
        .eq('id', membership.organization_id)
        .maybeSingle();

      if (orgError || !org || org.is_active === false) {
        setAllowed(false);
        setBlockedReason('Hesabınız devre dışı bırakıldı');
        setResolving(false);
        return;
      }

      setAllowed(true);
      setResolving(false);
    };

    void checkAccess();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }

    if (!loading && user && allowed === true) {
      router.replace('/(tabs)/dashboard');
    }
  }, [allowed, loading, user]);

  if (!isSupabaseConfigured) {
    return <LoadingView label="Supabase ayarı eksik. EXPO_PUBLIC_* değişkenlerini tanımlayın." />;
  }

  if (loading) return <LoadingView label="Oturum kontrol ediliyor..." />;
  if (resolving || (user && allowed === null)) return <LoadingView label="Panel hazırlanıyor..." />;
  if (user && allowed === false) return <LoadingView label={blockedReason ?? 'Erişim yetkiniz bulunmuyor.'} />;

  return <LoadingView label="Yönlendiriliyor..." />;
}
