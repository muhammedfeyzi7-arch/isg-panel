import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';
import { downloadOsgbReportPdf } from './utils/osgbReportPdf';
import { downloadOsgbReportExcel } from './utils/osgbReportExcel';
import FirmaDetayModal from './components/FirmaDetayModal';
import UzmanDetayModal from './components/UzmanDetayModal';
import DashboardTab from './components/DashboardTab';
import FirmalarTab from './components/FirmalarTab';
import OsgbSidebar from './components/OsgbSidebar';
import OsgbHeader from './components/OsgbHeader';
import OsgbSettings from './components/OsgbSettings';
import ZiyaretlerTab from './components/ZiyaretlerTab';
import OsgbRaporlarPage from './components/OsgbRaporlarPage';
import CopKutusuTab from './components/CopKutusuTab';
import OsgbLoadingScreen from './components/OsgbLoadingScreen';
import OsgbOnboarding from './components/OsgbOnboarding';
import OnboardingTour from '../../components/feature/OnboardingTour';
import ForcePasswordChange from '../../components/feature/ForcePasswordChange';
import FirmaModal from './components/FirmaModal';
import UzmanModal from './components/UzmanModal';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management';

// ── UZMAN ROW — ayrı memo component, sadece props değişince render ──
interface UzmanRowProps {
  u: {
    user_id: string;
    display_name: string;
    email: string;
    is_active: boolean;
    active_firm_id: string | null;
    active_firm_ids: string[] | null;
    active_firm_name: string | null;
    osgb_role?: string | null;
  };
  firmaMap: Record<string, { id: string; name: string; [key: string]: unknown }>;
  isDark: boolean;
  textPrimary: string;
  textMuted: string;
  onAtamaYapForUzman: (userId: string, firmIds: string[]) => void;
  onAtamaYapEmpty: (userId: string) => void;
  onUzmanClick: (u: UzmanRowProps['u']) => void;
}

const UzmanRow = memo(function UzmanRow({
  u, firmaMap, isDark, textPrimary, textMuted,
  onAtamaYapForUzman, onAtamaYapEmpty, onUzmanClick,
}: UzmanRowProps) {
  const firmIds = (u.active_firm_ids && u.active_firm_ids.length > 0)
    ? u.active_firm_ids
    : u.active_firm_id ? [u.active_firm_id] : [];
  const atananFirmalar = firmIds.map(id => firmaMap[id]).filter(Boolean) as { id: string; name: string }[];

  return (
    <div
      className="grid px-4 py-3 transition-all"
      style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1.5fr 1fr 100px', background: 'transparent' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.04)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {/* Personel adı */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white"
            style={{ background: u.is_active ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
            {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
          </div>
          {u.is_active && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
              style={{ background: '#22C55E', borderColor: 'var(--bg-card-solid)' }} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>
            {u.display_name ?? u.email}
          </p>
          {atananFirmalar.length > 0 && (
            <p className="text-[10px]" style={{ color: '#0EA5E9' }}>{atananFirmalar.length} firma</p>
          )}
        </div>
      </div>

      {/* Rol */}
      <div className="flex items-center">
        {u.osgb_role === 'isyeri_hekimi' ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
            style={{ background: 'rgba(14,165,233,0.1)', color: '#10B981', border: '1px solid rgba(14,165,233,0.2)' }}>
            <i className="ri-heart-pulse-line text-[9px]" />Hekim
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
            style={{ background: 'rgba(14,165,233,0.08)', color: '#10B981', border: '1px solid rgba(14,165,233,0.18)' }}>
            <i className="ri-shield-user-line text-[9px]" />Uzman
          </span>
        )}
      </div>

      {/* Durum */}
      <div className="flex items-center">
        {u.is_active ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: '#22C55E' }} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
              Aktif
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#94A3B8' }} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(148,163,184,0.08)', color: '#64748B', border: '1px solid rgba(148,163,184,0.15)' }}>
              Pasif
            </span>
          </div>
        )}
      </div>

      {/* Firma chips */}
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        {atananFirmalar.length > 0 ? (
          <>
            {atananFirmalar.slice(0, 1).map((f) => (
              <span key={f.id}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap max-w-[120px] truncate"
                style={{ background: 'rgba(14,165,233,0.08)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.2)' }}>
                <i className="ri-building-2-line text-[9px] flex-shrink-0" />
                <span className="truncate">{f.name}</span>
              </span>
            ))}
            {atananFirmalar.length > 1 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap"
                style={{ background: 'rgba(14,165,233,0.06)', color: '#0284C7', border: '1px solid rgba(14,165,233,0.15)' }}>
                +{atananFirmalar.length - 1}
              </span>
            )}
          </>
        ) : (
          <button
            onClick={() => onAtamaYapEmpty(u.user_id)}
            className="whitespace-nowrap flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg cursor-pointer transition-all"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#D97706' }}>
            <i className="ri-add-line text-[10px]" />Ata
          </button>
        )}
      </div>

      {/* E-posta */}
      <div className="flex items-center min-w-0">
        <span className="text-[10px] truncate" style={{ color: textMuted }}>{u.email}</span>
      </div>

      {/* İşlemler */}
      <div className="flex items-center gap-1.5 justify-end">
        <button
          onClick={() => onAtamaYapForUzman(u.user_id, firmIds)}
          title="Firma Ata"
          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.1)'; (e.currentTarget as HTMLElement).style.color = '#F59E0B'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
          <i className="ri-links-line text-xs" />
        </button>
        <button
          onClick={() => onUzmanClick(u)}
          title="Detay Gör"
          className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)'; (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
          <i className="ri-eye-line text-xs" />
        </button>
      </div>
    </div>
  );
});

