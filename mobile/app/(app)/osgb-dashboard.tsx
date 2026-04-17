import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useMembership } from '@/hooks/useMembership';
import { useOsgbDashboard } from '@/hooks/useOsgbDashboard';
import { useAuth } from '@/store/AuthContext';

type ThemeMode = 'dark' | 'light';
type TabKey =
  | 'dashboard'
  | 'firmalar'
  | 'personel'
  | 'ziyaretler'
  | 'raporlar'
  | 'analitik'
  | 'copkutusu'
  | 'ayarlar';

const MENU_GROUPS: { title: string; items: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] }[] =
  [
    {
      title: 'GENEL',
      items: [{ key: 'dashboard', label: 'Genel Bakis', icon: 'grid-outline' }],
    },
    {
      title: 'YONETIM',
      items: [
        { key: 'firmalar', label: 'Firmalar', icon: 'business-outline' },
        { key: 'personel', label: 'Personel', icon: 'people-outline' },
        { key: 'ziyaretler', label: 'Ziyaretler', icon: 'location-outline' },
      ],
    },
    {
      title: 'SISTEM',
      items: [
        { key: 'raporlar', label: 'Raporlar', icon: 'bar-chart-outline' },
        { key: 'analitik', label: 'Analiz & Harita', icon: 'pie-chart-outline' },
        { key: 'copkutusu', label: 'Cop Kutusu', icon: 'trash-outline' },
        { key: 'ayarlar', label: 'Ayarlar', icon: 'settings-outline' },
      ],
    },
  ];

const TAB_LABEL: Record<TabKey, string> = {
  dashboard: 'Genel Bakis',
  firmalar: 'Firmalar',
  personel: 'Personel',
  ziyaretler: 'Ziyaretler',
  raporlar: 'Raporlar',
  analitik: 'Analiz & Harita',
  copkutusu: 'Cop Kutusu',
  ayarlar: 'Ayarlar',
};

function palette(mode: ThemeMode) {
  if (mode === 'light') {
    return {
      bg: '#EEF4FF',
      panel: '#FFFFFF',
      panel2: '#F8FAFC',
      border: '#D6E0F0',
      text: '#0F172A',
      muted: '#64748B',
      accent: '#0284C7',
      accentSoft: 'rgba(2,132,199,0.12)',
      overlay: 'rgba(15,23,42,0.25)',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#BE123C',
    };
  }
  return {
    bg: '#050C1E',
    panel: 'rgba(15,23,42,0.78)',
    panel2: 'rgba(15,23,42,0.65)',
    border: 'rgba(51,65,85,0.7)',
    text: '#E2E8F0',
    muted: '#94A3B8',
    accent: '#38BDF8',
    accentSoft: 'rgba(56,189,248,0.16)',
    overlay: 'rgba(2,6,23,0.78)',
    success: '#4ADE80',
    warning: '#F59E0B',
    danger: '#FB7185',
  };
}

