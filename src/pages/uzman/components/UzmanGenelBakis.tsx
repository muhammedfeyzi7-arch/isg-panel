import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  atanmisFirmaIds: string[];
  isDark: boolean;
}

interface Stats {
  firmaCount: number;
  personelCount: number;
  uygunsuzlukAcik: number;
  uygunsuzlukKapali: number;
  ekipmanCount: number;
  ekipmanUygunDegil: number;
  izinBekleyen: number;
  egitimCount: number;
  tutanakCount: number;
  ziyaretCount: number;
  saglikCount: number;
}

const ACCENT = '#0EA5E9';

export default function UzmanGenelBakis({ atanmisFirmaIds, isDark }: Props) {
  const [stats, setStats] = useState<Stats>({
    firmaCount: 0,
    personelCount: 0,
    uygunsuzlukAcik: 0,
    uygunsuzlukKapali: 0,
    ekipmanCount: 0,
    ekipmanUygunDegil: 0,
    izinBekleyen: 0,
    egitimCount: 0,
    tutanakCount: 0,
    ziyaretCount: 0,
    saglikCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (atanmisFirmaIds.length === 0) { setLoading(false); return; }
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [
          { count: personelC },
          { count: uygunsuzlukAcikC },
          { count: uygunsuzlukKapaliC },
          { count: ekipmanC },
          { count: ekipmanUygunDegilC },
          { count: izinC },
          { count: egitimC },
          { count: tutanakC },
          { count: saglikC },
        ] = await Promise.all([
          supabase.from('personeller').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('silinmis', false),
          supabase.from('uygunsuzluklar').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).neq('durum', 'Kapandı').eq('silinmis', false),
          supabase.from('uygunsuzluklar').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('durum', 'Kapandı').eq('silinmis', false),
          supabase.from('ekipmanlar').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('silinmis', false),
          supabase.from('ekipmanlar').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('durum', 'Uygun Değil').eq('silinmis', false),
          supabase.from('is_izinleri').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('durum', 'Onay Bekliyor').eq('silinmis', false),
          supabase.from('egitimler').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('silinmis', false),
          supabase.from('tutanaklar').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('silinmis', false),
          supabase.from('muayeneler').select('*', { count: 'exact', head: true }).in('organization_id', atanmisFirmaIds).eq('silinmis', false),
        ]);

        setStats({
          firmaCount: atanmisFirmaIds.length,
          personelCount: personelC ?? 0,
          uygunsuzlukAcik: uygunsuzlukAcikC ?? 0,
          uygunsuzlukKapali: uygunsuzlukKapaliC ?? 0,
          ekipmanCount: ekipmanC ?? 0,
          ekipmanUygunDegil: ekipmanUygunDegilC ?? 0,
          izinBekleyen: izinC ?? 0,
          egitimCount: egitimC ?? 0,
          tutanakCount: tutanakC ?? 0,
          ziyaretCount: 0,
          saglikCount: saglikC ?? 0,
        });
      } catch (err) {
        console.error('[UzmanGenelBakis]', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [atanmisFirmaIds.join(',')]);

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';

  const CARDS = [
    { label: 'Atanmış Firma', value: stats.firmaCount, icon: 'ri-building-3-line', color: ACCENT, bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)' },
    { label: 'Toplam Personel', value: stats.personelCount, icon: 'ri-group-line', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)' },
    { label: 'Açık Uygunsuzluk', value: stats.uygunsuzlukAcik, icon: 'ri-error-warning-line', color: stats.uygunsuzlukAcik > 0 ? '#F87171' : '#64748b', bg: stats.uygunsuzlukAcik > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(100,116,139,0.08)', border: stats.uygunsuzlukAcik > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(100,116,139,0.15)' },
    { label: 'Kapalı Uygunsuzluk', value: stats.uygunsuzlukKapali, icon: 'ri-checkbox-circle-line', color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.18)' },
    { label: 'Toplam Ekipman', value: stats.ekipmanCount, icon: 'ri-tools-line', color: '#818CF8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)' },
    { label: 'Uygun Değil Ekipman', value: stats.ekipmanUygunDegil, icon: 'ri-tools-fill', color: stats.ekipmanUygunDegil > 0 ? '#F97316' : '#64748b', bg: stats.ekipmanUygunDegil > 0 ? 'rgba(249,115,22,0.1)' : 'rgba(100,116,139,0.08)', border: stats.ekipmanUygunDegil > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(100,116,139,0.15)' },
    { label: 'Bekleyen İzin', value: stats.izinBekleyen, icon: 'ri-shield-keyhole-line', color: stats.izinBekleyen > 0 ? '#FBBF24' : '#64748b', bg: stats.izinBekleyen > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(100,116,139,0.08)', border: stats.izinBekleyen > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(100,116,139,0.15)' },
    { label: 'Eğitim Kaydı', value: stats.egitimCount, icon: 'ri-graduation-cap-line', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
    { label: 'Tutanak', value: stats.tutanakCount, icon: 'ri-file-text-line', color: '#22D3EE', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.2)' },
    { label: 'Muayene Kaydı', value: stats.saglikCount, icon: 'ri-heart-pulse-line', color: '#FB7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.2)' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ background: cardBg, border: `1px solid ${border}`, height: '96px' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>Genel Bakış</h2>
        <p className="text-sm mt-1" style={{ color: textMuted }}>Atanmış firmaların özet istatistikleri</p>
      </div>

      {/* Uyarı bantları */}
      {(stats.uygunsuzlukAcik > 0 || stats.izinBekleyen > 0 || stats.ekipmanUygunDegil > 0) && (
        <div className="space-y-2">
          {stats.uygunsuzlukAcik > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-fill" style={{ color: '#EF4444' }} />
              <p className="text-sm font-semibold flex-1" style={{ color: '#F87171' }}>{stats.uygunsuzlukAcik} açık uygunsuzluk bekliyor</p>
            </div>
          )}
          {stats.izinBekleyen > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <i className="ri-time-line" style={{ color: '#FBBF24' }} />
              <p className="text-sm font-semibold flex-1" style={{ color: '#FCD34D' }}>{stats.izinBekleyen} iş izni onay bekliyor</p>
            </div>
          )}
          {stats.ekipmanUygunDegil > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <i className="ri-tools-fill" style={{ color: '#F97316' }} />
              <p className="text-sm font-semibold flex-1" style={{ color: '#FB923C' }}>{stats.ekipmanUygunDegil} ekipman uygun değil</p>
            </div>
          )}
        </div>
      )}

      {/* Stat kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {CARDS.map(card => (
          <div
            key={card.label}
            className="rounded-2xl p-5"
            style={{ background: cardBg, border: `1px solid ${border}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: card.bg, border: `1px solid ${card.border}` }}>
                <i className={`${card.icon} text-base`} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-black" style={{ color: card.color, letterSpacing: '-0.04em' }}>{card.value}</p>
            <p className="text-xs mt-1 font-medium" style={{ color: textMuted }}>{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
