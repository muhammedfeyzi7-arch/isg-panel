import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ConfirmDeleteModal from '@/components/base/ConfirmDeleteModal';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management';

interface AltFirma {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  personelSayisi: number;
  uzmanAd: string | null;
  uygunsuzluk: number;
}

interface Uzman {
  user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  active_firm_id: string | null;
  active_firm_ids: string[] | null;
  active_firm_name: string | null;
}

interface MobileFirmalarTabProps {
  altFirmalar: AltFirma[];
  uzmanlar: Uzman[];
  orgId: string;
  onFirmaClick: (f: { id: string; name: string }) => void;
  onFirmaEkle: () => void;
  onAtamaYap: (firmaId: string) => void;
  onFirmaDeleted?: (firmaId: string) => void;
}

const GRADIENT_COLORS = [
  { from: '#FF6B35', to: '#FF8C42' },
  { from: '#7C3AED', to: '#9F67FF' },
  { from: '#0EA5E9', to: '#38BDF8' },
  { from: '#10B981', to: '#34D399' },
  { from: '#F59E0B', to: '#FCD34D' },
  { from: '#EF4444', to: '#F87171' },
  { from: '#EC4899', to: '#F472B6' },
  { from: '#14B8A6', to: '#2DD4BF' },
];

type FilterType = 'tumu' | 'uzmanli' | 'uzmansiz' | 'uygunsuzluk';

