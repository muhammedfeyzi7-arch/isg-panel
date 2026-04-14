import { useState, useEffect, useCallback } from 'react';
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
  gps_required?: boolean;
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

interface FirmalarTabProps {
  altFirmalar: AltFirma[];
  uzmanlar: Uzman[];
  orgId: string;
  isDark: boolean;
  onFirmaClick: (firma: { id: string; name: string }) => void;
  onFirmaEkle: () => void;
  onAtamaYap: (firmaId: string) => void;
  onFirmaDeleted?: (firmaId: string) => void;
}

function getDaysDiff(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function VisitBadge({ days }: { days: number | null }) {
  if (days === null) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.15)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }} />Hiç yok
    </span>
  );
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0EA5E9' }} />Bugün
    </span>
  );
  if (days <= 2) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0EA5E9' }} />{days}g önce
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />{days}g önce
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444' }} />{days}g önce
    </span>
  );
}

function GpsBadge({ active }: { active: boolean }) {
  if (active) return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(239,68,68,0.09)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.22)' }}>
      <i className="ri-map-pin-2-fill text-[8px]" />GPS
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(148,163,184,0.09)', color: '#94A3B8', border: '1px solid rgba(148,163,184,0.2)' }}>
      <i className="ri-qr-code-line text-[8px]" />QR
    </span>
  );
}

