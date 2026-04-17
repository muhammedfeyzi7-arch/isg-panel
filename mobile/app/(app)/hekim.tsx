import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useHekimDashboard } from '@/hooks/useHekimDashboard';
import { useMembership } from '@/hooks/useMembership';
import { useAuth } from '@/store/AuthContext';

export default function HekimPanelScreen() {
  const { user } = useAuth();
  const membershipState = useMembership(user?.id);
  const membership = membershipState.membership;
  const assignedIds =
    membership?.active_firm_ids?.filter(Boolean) ??
    (membership?.active_firm_id ? [membership.active_firm_id] : membership?.organization_id ? [membership.organization_id] : []);
  const dashboard = useHekimDashboard(assignedIds);

  if (membershipState.loading || dashboard.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={{ color: '#CBD5E1' }}>Hekim paneli yükleniyor...</Text>
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
        <Text style={{ color: '#F8FAFC', fontSize: 26, fontWeight: '700' }}>İşyeri Hekimi</Text>
        <Text style={{ color: '#94A3B8', marginTop: 6 }}>
          Muayene ve yaklaşan kontrol takibi
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
          <Card title="Muayene Kaydı" value={dashboard.summary.totalMuayeneCount} />
          <Card title="30 Gün İçinde" value={dashboard.summary.upcoming30Count} />
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
            Yaklaşan Muayeneler
          </Text>
          {dashboard.upcoming.length === 0 ? (
            <Text style={{ color: '#64748B', fontSize: 13 }}>
              Önümüzdeki 30 gün için yaklaşan muayene kaydı yok.
            </Text>
          ) : (
            dashboard.upcoming.map((item) => (
              <View
                key={item.id}
                style={{ borderBottomColor: '#1E293B', borderBottomWidth: 1, paddingVertical: 10 }}
              >
                <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '600' }}>
                  {item.personelAdSoyad}
                </Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                  {item.daysLeft} gün sonra kontrol
                </Text>
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
