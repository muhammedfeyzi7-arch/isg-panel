import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFirmaDashboard } from '@/hooks/useFirmaDashboard';
import { useAuth } from '@/store/AuthContext';

export default function FirmaPanelScreen() {
  const { user, signOut } = useAuth();
  const { loading, refreshing, error, summary, personeller, refresh } = useFirmaDashboard(user?.id);

  const welcomeName = useMemo(() => {
    const name = user?.user_metadata?.full_name as string | undefined;
    if (name?.trim()) return name;
    if (user?.email) return user.email.split('@')[0];
    return 'Kullanıcı';
  }, [user?.email, user?.user_metadata]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={{ color: '#CBD5E1' }}>Firma verileri yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '700' }}>Firma Paneli</Text>
          <Text style={{ color: '#94A3B8', marginTop: 6 }}>Hoş geldin, {welcomeName}</Text>
        </View>

        {error ? (
          <View
            style={{
              backgroundColor: 'rgba(239,68,68,0.18)',
              borderColor: 'rgba(239,68,68,0.4)',
              borderRadius: 12,
              borderWidth: 1,
              marginBottom: 14,
              padding: 12,
            }}
          >
            <Text style={{ color: '#FCA5A5', fontSize: 13 }}>
              Veri alınırken hata oluştu: {error}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <Card title="Firma" value={summary.firmaCount} detail={`Aktif: ${summary.aktifFirmaCount}`} />
          <Card
            title="Personel"
            value={summary.personelCount}
            detail={`Aktif: ${summary.aktifPersonelCount}`}
          />
        </View>

        <View
          style={{
            backgroundColor: '#0F172A',
            borderColor: '#1E293B',
            borderRadius: 14,
            borderWidth: 1,
            padding: 12,
          }}
        >
          <Text style={{ color: '#E2E8F0', fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
            Son Personeller
          </Text>

          {personeller.length === 0 ? (
            <Text style={{ color: '#64748B', fontSize: 13 }}>Henüz personel kaydı yok.</Text>
          ) : (
            personeller.slice(0, 12).map((personel) => (
              <View
                key={personel.id}
                style={{
                  borderBottomColor: '#1E293B',
                  borderBottomWidth: 1,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>
                  {personel.adSoyad}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                  {personel.gorev || 'Görev girilmedi'} • {personel.durum || 'Aktif'}
                </Text>
              </View>
            ))
          )}
        </View>

        <Pressable
          onPress={signOut}
          style={{
            alignItems: 'center',
            backgroundColor: '#1E293B',
            borderColor: '#334155',
            borderRadius: 12,
            borderWidth: 1,
            marginTop: 16,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: '#E2E8F0', fontWeight: '600' }}>Çıkış Yap</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <View
      style={{
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        flexGrow: 1,
        minWidth: '48%',
        padding: 12,
      }}
    >
      <Text style={{ color: '#94A3B8', fontSize: 12 }}>{title}</Text>
      <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '700', marginTop: 4 }}>{value}</Text>
      <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{detail}</Text>
    </View>
  );
}