export default function FirmalarTab({
  altFirmalar, uzmanlar, orgId, isDark, onFirmaClick, onFirmaEkle, onAtamaYap, onFirmaDeleted,
}: FirmalarTabProps) {
  const [search, setSearch] = useState('');
  const [firmaLastVisit, setFirmaLastVisit] = useState<Record<string, string>>({});
  const [aktifFirmaIds, setAktifFirmaIds] = useState<Set<string>>(new Set());
  const [firmaGpsMap, setFirmaGpsMap] = useState<Record<string, boolean>>({});
  const [vizitLoading, setVizitLoading] = useState(false);
  const [silOnayId, setSilOnayId] = useState<string | null>(null);
  const [silLoading, setSilLoading] = useState(false);
  const [silAdi, setSilAdi] = useState('');

  const textPrimary = 'var(--text-primary)';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const tableBg = isDark ? 'rgba(20,30,50,0.98)' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';

  const fetchGpsInfo = useCallback(async () => {
    if (altFirmalar.length === 0) return;
    const ids = altFirmalar.map(f => f.id);
    const { data } = await supabase.from('organizations').select('id, gps_required').in('id', ids);
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((r: { id: string; gps_required: boolean }) => { map[r.id] = r.gps_required ?? false; });
    setFirmaGpsMap(map);
  }, [altFirmalar]);

  useEffect(() => {
    if (!orgId || altFirmalar.length === 0) return;
    void fetchGpsInfo();
    const fetchVisits = async () => {
      setVizitLoading(true);
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const firmaIds = altFirmalar.map(f => f.id);
        const { data } = await supabase
          .from('osgb_ziyaretler')
          .select('firma_org_id, giris_saati, cikis_saati')
          .eq('osgb_org_id', orgId)
          .in('firma_org_id', firmaIds)
          .gte('giris_saati', thirtyDaysAgo.toISOString())
          .order('giris_saati', { ascending: false });
        const lastVisit: Record<string, string> = {};
        const aktif = new Set<string>();
        (data ?? []).forEach((z: { firma_org_id: string; giris_saati: string; cikis_saati: string | null }) => {
          if (!lastVisit[z.firma_org_id]) lastVisit[z.firma_org_id] = z.giris_saati;
          if (!z.cikis_saati) aktif.add(z.firma_org_id);
        });
        setFirmaLastVisit(lastVisit);
        setAktifFirmaIds(aktif);
      } catch (err) {
        console.error('[FirmalarTab] visit fetch error:', err);
      } finally {
        setVizitLoading(false);
      }
    };
    void fetchVisits();
  }, [orgId, altFirmalar, fetchGpsInfo]);

  const handleSil = async (firmaId: string) => {
    setSilLoading(true);
    // Optimistic: hemen UI'dan kaldır
    if (onFirmaDeleted) onFirmaDeleted(firmaId);
    setSilOnayId(null);
    setSilAdi('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Oturum bulunamadı.');
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete_firm', organization_id: orgId, firma_id: firmaId }),
      });
      const json = await res.json() as { error?: string; success?: boolean };
      if (json.error) throw new Error(json.error);
    } catch (err) {
      // Hata durumunda liste yeniden yüklenecek (parent fetchData tetikler)
      if (onFirmaDeleted) onFirmaDeleted(firmaId);
    } finally {
      setSilLoading(false);
    }
  };

  const filtered = altFirmalar.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const getFirmaUzmanlar = (firmaId: string) =>
    uzmanlar.filter(u => (u.active_firm_ids && u.active_firm_ids.includes(firmaId)) || u.active_firm_id === firmaId);

  return (
    <div className="space-y-4 page-enter">

      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: textSecondary }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Firma ara..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none transition-all"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1.5px solid ${borderColor}`, color: textPrimary }}
            onFocus={e => { e.currentTarget.style.borderColor = '#0EA5E9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none'; }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full cursor-pointer"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)', color: textSecondary }}>
              <i className="ri-close-line text-[10px]" />
            </button>
          )}
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          {filtered.length} firma
        </span>
        <button onClick={onFirmaEkle}
          className="whitespace-nowrap ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
          <i className="ri-add-line text-sm" />Firma Ekle
        </button>
      </div>

      {/* Boş state */}
      {filtered.length === 0 && (
        <div className="rounded-xl p-12 flex flex-col items-center gap-4 text-center"
          style={{ background: tableBg, border: `1px solid ${borderColor}` }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
            <i className="ri-building-2-line text-2xl" style={{ color: '#0EA5E9' }} />
          </div>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>
              {search ? `"${search}" için sonuç yok` : 'Henüz firma eklenmedi'}
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              {search ? 'Farklı bir arama deneyin' : 'Müşteri firmalarınızı ekleyerek ISG süreçlerini yönetin.'}
            </p>
          </div>
          {!search && (
            <button onClick={onFirmaEkle}
              className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
              <i className="ri-add-line" />İlk Firmayı Ekle
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      {filtered.length > 0 && (
        <div className="space-y-1">
          <div className="hidden md:grid grid-cols-[2.5fr_1.5fr_1fr_1.2fr_140px] items-center px-4 py-2"
            style={{ borderBottom: `1px solid ${borderColor}` }}>
            {['FİRMA', 'UZMAN', 'PERSONEL', 'SON ZİYARET', 'İŞLEM'].map(h => (
              <span key={h} className="text-[10px] font-bold tracking-wider uppercase" style={{ color: textSecondary }}>{h}</span>
            ))}
          </div>

          {/* Mobil */}
          <div className="md:hidden space-y-2 pt-1">
            {filtered.map((f) => {
              const days = getDaysDiff(firmaLastVisit[f.id]);
              const isAktif = aktifFirmaIds.has(f.id);
              const firmaUzmanlar = getFirmaUzmanlar(f.id);
              const hasUzman = firmaUzmanlar.length > 0;
              const gpsActive = firmaGpsMap[f.id] ?? false;
              return (
                <div key={f.id} className="rounded-xl p-4 transition-all"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${borderColor}` }}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold text-white"
                        style={{ background: isAktif ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                        {f.name.charAt(0).toUpperCase()}
                      </div>
                      {isAktif && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse" style={{ background: '#22C55E', borderColor: isDark ? 'rgba(20,30,50,0.98)' : '#ffffff' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: textPrimary }}>{f.name}</p>
                        <GpsBadge active={gpsActive} />
                      </div>
                      {isAktif && <span className="text-[9px] font-bold" style={{ color: '#22C55E' }}>● Ziyaret devam ediyor</span>}
                    </div>
                    {!vizitLoading && <VisitBadge days={days} />}
                  </div>
                  <div className="flex items-center gap-2 justify-end flex-wrap pt-2" style={{ borderTop: `1px solid ${borderColor}` }}>
                    {!hasUzman && (
                      <button onClick={() => onAtamaYap(f.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[11px] font-semibold whitespace-nowrap"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#D97706' }}>
                        <i className="ri-links-line text-xs" />Uzman Ata
                      </button>
                    )}
                    <button onClick={() => onFirmaClick({ id: f.id, name: f.name })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
                      <i className="ri-edit-line text-xs" />Düzenle
                    </button>
                    <button onClick={() => { setSilOnayId(f.id); setSilAdi(f.name); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                      <i className="ri-delete-bin-line text-xs" />Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop */}
          <div className="hidden md:block space-y-1.5 pt-1">
            {filtered.map((f) => {
              const days = getDaysDiff(firmaLastVisit[f.id]);
              const isAktif = aktifFirmaIds.has(f.id);
              const firmaUzmanlar = getFirmaUzmanlar(f.id);
              const hasUzman = firmaUzmanlar.length > 0;
              const gpsActive = firmaGpsMap[f.id] ?? false;

              return (
                <div key={f.id}
                  className="grid grid-cols-[2.5fr_1.5fr_1fr_1.2fr_140px] items-center px-4 py-3 rounded-xl transition-all"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${borderColor}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff'; (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}>

                  {/* Firma */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-2 cursor-pointer" onClick={() => onFirmaClick({ id: f.id, name: f.name })}>
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white"
                        style={{ background: isAktif ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                        {f.name.charAt(0).toUpperCase()}
                      </div>
                      {isAktif && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse" style={{ background: '#22C55E', borderColor: isDark ? 'rgba(20,30,50,0.98)' : '#ffffff' }} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold truncate" style={{ color: textPrimary }}>{f.name}</p>
                        <GpsBadge active={gpsActive} />
                      </div>
                      <span className="text-[9px]" style={{ color: isAktif ? '#22C55E' : textSecondary }}>
                        {isAktif ? '● Ziyaret devam ediyor' : 'Firma'}
                      </span>
                    </div>
                  </div>

                  {/* Uzman */}
                  <div className="min-w-0 pr-2 cursor-pointer" onClick={() => onFirmaClick({ id: f.id, name: f.name })}>
                    {hasUzman ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {firmaUzmanlar.slice(0, 2).map(u => (
                          <span key={u.user_id} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: 'rgba(14,165,233,0.1)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.2)' }}>
                            <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                              {u.display_name.charAt(0).toUpperCase()}
                            </span>
                            {u.display_name.split(' ')[0]}
                          </span>
                        ))}
                        {firmaUzmanlar.length > 2 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(14,165,233,0.08)', color: '#0284C7' }}>
                            +{firmaUzmanlar.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }}>
                        Atanmadı
                      </span>
                    )}
                  </div>

                  {/* Personel */}
                  <div className="cursor-pointer" onClick={() => onFirmaClick({ id: f.id, name: f.name })}>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }}>
                      <i className="ri-group-line text-[9px]" />{f.personelSayisi}
                    </span>
                  </div>

                  {/* Son ziyaret */}
                  <div className="cursor-pointer" onClick={() => onFirmaClick({ id: f.id, name: f.name })}>
                    {!vizitLoading && <VisitBadge days={days} />}
                    {vizitLoading && <span className="text-[10px]" style={{ color: textSecondary }}>...</span>}
                  </div>

                  {/* İşlem butonları — sabit 140px, yan yana hizalı */}
                  <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                    {!hasUzman && (
                      <button onClick={() => onAtamaYap(f.id)} title="Uzman Ata"
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#D97706' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.15)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.08)'; }}>
                        <i className="ri-links-line text-[10px]" />
                      </button>
                    )}
                    {/* Detay */}
                    <button onClick={() => onFirmaClick({ id: f.id, name: f.name })} title="Detay"
                      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1px solid ${borderColor}`, color: textSecondary }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; (e.currentTarget as HTMLElement).style.color = textSecondary; }}>
                      <i className="ri-eye-line text-[10px]" />
                    </button>
                    {/* Düzenle — gri ikon */}
                    <button onClick={() => onFirmaClick({ id: f.id, name: f.name })} title="Düzenle"
                      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                      style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1px solid ${borderColor}`, color: textSecondary }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)'; (e.currentTarget as HTMLElement).style.color = textSecondary; }}>
                      <i className="ri-edit-line text-[10px]" />
                    </button>
                    {/* Sil — kırmızı ikon, modal aç */}
                    <button onClick={() => { setSilOnayId(f.id); setSilAdi(f.name); }} title="Sil"
                      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'; }}>
                      <i className="ri-delete-bin-line text-[10px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Silme Onay Modalı */}
      <ConfirmDeleteModal
        open={!!silOnayId}
        onClose={() => { setSilOnayId(null); setSilAdi(''); }}
        onConfirm={() => silOnayId && void handleSil(silOnayId)}
        title="Firmayı silmek istediğinize emin misiniz?"
        description={`"${silAdi}" firması çöp kutusuna taşınacak. Bağlı veriler korunur.`}
        loading={silLoading}
        isDark={isDark}
      />
    </div>
  );
}