// ── Module-level sabitler — her render'da yeni referans oluşturmaz ──
const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', borderRadius: '10px',
  color: 'var(--text-primary)', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '13px',
};
const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)',
};
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)', borderRadius: '16px',
};
const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard', icon: 'ri-dashboard-line', label: 'Genel Bakış' },
  { id: 'firmalar', icon: 'ri-building-2-line', label: 'Müşteri Firmalar' },
  { id: 'uzmanlar', icon: 'ri-user-star-line', label: 'Gezici Uzmanlar' },
  { id: 'raporlar', icon: 'ri-file-chart-line', label: 'Raporlar' },
];

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
  osgb_role?: string | null;
}

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'ziyaretler' | 'raporlar' | 'copkutusu' | 'ayarlar';

interface FirmaDetay {
  id: string;
  name: string;
  personelSayisi: number;
  uzmanAd: string | null;
  uygunsuzluk: number;
  kapatilan: number;
  tutanakSayisi: number;
  egitimSayisi: number;
}

export default function OsgbDashboardPage() {
  const { user } = useAuth();
  const { org, addToast, mustChangePassword, theme } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    // Sekme değişimini sakla ama başlangıçta her zaman dashboard'dan başla
    try { localStorage.removeItem('osgb_active_tab'); } catch { /* ignore */ }
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [osgbTheme, setOsgbTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('isg_theme') as 'dark' | 'light') ?? 'dark'; } catch { return 'dark'; }
  });

  // ── Tema toggle — anlık geçiş ──
  useEffect(() => {
    const root = document.documentElement;
    // Tema geçişini anlık yap (0ms), sadece içerik transition'ları kalsın
    root.style.setProperty('--theme-transition', '0s');
    if (osgbTheme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
    try { localStorage.setItem('isg_theme', osgbTheme); } catch { /* ignore */ }
  }, [osgbTheme]);

  const [searchFirma, setSearchFirma] = useState('');
  const [searchUzman, setSearchUzman] = useState('');

  // Data
  const [altFirmalar, setAltFirmalar] = useState<AltFirma[]>([]);
  const [uzmanlar, setUzmanlar] = useState<Uzman[]>([]);
  const [firmaDetaylar, setFirmaDetaylar] = useState<FirmaDetay[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);

  // Detay modalları
  const [secilenFirma, setSecilenFirma] = useState<{ id: string; name: string } | null>(null);
  const [secilenUzman, setSecilenUzman] = useState<Uzman | null>(null);

  // Rapor
  const [raporDonem, setRaporDonem] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [raporExporting, setRaporExporting] = useState<'pdf' | 'excel' | null>(null);
  const [raporFirmaFilter, setRaporFirmaFilter] = useState('');


  // Firma Ekle Modal — sadece open/close
  const [showFirmaModal, setShowFirmaModal] = useState(false);

  // Uzman Atama Modal
  const [showAtamaModal, setShowAtamaModal] = useState(false);
  const [atamaUzmanId, setAtamaUzmanId] = useState<string>('');
  const [atamaFirmaIds, setAtamaFirmaIds] = useState<string[]>([]);
  const [atamaLoading, setAtamaLoading] = useState(false);
  const [atamaError, setAtamaError] = useState<string | null>(null);

  // Personel Ekle Modal — sadece open/close
  const [showUzmanModal, setShowUzmanModal] = useState(false);

  // ── Veri çek ──
  const fetchData = useCallback(async () => {
    if (!org?.id) return;
    setDataLoading(true);
    try {
      // ── ADIM 1: Firmalar + Uzmanlar paralel çek — temel liste hemen gelir ──
      const [{ data: firmData }, { data: uzmanData }] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, name, invite_code, created_at')
          .eq('parent_org_id', org.id)
          .eq('org_type', 'firma')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_organizations')
          .select('user_id, display_name, email, is_active, active_firm_id, active_firm_ids, osgb_role')
          .eq('organization_id', org.id)
          .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi']),
      ]);

      const firmaIds = (firmData ?? []).map(f => f.id);

      // ── ADIM 2: Temel firma listesini hemen göster (sayılar sonra gelecek) ──
      if (firmData && firmData.length > 0) {
        const temelFirmalar: AltFirma[] = firmData.map(f => ({
          id: f.id, name: f.name, invite_code: f.invite_code,
          created_at: f.created_at, personelSayisi: 0, uzmanAd: null, uygunsuzluk: 0,
        }));
        const temelUzmanlar: Uzman[] = (uzmanData ?? []).map(u => ({
          ...u, active_firm_ids: u.active_firm_ids ?? null, active_firm_name: null,
        }));
        setAltFirmalar(temelFirmalar);
        setUzmanlar(temelUzmanlar);
        setDataLoading(false); // ← İlk render burada, kullanıcı beklemez
      }

      // ── ADIM 3: Detay sayıları arka planda çek ──
      const enrichedFirmalar: AltFirma[] = [];
      const detaylar: FirmaDetay[] = [];

      if (firmaIds.length > 0) {
        // 5 paralel GROUP BY sorgusu — tüm firmalar için tek seferde
        const [
          personelRows,
          uygunsuzlukRows,
          kapatilanRows,
          tutanakRows,
          egitimRows,
        ] = await Promise.all([
          // 1. personeller GROUP BY organization_id
          supabase
            .from('personeller')
            .select('organization_id')
            .in('organization_id', firmaIds)
            .is('deleted_at', null),

          // 2. açık uygunsuzluklar GROUP BY organization_id
          supabase
            .from('uygunsuzluklar')
            .select('organization_id, data')
            .in('organization_id', firmaIds)
            .is('deleted_at', null),

          // 3. kapatılan uygunsuzluklar — aynı veriyi yukarıdan filtreleyeceğiz, ayrı query gerek yok
          // placeholder: null olarak bırak, aşağıda hesaplanacak
          Promise.resolve(null),

          // 4. tutanaklar GROUP BY organization_id
          supabase
            .from('tutanaklar')
            .select('organization_id')
            .in('organization_id', firmaIds)
            .is('deleted_at', null),

          // 5. egitimler GROUP BY organization_id
          supabase
            .from('egitimler')
            .select('organization_id')
            .in('organization_id', firmaIds)
            .is('deleted_at', null),
        ]);

        // Map'lere dönüştür: { [firmaId]: count }
        const personelMap: Record<string, number> = {};
        (personelRows.data ?? []).forEach(r => {
          personelMap[r.organization_id] = (personelMap[r.organization_id] ?? 0) + 1;
        });

        const uygunsuzlukMap: Record<string, number> = {};
        const kapatilanMap: Record<string, number> = {};
        (uygunsuzlukRows.data ?? []).forEach(r => {
          const durum: string = (r.data as Record<string, unknown>)?.durum as string ?? '';
          const isKapali = durum === 'Kapandı' || durum === 'Kapatıldı';
          if (isKapali) {
            kapatilanMap[r.organization_id] = (kapatilanMap[r.organization_id] ?? 0) + 1;
          } else {
            uygunsuzlukMap[r.organization_id] = (uygunsuzlukMap[r.organization_id] ?? 0) + 1;
          }
        });

        void kapatilanRows; // unused placeholder

        const tutanakMap: Record<string, number> = {};
        (tutanakRows.data ?? []).forEach(r => {
          tutanakMap[r.organization_id] = (tutanakMap[r.organization_id] ?? 0) + 1;
        });

        const egitimMap: Record<string, number> = {};
        (egitimRows.data ?? []).forEach(r => {
          egitimMap[r.organization_id] = (egitimMap[r.organization_id] ?? 0) + 1;
        });

        // Firma listesini map'lerden doldur
        for (const f of (firmData ?? [])) {
          const atananUzman = (uzmanData ?? []).find(u =>
            u.active_firm_id === f.id ||
            (Array.isArray(u.active_firm_ids) && u.active_firm_ids.includes(f.id))
          );

          enrichedFirmalar.push({
            id: f.id,
            name: f.name,
            invite_code: f.invite_code,
            created_at: f.created_at,
            personelSayisi: personelMap[f.id] ?? 0,
            uzmanAd: atananUzman?.display_name ?? null,
            uygunsuzluk: uygunsuzlukMap[f.id] ?? 0,
          });
          detaylar.push({
            id: f.id,
            name: f.name,
            personelSayisi: personelMap[f.id] ?? 0,
            uzmanAd: atananUzman?.display_name ?? null,
            uygunsuzluk: uygunsuzlukMap[f.id] ?? 0,
            kapatilan: kapatilanMap[f.id] ?? 0,
            tutanakSayisi: tutanakMap[f.id] ?? 0,
            egitimSayisi: egitimMap[f.id] ?? 0,
          });
        }
      }

      // Sıralama koru (created_at desc)
      enrichedFirmalar.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      detaylar.sort((a, b) => enrichedFirmalar.findIndex(x => x.id === a.id) - enrichedFirmalar.findIndex(x => x.id === b.id));

      // ── Uzmanlar için firma adı — DB sorgusu YOK, zaten çektiğimiz firmData'dan oku ──
      // firmData zaten var, ayrıca organizations sorgusu atmıyoruz (N+1 fix)
      const allFirmaNameMap: Record<string, string> = {};
      (firmData ?? []).forEach(f => { allFirmaNameMap[f.id] = f.name; });

      const enrichedUzmanlar: Uzman[] = (uzmanData ?? []).map((u) => {
        const firmIds: string[] = (u.active_firm_ids && u.active_firm_ids.length > 0)
          ? u.active_firm_ids
          : u.active_firm_id ? [u.active_firm_id] : [];

        const active_firm_name = firmIds.length > 0
          ? firmIds.map(id => allFirmaNameMap[id]).filter(Boolean).join(', ') || null
          : null;

        return {
          ...u,
          active_firm_ids: u.active_firm_ids ?? null,
          active_firm_name,
        };
      });

      setAltFirmalar(enrichedFirmalar);
      setFirmaDetaylar(detaylar);
      setUzmanlar(enrichedUzmanlar);
    } catch (err) {
      console.error('[OSGB] fetchData error:', err);
    } finally {
      setDataLoading(false);
    }
  }, [org?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── State yardımcıları — Realtime effect'ten ÖNCE tanımlanmalı ──
  const addFirmaToState = useCallback((firma: AltFirma) => {
    setAltFirmalar(prev => [firma, ...prev]);
    setFirmaDetaylar(prev => [{
      id: firma.id,
      name: firma.name,
      personelSayisi: 0,
      uzmanAd: null,
      uygunsuzluk: 0,
      kapatilan: 0,
      tutanakSayisi: 0,
      egitimSayisi: 0,
    }, ...prev]);
  }, []);

  const removeFirmaFromState = useCallback((firmaId: string) => {
    setAltFirmalar(prev => prev.filter(f => f.id !== firmaId));
    setFirmaDetaylar(prev => prev.filter(f => f.id !== firmaId));
  }, []);

  const updateFirmaInState = useCallback((firmaId: string, partial: Partial<AltFirma>) => {
    setAltFirmalar(prev => prev.map(f => f.id === firmaId ? { ...f, ...partial } : f));
    setFirmaDetaylar(prev => prev.map(f => f.id === firmaId ? { ...f, ...partial } : f));
  }, []);

  const updateUzmanInState = useCallback((userId: string, partial: Partial<Uzman>) => {
    setUzmanlar(prev => prev.map(u => u.user_id === userId ? { ...u, ...partial } : u));
  }, []);

  // ── OSGB Realtime — tüm kritik tablolar ──
  useEffect(() => {
    if (!org?.id) return;

    // Firma sayısı değişince sadece o firmanın state'ini güncelle
    const handlePersonelChange = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown>; eventType: string }) => {
      const orgId = (payload.new?.organization_id ?? payload.old?.organization_id) as string | undefined;
      if (!orgId) return;
      // İlgili firmanın personel sayısını DB'den çek (sadece o firma)
      supabase
        .from('personeller')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .then(({ count }) => {
          updateFirmaInState(orgId, { personelSayisi: count ?? 0 });
        });
    };

    const handleUygunsuzlukChange = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const orgId = (payload.new?.organization_id ?? payload.old?.organization_id) as string | undefined;
      if (!orgId) return;
      // İlgili firmanın açık uygunsuzluk sayısını güncelle
      supabase
        .from('uygunsuzluklar')
        .select('data')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .then(({ data }) => {
          const acik = (data ?? []).filter(r => {
            const durum = (r.data as Record<string, unknown>)?.durum as string ?? '';
            return durum !== 'Kapandı' && durum !== 'Kapatıldı';
          }).length;
          updateFirmaInState(orgId, { uygunsuzluk: acik });
        });
    };

    const handleUserOrgChange = () => {
      // Uzman atama değişince fetchData — firma adı eşleştirmesi için
      void fetchData();
    };

    const handleFirmaChange = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown>; eventType: string }) => {
      // Yeni firma eklendi veya silindi
      if (payload.eventType === 'INSERT' && payload.new) {
        const f = payload.new;
        if (f.parent_org_id === org.id && f.org_type === 'firma' && !f.deleted_at) {
          // Yeni firma state'e ekle
          const yeniFirma: AltFirma = {
            id: f.id as string,
            name: f.name as string,
            invite_code: f.invite_code as string ?? '',
            created_at: f.created_at as string,
            personelSayisi: 0,
            uzmanAd: null,
            uygunsuzluk: 0,
          };
          setAltFirmalar(prev => {
            if (prev.some(x => x.id === yeniFirma.id)) return prev;
            return [yeniFirma, ...prev];
          });
        }
      } else if (payload.eventType === 'UPDATE' && payload.new?.deleted_at) {
        // Firma silindi (soft delete)
        removeFirmaFromState(payload.new.id as string);
      }
    };

    const channel = supabase
      .channel(`osgb_realtime_${org.id}`)
      // Personel değişimi
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personeller' },
        (p) => handlePersonelChange({ ...p, eventType: p.eventType }))
      // Uygunsuzluk değişimi
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uygunsuzluklar' },
        (p) => handleUygunsuzlukChange(p))
      // Uzman atama değişimi
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_organizations', filter: `organization_id=eq.${org.id}` },
        () => handleUserOrgChange())
      // Firma değişimi (yeni firma eklendi / silindi)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'organizations', filter: `parent_org_id=eq.${org.id}` },
        (p) => handleFirmaChange({ ...p, eventType: p.eventType }))
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [org?.id, fetchData, updateFirmaInState, removeFirmaFromState]);

  // RLS fix effect REMOVED — artık her açılışta çalışmıyor



  // ── Firma/Uzman ekleme artık modal component'lerinde ──

  // ── Stable handler'lar — useCallback ──
  const handleFirmaEkleOpen = useCallback(() => {
    setShowFirmaModal(true);
  }, []);

  const handleUzmanEkleOpen = useCallback(() => {
    setShowUzmanModal(true);
  }, []);

  const handleAtamaYapOpen = useCallback(() => {
    setShowAtamaModal(true);
    setAtamaError(null);
    setAtamaUzmanId((prev) => prev || (uzmanlar[0]?.user_id ?? ''));
    setAtamaFirmaIds([]);
  }, [uzmanlar]);

  const handleAtamaYapOpenForFirma = useCallback((firmaId: string) => {
    setShowAtamaModal(true);
    setAtamaError(null);
    setAtamaUzmanId('');
    setAtamaFirmaIds([firmaId]);
  }, []);

  const handleAtamaYapOpenForUzman = useCallback((uzmanId: string, firmIds: string[]) => {
    setShowAtamaModal(true);
    setAtamaError(null);
    setAtamaUzmanId(uzmanId);
    setAtamaFirmaIds(firmIds);
  }, []);

  const handleAtamaYapOpenForUzmanEmpty = useCallback((uzmanId: string) => {
    setShowAtamaModal(true);
    setAtamaError(null);
    setAtamaUzmanId(uzmanId);
    setAtamaFirmaIds([]);
  }, []);

  const handleFirmaClick = useCallback((f: { id: string; name: string }) => {
    setSecilenFirma(f);
  }, []);

  const handleUzmanClick = useCallback((u: Uzman) => {
    setSecilenUzman(u);
  }, []);

  const handleFirmaModalClose = useCallback(() => {
    setShowFirmaModal(false);
  }, []);

  const handleFirmaModalSuccess = useCallback((firma: AltFirma) => {
    addFirmaToState(firma);
  }, [addFirmaToState]);

  const handleUzmanModalClose = useCallback(() => {
    setShowUzmanModal(false);
  }, []);

  const handleUzmanModalSuccess = useCallback((yeniUzman: Uzman) => {
    setUzmanlar(prev => [...prev, yeniUzman]);
  }, []);

  const handleAtamaModalClose = useCallback(() => {
    setShowAtamaModal(false);
  }, []);

  const handleFirmaDetayClose = useCallback(() => {
    setSecilenFirma(null);
  }, []);

  const handleFirmaDetayRefresh = useCallback((updatedFirma?: Partial<AltFirma> & { id: string } | null) => {
    if (updatedFirma) {
      updateFirmaInState(updatedFirma.id, updatedFirma);
      setSecilenFirma(null);
    }
  }, [updateFirmaInState]);

  const handleUzmanDetayClose = useCallback(() => {
    setSecilenUzman(null);
  }, []);

  const handleUzmanDetayRefresh = useCallback((updatedUzman?: Partial<Uzman> & { user_id: string } | null) => {
    if (updatedUzman) {
      updateUzmanInState(updatedUzman.user_id, updatedUzman);
    }
  }, [updateUzmanInState]);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileOpen(v => !v);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setOsgbTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  const handleMobileOverlayClick = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleCopKutusuFirmaRestored = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const handleAtamaFirmaToggle = useCallback((firmaId: string) => {
    setAtamaFirmaIds(prev =>
      prev.includes(firmaId) ? prev.filter(id => id !== firmaId) : [...prev, firmaId]
    );
  }, []);

  const handleAtamaUzmanSelect = useCallback((userId: string) => {
    setAtamaUzmanId(userId);
  }, []);

  // ── Uzman Ata ──
  const handleAtamaKaydet = async () => {
    if (!atamaUzmanId || atamaFirmaIds.length === 0) {
      setAtamaError('Lütfen bir uzman ve en az bir firma seçin.');
      return;
    }
    setAtamaLoading(true);
    setAtamaError(null);
    try {
      // 1. Uzmanın mevcut atamalarını çek (merge için)
      const { data: mevcutRow } = await supabase
        .from('user_organizations')
        .select('active_firm_ids, active_firm_id, osgb_role')
        .eq('user_id', atamaUzmanId)
        .eq('organization_id', org?.id ?? '')
        .maybeSingle();

      const mevcutFirmIds: string[] = Array.isArray(mevcutRow?.active_firm_ids)
        ? mevcutRow.active_firm_ids
        : mevcutRow?.active_firm_id ? [mevcutRow.active_firm_id] : [];

      const birlesimFirmIds = [...new Set([...mevcutFirmIds, ...atamaFirmaIds])];

      // 2. Uzmanın atamasını güncelle
      const { error } = await supabase
        .from('user_organizations')
        .update({
          active_firm_id: birlesimFirmIds[0],
          active_firm_ids: birlesimFirmIds,
        })
        .eq('user_id', atamaUzmanId)
        .eq('organization_id', org?.id ?? '');
      if (error) { setAtamaError(error.message); return; }

      // 3. Eğer gezici_uzman ise hekimleri güncelle (DB güncellemesi yeterli, state'e dokunmuyoruz)
      if (org?.id && mevcutRow?.osgb_role === 'gezici_uzman') {
        const { data: uzmanRows } = await supabase
          .from('user_organizations')
          .select('active_firm_ids, active_firm_id')
          .eq('organization_id', org.id)
          .eq('osgb_role', 'gezici_uzman');

        const allFirmIds: string[] = [];
        (uzmanRows ?? []).forEach(u => {
          const ids = Array.isArray(u.active_firm_ids) && u.active_firm_ids.length > 0
            ? u.active_firm_ids
            : u.active_firm_id ? [u.active_firm_id] : [];
          ids.forEach((id: string) => { if (!allFirmIds.includes(id)) allFirmIds.push(id); });
        });
        birlesimFirmIds.forEach(id => { if (!allFirmIds.includes(id)) allFirmIds.push(id); });

        if (allFirmIds.length > 0) {
          const { data: hekimRows } = await supabase
            .from('user_organizations')
            .select('user_id, active_firm_ids')
            .eq('organization_id', org.id)
            .eq('osgb_role', 'isyeri_hekimi');

          if (hekimRows && hekimRows.length > 0) {
            await Promise.all(hekimRows.map(h => {
              const hMevcut: string[] = Array.isArray(h.active_firm_ids) ? h.active_firm_ids : [];
              const hBirlesim = [...new Set([...hMevcut, ...allFirmIds])];
              return supabase
                .from('user_organizations')
                .update({ active_firm_ids: hBirlesim, active_firm_id: hBirlesim[0] })
                .eq('user_id', h.user_id)
                .eq('organization_id', org.id);
            }));
          }
        }
      }

      // ✅ fetchData YOK — sadece ilgili uzmanın state'ini güncelle
      const yeniFirmaAd = altFirmalar
        .filter(f => birlesimFirmIds.includes(f.id))
        .map(f => f.name)
        .join(', ') || null;

      updateUzmanInState(atamaUzmanId, {
        active_firm_id: birlesimFirmIds[0] ?? null,
        active_firm_ids: birlesimFirmIds,
        active_firm_name: yeniFirmaAd,
      });

      // Firma kartındaki uzmanAd'ı da güncelle
      const uzmanAdi = uzmanlar.find(u => u.user_id === atamaUzmanId)?.display_name ?? null;
      if (uzmanAdi) {
        atamaFirmaIds.forEach(fid => {
          updateFirmaInState(fid, { uzmanAd: uzmanAdi });
        });
      }

      addToast('Atama başarıyla güncellendi!', 'success');
      setShowAtamaModal(false);
      setAtamaUzmanId('');
      setAtamaFirmaIds([]);
    } catch (err) {
      setAtamaError(String(err));
    } finally {
      setAtamaLoading(false);
    }
  };

  const filteredFirmalar = useMemo(
    () => altFirmalar.filter(f => f.name.toLowerCase().includes(searchFirma.toLowerCase())),
    [altFirmalar, searchFirma]
  );

  const filteredUzmanlar = useMemo(
    () => uzmanlar.filter(u =>
      u.display_name?.toLowerCase().includes(searchUzman.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchUzman.toLowerCase())
    ),
    [uzmanlar, searchUzman]
  );

  const totalPersonel = useMemo(
    () => altFirmalar.reduce((s, f) => s + f.personelSayisi, 0),
    [altFirmalar]
  );

  const totalUygunsuzluk = useMemo(
    () => altFirmalar.reduce((s, f) => s + f.uygunsuzluk, 0),
    [altFirmalar]
  );

  const navItems = NAV_ITEMS;

  const donemLabel = () => {
    if (!raporDonem) return 'Tüm Dönemler';
    const [y, m] = raporDonem.split('-');
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  const filteredRaporFirmalar = useMemo(
    () => firmaDetaylar.filter(f => !raporFirmaFilter || f.id === raporFirmaFilter),
    [firmaDetaylar, raporFirmaFilter]
  );

  // O(1) lookup map — altFirmalar.find() yerine kullan
  const firmaMap = useMemo(() => {
    const map: Record<string, AltFirma> = {};
    altFirmalar.forEach(f => { map[f.id] = f; });
    return map;
  }, [altFirmalar]);

  const buildRaporData = () => ({
    orgName: org?.name ?? 'OSGB',
    donem: donemLabel(),
    firmalar: filteredRaporFirmalar,
    uzmanlar: uzmanlar.map(u => ({
      user_id: u.user_id,
      display_name: u.display_name,
      email: u.email,
      active_firm_name: u.active_firm_name,
      is_active: u.is_active,
    })),
  });

  const handlePdfExport = async () => {
    setRaporExporting('pdf');
    try { downloadOsgbReportPdf(buildRaporData()); }
    finally { setRaporExporting(null); }
  };

  const handleExcelExport = async () => {
    setRaporExporting('excel');
    try { await downloadOsgbReportExcel(buildRaporData()); }
    finally { setRaporExporting(null); }
  };

  const isDark = osgbTheme === 'dark';

  const inputStyle = INPUT_STYLE;
  const labelStyle = LABEL_STYLE;
  const cardStyle = CARD_STYLE;
  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';

  if (showIntro) {
    return <OsgbLoadingScreen onDone={() => setShowIntro(false)} isDark={theme === 'dark'} />;
  }

  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)' }}>

      {/* Onboarding Tour */}
      <OnboardingTour />

      {/* Mobile overlay */}
      <div
        className="fixed inset-0 lg:hidden"
        style={{
          zIndex: 41,
          background: 'rgba(0,0,0,0.62)',
          backdropFilter: 'blur(3px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
        onClick={handleMobileOverlayClick}
      />

      <OsgbSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orgName={org?.name ?? 'OSGB'}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        firmaCount={altFirmalar.length}
        uzmanCount={uzmanlar.length}
      />

      <OsgbHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        orgName={org?.name ?? 'OSGB'}
        onMobileMenuToggle={handleMobileMenuToggle}
        onFirmaEkle={handleFirmaEkleOpen}
        onUzmanEkle={handleUzmanEkleOpen}
        theme={osgbTheme}
        onToggleTheme={handleToggleTheme}
      />

      <main
        className={`transition-all duration-300 pt-[46px] min-h-screen ${sidebarCollapsed ? 'lg:pl-[64px]' : 'lg:pl-[220px]'}`}
      >
        <div className="px-2 sm:px-3 md:px-5 py-3 max-w-[1680px]">
          {!dataLoading && (
            <>
              {/* ── DASHBOARD ── hidden/block ile mount edilmiş kalır, unmount olmaz */}
              <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                {(altFirmalar.length === 0 || uzmanlar.length === 0 || !altFirmalar.some(f => f.uzmanAd)) ? (
                  <OsgbOnboarding
                    firmalar={altFirmalar.map(f => ({ id: f.id, name: f.name, uzmanAd: f.uzmanAd }))}
                    uzmanlar={uzmanlar}
                    isDark={isDark}
                    onFirmaEkle={handleFirmaEkleOpen}
                    onUzmanEkle={handleUzmanEkleOpen}
                    onAtamaYap={handleAtamaYapOpen}
                  />
                ) : (
                  <DashboardTab
                    altFirmalar={altFirmalar}
                    uzmanlar={uzmanlar}
                    isDark={isDark}
                    orgId={org?.id ?? ''}
                    onFirmaEkle={handleFirmaEkleOpen}
                    onUzmanEkle={handleUzmanEkleOpen}
                    onAtamaYap={handleAtamaYapOpen}
                    onFirmaClick={handleFirmaClick}
                    onUzmanClick={handleUzmanClick}
                    setActiveTab={setActiveTab}
                  />
                )}
              </div>

              {/* ── FİRMALAR TAB ── */}
              <div className={activeTab === 'firmalar' ? 'block' : 'hidden'}>
                <FirmalarTab
                  altFirmalar={altFirmalar}
                  uzmanlar={uzmanlar}
                  orgId={org?.id ?? ''}
                  isDark={isDark}
                  onFirmaClick={handleFirmaClick}
                  onFirmaEkle={handleFirmaEkleOpen}
                  onAtamaYap={handleAtamaYapOpenForFirma}
                  onFirmaDeleted={removeFirmaFromState}
                />
              </div>

              {/* ── PERSONEL TAB ── */}
              {activeTab === 'uzmanlar' && (
                <div className="space-y-4 page-enter">
                  {/* Filtre bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-lg">
                      <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: textMuted }} />
                      <input value={searchUzman} onChange={e => setSearchUzman(e.target.value)}
                        placeholder="Ad, e-posta veya firma ara..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all"
                        style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: textPrimary }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#0EA5E9'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.1)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textMuted }}>
                      ≡ {filteredUzmanlar.length} sonuç
                    </span>
                    <button onClick={handleUzmanEkleOpen}
                        className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all ml-auto"
                        style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                      <i className="ri-user-add-line" />+ Personel Ekle
                    </button>
                  </div>

                  {filteredUzmanlar.length === 0 ? (
                    <div className="rounded-2xl p-16 flex flex-col items-center gap-5" style={cardStyle}>
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
                        <i className="ri-team-line text-3xl" style={{ color: '#0EA5E9' }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold mb-1.5" style={{ color: textPrimary }}>Henüz personel eklenmedi</p>
                        <p className="text-xs max-w-xs" style={{ color: textMuted }}>
                          Gezici uzman veya işyeri hekimi ekleyip firmalara atayın.
                        </p>
                      </div>
                      <button onClick={handleUzmanEkleOpen}
                        className="whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                        <i className="ri-user-add-line" />İlk Personeli Ekle
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                      <div className="overflow-x-auto">
                        {/* Sütun başlıkları */}
                        <div className="px-4 py-2 min-w-[700px]"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <div className="grid"
                            style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1.5fr 1fr 100px' }}>
                            {['PERSONEL', 'ROL', 'DURUM', 'ATANAN FİRMALAR', 'E-POSTA', 'İŞLEMLER'].map(h => (
                              <span key={h} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: textMuted }}>{h}</span>
                            ))}
                          </div>
                        </div>

                        {/* Satırlar */}
                        <div className="divide-y min-w-[700px]" style={{ borderColor: 'var(--border-subtle)' }}>
                          {filteredUzmanlar.map((u) => (
                            <UzmanRow
                              key={u.user_id}
                              u={u}
                              firmaMap={firmaMap}
                              isDark={isDark}
                              textPrimary={textPrimary}
                              textMuted={textMuted}
                              onAtamaYapForUzman={handleAtamaYapOpenForUzman}
                              onAtamaYapEmpty={handleAtamaYapOpenForUzmanEmpty}
                              onUzmanClick={handleUzmanClick}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* ── ZİYARETLER TAB ── */}
              {activeTab === 'ziyaretler' && (
                <ZiyaretlerTab isDark={isDark} />
              )}

              {/* ── ÇÖP KUTUSU TAB ── */}
              {activeTab === 'copkutusu' && org?.id && (
                <CopKutusuTab orgId={org.id} isDark={isDark} onFirmaRestored={handleCopKutusuFirmaRestored} />
              )}

              {/* ── AYARLAR TAB ── */}
              {activeTab === 'ayarlar' && org?.id && (
                <OsgbSettings
                  orgId={org.id}
                  orgName={org.name ?? 'OSGB'}
                  firmaCount={altFirmalar.length}
                  uzmanCount={uzmanlar.length}
                />
              )}

              {/* ── RAPORLAR TAB ── */}
              {activeTab === 'raporlar' && (
                <OsgbRaporlarPage isDark={isDark} />
              )}

              {/* ── ESKİ RAPORLAR (KULLANILMIYOR) ── */}
              {activeTab === '__disabled_raporlar__' && (
                <div className="space-y-5 page-enter">
                  {/* Filtre bar */}
                  <div className="rounded-2xl p-5" style={cardStyle}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Rapor Oluştur</h3>
                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>Dönem ve firma seçerek PDF veya Excel raporu indirin</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: textMuted }}>Dönem</label>
                        <input
                          type="month"
                          value={raporDonem}
                          onChange={e => setRaporDonem(e.target.value)}
                          className="text-sm px-3 py-2 rounded-xl outline-none"
                          style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: textMuted }}>Firma Filtresi</label>
                        <select
                          value={raporFirmaFilter}
                          onChange={e => setRaporFirmaFilter(e.target.value)}
                          className="text-sm px-3 py-2 rounded-xl cursor-pointer outline-none"
                          style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)', minWidth: '200px' }}
                        >
                          <option value="">Tüm Firmalar</option>
                          {altFirmalar.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <button
                          onClick={handlePdfExport}
                          disabled={raporExporting !== null}
                          className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer text-white"
                          style={{
                            background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                            border: '1px solid rgba(14,165,233,0.3)',
                            opacity: raporExporting === 'pdf' ? 0.7 : 1,
                          }}
                        >
                          {raporExporting === 'pdf'
                            ? <><i className="ri-loader-4-line animate-spin" />Hazırlanıyor...</>
                            : <><i className="ri-file-pdf-line" />PDF İndir</>}
                        </button>
                        <button
                          onClick={handleExcelExport}
                          disabled={raporExporting !== null}
                          className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer text-white"
                          style={{
                            background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                            border: '1px solid rgba(14,165,233,0.3)',
                            opacity: raporExporting === 'excel' ? 0.7 : 1,
                          }}
                        >
                          {raporExporting === 'excel'
                            ? <><i className="ri-loader-4-line animate-spin" />Hazırlanıyor...</>
                            : <><i className="ri-file-excel-line" />Excel İndir</>}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Özet KPI'lar */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Seçili Firma', value: filteredRaporFirmalar.length, icon: 'ri-building-2-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
                      { label: 'Toplam Personel', value: filteredRaporFirmalar.reduce((s, f) => s + f.personelSayisi, 0), icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
                      { label: 'Açık Uygunsuzluk', value: filteredRaporFirmalar.reduce((s, f) => s + f.uygunsuzluk, 0), icon: 'ri-alert-line', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
                      { label: 'Toplam Tutanak', value: filteredRaporFirmalar.reduce((s, f) => s + f.tutanakSayisi, 0), icon: 'ri-file-list-3-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
                    ].map(s => (
                      <div key={s.label} className="rounded-2xl p-5" style={cardStyle}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                          <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
                        </div>
                        <p className="text-2xl font-extrabold mb-1" style={{ color: textPrimary }}>{s.value}</p>
                        <p className="text-xs font-medium" style={{ color: textMuted }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Firma detay tablosu */}
                  <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Firma Detay Tablosu</h3>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(14,165,233,0.08)', color: '#0284C7' }}>
                        {donemLabel()}
                      </span>
                    </div>
                    {filteredRaporFirmalar.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}>
                          <i className="ri-file-chart-line text-xl" style={{ color: '#0EA5E9' }} />
                        </div>
                        <p className="text-sm" style={{ color: textMuted }}>Rapor için firma bulunamadı</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                          <thead>
                            <tr style={{ background: 'var(--table-head-bg)', borderBottom: '1px solid var(--border-subtle)' }}>
                              {['Firma Adı', 'Sorumlu Uzman', 'Personel', 'Açık Uyg.', 'Kapatılan', 'Tutanak', 'Eğitim', 'Kapanma %'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: textMuted }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRaporFirmalar.map((f, i) => {
                              const kapanmaOran = f.uygunsuzluk > 0 ? Math.round((f.kapatilan / f.uygunsuzluk) * 100) : 100;
                              const uyColor = f.uygunsuzluk > 5 ? '#EF4444' : f.uygunsuzluk > 2 ? '#F59E0B' : '#10B981';
                              const uyBg = f.uygunsuzluk > 5 ? 'rgba(239,68,68,0.1)' : f.uygunsuzluk > 2 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
                              return (
                                <tr key={f.id} style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-row-hover)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                                        <i className="ri-building-2-line" />
                                      </div>
                                      <span className="text-xs font-semibold" style={{ color: textPrimary }}>{f.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs" style={{ color: f.uzmanAd ? 'var(--text-secondary)' : textMuted }}>
                                    {f.uzmanAd ?? '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: textPrimary }}>{f.personelSayisi}</td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: uyBg, color: uyColor }}>
                                      {f.uygunsuzluk}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#0EA5E9' }}>{f.kapatilan}</td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#0EA5E9' }}>{f.tutanakSayisi}</td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#06B6D4' }}>{f.egitimSayisi}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-main)', minWidth: '48px' }}>
                                        <div
                                          className="h-full rounded-full"
                                          style={{ width: `${kapanmaOran}%`, background: kapanmaOran >= 80 ? '#10B981' : kapanmaOran >= 50 ? '#F59E0B' : '#EF4444' }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold flex-shrink-0" style={{ color: kapanmaOran >= 80 ? '#10B981' : kapanmaOran >= 50 ? '#F59E0B' : '#EF4444' }}>
                                        {kapanmaOran}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: isDark ? 'rgba(14,165,233,0.08)' : '#f0f9ff', borderTop: '2px solid rgba(14,165,233,0.2)' }}>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#0EA5E9' }}>TOPLAM</td>
                              <td className="px-4 py-3 text-xs" style={{ color: textMuted }}>—</td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: textPrimary }}>
                                {filteredRaporFirmalar.reduce((s, f) => s + f.personelSayisi, 0)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                  {filteredRaporFirmalar.reduce((s, f) => s + f.uygunsuzluk, 0)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#0EA5E9' }}>
                                {filteredRaporFirmalar.reduce((s, f) => s + f.kapatilan, 0)}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#0EA5E9' }}>
                                {filteredRaporFirmalar.reduce((s, f) => s + f.tutanakSayisi, 0)}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#06B6D4' }}>
                                {filteredRaporFirmalar.reduce((s, f) => s + f.egitimSayisi, 0)}
                              </td>
                              <td className="px-4 py-3" />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── FİRMA DETAY MODAL ── */}
      {secilenFirma && (
        <FirmaDetayModal
          firmaId={secilenFirma.id}
          firmaAdi={secilenFirma.name}
          orgId={org?.id ?? ''}
          uzmanlar={uzmanlar}
          onClose={handleFirmaDetayClose}
          onRefresh={handleFirmaDetayRefresh}
          addToast={addToast}
          isDark={isDark}
        />
      )}

      {/* ── UZMAN DETAY MODAL ── */}
      {secilenUzman && (
        <UzmanDetayModal
          uzman={secilenUzman}
          orgId={org?.id ?? ''}
          altFirmalar={altFirmalar}
          onClose={handleUzmanDetayClose}
          onRefresh={handleUzmanDetayRefresh}
          addToast={addToast}
        />
      )}

      {/* ── UZMAN EKLE MODAL ── */}
      <UzmanModal
        open={showUzmanModal}
        orgId={org?.id ?? ''}
        altFirmalar={altFirmalar}
        onClose={handleUzmanModalClose}
        onSuccess={handleUzmanModalSuccess}
        addToast={addToast}
      />

      {/* ── UZMAN ATAMA MODAL ── */}
      {showAtamaModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) handleAtamaModalClose(); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '85vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <i className="ri-links-line text-base" style={{ color: '#F59E0B' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Uzman - Firma Ataması</h3>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Hangi uzman hangi firmada çalışacak?</p>
                </div>
              </div>
              <button onClick={handleAtamaModalClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Uzman Seçimi */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  Uzman Seç <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {uzmanlar.map(u => {
                    const secili = atamaUzmanId === u.user_id;
                    return (
                      <button key={u.user_id} type="button"
                        onClick={() => handleAtamaUzmanSelect(u.user_id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          background: secili ? 'rgba(245,158,11,0.1)' : 'var(--bg-item)',
                          border: secili ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid var(--border-subtle)',
                        }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={secili
                            ? { background: '#F59E0B' }
                            : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                          {secili && <i className="ri-check-line text-white text-[10px]" />}
                        </div>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                          {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: secili ? '#F59E0B' : 'var(--text-primary)' }}>
                            {u.display_name ?? u.email}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {u.active_firm_name ?? 'Firma atanmamış'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Firma Seçimi */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  Atanacak Firma(lar) <span style={{ color: '#EF4444' }}>*</span>
                  <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>
                    ({atamaFirmaIds.length} seçili)
                  </span>
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {altFirmalar.map(f => {
                    const secili = atamaFirmaIds.includes(f.id);
                    return (
                      <button key={f.id} type="button"
                        onClick={() => handleAtamaFirmaToggle(f.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          background: secili ? 'rgba(245,158,11,0.1)' : 'var(--bg-item)',
                          border: secili ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid var(--border-subtle)',
                        }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={secili
                            ? { background: '#F59E0B' }
                            : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                          {secili && <i className="ri-check-line text-white text-[10px]" />}
                        </div>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                          <i className="ri-building-2-line" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: secili ? '#F59E0B' : 'var(--text-primary)' }}>
                            {f.name}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {f.uzmanAd ? `${f.uzmanAd} atanmış` : `${f.personelSayisi} personel`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {atamaError && (
              <div className="mx-6 mb-3 flex items-start gap-2 p-3 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#EF4444' }} />
                <p className="text-xs" style={{ color: '#EF4444' }}>{atamaError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={handleAtamaModalClose}
                className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                İptal
              </button>
              <button onClick={handleAtamaKaydet}
                disabled={atamaLoading || !atamaUzmanId || atamaFirmaIds.length === 0}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: (atamaLoading || !atamaUzmanId || atamaFirmaIds.length === 0) ? 0.6 : 1 }}>
                {atamaLoading ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</> : <><i className="ri-links-line" />Atamaları Kaydet</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── FİRMA EKLE MODAL ── */}
      <FirmaModal
        open={showFirmaModal}
        orgId={org?.id ?? ''}
        onClose={handleFirmaModalClose}
        onSuccess={handleFirmaModalSuccess}
        addToast={addToast}
      />
    </div>
  );
}