export default function OsgbPanelScreen() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    GENEL: true,
    YONETIM: true,
    SISTEM: true,
  });

  const p = palette(theme);
  const membershipState = useMembership(user?.id);
  const dashboard = useOsgbDashboard(membershipState.membership?.organization_id);

  const userInitial = useMemo(() => {
    const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'M';
    return name.charAt(0).toUpperCase();
  }, [user?.email, user?.user_metadata]);

  if (membershipState.loading || dashboard.loading) {
    return (
      <SafeAreaView style={{ backgroundColor: p.bg, flex: 1 }}>
        <View style={{ alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' }}>
          <ActivityIndicator color={p.accent} size="large" />
          <Text style={{ color: p.text }}>OSGB paneli yukleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const error = membershipState.error ?? dashboard.error;

  return (
    <SafeAreaView style={{ backgroundColor: p.bg, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 34 }}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.refreshing}
            onRefresh={() => void Promise.all([membershipState.refresh(), dashboard.refresh()])}
            tintColor={p.accent}
          />
        }
      >
        <TopBar
          activeTab={activeTab}
          accent={p.accent}
          accentSoft={p.accentSoft}
          muted={p.muted}
          onMenu={() => setDrawerOpen(true)}
          onQuickAction={() => setQuickOpen(true)}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          text={p.text}
          theme={theme}
          userInitial={userInitial}
        />

        {error ? (
          <View
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.16)' : 'rgba(239,68,68,0.12)',
              borderColor: theme === 'dark' ? 'rgba(248,113,113,0.35)' : 'rgba(220,38,38,0.3)',
              borderRadius: 14,
              borderWidth: 1,
              marginBottom: 12,
              padding: 12,
            }}
          >
            <Text style={{ color: theme === 'dark' ? '#FCA5A5' : '#B91C1C', fontSize: 13 }}>
              {String(error)}
            </Text>
          </View>
        ) : null}

        <KpiGrid
          accent={p.accent}
          dark={theme === 'dark'}
          lastActivityCompany={dashboard.summary.lastActivityCompany}
          lastActivityLabel={dashboard.summary.lastActivityLabel}
          summary={dashboard.summary}
        />

        {activeTab === 'dashboard' || activeTab === 'firmalar' ? (
          <>
            <SectionHeader
              accent={p.accent}
              border={p.border}
              countLabel={`${dashboard.summary.childCompanyCount} firma kayitli`}
              panel={p.panel}
              text={p.text}
              title="Musteri Firmalar"
            />
            <TableCard
              border={p.border}
              columns={['FIRMA', 'PERSONEL', 'ZIYARET']}
              muted={p.muted}
              panel={p.panel}
              rows={dashboard.companyRows.map((row) => ({
                c1: row.name,
                c2: String(row.personelCount),
                c3: visitLabel(row.hasActiveVisit, row.lastVisitDays),
                c3Tone: row.hasActiveVisit ? 'green' : row.lastVisitDays === null ? 'gray' : 'blue',
                sub: row.hasActiveVisit ? 'Aktif' : undefined,
              }))}
              text={p.text}
              theme={theme}
            />
          </>
        ) : null}

        {activeTab === 'dashboard' || activeTab === 'personel' ? (
          <>
            <SectionHeader
              accent={p.accent}
              border={p.border}
              countLabel={`${dashboard.summary.activeVisitCount} personel su an sahada`}
              panel={p.panel}
              text={p.text}
              title="Personeller"
            />
            <TableCard
              border={p.border}
              columns={['PERSONEL', 'FIRMA', 'DURUM']}
              muted={p.muted}
              panel={p.panel}
              rows={dashboard.teamRows.map((row) => ({
                c1: row.displayName,
                c2: row.activeFirmName,
                c3: row.isSahada ? 'Sahada' : 'Müsait',
                c3Tone: row.isSahada ? 'green' : 'gray',
              }))}
              text={p.text}
              theme={theme}
            />
          </>
        ) : null}

        {activeTab === 'ziyaretler' ? (
          <InfoPanel
            border={p.border}
            muted={p.muted}
            panel={p.panel}
            text={p.text}
            title="Ziyaret Ozeti"
            values={[
              ['Aktif ziyaret', `${dashboard.summary.activeVisitCount}`],
              ['Bugunku ziyaret', `${dashboard.summary.todayVisitCount}`],
              ['Haftalik ziyaret', `${dashboard.summary.weeklyVisitCount}`],
              ['Son aktivite', `${dashboard.summary.lastActivityLabel}`],
            ]}
          />
        ) : null}

        {activeTab === 'raporlar' || activeTab === 'analitik' || activeTab === 'copkutusu' || activeTab === 'ayarlar' ? (
          <InfoPanel
            border={p.border}
            muted={p.muted}
            panel={p.panel}
            text={p.text}
            title={TAB_LABEL[activeTab]}
            values={[
              ['Durum', 'Hazir'],
              ['Not', 'Bu sekme UI olarak aktif, sonraki adimda aksiyon baglanacak'],
            ]}
          />
        ) : null}
      </ScrollView>

      <SidebarDrawer
        accent={p.accent}
        activeTab={activeTab}
        border={p.border}
        companyCount={dashboard.summary.childCompanyCount}
        muted={p.muted}
        onClose={() => setDrawerOpen(false)}
        onSelect={(tab) => {
          setActiveTab(tab);
          setDrawerOpen(false);
        }}
        onToggleGroup={(group) => setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
        open={drawerOpen}
        openGroups={openGroups}
        panel={p.panel}
        panel2={p.panel2}
        text={p.text}
        theme={theme}
        userInitial={userInitial}
      />

      <QuickAddModal
        accent={p.accent}
        onClose={() => setQuickOpen(false)}
        onSelect={(tab) => {
          setActiveTab(tab);
          setQuickOpen(false);
        }}
        open={quickOpen}
        panel={p.panel}
        text={p.text}
        theme={theme}
      />
    </SafeAreaView>
  );
}

