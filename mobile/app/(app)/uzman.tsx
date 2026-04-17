import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useMembership } from '@/hooks/useMembership';
import { useUzmanDashboard } from '@/hooks/useUzmanDashboard';
import { useAuth } from '@/store/AuthContext';

export default function UzmanPanelScreen() {
  const { user } = useAuth();
  const membershipState = useMembership(user?.id);
  const membership = membershipState.membership;

  const assignedIds =
    membership?.active_firm_ids?.filter(Boolean) ??
    (membership?.active_firm_id ? [membership.active_firm_id] : membership?.organization_id ? [membership.organization_id] : []);

  const dashboard = useUzmanDashboard(assignedIds);

  if (membershipState.loading || dashboard.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={{ color: '#CBD5E1' }}>Uzman paneli yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const error = membershipState.error ?? dashboard.error;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.refreshing}
            onRefresh={() => void Promise.all([membershipState.refresh(), dashboard.refresh()])}
          />
        }
      >
        <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '700' }}>Gezici Uzman</Text>
        <Text style={{ color: '#94A3B8', marginTop: 6 }}>
          Atanmış firmalar ve saha operasyon özeti
        </Text>

        {error ? (
          <View
            style={{
              backgroundColor: 'rgba(239,68,68,0.18)',
              borderColor: 'rgba(239,68,68,0.4)',
              borderRadius: 12,
              borderWidth: 1,
              marginTop: 12,
              padding: 12,
            }}
          >
            <Text style={{ color: '#FCA5A5', fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          <Card title="Atanmış Firma" value={dashboard.summary.assignedCompanyCount} />
          <Card title="Toplam Personel" value={dashboard.summary.personelCount} />
          <Card title="Uygunsuzluk" value={dashboard.summary.uygunsuzlukCount} />
        </View>

        <View
          style={{
            backgroundColor: '#0F172A',
            borderColor: '#1E293B',
            borderRadius: 14,
            borderWidth: 1,
            marginTop: 16,
            padding: 12,
          }}
        >
          <Text style={{ color: '#E2E8F0', fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
            Atanmış Firma Listesi
          </Text>

          {dashboard.companies.length === 0 ? (
            <Text style={{ color: '#64748B', fontSize: 13 }}>Uzmana atanmış firma bulunamadı.</Text>
          ) : (
            dashboard.companies.map((company) => (
              <View
                key={company.id}
                style={{ borderBottomColor: '#1E293B', borderBottomWidth: 1, paddingVertical: 10 }}
              >
                <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>{company.name}</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{company.id}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <View
      style={{
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        minWidth: '48%',
        padding: 12,
      }}
    >
      <Text style={{ color: '#94A3B8', fontSize: 12 }}>{title}</Text>
      <Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '700', marginTop: 4 }}>{value}</Text>
    </View>
  );
}