export default function MobileFirmalarTab({
  altFirmalar, uzmanlar, orgId, onFirmaClick, onFirmaEkle, onAtamaYap, onFirmaDeleted,
}: MobileFirmalarTabProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('tumu');
  const [aktifFirmaIds, setAktifFirmaIds] = useState<Set<string>>(new Set());
  const [silOnayId, setSilOnayId] = useState<string | null>(null);
  const [silAdi, setSilAdi] = useState('');
  const [silLoading, setSilLoading] = useState(false);

  useEffect(() => {
    if (!orgId || altFirmalar.length === 0) return;
    const firmaIds = altFirmalar.map(f => f.id);
    supabase
      .from('osgb_ziyaretler')
      .select('firma_org_id')
      .eq('osgb_org_id', orgId)
      .in('firma_org_id', firmaIds)
      .is('cikis_saati', null)
      .then(({ data }) => {
        const aktif = new Set<string>((data ?? []).map((z: { firma_org_id: string }) => z.firma_org_id));
        setAktifFirmaIds(aktif);
      });
  }, [orgId, altFirmalar]);

  const filtered = altFirmalar.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'uzmanli') return !!f.uzmanAd;
    if (filter === 'uzmansiz') return !f.uzmanAd;
    if (filter === 'uygunsuzluk') return f.uygunsuzluk > 0;
    return true;
  });

  const handleSil = async (firmaId: string) => {
    setSilLoading(true);
    if (onFirmaDeleted) onFirmaDeleted(firmaId);
    setSilOnayId(null);
    setSilAdi('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');
      await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete_firm', organization_id: orgId, firma_id: firmaId }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSilLoading(false);
    }
  };

  const getFirmaUzmanlar = (firmaId: string) =>
    uzmanlar.filter(u => (u.active_firm_ids && u.active_firm_ids.includes(firmaId)) || u.active_firm_id === firmaId);

  const FILTERS: { id: FilterType; label: string; count: number }[] = [
    { id: 'tumu', label: 'Tümü', count: altFirmalar.length },
    { id: 'uzmanli', label: 'Uzman Atanmış', count: altFirmalar.filter(f => !!f.uzmanAd).length },
    { id: 'uzmansiz', label: 'Uzman Yok', count: altFirmalar.filter(f => !f.uzmanAd).length },
    { id: 'uygunsuzluk', label: 'Uygunsuzluk', count: altFirmalar.filter(f => f.uygunsuzluk > 0).length },
  ];

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-black" style={{ color: 'var(--text-primary)' }}>
          Firmalar
        </h2>
        <button
          onClick={onFirmaEkle}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white cursor-pointer active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
        >
          <i className="ri-add-line" />
          Ekle
        </button>
      </div>

      {/* Arama */}
      <div className="relative">
        <i
          className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-base"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Firma ara..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none"
          style={{
            background: 'var(--bg-card-solid)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer"
            style={{ background: 'var(--border-subtle)' }}
          >
            <i className="ri-close-line text-xs" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      {/* Pill filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap cursor-pointer flex-shrink-0 transition-all active:scale-95"
            style={{
              background: filter === f.id ? '#0EA5E9' : 'var(--bg-card-solid)',
              color: filter === f.id ? '#fff' : 'var(--text-muted)',
              border: filter === f.id ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            {f.label}
            {f.count > 0 && (
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  background: filter === f.id ? 'rgba(255,255,255,0.25)' : 'rgba(14,165,233,0.1)',
                  color: filter === f.id ? '#fff' : '#0EA5E9',
                }}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Firma listesi */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
          style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.1)' }}>
            <i className="ri-building-2-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {search ? `"${search}" bulunamadı` : 'Firma yok'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {search ? 'Farklı bir arama deneyin' : 'Müşteri firması ekleyin'}
            </p>
          </div>
          {!search && (
            <button
              onClick={onFirmaEkle}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}
            >
              + Firma Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((f, i) => {
            const isAktif = aktifFirmaIds.has(f.id);
            const firmaUzmanlar = getFirmaUzmanlar(f.id);
            const hasUzman = firmaUzmanlar.length > 0;
            const colorIdx = i % GRADIENT_COLORS.length;

            return (
              <div
                key={f.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--bg-card-solid)',
                  border: isAktif ? '1.5px solid rgba(34,197,94,0.3)' : '1px solid var(--border-subtle)',
                }}
              >
                {/* Ana içerik */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer active:opacity-80 transition-opacity"
                  onClick={() => onFirmaClick({ id: f.id, name: f.name })}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white"
                      style={{
                        background: isAktif
                          ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                          : `linear-gradient(135deg, ${GRADIENT_COLORS[colorIdx].from}, ${GRADIENT_COLORS[colorIdx].to})`,
                      }}
                    >
                      {f.name.charAt(0).toUpperCase()}
                    </div>
                    {isAktif && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 animate-pulse"
                        style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {f.name}
                      </p>
                      {isAktif && (
                        <span
                          className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}
                        >
                          AKTİF
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        <i className="ri-group-line mr-1" />{f.personelSayisi} personel
                      </span>
                      {f.uzmanAd && (
                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          · {f.uzmanAd}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sağ taraf */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {f.uygunsuzluk > 0 && (
                      <span
                        className="text-[11px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                      >
                        {f.uygunsuzluk} uyg.
                      </span>
                    )}
                    <i className="ri-arrow-right-s-line text-lg" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>

                {/* Alt aksiyon bar */}
                <div
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  {!hasUzman && (
                    <button
                      onClick={() => onAtamaYap(f.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer active:scale-95 transition-transform"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      <i className="ri-links-line text-xs" />
                      Uzman Ata
                    </button>
                  )}
                  <button
                    onClick={() => onFirmaClick({ id: f.id, name: f.name })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer active:scale-95 transition-transform"
                    style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.15)' }}
                  >
                    <i className="ri-eye-line text-xs" />
                    Detay
                  </button>
                  <button
                    onClick={() => { setSilOnayId(f.id); setSilAdi(f.name); }}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer active:scale-95 transition-transform"
                    style={{ background: 'rgba(239,68,68,0.07)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    <i className="ri-delete-bin-line text-xs" />
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        open={!!silOnayId}
        onClose={() => { setSilOnayId(null); setSilAdi(''); }}
        onConfirm={() => silOnayId && void handleSil(silOnayId)}
        title="Firmayı silmek istediğinize emin misiniz?"
        description={`"${silAdi}" firması çöp kutusuna taşınacak.`}
        loading={silLoading}
        isDark={false}
      />
    </div>
  );
}