function TopBar({
  activeTab,
  onMenu,
  onQuickAction,
  onToggleTheme,
  theme,
  userInitial,
  text,
  muted,
  accent,
  accentSoft,
}: {
  activeTab: TabKey;
  onMenu: () => void;
  onQuickAction: () => void;
  onToggleTheme: () => void;
  theme: ThemeMode;
  userInitial: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme === 'dark' ? 'rgba(15,23,42,0.72)' : '#FFFFFF',
        borderColor: theme === 'dark' ? 'rgba(51,65,85,0.5)' : '#D6E0F0',
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        marginBottom: 12,
        padding: 10,
      }}
    >
      <Pressable onPress={onMenu} style={[iconBtnStyle, { borderColor: theme === 'dark' ? 'rgba(51,65,85,0.8)' : '#D6E0F0' }]}>
        <Ionicons color={accent} name="menu" size={16} />
      </Pressable>

      <View
        style={{
          alignItems: 'center',
          backgroundColor: accentSoft,
          borderColor: theme === 'dark' ? 'rgba(56,189,248,0.25)' : 'rgba(2,132,199,0.2)',
          borderRadius: 10,
          borderWidth: 1,
          flex: 1,
          flexDirection: 'row',
          marginHorizontal: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      >
        <MaterialCommunityIcons color={accent} name="view-grid-outline" size={14} />
        <Text style={{ color: text, fontSize: 13, fontWeight: '700', marginLeft: 6 }}>{TAB_LABEL[activeTab]}</Text>
      </View>

      <Pressable onPress={onToggleTheme} style={[iconBtnStyle, { borderColor: theme === 'dark' ? 'rgba(51,65,85,0.8)' : '#D6E0F0' }]}>
        <Ionicons color={theme === 'dark' ? '#FBBF24' : muted} name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={15} />
      </Pressable>
      <Pressable onPress={onQuickAction} style={[iconBtnStyle, { backgroundColor: accent, borderColor: accent }]}>
        <Ionicons color={theme === 'dark' ? '#022C22' : '#EFF6FF'} name="add" size={15} />
      </Pressable>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: accent,
          borderRadius: 8,
          height: 28,
          justifyContent: 'center',
          marginLeft: 6,
          width: 28,
        }}
      >
        <Text style={{ color: theme === 'dark' ? '#0C111D' : '#EFF6FF', fontSize: 12, fontWeight: '800' }}>{userInitial}</Text>
      </View>
    </View>
  );
}

