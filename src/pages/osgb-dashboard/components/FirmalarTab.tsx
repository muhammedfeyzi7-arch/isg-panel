import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

interface FirmalarTabProps {
  altFirmalar: AltFirma[];
  uzmanlar: Uzman[];
  orgId: string;
  isDark: boolean;
  onFirmaClick: (firma: { id: string; name: string }) => void;
  onFirmaEkle: () => void;
  onAtamaYap: (firmaId: string) => void;
}

function getDaysDiff(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

interface VisitBadgeProps { days: number | null }
function VisitBadge({ days }: VisitBadgeProps) {
  if (days === null) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(100,116,139,0.1)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.15)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#94A3B8' }} />
      Hiç ziyaret yok
    </span>
  );
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
      Bugün
    </span>
  );
  if (days <= 2) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
      {days}g önce
    </span>
  );
  if (days <= 7) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
      {days}g önce
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.18)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444' }} />
      {days}g önce
    </span>
  );
}

export default function FirmalarTab({
  altFirmalar, uzmanlar, orgId, isDark, onFirmaClick, onFirmaEkle, onAtamaYap,
}: FirmalarTabProps) {
  const [search, setSearch] = useState('');
  const [firmaLastVisit, setFirmaLastVisit] = useState<Record<string, string>>({});
  const [aktifFirmaIds, setAktifFirmaIds] = useState<Set<string>>(new Set());
  const [vizitLoading, setVizitLoading] = useState(false);

  const textPrimary = 'var(--text-primary)';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const card: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(145deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
    borderRadius: '20px',
  };

  useEffect(() => {
    if (!orgId || altFirmalar.length === 0) return;
    const fetchVisits = async () => {
      setVizitLoading(true);
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const firmaIds = altFirmalar.map(f => f.id);
        const { data } = await supabase
          .from('osgb_ziyaretler')
          .select('firma_id, giris_saati, cikis_saati')
          .eq('organization_id', orgId)
          .in('firma_id', firmaIds)
          .gte('giris_saati', thirtyDaysAgo.toISOString())
          .order('giris_saati', { ascending: false });

        const lastVisit: Record<string, string> = {};
        const aktif = new Set<string>();
        (data ?? []).forEach(z => {
          if (!lastVisit[z.firma_id]) lastVisit[z.firma_id] = z.giris_saati;
          if (!z.cikis_saati) aktif.add(z.firma_id);
        });
        setFirmaLastVisit(lastVisit);
        setAktifFirmaIds(aktif);
      } catch (err) {
        console.error('[FirmalarTab] visit fetch error:', err);
      } finally {
        setVizitLoading(false);
      }
    };
    fetchVisits();
  }, [orgId, altFirmalar]);

  const filtered = altFirmalar.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const getFirmaUzmanlar = (firmaId: string) =>
    uzmanlar.filter(u =>
      (u.active_firm_ids && u.active_firm_ids.includes(firmaId)) ||
      u.active_firm_id === firmaId
    );

  return (
    <div className="space-y-5 page-enter">

      {/* ── HEADER BAR ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Arama */}
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Firma adı ile ara..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
              border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'}`,
              color: 'var(--text-primary)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#10B981';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)', color: textSecondary }}>
              <i className="ri-close-line text-xs" />
            </button>
          )}
        </div>

        {/* Firma sayısı badge */}
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          {filtered.length} firma
        </span>

        {/* Firma Ekle */}
        <button
          onClick={onFirmaEkle}
          className="whitespace-nowrap ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
          style={{
            background: 'linear-gradient(135deg, #10B981, #059669)',
            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(16,185,129,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(16,185,129,0.3)';
          }}>
          <i className="ri-add-line text-base" />
          Firma Ekle
        </button>
      </div>

      {/* ── BOŞ STATE ── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-5" style={card}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.15)' }}>
            <i className="ri-building-2-line text-2xl" style={{ color: '#10B981' }} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold mb-2" style={{ color: textPrimary }}>
              {search ? `"${search}" için sonuç bulunamadı` : 'Henüz firma eklenmedi'}
            </p>
            <p className="text-sm" style={{ color: textSecondary }}>
              {search
                ? 'Farklı bir arama terimi deneyin'
                : 'Müşteri firmalarınızı ekleyerek ISG süreçlerini yönetmeye başlayın.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={onFirmaEkle}
              className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <i className="ri-add-line" />İlk Firmayı Ekle
            </button>
          )}
        </div>
      )}

      {/* ── FİRMA LİSTESİ ── */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((f, idx) => {
            const lastVisitDate = firmaLastVisit[f.id];
            const days = getDaysDiff(lastVisitDate);
            const isAktif = aktifFirmaIds.has(f.id);
            const firmaUzmanlar = getFirmaUzmanlar(f.id);
            const hasUzman = firmaUzmanlar.length > 0;
            const addedDate = new Date(f.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

            const rowBase: React.CSSProperties = {
              ...card,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              animation: `fadeSlideIn 0.3s ease ${idx * 0.04}s both`,
            };

            return (
              <div
                key={f.id}
                style={rowBase}
                onClick={() => onFirmaClick({ id: f.id, name: f.name })}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'translateX(3px)';
                  el.style.boxShadow = isDark
                    ? '0 8px 28px rgba(0,0,0,0.3)'
                    : '0 8px 24px rgba(15,23,42,0.09)';
                  el.style.borderColor = isAktif
                    ? 'rgba(34,197,94,0.3)'
                    : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.13)');
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'translateX(0)';
                  el.style.boxShadow = 'none';
                  el.style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
                }}
              >
                <div className="flex items-center gap-4 p-4">

                  {/* ── SOL: İkon ── */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{
                        background: isAktif
                          ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))'
                          : 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.06))',
                      }}>
                      <i
                        className="ri-building-2-fill text-base"
                        style={{ color: isAktif ? '#22C55E' : '#10B981' }}
                      />
                    </div>
                    {isAktif && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 animate-pulse"
                        style={{
                          background: '#22C55E',
                          borderColor: isDark ? '#1e293b' : '#ffffff',
                        }}
                      />
                    )}
                  </div>

                  {/* ── ORTA: Firma bilgileri ── */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: textPrimary }}>{f.name}</p>
                      {isAktif && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                          Aktif ziyaret
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[11px]" style={{ color: textSecondary }}>
                        <i className="ri-user-star-line mr-1 text-[10px]" />
                        {!hasUzman ? (
                          <span style={{ color: '#F59E0B', fontWeight: 600 }}>Uzman atanmadı</span>
                        ) : (
                          firmaUzmanlar.map(u => u.display_name.split(' ')[0]).join(', ')
                        )}
                      </span>
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.2)', fontSize: '10px' }}>·</span>
                      <span className="text-[11px]" style={{ color: textSecondary }}>
                        <i className="ri-group-line mr-1 text-[10px]" />
                        {f.personelSayisi} personel
                      </span>
                      <span style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.2)', fontSize: '10px' }}>·</span>
                      <span className="text-[11px]" style={{ color: textSecondary }}>
                        <i className="ri-calendar-line mr-1 text-[10px]" />
                        {addedDate}
                      </span>
                    </div>
                  </div>

                  {/* ── SAĞ: Uzman chips + personel + son ziyaret + detay ── */}
                  <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
                    {/* Uzman chip */}
                    {hasUzman && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {firmaUzmanlar.slice(0, 2).map(u => (
                          <span
                            key={u.user_id}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <span
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                              {u.display_name.charAt(0).toUpperCase()}
                            </span>
                            {u.display_name.split(' ')[0]}
                          </span>
                        ))}
                        {firmaUzmanlar.length > 2 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                            +{firmaUzmanlar.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Uzman ata butonu */}
                    {!hasUzman && (
                      <button
                        onClick={e => { e.stopPropagation(); onAtamaYap(f.id); }}
                        className="whitespace-nowrap flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#D97706' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.14)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.08)'; }}>
                        <i className="ri-user-add-line text-[10px]" />+ Uzman Ata
                      </button>
                    )}

                    {/* Son ziyaret badge */}
                    {!vizitLoading && <VisitBadge days={days} />}

                    {/* Detay butonu */}
                    <button
                      onClick={e => { e.stopPropagation(); onFirmaClick({ id: f.id, name: f.name }); }}
                      className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}`,
                        color: textSecondary,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = 'rgba(16,185,129,0.1)';
                        el.style.borderColor = 'rgba(16,185,129,0.25)';
                        el.style.color = '#10B981';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';
                        el.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
                        el.style.color = textSecondary;
                      }}>
                      <i className="ri-eye-line text-xs" />
                      Detay
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
