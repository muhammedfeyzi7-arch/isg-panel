import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import HekimIsKazasiModal from './HekimIsKazasiModal';
import HekimIsKazasiRaporBolumu from './HekimIsKazasiRaporBolumu';
import { generateIsKazasiDocx } from '@/pages/hekim/utils/isKazasiDocxGenerator';

interface BesNedenItem {
  sira: number;
  neden: string;
  aciklama: string;
}

interface KazaRow {
  id: string;
  personelId: string;
  personelAd: string;
  firmaAd: string;
  firmaId: string;
  kazaTarihi: string;
  kazaSaati: string;
  kazaYeri: string;
  kazaTuru: string;
  kazaAciklamasi: string;
  yaraliVucutBolgeleri: string[];
  yaralanmaSiddeti: string;
  isGunuKaybi: number;
  hastaneyeKaldirildi: boolean;
  durum: string;
  yaralanmaTuru: string;
  hastaneAdi: string;
  tanikBilgileri: string;
  onlemler: string;
  sgkBildirildi: boolean;
  sgkBildirimTarihi: string;
  sgkBildirimNotu: string;
  fotografPaths: string[];
  besNeden: BesNedenItem[];
  kazaTipi?: string;
  riskSeviyesi?: string;
}

interface HekimIsKazasiTabProps {
  atanmisFirmaIds: string[];
  isDark: boolean;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ACCENT = '#0EA5E9';
const ACCENT_DARK = '#0284C7';

const VUCUT_LABEL: Record<string, string> = {
  bas: 'Baş', boyun: 'Boyun', sag_omuz: 'Sağ Omuz', sol_omuz: 'Sol Omuz',
  gogus: 'Göğüs', sirt: 'Sırt', sag_kol: 'Sağ Kol', sol_kol: 'Sol Kol',
  sag_el: 'Sağ El', sol_el: 'Sol El', karin: 'Karın/Bel',
  sag_kalca: 'Sağ Kalça', sol_kalca: 'Sol Kalça',
  sag_bacak: 'Sağ Bacak', sol_bacak: 'Sol Bacak',
  sag_ayak: 'Sağ Ayak', sol_ayak: 'Sol Ayak',
};

const SIDDET_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'Hafif':    { color: ACCENT,    bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.25)' },
  'Orta':     { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  'Ağır':     { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  'Çok Ağır': { color: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)' },
  'Ölüm':     { color: '#7F1D1D', bg: 'rgba(127,29,29,0.15)',  border: 'rgba(127,29,29,0.4)' },
};

const DURUM_CONFIG: Record<string, { color: string; bg: string }> = {
  'Açık':           { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  'Soruşturuluyor': { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  'Kapatıldı':      { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
};

type TabView = 'liste' | 'rapor';

// ── Detay Modal Bileşeni ──
function KazaDetayModal({
  kaza,
  isDark,
  onClose,
  onEdit,
  onWordExport,
}: {
  kaza: KazaRow;
  isDark: boolean;
  onClose: () => void;
  onEdit: () => void;
  onWordExport: () => void;
}) {
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.02)';
  const modalBg = isDark ? '#1e293b' : '#ffffff';

  const siddetCfg = SIDDET_CONFIG[kaza.yaralanmaSiddeti] ?? SIDDET_CONFIG['Hafif'];
  const durumCfg = DURUM_CONFIG[kaza.durum] ?? DURUM_CONFIG['Açık'];
  const besNedenFiltered = kaza.besNeden.filter(n => n.neden);

  const fmtDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const KAZA_TIPI_MAP: Record<string, string> = {
    is_kazasi: 'İş Kazası',
    ramak_kala: 'Ramak Kala (Near Miss)',
    meslek_hastaligi: 'Meslek Hastalığı',
  };
  const RISK_MAP: Record<string, string> = {
    dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek', kritik: 'Kritik',
  };

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{ background: modalBg, border: `1px solid ${borderColor}`, maxHeight: 'calc(100vh - 32px)', overflow: 'hidden' }}
      >
        {/* Accent bar */}
        <div className="h-[3px] flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #fbbf24)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <i className="ri-alert-line text-sm" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: textPrimary }}>Kaza Detayı</p>
              <p className="text-[10px]" style={{ color: textSecondary }}>{kaza.personelAd} — {kaza.firmaAd}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onWordExport}
              className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.1)'; }}>
              <i className="ri-file-word-line text-xs" />
              Word İndir
            </button>
            <button onClick={onEdit}
              className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
              style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: `1px solid rgba(14,165,233,0.25)` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; }}>
              <i className="ri-edit-line text-xs" />
              Düzenle
            </button>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.color = textSecondary; }}>
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {/* Scroll içerik */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: siddetCfg.bg, color: siddetCfg.color, border: `1px solid ${siddetCfg.border}` }}>
              <i className="ri-alert-line text-[10px]" />
              {kaza.yaralanmaSiddeti}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: durumCfg.bg, color: durumCfg.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: durumCfg.color }} />
              {kaza.durum}
            </span>
            {kaza.sgkBildirildi && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                <i className="ri-check-double-line text-[10px]" />
                SGK Bildirildi
              </span>
            )}
          </div>

          {/* Genel */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
            <div className="px-4 py-2.5" style={{ background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)', borderBottom: `1px solid ${borderColor}` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>
                <i className="ri-information-line mr-1.5" />Kaza Bilgileri
              </span>
            </div>
            <div className="divide-y" style={{ borderColor }}>
              {[
                { label: 'Firma', value: kaza.firmaAd },
                { label: 'Personel', value: kaza.personelAd },
                { label: 'Kaza Tarihi', value: fmtDate(kaza.kazaTarihi) + (kaza.kazaSaati ? ` — ${kaza.kazaSaati}` : '') },
                { label: 'Kaza Yeri', value: kaza.kazaYeri || '—' },
                { label: 'Kaza Türü', value: kaza.kazaTuru || '—' },
                { label: 'Kaza Tipi', value: KAZA_TIPI_MAP[kaza.kazaTipi ?? ''] || '—' },
                { label: 'Risk Seviyesi', value: RISK_MAP[kaza.riskSeviyesi ?? ''] || '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center px-4 py-2.5">
                  <span className="text-[10px] font-semibold w-32 flex-shrink-0" style={{ color: textSecondary }}>{row.label}</span>
                  <span className="text-xs font-medium" style={{ color: textPrimary }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Açıklama */}
          {kaza.kazaAciklamasi && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
              <div className="px-4 py-2.5" style={{ background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)', borderBottom: `1px solid ${borderColor}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>
                  <i className="ri-file-text-line mr-1.5" />Kaza Açıklaması
                </span>
              </div>
              <p className="px-4 py-3 text-xs leading-relaxed" style={{ color: textPrimary }}>{kaza.kazaAciklamasi}</p>
            </div>
          )}

          {/* Yaralanma */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
            <div className="px-4 py-2.5" style={{ background: isDark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.04)', borderBottom: `1px solid ${borderColor}` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#F97316' }}>
                <i className="ri-first-aid-kit-line mr-1.5" />Yaralanma
              </span>
            </div>
            <div className="divide-y" style={{ borderColor }}>
              <div className="flex items-center px-4 py-2.5">
                <span className="text-[10px] font-semibold w-32 flex-shrink-0" style={{ color: textSecondary }}>Yaralanma Türü</span>
                <span className="text-xs font-medium" style={{ color: textPrimary }}>{kaza.yaralanmaTuru || '—'}</span>
              </div>
              <div className="flex items-center px-4 py-2.5">
                <span className="text-[10px] font-semibold w-32 flex-shrink-0" style={{ color: textSecondary }}>Şiddet</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: siddetCfg.bg, color: siddetCfg.color, border: `1px solid ${siddetCfg.border}` }}>
                  {kaza.yaralanmaSiddeti}
                </span>
              </div>
              <div className="flex items-center px-4 py-2.5">
                <span className="text-[10px] font-semibold w-32 flex-shrink-0" style={{ color: textSecondary }}>İş Günü Kaybı</span>
                <span className="text-xs font-medium" style={{ color: textPrimary }}>{kaza.isGunuKaybi > 0 ? `${kaza.isGunuKaybi} gün` : 'Yok'}</span>
              </div>
              {kaza.hastaneyeKaldirildi && (
                <div className="flex items-center px-4 py-2.5">
                  <span className="text-[10px] font-semibold w-32 flex-shrink-0" style={{ color: textSecondary }}>Hastane</span>
                  <span className="text-xs font-medium" style={{ color: textPrimary }}>{kaza.hastaneAdi || 'Kaldırıldı'}</span>
                </div>
              )}
              {kaza.yaraliVucutBolgeleri.length > 0 && (
                <div className="px-4 py-3">
                  <span className="text-[10px] font-semibold block mb-2" style={{ color: textSecondary }}>Yaralanan Bölgeler</span>
                  <div className="flex flex-wrap gap-1.5">
                    {kaza.yaraliVucutBolgeleri.map(id => (
                      <span key={id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {VUCUT_LABEL[id] ?? id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SGK */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
            <div className="px-4 py-2.5" style={{ background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)', borderBottom: `1px solid ${borderColor}` }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6366F1' }}>
                <i className="ri-government-line mr-1.5" />SGK Bildirimi
              </span>
            </div>
            <div className="divide-y" style={{ borderColor }}>
              {[
                { label: 'Bildirildi mi', value: kaza.sgkBildirildi ? 'Evet' : 'Hayır' },
                { label: 'Bildirim Tarihi', value: kaza.sgkBildirimTarihi ? fmtDate(kaza.sgkBildirimTarihi) : '—' },
                { label: 'Bildirim Notu', value: kaza.sgkBildirimNotu || '—' },
              ].map(row => (
                <div key={row.label} className="flex items-center px-4 py-2.5">
                  <span className="text-[10px] font-semibold w-32 flex-shrink-0" style={{ color: textSecondary }}>{row.label}</span>
                  <span className="text-xs font-medium" style={{ color: textPrimary }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 5 Neden */}
          {besNedenFiltered.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
              <div className="px-4 py-2.5" style={{ background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)', borderBottom: `1px solid ${borderColor}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#10B981' }}>
                  <i className="ri-mind-map mr-1.5" />5 Neden Analizi
                </span>
              </div>
              <div className="px-4 py-3 space-y-2">
                {besNedenFiltered.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 rounded-lg px-3 py-2"
                    style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: textPrimary }}>{item.neden}</p>
                      {item.aciklama && <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>{item.aciklama}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Önlemler */}
          {kaza.onlemler && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
              <div className="px-4 py-2.5" style={{ background: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)', borderBottom: `1px solid ${borderColor}` }}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#10B981' }}>
                  <i className="ri-shield-check-line mr-1.5" />Alınan Önlemler
                </span>
              </div>
              <p className="px-4 py-3 text-xs leading-relaxed" style={{ color: textPrimary }}>{kaza.onlemler}</p>
            </div>
          )}

          {/* Tanık */}
          {kaza.tanikBilgileri && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
              style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
              <i className="ri-eye-line text-xs mt-0.5" style={{ color: textSecondary }} />
              <div>
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: textSecondary }}>Tanık</p>
                <p className="text-xs" style={{ color: textPrimary }}>{kaza.tanikBilgileri}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default function HekimIsKazasiTab({ atanmisFirmaIds, isDark, addToast }: HekimIsKazasiTabProps) {
  const [kazalar, setKazalar] = useState<KazaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<TabView>('liste');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<(KazaRow & { id: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detayKaza, setDetayKaza] = useState<KazaRow | null>(null);
  const [wordLoading, setWordLoading] = useState<string | null>(null);

  const textPrimary   = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const cardBg        = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';

  const loadKazalar = useCallback(async () => {
    if (atanmisFirmaIds.length === 0) { setKazalar([]); setLoading(false); return; }
    setLoading(true);
    try {
      const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);

      const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);
      const firmaAdMap: Record<string, string> = {};
      (orgs ?? []).forEach(o => { firmaAdMap[o.id] = o.name; });

      const allKazalar: KazaRow[] = [];
      await Promise.all(safeIds.map(async (firmaId) => {
        const { data: personelRows } = await supabase.from('personeller').select('id, data').eq('organization_id', firmaId).is('deleted_at', null);
        const personelAdMap: Record<string, string> = {};
        (personelRows ?? []).forEach(r => {
          const d = r.data as Record<string, unknown>;
          personelAdMap[r.id] = (d.adSoyad as string) ?? 'Bilinmiyor';
        });

        const { data: rows } = await supabase.from('is_kazalari')
          .select('*').eq('organization_id', firmaId).is('deleted_at', null)
          .order('kaza_tarihi', { ascending: false });

        (rows ?? []).forEach(r => {
          allKazalar.push({
            id: r.id,
            personelId: r.personel_id,
            personelAd: personelAdMap[r.personel_id] ?? 'Bilinmiyor',
            firmaAd: firmaAdMap[firmaId] ?? firmaId,
            firmaId,
            kazaTarihi: r.kaza_tarihi,
            kazaSaati: r.kaza_saati ?? '',
            kazaYeri: r.kaza_yeri ?? '',
            kazaTuru: r.kaza_turu ?? '',
            kazaAciklamasi: r.kaza_aciklamasi ?? '',
            yaraliVucutBolgeleri: Array.isArray(r.yarali_vucut_bolgeleri) ? r.yarali_vucut_bolgeleri : [],
            yaralanmaSiddeti: r.yaralanma_siddeti ?? 'Hafif',
            isGunuKaybi: r.is_gunu_kaybi ?? 0,
            hastaneyeKaldirildi: r.hastaneye_kaldirildi ?? false,
            durum: r.durum ?? 'Açık',
            yaralanmaTuru: r.yaralanma_turu ?? '',
            hastaneAdi: r.hastane_adi ?? '',
            tanikBilgileri: r.tanik_bilgileri ?? '',
            onlemler: r.onlemler ?? '',
            sgkBildirildi: r.sgk_bildirildi ?? false,
            sgkBildirimTarihi: r.sgk_bildirim_tarihi ?? '',
            sgkBildirimNotu: r.sgk_bildirim_notu ?? '',
            fotografPaths: Array.isArray(r.fotograf_paths) ? r.fotograf_paths : [],
            besNeden: Array.isArray(r.bes_neden) ? r.bes_neden : [],
            kazaTipi: r.kaza_tipi ?? undefined,
            riskSeviyesi: r.risk_seviyesi ?? undefined,
          });
        });
      }));

      allKazalar.sort((a, b) => new Date(b.kazaTarihi).getTime() - new Date(a.kazaTarihi).getTime());
      setKazalar(allKazalar);
    } catch (err) {
      console.error('[HekimIsKazasiTab] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [atanmisFirmaIds]);

  useEffect(() => { loadKazalar(); }, [loadKazalar]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('is_kazalari').update({ deleted_at: new Date().toISOString() }).eq('id', deleteId);
    setDeleteId(null);
    loadKazalar();
  };

  const handleWordExport = async (kaza: KazaRow) => {
    setWordLoading(kaza.id);
    try {
      await generateIsKazasiDocx({
        id: kaza.id,
        personelAd: kaza.personelAd,
        firmaAd: kaza.firmaAd,
        kazaTarihi: kaza.kazaTarihi,
        kazaSaati: kaza.kazaSaati,
        kazaYeri: kaza.kazaYeri,
        kazaTuru: kaza.kazaTuru,
        kazaAciklamasi: kaza.kazaAciklamasi,
        yaraliVucutBolgeleri: kaza.yaraliVucutBolgeleri,
        yaralanmaTuru: kaza.yaralanmaTuru,
        yaralanmaSiddeti: kaza.yaralanmaSiddeti,
        isGunuKaybi: kaza.isGunuKaybi,
        hastaneyeKaldirildi: kaza.hastaneyeKaldirildi,
        hastaneAdi: kaza.hastaneAdi,
        tanikBilgileri: kaza.tanikBilgileri,
        onlemler: kaza.onlemler,
        durum: kaza.durum,
        sgkBildirildi: kaza.sgkBildirildi,
        sgkBildirimTarihi: kaza.sgkBildirimTarihi,
        sgkBildirimNotu: kaza.sgkBildirimNotu,
        besNeden: kaza.besNeden,
        kazaTipi: kaza.kazaTipi,
        riskSeviyesi: kaza.riskSeviyesi,
      });
      addToast?.('İş kazası tutanağı Word olarak indiriliyor...', 'success');
    } catch (err) {
      addToast?.('Word oluşturulurken hata oluştu.', 'error');
      console.error('[IsKazasi Word]', err);
    } finally {
      setWordLoading(null);
    }
  };

  const filtered = kazalar.filter(k =>
    k.personelAd.toLowerCase().includes(search.toLowerCase()) ||
    k.firmaAd.toLowerCase().includes(search.toLowerCase()) ||
    k.kazaTuru.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const totalKaza = kazalar.length;
  const acikKaza = kazalar.filter(k => k.durum === 'Açık').length;
  const agirKaza = kazalar.filter(k => k.yaralanmaSiddeti === 'Ağır' || k.yaralanmaSiddeti === 'Çok Ağır' || k.yaralanmaSiddeti === 'Ölüm').length;
  const toplamGunKaybi = kazalar.reduce((sum, k) => sum + (k.isGunuKaybi || 0), 0);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>İş Kazaları</h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>Kayıt altına alınan iş kazası olayları</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}>
            {([
              { id: 'liste', label: 'Liste', icon: 'ri-list-check-3' },
              { id: 'rapor', label: 'Rapor', icon: 'ri-bar-chart-grouped-line' },
            ] as { id: TabView; label: string; icon: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{
                  background: activeView === tab.id
                    ? (tab.id === 'rapor' ? 'linear-gradient(135deg, #DC2626, #EF4444)' : `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})`)
                    : 'transparent',
                  color: activeView === tab.id ? '#fff' : textSecondary,
                }}
              >
                <i className={`${tab.icon} text-xs`} />
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setEditData(null); setShowModal(true); }}
            className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            <i className="ri-add-line" />
            Kaza Kaydı Ekle
          </button>
        </div>
      </div>

      {/* Rapor View */}
      {activeView === 'rapor' && !loading && (
        <HekimIsKazasiRaporBolumu kazalar={kazalar} isDark={isDark} />
      )}
      {activeView === 'rapor' && loading && (
        <div className="rounded-xl p-12 flex items-center justify-center gap-3"
          style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${borderColor}` }}>
          <i className="ri-loader-4-line animate-spin text-xl" style={{ color: '#EF4444' }} />
          <span className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</span>
        </div>
      )}

      {/* Liste View */}
      {activeView === 'liste' && (<>

      {/* KPI */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Toplam Kaza',    value: totalKaza,       color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   icon: 'ri-alert-line' },
            { label: 'Açık Vaka',      value: acikKaza,        color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  icon: 'ri-time-line' },
            { label: 'Ağır/Ölüm',      value: agirKaza,        color: '#F97316', bg: 'rgba(249,115,22,0.08)',  icon: 'ri-error-warning-line' },
            { label: 'İş Günü Kaybı',  value: toplamGunKaybi,  color: ACCENT,    bg: 'rgba(14,165,233,0.08)',  icon: 'ri-calendar-close-line' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: kpi.bg, border: `1px solid ${kpi.color}22` }}>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${kpi.color}18` }}>
                <i className={`${kpi.icon} text-sm`} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xl font-extrabold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: textSecondary }}>{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Arama */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textSecondary }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Personel, firma veya kaza türü ara..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)', border: `1.5px solid ${borderColor}`, color: textPrimary }}
            onFocus={e => { e.currentTarget.style.borderColor = ACCENT; }}
            onBlur={e => { e.currentTarget.style.borderColor = borderColor; }} />
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary }}>
          {filtered.length} kayıt
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl p-12 flex items-center justify-center gap-3"
          style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${borderColor}` }}>
          <i className="ri-loader-4-line animate-spin text-xl" style={{ color: '#EF4444' }} />
          <span className="text-sm" style={{ color: textSecondary }}>Yükleniyor...</span>
        </div>
      )}

      {/* Boş state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-14 flex flex-col items-center gap-5"
          style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${borderColor}` }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.15)' }}>
            <i className="ri-shield-check-line text-2xl" style={{ color: '#EF4444' }} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold mb-2" style={{ color: textPrimary }}>
              {search ? `"${search}" için kayıt yok` : 'Kayıtlı iş kazası yok'}
            </p>
            <p className="text-sm" style={{ color: textSecondary }}>
              {search ? 'Farklı bir arama deneyin' : 'Harika! Şu ana kadar kayıtlı iş kazası bulunmuyor.'}
            </p>
          </div>
          {!search && (
            <button onClick={() => { setEditData(null); setShowModal(true); }}
              className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer text-white"
              style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
              <i className="ri-add-line" />Kaza Kaydı Ekle
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: isDark ? '#1e293b' : '#fff', border: `1px solid ${borderColor}` }}>
          {/* Kolon başlıkları */}
          <div className="hidden md:grid px-4 py-2.5"
            style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 110px',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)',
              borderBottom: `1px solid ${borderColor}` }}>
            {['KAZAZEDE', 'TARİH / YER', 'KAZA TÜRÜ', 'ŞİDDET', 'DURUM', 'İŞLEM'].map(h => (
              <span key={h} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textSecondary }}>{h}</span>
            ))}
          </div>

          {/* Satırlar */}
          <div className="space-y-1.5 p-2">
            {filtered.map(kaza => {
              const isExpanded = expandedId === kaza.id;
              const siddetCfg = SIDDET_CONFIG[kaza.yaralanmaSiddeti] ?? SIDDET_CONFIG['Hafif'];
              const durumCfg = DURUM_CONFIG[kaza.durum] ?? DURUM_CONFIG['Açık'];
              const isWordLoading = wordLoading === kaza.id;

              return (
                <div key={kaza.id} className="rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    border: isExpanded ? '1px solid rgba(239,68,68,0.3)' : `1px solid ${borderColor}`,
                    background: isExpanded ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)') : cardBg,
                  }}>

                  {/* Ana satır */}
                  <div
                    className="hidden md:grid items-center px-4 py-3 cursor-pointer transition-all duration-200"
                    style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 110px' }}
                    onClick={() => setExpandedId(isExpanded ? null : kaza.id)}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.03)'; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Kazazede */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}>
                        {kaza.personelAd.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{kaza.personelAd}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT_DARK }}>
                          <i className="ri-building-2-line text-[9px]" />{kaza.firmaAd}
                        </span>
                      </div>
                    </div>

                    {/* Tarih / Yer */}
                    <div>
                      <p className="text-xs font-semibold" style={{ color: textPrimary }}>{formatDate(kaza.kazaTarihi)}</p>
                      {kaza.kazaSaati && <p className="text-[10px]" style={{ color: textSecondary }}>{kaza.kazaSaati}</p>}
                      {kaza.kazaYeri && <p className="text-[10px] truncate" style={{ color: textSecondary }}>{kaza.kazaYeri}</p>}
                    </div>

                    {/* Kaza Türü */}
                    <div>
                      <span className="text-xs" style={{ color: kaza.kazaTuru ? textPrimary : textSecondary }}>
                        {kaza.kazaTuru || '—'}
                      </span>
                    </div>

                    {/* Şiddet */}
                    <div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ background: siddetCfg.bg, color: siddetCfg.color, border: `1px solid ${siddetCfg.border}` }}>
                        {kaza.yaralanmaSiddeti || '—'}
                      </span>
                    </div>

                    {/* Durum */}
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ background: durumCfg.bg, color: durumCfg.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: durumCfg.color }} />
                        {kaza.durum}
                      </span>
                    </div>

                    {/* İşlemler */}
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      {/* Detay Gör */}
                      <button
                        onClick={() => setDetayKaza(kaza)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        title="Detayı Gör"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.3)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}>
                        <i className="ri-eye-line text-xs" style={{ color: textSecondary }} />
                      </button>

                      {/* Word İndir */}
                      <button
                        onClick={() => handleWordExport(kaza)}
                        disabled={isWordLoading}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        title="Word İndir (.docx)"
                        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.16)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.08)'; }}>
                        {isWordLoading
                          ? <i className="ri-loader-4-line animate-spin text-xs" style={{ color: '#16a34a' }} />
                          : <i className="ri-file-word-line text-xs" style={{ color: '#16a34a' }} />
                        }
                      </button>

                      {/* Düzenle */}
                      <button
                        onClick={() => { setEditData(kaza); setShowModal(true); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.3)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}>
                        <i className="ri-edit-line text-xs" style={{ color: textSecondary }} />
                      </button>

                      {/* Sil */}
                      <button
                        onClick={() => setDeleteId(kaza.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = borderColor; }}>
                        <i className="ri-delete-bin-line text-xs" style={{ color: textSecondary }} />
                      </button>
                    </div>
                  </div>

                  {/* Mobil kart */}
                  <div className="md:hidden p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${ACCENT_DARK}, ${ACCENT})` }}>
                        {kaza.personelAd.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>{kaza.personelAd}</p>
                        <span className="text-[10px]" style={{ color: ACCENT }}>{kaza.firmaAd}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: siddetCfg.bg, color: siddetCfg.color, border: `1px solid ${siddetCfg.border}` }}>
                        {kaza.yaralanmaSiddeti}
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: durumCfg.bg, color: durumCfg.color }}>
                        {kaza.durum}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 flex-wrap" style={{ borderTop: `1px solid ${borderColor}` }}>
                      <button onClick={() => setDetayKaza(kaza)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[11px] font-semibold whitespace-nowrap"
                        style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
                        <i className="ri-eye-line text-xs" />Detay
                      </button>
                      <button onClick={() => handleWordExport(kaza)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[11px] font-semibold whitespace-nowrap"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <i className="ri-file-word-line text-xs" />Word
                      </button>
                      <button onClick={() => { setEditData(kaza); setShowModal(true); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}>
                        <i className="ri-edit-line text-xs" style={{ color: textSecondary }} />
                      </button>
                      <button onClick={() => setDeleteId(kaza.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${borderColor}` }}>
                        <i className="ri-delete-bin-line text-xs" style={{ color: textSecondary }} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detay (mini özet) */}
                  {isExpanded && (
                    <div className="hidden md:block px-5 py-4 space-y-3"
                      style={{ borderTop: `1px solid rgba(239,68,68,0.15)`, background: isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)' }}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>
                          <i className="ri-file-list-3-line mr-1.5" />Kaza Özeti
                        </p>
                        <button
                          onClick={() => setDetayKaza(kaza)}
                          className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                          style={{ background: 'rgba(14,165,233,0.1)', color: ACCENT, border: '1px solid rgba(14,165,233,0.2)' }}>
                          <i className="ri-eye-line text-xs" />
                          Tam Detayı Gör
                        </button>
                      </div>
                      {kaza.kazaAciklamasi && (
                        <p className="text-xs leading-relaxed" style={{ color: textPrimary }}>{kaza.kazaAciklamasi}</p>
                      )}
                      {kaza.yaraliVucutBolgeleri.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {kaza.yaraliVucutBolgeleri.map(b => (
                            <span key={b} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                              {VUCUT_LABEL[b] ?? b}
                            </span>
                          ))}
                        </div>
                      )}
                      {kaza.onlemler && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#10B981' }}>Alınan Önlemler</p>
                          <p className="text-xs" style={{ color: textPrimary }}>{kaza.onlemler}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </>)}

      {/* Detay Modal */}
      {detayKaza && (
        <KazaDetayModal
          kaza={detayKaza}
          isDark={isDark}
          onClose={() => setDetayKaza(null)}
          onEdit={() => { setEditData(detayKaza); setDetayKaza(null); setShowModal(true); }}
          onWordExport={() => { handleWordExport(detayKaza); setDetayKaza(null); }}
        />
      )}

      {/* Kayıt Modal */}
      <HekimIsKazasiModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditData(null); }}
        onSaved={loadKazalar}
        atanmisFirmaIds={atanmisFirmaIds}
        isDark={isDark}
        addToast={addToast}
        editData={editData ? {
          id: editData.id,
          personelId: editData.personelId,
          firmaId: editData.firmaId,
          kazaTarihi: editData.kazaTarihi,
          kazaSaati: editData.kazaSaati,
          kazaYeri: editData.kazaYeri,
          kazaTuru: editData.kazaTuru,
          kazaTipi: editData.kazaTipi ?? 'is_kazasi',
          riskSeviyesi: editData.riskSeviyesi ?? 'orta',
          kazaAciklamasi: editData.kazaAciklamasi,
          yaraliVucutBolgeleri: editData.yaraliVucutBolgeleri,
          yaralanmaTuru: editData.yaralanmaTuru,
          yaralanmaSiddeti: editData.yaralanmaSiddeti,
          isGunuKaybi: editData.isGunuKaybi,
          hastaneyeKaldirildi: editData.hastaneyeKaldirildi,
          hastaneAdi: editData.hastaneAdi,
          tanikBilgileri: editData.tanikBilgileri,
          onlemler: editData.onlemler,
          durum: editData.durum,
          olumNedeni: '',
          olumTarihi: '',
          sgkBildirildi: editData.sgkBildirildi,
          sgkBildirimTarihi: editData.sgkBildirimTarihi,
          sgkBildirimNotu: editData.sgkBildirimNotu,
          fotografPaths: editData.fotografPaths,
          olayYeriDiagram: '',
          besNeden: editData.besNeden,
        } : null}
      />

      {/* Silme onay */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${borderColor}` }}>
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #EF4444, #F43F5E)' }} />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
              </div>
              <p className="text-sm font-bold mb-1" style={{ color: textPrimary }}>Kaza kaydını sil?</p>
              <p className="text-xs mb-5" style={{ color: textSecondary }}>Bu kayıt silinecek. Geri alınamaz.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textSecondary, border: `1px solid ${borderColor}` }}>
                  İptal
                </button>
                <button onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer text-white whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