function KpiGrid({
  summary,
  lastActivityLabel,
  lastActivityCompany,
  dark,
  accent,
}: {
  summary: {
    childCompanyCount: number;
    activeVisitCount: number;
    todayVisitCount: number;
    weeklyVisitCount: number;
  };
  lastActivityLabel: string;
  lastActivityCompany: string;
  dark: boolean;
  accent: string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
      <MetricCard
        icon={<Ionicons color={dark ? '#38BDF8' : '#0284C7'} name="business-outline" size={15} />}
        subtitle={`${summary.childCompanyCount} firma kayitli`}
        title="MUSTERI FIRMA"
        value={summary.childCompanyCount}
        variant="blue"
      />
      <MetricCard
        icon={<Ionicons color={dark ? '#4ADE80' : '#16A34A'} name="location-outline" size={15} />}
        subtitle={`${summary.activeVisitCount} personel su an sahada`}
        title="AKTIF ZIYARET"
        value={summary.activeVisitCount}
        variant="green"
      />
      <MetricCard
        icon={<Ionicons color={dark ? '#F59E0B' : '#D97706'} name="calendar-outline" size={15} />}
        subtitle={`Bu hafta ${summary.weeklyVisitCount} ziyaret`}
        title="BUGUNKU ZIYARET"
        value={summary.todayVisitCount}
        variant="amber"
      />
      <MetricCard
        icon={<Ionicons color={dark ? '#FB7185' : '#BE123C'} name="pulse-outline" size={15} />}
        subtitle={String(lastActivityCompany || '-')}
        title="SON AKTIVITE"
        valueLabel={String(lastActivityLabel || '-')}
        variant="rose"
      />
      <View style={{ alignItems: 'center', flexDirection: 'row', marginTop: 4 }}>
        <View style={{ backgroundColor: `${accent}22`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>Canli dashboard</Text>
        </View>
      </View>
    </View>
  );
}

function MetricCard({
  title,
  value,
  valueLabel,
  subtitle,
  variant,
  icon,
}: {
  title: string;
  value?: number;
  valueLabel?: string;
  subtitle: string;
  variant: 'blue' | 'green' | 'amber' | 'rose';
  icon: React.ReactNode;
}) {
  const palette =
    variant === 'blue'
      ? { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.28)', main: '#7DD3FC', text: '#67E8F9' }
      : variant === 'green'
        ? { bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.26)', main: '#86EFAC', text: '#4ADE80' }
        : variant === 'amber'
          ? { bg: 'rgba(245,158,11,0.13)', border: 'rgba(245,158,11,0.28)', main: '#FCD34D', text: '#F59E0B' }
          : { bg: 'rgba(244,63,94,0.13)', border: 'rgba(244,63,94,0.27)', main: '#FDA4AF', text: '#FB7185' };

  return (
    <View
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderRadius: 16,
        borderWidth: 1,
        minWidth: '48%',
        padding: 12,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 10 }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(15,23,42,0.45)',
            borderRadius: 9,
            height: 24,
            justifyContent: 'center',
            width: 24,
          }}
        >
          {icon}
        </View>
        <Text style={{ color: palette.text, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>{title}</Text>
      </View>
      <Text style={{ color: palette.main, fontSize: valueLabel ? 22 : 36, fontWeight: '900' }}>
        {valueLabel ?? value ?? 0}
      </Text>
      <Text style={{ color: 'rgba(226,232,240,0.75)', fontSize: 11, marginTop: 6 }}>{subtitle}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  countLabel,
  panel,
  border,
  text,
  accent,
}: {
  title: string;
  countLabel: string;
  panel: string;
  border: string;
  text: string;
  accent: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: panel,
        borderColor: border,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        marginTop: 8,
        padding: 12,
      }}
    >
      <View>
        <Text style={{ color: text, fontSize: 21, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{countLabel}</Text>
      </View>
      <Pressable
        style={{
          backgroundColor: `${accent}22`,
          borderColor: `${accent}55`,
          borderRadius: 10,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      >
        <Text style={{ color: accent, fontSize: 12, fontWeight: '700' }}>Tumunu Gor</Text>
      </Pressable>
    </View>
  );
}

function TableCard({
  columns,
  rows,
  panel,
  border,
  text,
  muted,
  theme,
}: {
  columns: string[];
  rows: Array<{ c1: string; c2: string; c3: string; c3Tone: 'green' | 'gray' | 'blue'; sub?: string }>;
  panel: string;
  border: string;
  text: string;
  muted: string;
  theme: ThemeMode;
}) {
  return (
    <View
      style={{
        backgroundColor: panel,
        borderColor: border,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 }}>
        {columns.map((col) => (
          <Text key={col} style={{ color: muted, flex: 1, fontSize: 10, fontWeight: '800' }}>
            {col}
          </Text>
        ))}
      </View>

      {rows.length === 0 ? (
        <View style={{ padding: 12 }}>
          <Text style={{ color: muted, fontSize: 12 }}>Kayit bulunamadi.</Text>
        </View>
      ) : (
        rows.map((row, idx) => (
          <View
            key={`${row.c1}-${idx}`}
            style={{
              borderTopColor: border,
              borderTopWidth: 1,
              flexDirection: 'row',
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                {row.c1}
              </Text>
              {row.sub ? (
                <Text style={{ color: theme === 'dark' ? '#4ADE80' : '#16A34A', fontSize: 10, marginTop: 1 }}>
                  • {row.sub}
                </Text>
              ) : null}
            </View>
            <Text style={{ color: text, flex: 1, fontSize: 13 }}>{row.c2}</Text>
            <View style={{ flex: 1 }}>
              <StatusPill label={row.c3} tone={row.c3Tone} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'gray' | 'blue' }) {
  const palette =
    tone === 'green'
      ? { bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.28)', text: '#4ADE80' }
      : tone === 'blue'
        ? { bg: 'rgba(14,165,233,0.14)', border: 'rgba(14,165,233,0.27)', text: '#67E8F9' }
        : { bg: 'rgba(100,116,139,0.16)', border: 'rgba(100,116,139,0.28)', text: '#94A3B8' };

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: palette.text, fontSize: 10, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function InfoPanel({
  title,
  values,
  panel,
  border,
  text,
  muted,
}: {
  title: string;
  values: [string, string][];
  panel: string;
  border: string;
  text: string;
  muted: string;
}) {
  return (
    <View
      style={{
        backgroundColor: panel,
        borderColor: border,
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
      }}
    >
      <Text style={{ color: text, fontSize: 18, fontWeight: '800', marginBottom: 10 }}>{title}</Text>
      {values.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: muted, fontSize: 13 }}>{k}</Text>
          <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function SidebarDrawer({
  open,
  onClose,
  onSelect,
  onToggleGroup,
  openGroups,
  activeTab,
  companyCount,
  userInitial,
  theme,
  panel,
  panel2,
  border,
  text,
  muted,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (tab: TabKey) => void;
  onToggleGroup: (group: string) => void;
  openGroups: Record<string, boolean>;
  activeTab: TabKey;
  companyCount: number;
  userInitial: string;
  theme: ThemeMode;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <View style={{ backgroundColor: theme === 'dark' ? 'rgba(2,6,23,0.75)' : 'rgba(15,23,42,0.25)', flex: 1 }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: panel,
            borderColor: border,
            borderRadius: 18,
            borderWidth: 1,
            bottom: 14,
            left: 12,
            padding: 12,
            position: 'absolute',
            top: 16,
            width: '76%',
          }}
        >
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ backgroundColor: `${accent}2e`, borderRadius: 10, padding: 8 }}>
              <Ionicons color={accent} name="shield-checkmark-outline" size={16} />
            </View>
            <View>
              <Text style={{ color: text, fontSize: 15, fontWeight: '800' }}>ISG Denetim</Text>
              <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>OSGB PANELI</Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: `${accent}1c`,
              borderColor: `${accent}44`,
              borderRadius: 12,
              borderWidth: 1,
              marginBottom: 12,
              padding: 10,
            }}
          >
            <Text style={{ color: accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }}>ORGANIZASYON</Text>
            <Text style={{ color: text, fontSize: 13, fontWeight: '800', marginTop: 4 }}>NUR OSGB</Text>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 14 }}>
            {MENU_GROUPS.map((group) => (
              <View key={group.title} style={{ marginBottom: 10 }}>
                <Pressable
                  onPress={() => onToggleGroup(group.title)}
                  style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}
                >
                  <Text style={{ color: muted, fontSize: 9, fontWeight: '800' }}>{group.title}</Text>
                  <Ionicons
                    color={muted}
                    name={openGroups[group.title] ? 'chevron-down' : 'chevron-forward'}
                    size={12}
                  />
                </Pressable>
                {openGroups[group.title]
                  ? group.items.map((item) => {
                      const active = item.key === activeTab;
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => onSelect(item.key)}
                          style={{
                            alignItems: 'center',
                            backgroundColor: active ? `${accent}24` : 'transparent',
                            borderColor: active ? `${accent}44` : 'transparent',
                            borderRadius: 10,
                            borderWidth: 1,
                            flexDirection: 'row',
                            marginBottom: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 8,
                          }}
                        >
                          <View style={{ width: 18 }}>
                            <Ionicons color={active ? accent : muted} name={item.icon} size={13} />
                          </View>
                          <Text style={{ color: active ? accent : text, fontSize: 12, fontWeight: active ? '700' : '600' }}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            ))}

            <View
              style={{
                backgroundColor: panel2,
                borderColor: border,
                borderRadius: 12,
                borderWidth: 1,
                marginBottom: 12,
                padding: 10,
              }}
            >
              <Text style={{ color: muted, fontSize: 9, fontWeight: '800', marginBottom: 8 }}>ISTATISTIKLER</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <MiniStat accent={accent} label="Toplam Firma" value={companyCount} />
                <MiniStat accent={accent} label="Toplam Uzman" value={1} />
              </View>
            </View>
          </ScrollView>

          <View
            style={{
              alignItems: 'center',
              backgroundColor: panel2,
              borderColor: border,
              borderRadius: 12,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 10,
              padding: 8,
            }}
          >
            <View
              style={{
                alignItems: 'center',
                backgroundColor: accent,
                borderRadius: 9,
                height: 26,
                justifyContent: 'center',
                width: 26,
              }}
            >
              <Text style={{ color: theme === 'dark' ? '#0C111D' : '#EFF6FF', fontSize: 12, fontWeight: '800' }}>{userInitial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontSize: 12, fontWeight: '700' }}>m</Text>
              <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>OSGB Admin</Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons color={muted} name="close" size={16} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MiniStat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(15,23,42,0.55)',
        borderColor: 'rgba(30,41,59,0.6)',
        borderRadius: 9,
        borderWidth: 1,
        flex: 1,
        paddingHorizontal: 8,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: accent, fontSize: 19, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: '#64748B', fontSize: 9, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function QuickAddModal({
  open,
  onClose,
  onSelect,
  panel,
  text,
  accent,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (tab: TabKey) => void;
  panel: string;
  text: string;
  accent: string;
  theme: ThemeMode;
}) {
  const actions: { label: string; tab: TabKey; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Firma Ekle', tab: 'firmalar', icon: 'business-outline' },
    { label: 'Personel Ata', tab: 'personel', icon: 'person-add-outline' },
    { label: 'Ziyaret Planla', tab: 'ziyaretler', icon: 'calendar-outline' },
    { label: 'Rapor Olustur', tab: 'raporlar', icon: 'document-text-outline' },
  ];

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={open}>
      <View style={{ alignItems: 'center', backgroundColor: theme === 'dark' ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.24)', flex: 1, justifyContent: 'center', padding: 22 }}>
        <View
          style={{
            backgroundColor: panel,
            borderColor: `${accent}55`,
            borderRadius: 16,
            borderWidth: 1,
            padding: 14,
            width: '100%',
          }}
        >
          <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: text, fontSize: 17, fontWeight: '800' }}>Hizli Ekle</Text>
            <Pressable onPress={onClose}>
              <Ionicons color={accent} name="close" size={18} />
            </Pressable>
          </View>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => onSelect(action.tab)}
              style={{
                alignItems: 'center',
                backgroundColor: `${accent}16`,
                borderColor: `${accent}2f`,
                borderRadius: 10,
                borderWidth: 1,
                flexDirection: 'row',
                marginBottom: 8,
                paddingHorizontal: 10,
                paddingVertical: 9,
              }}
            >
              <Ionicons color={accent} name={action.icon} size={15} />
              <Text style={{ color: text, fontSize: 13, fontWeight: '700', marginLeft: 8 }}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function visitLabel(hasActiveVisit: boolean, lastVisitDays: number | null): string {
  if (hasActiveVisit) return 'Canli';
  if (lastVisitDays === null) return 'Ziyaret yok';
  if (lastVisitDays === 0) return 'Bugun';
  return `${lastVisitDays} gun once`;
}

const iconBtnStyle = {
  alignItems: 'center' as const,
  backgroundColor: 'rgba(30,41,59,0.8)',
  borderRadius: 8,
  borderWidth: 1,
  height: 28,
  justifyContent: 'center' as const,
  width: 28,
};
