import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';

const FirmaKonumSecici = lazy(() => import('./components/FirmaKonumSecici'));
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


  // Firma Ekle Modal
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [firmaError, setFirmaError] = useState<string | null>(null);

  // Uzman Atama Modal
  const [showAtamaModal, setShowAtamaModal] = useState(false);
  const [atamaUzmanId, setAtamaUzmanId] = useState<string>('');
  const [atamaFirmaIds, setAtamaFirmaIds] = useState<string[]>([]);
  const [atamaLoading, setAtamaLoading] = useState(false);
  const [atamaError, setAtamaError] = useState<string | null>(null);

  // Personel Ekle Modal
  const [showUzmanModal, setShowUzmanModal] = useState(false);
  const [uzmanForm, setUzmanForm] = useState({ ad: '', soyad: '', email: '', telefon: '', rol: 'gezici_uzman' as 'gezici_uzman' | 'isyeri_hekimi', password: '', passwordConfirm: '', atananFirmaIds: [] as string[] });
  const [uzmanFormTab, setUzmanFormTab] = useState<0 | 1 | 2>(0);
  const [uzmanLoading, setUzmanLoading] = useState(false);
  const [uzmanError, setUzmanError] = useState<string | null>(null);
  const [showUzmanPw, setShowUzmanPw] = useState(false);
  const [showUzmanPwConfirm, setShowUzmanPwConfirm] = useState(false);

  // ── Veri çek ──
  const fetchData = useCallback(async () => {
    if (!org?.id) return;
    setDataLoading(true);
    try {
      // Alt firmalar (parent_org_id = bu OSGB'nin org id'si) — silinmemişler
      const { data: firmData } = await supabase
        .from('organizations')
        .select('id, name, invite_code, created_at')
        .eq('parent_org_id', org.id)
        .eq('org_type', 'firma')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Tüm personel (gezici_uzman + isyeri_hekimi)
      const { data: uzmanData } = await supabase
        .from('user_organizations')
        .select('user_id, display_name, email, is_active, active_firm_id, active_firm_ids, osgb_role')
        .eq('organization_id', org.id)
        .in('osgb_role', ['gezici_uzman', 'isyeri_hekimi']);

      // Her alt firma için personel, uygunsuzluk, tutanak, eğitim say
      const enrichedFirmalar: AltFirma[] = [];
      const detaylar: FirmaDetay[] = [];

      await Promise.all(
        (firmData ?? []).map(async (f) => {
          const [
            { count: personelCount },
            { count: uygunsuzlukCount },
            { count: kapatilanCount },
            { count: tutanakCount },
            { count: egitimCount },
          ] = await Promise.all([
            supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', f.id).is('deleted_at', null),
            supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id).is('deleted_at', null)
              .not('data->>durum', 'in', '("Kapandı","Kapatıldı","Kapandı")'),
            supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id).is('deleted_at', null)
              .or('data->>durum.eq.Kapandı,data->>durum.eq.Kapatıldı'),
            supabase.from('tutanaklar').select('id', { count: 'exact', head: true }).eq('organization_id', f.id).is('deleted_at', null),
            supabase.from('egitimler').select('id', { count: 'exact', head: true }).eq('organization_id', f.id).is('deleted_at', null),
          ]);

          // Bu firmaya atanmış uzmanı bul (active_firm_id veya active_firm_ids içinde)
          const atananUzman = (uzmanData ?? []).find(u =>
            u.active_firm_id === f.id ||
            (Array.isArray(u.active_firm_ids) && u.active_firm_ids.includes(f.id))
          );

          const base: AltFirma = {
            id: f.id,
            name: f.name,
            invite_code: f.invite_code,
            created_at: f.created_at,
            personelSayisi: personelCount ?? 0,
            uzmanAd: atananUzman?.display_name ?? null,
            uygunsuzluk: uygunsuzlukCount ?? 0,
          };
          enrichedFirmalar.push(base);
          detaylar.push({
            id: f.id,
            name: f.name,
            personelSayisi: personelCount ?? 0,
            uzmanAd: atananUzman?.display_name ?? null,
            uygunsuzluk: uygunsuzlukCount ?? 0,
            kapatilan: kapatilanCount ?? 0,
            tutanakSayisi: tutanakCount ?? 0,
            egitimSayisi: egitimCount ?? 0,
          });
        })
      );

      // Sıralama koru (created_at desc)
      enrichedFirmalar.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      detaylar.sort((a, b) => enrichedFirmalar.findIndex(x => x.id === a.id) - enrichedFirmalar.findIndex(x => x.id === b.id));

      // Uzmanlar için aktif firma adını/adlarını çek
      const enrichedUzmanlar: Uzman[] = await Promise.all(
        (uzmanData ?? []).map(async (u) => {
          // active_firm_ids varsa tüm firma adlarını çek
          const firmIds: string[] = (u.active_firm_ids && u.active_firm_ids.length > 0)
            ? u.active_firm_ids
            : u.active_firm_id ? [u.active_firm_id] : [];

          let active_firm_name: string | null = null;
          if (firmIds.length > 0) {
            const { data: firmRows } = await supabase
              .from('organizations')
              .select('id, name')
              .in('id', firmIds);
            if (firmRows && firmRows.length > 0) {
              // Birden fazla firma varsa isimlerini virgülle birleştir
              active_firm_name = firmRows.map(r => r.name).join(', ');
            }
          }
          return {
            ...u,
            active_firm_ids: u.active_firm_ids ?? null,
            active_firm_name,
          };
        })
      );

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

  // RLS fix — OSGB admin alt firmalarını güncelleyebilsin (çöp kutusu geri alma vb.)
  useEffect(() => {
    const applyRlsFix = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        await fetch('https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/apply-rls-fixes', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Sessiz hata — kritik değil
      }
    };
    void applyRlsFix();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Firma Ekle ──
  const [firmaForm, setFirmaForm] = useState({
    ad: '', yetkili: '', telefon: '', eposta: '', sgkSicil: '', adres: '',
    tehlikeSinifi: 'Tehlikeli', durum: 'Aktif',
    sozlesmeBas: '', sozlesmeBit: '', logoFile: null as File | null,
    // GPS alanları
    ziyaretDogrulama: 'sadece_qr' as 'sadece_qr' | 'qr_konum',
    izinVerilenMesafe: 1000,
    firmaLat: null as number | null,
    firmaLng: null as number | null,
    gpsStrict: true, // true = engelle, false = uyar ama izin ver
  });
  const [firmaFormTab, setFirmaFormTab] = useState<0 | 1 | 2>(0);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  /** Nominatim geocoding — adres → koordinat */
  const handleGeocode = useCallback(async () => {
    const q = firmaForm.adres.trim();
    if (!q) return;
    setGeocodeLoading(true);
    setGeocodeError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'tr' } });
      const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (!data || data.length === 0) {
        setGeocodeError('Adres bulunamadı. Daha ayrıntılı bir adres deneyin.');
        return;
      }
      const { lat, lon } = data[0];
      setFirmaForm(p => ({ ...p, firmaLat: parseFloat(lat), firmaLng: parseFloat(lon) }));
    } catch {
      setGeocodeError('Adres arama sırasında bir hata oluştu.');
    } finally {
      setGeocodeLoading(false);
    }
  }, [firmaForm.adres]);

  const handleFirmaEkle = async () => {
    if (!firmaForm.ad.trim()) { setFirmaError('Firma adı zorunludur.'); return; }
    if (firmaForm.ziyaretDogrulama === 'qr_konum' && !firmaForm.adres.trim()) {
      setFirmaError('QR + Konum doğrulama seçildiğinde adres zorunludur.');
      setFirmaFormTab(2);
      return;
    }
    if (!org?.id) return;
    setFirmaLoading(true);
    setFirmaError(null);
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      const gpsRequired = firmaForm.ziyaretDogrulama === 'qr_konum';

      const { data: newFirma, error } = await supabase
        .from('organizations')
        .insert({
          name: firmaForm.ad.trim(),
          invite_code: inviteCode,
          created_by: user?.id,
          org_type: 'firma',
          parent_org_id: org.id,
          gps_required: gpsRequired,
          gps_radius: gpsRequired ? firmaForm.izinVerilenMesafe : 1000,
          gps_strict: gpsRequired ? firmaForm.gpsStrict : true,
          firma_adres: firmaForm.adres.trim() || null,
          firma_lat: gpsRequired ? firmaForm.firmaLat : null,
          firma_lng: gpsRequired ? firmaForm.firmaLng : null,
        })
        .select()
        .maybeSingle();

      if (error || !newFirma) {
        setFirmaError(error?.message ?? 'Firma oluşturulamadı.');
        return;
      }

      await supabase.from('app_data').upsert(
        {
          organization_id: newFirma.id,
          data: {
            yetkili: firmaForm.yetkili,
            telefon: firmaForm.telefon,
            email: firmaForm.eposta,
            sgkSicil: firmaForm.sgkSicil,
            adres: firmaForm.adres,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' }
      );

      addToast(`${firmaForm.ad.trim()} başarıyla eklendi!`, 'success');
      setShowFirmaModal(false);
      setFirmaForm({ ad: '', yetkili: '', telefon: '', eposta: '', sgkSicil: '', adres: '', tehlikeSinifi: 'Tehlikeli', durum: 'Aktif', sozlesmeBas: '', sozlesmeBit: '', logoFile: null, ziyaretDogrulama: 'sadece_qr', izinVerilenMesafe: 1000, firmaLat: null, firmaLng: null, gpsStrict: true });
      setFirmaFormTab(0);
      setGeocodeError(null);
      await fetchData();
    } catch (err) {
      setFirmaError(String(err));
    } finally {
      setFirmaLoading(false);
    }
  };

  // ── Uzman Ekle ──
  const handleUzmanEkle = async () => {
    const fullName = `${uzmanForm.ad.trim()} ${uzmanForm.soyad.trim()}`.trim();
    if (!fullName) { setUzmanError('Ad ve soyad zorunludur.'); return; }
    if (!uzmanForm.email.trim()) { setUzmanError('E-posta zorunludur.'); return; }
    if (uzmanForm.password.length < 8) { setUzmanError('Şifre en az 8 karakter olmalıdır.'); return; }
    if (uzmanForm.password !== uzmanForm.passwordConfirm) { setUzmanError('Şifreler eşleşmiyor.'); return; }
    if (!org?.id) return;
    setUzmanLoading(true);
    setUzmanError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setUzmanError('Oturum bulunamadı.'); return; }
      const rolLabel = uzmanForm.rol === 'isyeri_hekimi' ? 'işyeri hekimi' : 'gezici uzman';
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          organization_id: org.id,
          email: uzmanForm.email.trim().toLowerCase(),
          password: uzmanForm.password,
          display_name: fullName,
          role: 'member',
          osgb_role: uzmanForm.rol,
          active_firm_id: uzmanForm.atananFirmaIds[0] || null,
          active_firm_ids: uzmanForm.atananFirmaIds.length > 0 ? uzmanForm.atananFirmaIds : null,
        }),
      });
      const json = await res.json();
      if (json.error) { setUzmanError(json.error); return; }
      addToast(`${fullName} ${rolLabel} olarak eklendi!`, 'success');
      setShowUzmanModal(false);
      setUzmanForm({ ad: '', soyad: '', email: '', telefon: '', rol: 'gezici_uzman', password: '', passwordConfirm: '', atananFirmaIds: [] });
      setUzmanFormTab(0);
      await fetchData();
    } catch (err) {
      setUzmanError(String(err));
    } finally {
      setUzmanLoading(false);
    }
  };

  // ── Uzman Ata ──
  const handleAtamaKaydet = async () => {
    if (!atamaUzmanId || atamaFirmaIds.length === 0) {
      setAtamaError('Lütfen bir uzman ve en az bir firma seçin.');
      return;
    }
    setAtamaLoading(true);
    setAtamaError(null);
    try {
      // 1. Seçilen uzmanın atamasını güncelle
      const { error } = await supabase
        .from('user_organizations')
        .update({
          active_firm_id: atamaFirmaIds[0],
          active_firm_ids: atamaFirmaIds,
        })
        .eq('user_id', atamaUzmanId)
        .eq('organization_id', org?.id ?? '');
      if (error) { setAtamaError(error.message); return; }

      // 2. Aynı OSGB'deki tüm hekimlerin active_firm_ids'ini yeniden hesapla ve güncelle
      //    Hekim; OSGB'ye bağlı tüm uzmanların atandığı firmaların birleşimini görmelidir.
      if (org?.id) {
        // Tüm gezici uzmanların güncel atamalarını çek (yeni atama dahil)
        const { data: uzmanRows } = await supabase
          .from('user_organizations')
          .select('active_firm_ids, active_firm_id')
          .eq('organization_id', org.id)
          .eq('osgb_role', 'gezici_uzman');

        // Tüm uzmanların firmalarının birleşimi
        const allFirmIds: string[] = [];
        (uzmanRows ?? []).forEach(u => {
          if (Array.isArray(u.active_firm_ids) && u.active_firm_ids.length > 0) {
            u.active_firm_ids.forEach((id: string) => { if (!allFirmIds.includes(id)) allFirmIds.push(id); });
          } else if (u.active_firm_id && !allFirmIds.includes(u.active_firm_id)) {
            allFirmIds.push(u.active_firm_id);
          }
        });

        // Hekimleri bul ve güncelle (sadece active_firm_ids boşsa veya eskiyse)
        if (allFirmIds.length > 0) {
          const { data: hekimRows } = await supabase
            .from('user_organizations')
            .select('user_id, active_firm_ids')
            .eq('organization_id', org.id)
            .eq('osgb_role', 'isyeri_hekimi');

          if (hekimRows && hekimRows.length > 0) {
            await Promise.all(hekimRows.map(h => {
              // Hekimin mevcut atamalarını koru + yeni firmaları ekle
              const mevcut: string[] = Array.isArray(h.active_firm_ids) ? h.active_firm_ids : [];
              const birlesim = [...new Set([...mevcut, ...allFirmIds])];
              return supabase
                .from('user_organizations')
                .update({ active_firm_ids: birlesim, active_firm_id: birlesim[0] })
                .eq('user_id', h.user_id)
                .eq('organization_id', org.id);
            }));
          }
        }
      }

      addToast('Atama başarıyla güncellendi!', 'success');
      setShowAtamaModal(false);
      setAtamaUzmanId('');
      setAtamaFirmaIds([]);
      await fetchData();
    } catch (err) {
      setAtamaError(String(err));
    } finally {
      setAtamaLoading(false);
    }
  };

  const filteredFirmalar = altFirmalar.filter(f =>
    f.name.toLowerCase().includes(searchFirma.toLowerCase())
  );
  const filteredUzmanlar = uzmanlar.filter(u =>
    u.display_name?.toLowerCase().includes(searchUzman.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUzman.toLowerCase())
  );

  const totalPersonel = altFirmalar.reduce((s, f) => s + f.personelSayisi, 0);
  const totalUygunsuzluk = altFirmalar.reduce((s, f) => s + f.uygunsuzluk, 0);

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: 'dashboard', icon: 'ri-dashboard-line', label: 'Genel Bakış' },
    { id: 'firmalar', icon: 'ri-building-2-line', label: 'Müşteri Firmalar' },
    { id: 'uzmanlar', icon: 'ri-user-star-line', label: 'Gezici Uzmanlar' },
    { id: 'raporlar', icon: 'ri-file-chart-line', label: 'Raporlar' },
  ];

  const donemLabel = () => {
    if (!raporDonem) return 'Tüm Dönemler';
    const [y, m] = raporDonem.split('-');
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  const filteredRaporFirmalar = firmaDetaylar.filter(f =>
    !raporFirmaFilter || f.id === raporFirmaFilter
  );

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

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', borderRadius: '10px',
    color: 'var(--text-primary)', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '13px',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)',
  };
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)', borderRadius: '16px',
  };
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
        onClick={() => setMobileOpen(false)}
      />

      <OsgbSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        orgName={org?.name ?? 'OSGB'}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        firmaCount={altFirmalar.length}
        uzmanCount={uzmanlar.length}
      />

      <OsgbHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        orgName={org?.name ?? 'OSGB'}
        onMobileMenuToggle={() => setMobileOpen(v => !v)}
        onFirmaEkle={() => { setShowFirmaModal(true); setFirmaError(null); }}
        onUzmanEkle={() => { setShowUzmanModal(true); setUzmanError(null); setUzmanFormTab(0); setUzmanForm({ ad: '', soyad: '', email: '', telefon: '', rol: 'gezici_uzman' as 'gezici_uzman' | 'isyeri_hekimi', password: '', passwordConfirm: '', atananFirmaIds: [] }); }}
        theme={osgbTheme}
        onToggleTheme={() => setOsgbTheme(t => t === 'dark' ? 'light' : 'dark')}
      />

      <main
        className={`transition-all duration-300 pt-[46px] min-h-screen ${sidebarCollapsed ? 'lg:pl-[64px]' : 'lg:pl-[220px]'}`}
      >
        <div className="px-2 sm:px-3 md:px-5 py-3 max-w-[1680px]">
          {!dataLoading && (
            <>
              {/* ── DASHBOARD ── */}
              {activeTab === 'dashboard' && (
                <>
                  {/* Onboarding: firma yoksa veya uzman yoksa veya atama yoksa göster */}
                  {(altFirmalar.length === 0 || uzmanlar.length === 0 || !altFirmalar.some(f => f.uzmanAd)) ? (
                    <OsgbOnboarding
                      firmalar={altFirmalar.map(f => ({ id: f.id, name: f.name, uzmanAd: f.uzmanAd }))}
                      uzmanlar={uzmanlar}
                      isDark={isDark}
                      onFirmaEkle={() => { setShowFirmaModal(true); setFirmaError(null); }}
                      onUzmanEkle={() => { setShowUzmanModal(true); setUzmanError(null); setUzmanFormTab(0); setUzmanForm({ ad: '', soyad: '', email: '', telefon: '', rol: 'gezici_uzman' as 'gezici_uzman' | 'isyeri_hekimi', password: '', passwordConfirm: '', atananFirmaIds: [] }); }}
                      onAtamaYap={() => { setShowAtamaModal(true); setAtamaError(null); setAtamaUzmanId(uzmanlar[0]?.user_id ?? ''); setAtamaFirmaIds([]); }}
                    />
                  ) : (
                    <DashboardTab
                      altFirmalar={altFirmalar}
                      uzmanlar={uzmanlar}
                      isDark={isDark}
                      orgId={org?.id ?? ''}
                      onFirmaEkle={() => { setShowFirmaModal(true); setFirmaError(null); }}
                      onUzmanEkle={() => { setShowUzmanModal(true); setUzmanError(null); setUzmanFormTab(0); setUzmanForm({ ad: '', soyad: '', email: '', telefon: '', rol: 'gezici_uzman' as 'gezici_uzman' | 'isyeri_hekimi', password: '', passwordConfirm: '', atananFirmaIds: [] }); }}
                      onAtamaYap={() => { setShowAtamaModal(true); setAtamaError(null); setAtamaUzmanId(uzmanlar[0]?.user_id ?? ''); setAtamaFirmaIds([]); }}
                      onFirmaClick={(f) => setSecilenFirma(f)}
                      onUzmanClick={(u) => setSecilenUzman(u)}
                      setActiveTab={setActiveTab}
                    />
                  )}
                </>
              )}

              {/* ── FİRMALAR TAB ── */}
              {activeTab === 'firmalar' && (
                <FirmalarTab
                  altFirmalar={altFirmalar}
                  uzmanlar={uzmanlar}
                  orgId={org?.id ?? ''}
                  isDark={isDark}
                  onFirmaClick={(f) => setSecilenFirma(f)}
                  onFirmaEkle={() => { setShowFirmaModal(true); setFirmaError(null); }}
                  onAtamaYap={(firmaId) => { setShowAtamaModal(true); setAtamaError(null); setAtamaUzmanId(''); setAtamaFirmaIds([firmaId]); }}
                  onFirmaDeleted={(_firmaId) => { void fetchData(); }}
                />
              )}

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
                    <button onClick={() => { setShowUzmanModal(true); setUzmanError(null); setUzmanFormTab(0); setUzmanForm({ ad: '', soyad: '', email: '', telefon: '', rol: 'gezici_uzman' as 'gezici_uzman' | 'isyeri_hekimi', password: '', passwordConfirm: '', atananFirmaIds: [] }); }}
                        className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all ml-auto"
                        style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', border: '1px solid rgba(14,165,233,0.3)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
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
                      <button onClick={() => { setShowUzmanModal(true); setUzmanFormTab(0); }}
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
                          {filteredUzmanlar.map((u) => {
                            const firmIds = (u.active_firm_ids && u.active_firm_ids.length > 0)
                              ? u.active_firm_ids
                              : u.active_firm_id ? [u.active_firm_id] : [];
                            const atananFirmalar = firmIds.map(id => altFirmalar.find(f => f.id === id)).filter(Boolean) as typeof altFirmalar;

                            return (
                              <div
                                key={u.user_id}
                                className="grid px-4 py-3 transition-all"
                                style={{
                                  gridTemplateColumns: '2fr 1.2fr 1fr 1.5fr 1fr 100px',
                                  background: 'transparent',
                                }}
                                onMouseEnter={e => {
                                  (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.04)';
                                }}
                                onMouseLeave={e => {
                                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                                }}
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
                                      <p className="text-[10px]" style={{ color: '#0EA5E9' }}>
                                        {atananFirmalar.length} firma
                                      </p>
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
                                      onClick={() => { setShowAtamaModal(true); setAtamaError(null); setAtamaUzmanId(u.user_id); setAtamaFirmaIds([]); }}
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
                                    onClick={() => { setShowAtamaModal(true); setAtamaError(null); setAtamaUzmanId(u.user_id); setAtamaFirmaIds(firmIds); }}
                                    title="Firma Ata"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                                    style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: textMuted }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.1)'; (e.currentTarget as HTMLElement).style.color = '#F59E0B'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.25)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = textMuted; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
                                    <i className="ri-links-line text-xs" />
                                  </button>
                                  <button
                                    onClick={() => setSecilenUzman(u)}
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
                          })}
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
                <CopKutusuTab orgId={org.id} isDark={isDark} onFirmaRestored={() => void fetchData()} />
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
          onClose={() => setSecilenFirma(null)}
          onRefresh={fetchData}
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
          onClose={() => setSecilenUzman(null)}
          onRefresh={fetchData}
          addToast={addToast}
        />
      )}

      {/* ── UZMAN EKLE MODAL — Premium 3 Bölüm ── */}
      {showUzmanModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowUzmanModal(false); setUzmanFormTab(0); } }}>
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '90vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <i className="ri-user-add-line text-base" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Personel Ekle</h3>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>OSGB ekibinize yeni personel ekleyin</p>
                </div>
              </div>
              <button onClick={() => { setShowUzmanModal(false); setUzmanFormTab(0); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 px-6 pt-4 flex-shrink-0">
              {[
                { idx: 0, icon: 'ri-user-line', label: 'Kişisel Bilgiler' },
                { idx: 1, icon: 'ri-lock-password-line', label: 'Giriş Bilgileri' },
                { idx: 2, icon: 'ri-building-2-line', label: 'Firma Atama' },
              ].map(tab => (
                <button key={tab.idx}
                  onClick={() => setUzmanFormTab(tab.idx as 0 | 1 | 2)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: uzmanFormTab === tab.idx ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                    border: uzmanFormTab === tab.idx ? '1.5px solid rgba(14,165,233,0.25)' : '1px solid var(--border-subtle)',
                    color: uzmanFormTab === tab.idx ? '#0EA5E9' : 'var(--text-muted)',
                  }}>
                  <i className={`${tab.icon} text-xs`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.idx + 1}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {/* Tab 0: Kişisel Bilgiler */}
              {uzmanFormTab === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                      <i className="ri-user-line text-xs" style={{ color: '#0EA5E9' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Kişisel Bilgiler</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanın kimlik ve iletişim bilgileri</p>
                    </div>
                  </div>

                  {/* Rol Seçimi */}
                  <div>
                    <label style={labelStyle}>Rol <span style={{ color: '#EF4444' }}>*</span></label>
                    <div className="flex gap-2">
                      {([
                        { val: 'gezici_uzman', label: 'Gezici Uzman', icon: 'ri-shield-user-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)' },
                        { val: 'isyeri_hekimi', label: 'İşyeri Hekimi', icon: 'ri-heart-pulse-line', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)' },
                      ] as const).map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setUzmanForm(p => ({ ...p, rol: opt.val }))}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                          style={{
                            background: uzmanForm.rol === opt.val ? opt.bg : 'var(--bg-item)',
                            border: `1.5px solid ${uzmanForm.rol === opt.val ? opt.border : 'var(--border-subtle)'}`,
                            color: uzmanForm.rol === opt.val ? opt.color : 'var(--text-muted)',
                          }}>
                          <i className={`${opt.icon} text-xs`} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Avatar önizleme */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0"
                      style={{ background: uzmanForm.ad ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                      {uzmanForm.ad ? uzmanForm.ad.charAt(0).toUpperCase() : <i className="ri-user-line text-xl" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {uzmanForm.ad || uzmanForm.soyad ? `${uzmanForm.ad} ${uzmanForm.soyad}`.trim() : 'Personel Adı'}
                      </p>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-1"
                        style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                        {uzmanForm.rol === 'isyeri_hekimi' ? 'İşyeri Hekimi' : 'Gezici Uzman'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Ad <span style={{ color: '#EF4444' }}>*</span></label>
                      <input value={uzmanForm.ad} onChange={e => { setUzmanForm(p => ({ ...p, ad: e.target.value })); setUzmanError(null); }}
                        placeholder="Ad" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Soyad <span style={{ color: '#EF4444' }}>*</span></label>
                      <input value={uzmanForm.soyad} onChange={e => setUzmanForm(p => ({ ...p, soyad: e.target.value }))}
                        placeholder="Soyad" style={inputStyle} />
                    </div>
                    <div className="sm:col-span-2">
                      <label style={labelStyle}>Telefon</label>
                      <input value={uzmanForm.telefon} onChange={e => setUzmanForm(p => ({ ...p, telefon: e.target.value }))}
                        placeholder="0555 000 00 00" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 1: Giriş Bilgileri */}
              {uzmanFormTab === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                      <i className="ri-lock-password-line text-xs" style={{ color: '#F59E0B' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Giriş Bilgileri</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanın sisteme giriş için e-posta ve şifresi</p>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>E-posta <span style={{ color: '#EF4444' }}>*</span></label>
                    <div className="relative">
                      <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                      <input type="email" value={uzmanForm.email}
                        onChange={e => { setUzmanForm(p => ({ ...p, email: e.target.value })); setUzmanError(null); }}
                        placeholder="uzman@ornek.com"
                        style={{ ...inputStyle, paddingLeft: '36px' }} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Şifre <span style={{ color: '#EF4444' }}>*</span></label>
                    <div className="relative">
                      <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                      <input type={showUzmanPw ? 'text' : 'password'} value={uzmanForm.password}
                        onChange={e => setUzmanForm(p => ({ ...p, password: e.target.value }))}
                        placeholder="En az 8 karakter"
                        style={{ ...inputStyle, paddingLeft: '36px', paddingRight: '44px' }} />
                      <button type="button" onClick={() => setShowUzmanPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}>
                        <i className={`${showUzmanPw ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                      </button>
                    </div>
                    {/* Şifre gücü */}
                    {uzmanForm.password.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {[...Array(4)].map((_, i) => {
                          const len = uzmanForm.password.length;
                          const active = (i === 0 && len >= 1) || (i === 1 && len >= 6) || (i === 2 && len >= 8) || (i === 3 && len >= 12);
                          const color = len < 6 ? '#EF4444' : len < 8 ? '#F59E0B' : len < 12 ? '#10B981' : '#22C55E';
                          return <div key={i} className="flex-1 h-1 rounded-full" style={{ background: active ? color : 'var(--border-subtle)' }} />;
                        })}
                        <span className="text-[10px] ml-1" style={{ color: uzmanForm.password.length < 6 ? '#EF4444' : uzmanForm.password.length < 8 ? '#F59E0B' : uzmanForm.password.length < 12 ? '#10B981' : '#22C55E' }}>
                          {uzmanForm.password.length < 6 ? 'Zayıf' : uzmanForm.password.length < 8 ? 'Orta' : uzmanForm.password.length < 12 ? 'İyi' : 'Güçlü'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>Şifre Tekrar <span style={{ color: '#EF4444' }}>*</span></label>
                    <div className="relative">
                      <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                      <input type={showUzmanPwConfirm ? 'text' : 'password'} value={uzmanForm.passwordConfirm}
                        onChange={e => setUzmanForm(p => ({ ...p, passwordConfirm: e.target.value }))}
                        placeholder="Şifreyi tekrar girin"
                        style={{
                          ...inputStyle, paddingLeft: '36px', paddingRight: '44px',
                          borderColor: uzmanForm.passwordConfirm && uzmanForm.password !== uzmanForm.passwordConfirm ? '#EF4444' : undefined,
                        }} />
                      <button type="button" onClick={() => setShowUzmanPwConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}>
                        <i className={`${showUzmanPwConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                      </button>
                    </div>
                    {uzmanForm.passwordConfirm && uzmanForm.password !== uzmanForm.passwordConfirm && (
                      <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>Şifreler eşleşmiyor</p>
                    )}
                  </div>

                  <div className="p-3 rounded-xl flex items-start gap-2.5" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                    <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                    <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Uzman bu e-posta ve şifre ile sisteme giriş yapabilecek. Şifreyi güvenli bir şekilde iletin.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Firma Atama */}
              {uzmanFormTab === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(139,92,246,0.1)' }}>
                      <i className="ri-building-2-line text-xs" style={{ color: '#8B5CF6' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Firma Atama</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanı bir müşteri firmaya atayın (isteğe bağlı)</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      Atanacak Firma(lar)
                      <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>
                        ({uzmanForm.atananFirmaIds.length} seçili)
                      </span>
                    </label>
                    {uzmanForm.atananFirmaIds.length > 0 && (
                      <button onClick={() => setUzmanForm(p => ({ ...p, atananFirmaIds: [] }))}
                        className="text-[10px] cursor-pointer" style={{ color: '#EF4444' }}>
                        Tümünü kaldır
                      </button>
                    )}
                  </div>

                  {/* Firma kartları — çoklu seçim */}
                  {altFirmalar.length === 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl mb-3" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Henüz müşteri firma eklenmedi. Personeli şimdi oluşturup daha sonra Firmalar sekmesinden atama yapabilirsiniz.</p>
                    </div>
                  )}
                  {altFirmalar.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {altFirmalar.map(f => {
                        const secili = uzmanForm.atananFirmaIds.includes(f.id);
                        const birincil = uzmanForm.atananFirmaIds[0] === f.id;
                        return (
                          <button key={f.id} type="button"
                            onClick={() => setUzmanForm(p => ({
                              ...p,
                              atananFirmaIds: p.atananFirmaIds.includes(f.id)
                                ? p.atananFirmaIds.filter(id => id !== f.id)
                                : [...p.atananFirmaIds, f.id],
                            }))}
                            className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left"
                            style={{
                              background: secili ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                              border: secili ? '1.5px solid rgba(14,165,233,0.3)' : '1.5px solid var(--border-subtle)',
                            }}>
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={secili
                                ? { background: 'linear-gradient(135deg,#0EA5E9,#0284C7)' }
                                : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                              {secili && <i className="ri-check-line text-white text-[10px]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: secili ? '#0EA5E9' : 'var(--text-primary)' }}>{f.name}</p>
                              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {f.uzmanAd ? `${f.uzmanAd} atanmış` : `${f.personelSayisi} personel`}
                              </p>
                            </div>
                            {birincil && secili && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(14,165,233,0.15)', color: '#0284C7' }}>Birincil</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Error */}
            {uzmanError && (
              <div className="mx-6 mb-3 flex items-start gap-2 p-3 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#dc2626' }}>{uzmanError}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="flex gap-2">
                <button onClick={() => setUzmanFormTab(t => Math.max(0, t - 1) as 0 | 1 | 2)}
                  disabled={uzmanFormTab === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: uzmanFormTab === 0 ? 0.35 : 1 }}>
                  <i className="ri-arrow-left-line" /> Geri
                </button>
                {uzmanFormTab < 2 && (
                  <button onClick={() => setUzmanFormTab(t => Math.min(2, t + 1) as 0 | 1 | 2)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                    style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
                    İleri <i className="ri-arrow-right-line" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowUzmanModal(false); setUzmanFormTab(0); }}
                  className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                  style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; }}>
                  İptal
                </button>
                <button onClick={handleUzmanEkle}
                  disabled={uzmanLoading || !uzmanForm.ad.trim() || !uzmanForm.email.trim() || uzmanForm.password.length < 8}
                  className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
                  style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: (uzmanLoading || !uzmanForm.ad.trim() || !uzmanForm.email.trim() || uzmanForm.password.length < 8) ? 0.6 : 1 }}
                  onMouseEnter={e => { if (!uzmanLoading && uzmanForm.ad.trim() && uzmanForm.email.trim() && uzmanForm.password.length >= 8) { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
                  {uzmanLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-user-add-line" />Personel Ekle</>}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── UZMAN ATAMA MODAL ── */}
      {showAtamaModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setShowAtamaModal(false); }}>
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
              <button onClick={() => setShowAtamaModal(false)}
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
                        onClick={() => setAtamaUzmanId(u.user_id)}
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
                        onClick={() => setAtamaFirmaIds(prev =>
                          prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                        )}
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
                <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#dc2626' }}>{atamaError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setShowAtamaModal(false)}
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

      {/* ── FİRMA EKLE MODAL — Premium 3 Bölüm ── */}
      {showFirmaModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowFirmaModal(false); setFirmaFormTab(0); } }}>
          <div className="w-full max-w-2xl rounded-2xl animate-modal-in overflow-hidden flex flex-col"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '90vh' }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <i className="ri-building-2-line text-base" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Müşteri Firma Ekle</h3>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>OSGB&apos;nize bağlı yeni müşteri firma</p>
                </div>
              </div>
              <button onClick={() => { setShowFirmaModal(false); setFirmaFormTab(0); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            {/* Section Tabs — 3 sekme */}
            <div className="flex gap-1.5 px-6 pt-4 flex-shrink-0">
              {[
                { idx: 0, icon: 'ri-id-card-line', label: 'Kimlik & İletişim' },
                { idx: 1, icon: 'ri-file-list-3-line', label: 'Sözleşme & Durum' },
                { idx: 2, icon: 'ri-map-pin-line', label: 'Konum & Ziyaret' },
              ].map(tab => (
                <button
                  key={tab.idx}
                  onClick={() => setFirmaFormTab(tab.idx as 0 | 1 | 2)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: firmaFormTab === tab.idx
                      ? tab.idx === 2 ? 'rgba(239,68,68,0.08)' : 'rgba(14,165,233,0.1)'
                      : 'var(--bg-item)',
                    border: firmaFormTab === tab.idx
                      ? tab.idx === 2 ? '1.5px solid rgba(239,68,68,0.25)' : '1.5px solid rgba(14,165,233,0.3)'
                      : '1px solid var(--border-subtle)',
                    color: firmaFormTab === tab.idx
                      ? tab.idx === 2 ? '#EF4444' : '#0EA5E9'
                      : 'var(--text-muted)',
                  }}>
                  <i className={`${tab.icon} text-xs`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.idx + 1}</span>
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* Tab 0: Kimlik & İletişim */}
              {firmaFormTab === 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                      <i className="ri-id-card-line text-xs" style={{ color: '#0EA5E9' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Kimlik & İletişim</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Firma adı, yetkili ve iletişim bilgileri</p>
                    </div>
                  </div>

                  {/* Firma Adı */}
                  <div>
                    <label style={labelStyle}>Firma Adı <span style={{ color: '#EF4444' }}>*</span></label>
                    <input
                      value={firmaForm.ad}
                      onChange={e => { setFirmaForm(p => ({ ...p, ad: e.target.value })); setFirmaError(null); }}
                      placeholder="Firma adı giriniz"
                      style={inputStyle}
                      onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                      onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    />
                  </div>

                  {/* Logo upload — firma adı altına */}
                  <div>
                    <label style={labelStyle}>Firma Logosu <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(PNG / JPG, isteğe bağlı)</span></label>
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden"
                      onChange={e => { const f = e.target.files?.[0] ?? null; setFirmaForm(p => ({ ...p, logoFile: f })); }} />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: firmaForm.logoFile ? 'rgba(14,165,233,0.06)' : 'var(--bg-item)',
                        border: `2px dashed ${firmaForm.logoFile ? 'rgba(14,165,233,0.35)' : 'var(--border-subtle)'}`,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.45)'; (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.05)'; }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = firmaForm.logoFile ? 'rgba(14,165,233,0.35)' : 'var(--border-subtle)';
                        (e.currentTarget as HTMLElement).style.background = firmaForm.logoFile ? 'rgba(14,165,233,0.06)' : 'var(--bg-item)';
                      }}>
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                        style={{ background: firmaForm.logoFile ? 'rgba(14,165,233,0.12)' : 'var(--bg-hover)' }}>
                        <i className={`${firmaForm.logoFile ? 'ri-image-line' : 'ri-upload-cloud-2-line'} text-lg`}
                          style={{ color: firmaForm.logoFile ? '#0EA5E9' : 'var(--text-faint)' }} />
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        {firmaForm.logoFile ? (
                          <>
                            <p className="text-xs font-semibold truncate" style={{ color: '#0EA5E9' }}>{firmaForm.logoFile.name}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {(firmaForm.logoFile.size / 1024).toFixed(1)} KB · Değiştirmek için tıklayın
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Logo yüklemek için tıklayın</p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>PNG veya JPG, max 2MB</p>
                          </>
                        )}
                      </div>
                      {firmaForm.logoFile && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(14,165,233,0.12)', color: '#0284C7' }}>Yüklendi</span>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Yetkili Kişi</label>
                      <input
                        value={firmaForm.yetkili}
                        onChange={e => setFirmaForm(p => ({ ...p, yetkili: e.target.value }))}
                        placeholder="Yetkili kişi adı"
                        style={inputStyle}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Telefon</label>
                      <input
                        value={firmaForm.telefon}
                        onChange={e => setFirmaForm(p => ({ ...p, telefon: e.target.value }))}
                        placeholder="0212 000 00 00"
                        style={inputStyle}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>E-posta</label>
                      <input
                        type="email"
                        value={firmaForm.eposta}
                        onChange={e => setFirmaForm(p => ({ ...p, eposta: e.target.value }))}
                        placeholder="info@firma.com"
                        style={inputStyle}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>SGK Sicil No</label>
                      <input
                        value={firmaForm.sgkSicil}
                        onChange={e => setFirmaForm(p => ({ ...p, sgkSicil: e.target.value }))}
                        placeholder="SGK sicil numarası"
                        style={inputStyle}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Adres</label>
                    <textarea
                      value={firmaForm.adres}
                      onChange={e => setFirmaForm(p => ({ ...p, adres: e.target.value }))}
                      placeholder="Firma adresi"
                      rows={3}
                      style={{ ...inputStyle, resize: 'none', height: 'auto' }}
                      onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                      onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>
              )}

              {/* Tab 1: Sözleşme & Durum */}
              {firmaFormTab === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                      <i className="ri-file-list-3-line text-xs" style={{ color: '#F59E0B' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Sözleşme & Durum</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tehlike sınıfı, firma durumu ve sözleşme tarihleri</p>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Tehlike Sınıfı</label>
                    <div className="flex gap-2">
                      {['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFirmaForm(p => ({ ...p, tehlikeSinifi: opt }))}
                          className="flex-1 py-2.5 px-2 rounded-xl text-[10.5px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                          style={{
                            background: firmaForm.tehlikeSinifi === opt
                              ? opt === 'Çok Tehlikeli' ? 'rgba(239,68,68,0.1)' : opt === 'Tehlikeli' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'
                              : 'var(--bg-item)',
                            border: firmaForm.tehlikeSinifi === opt
                              ? opt === 'Çok Tehlikeli' ? '1.5px solid rgba(239,68,68,0.3)' : opt === 'Tehlikeli' ? '1.5px solid rgba(245,158,11,0.3)' : '1.5px solid rgba(16,185,129,0.3)'
                              : '1.5px solid var(--border-subtle)',
                            color: firmaForm.tehlikeSinifi === opt
                              ? opt === 'Çok Tehlikeli' ? '#EF4444' : opt === 'Tehlikeli' ? '#F59E0B' : '#10B981'
                              : 'var(--text-muted)',
                          }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Firma Durumu</label>
                    <div className="flex gap-2">
                      {['Aktif', 'Pasif'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFirmaForm(p => ({ ...p, durum: opt }))}
                          className="flex-1 py-2.5 px-3 rounded-xl text-[11px] font-semibold cursor-pointer transition-all"
                          style={{
                            background: firmaForm.durum === opt ? (opt === 'Aktif' ? 'rgba(14,165,233,0.1)' : 'rgba(100,116,139,0.1)') : 'var(--bg-item)',
                            border: firmaForm.durum === opt ? (opt === 'Aktif' ? '1.5px solid rgba(14,165,233,0.3)' : '1.5px solid rgba(100,116,139,0.3)') : '1.5px solid var(--border-subtle)',
                            color: firmaForm.durum === opt ? (opt === 'Aktif' ? '#0EA5E9' : '#64748B') : 'var(--text-muted)',
                          }}>
                          {opt === 'Aktif' ? '● Aktif' : '○ Pasif'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Sözleşme Tarihleri</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-faint)' }}>Başlangıç</p>
                        <input
                          type="date"
                          value={firmaForm.sozlesmeBas}
                          onChange={e => setFirmaForm(p => ({ ...p, sozlesmeBas: e.target.value }))}
                          className="text-sm px-3 py-2 rounded-xl outline-none"
                          style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }}
                          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-faint)' }}>Bitiş</p>
                        <input
                          type="date"
                          value={firmaForm.sozlesmeBit}
                          onChange={e => setFirmaForm(p => ({ ...p, sozlesmeBit: e.target.value }))}
                          className="text-sm px-3 py-2 rounded-xl outline-none"
                          style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }}
                          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(14,165,233,0.08)'; }}
                          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sözleşme özeti */}
                  {firmaForm.sozlesmeBas && firmaForm.sozlesmeBit && (
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <i className="ri-calendar-check-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: '#0EA5E9', fontWeight: 600 }}>
                          {new Date(firmaForm.sozlesmeBas).toLocaleDateString('tr-TR')}
                        </span>
                        <span style={{ color: 'var(--text-faint)' }}> — </span>
                        <span style={{ color: '#0EA5E9', fontWeight: 600 }}>
                          {new Date(firmaForm.sozlesmeBit).toLocaleDateString('tr-TR')}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}> tarihler arası sözleşme</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Konum & Ziyaret Doğrulama */}
              {firmaFormTab === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <i className="ri-map-pin-line text-xs" style={{ color: '#EF4444' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Konum & Ziyaret Doğrulama</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanın firmayı ziyaret ederken doğrulama yöntemi</p>
                    </div>
                  </div>

                  {/* Ziyaret doğrulama seçeneği */}
                  <div>
                    <label style={labelStyle}>Ziyaret Doğrulama Yöntemi</label>
                    <div className="flex gap-2">
                      {([
                        { val: 'sadece_qr', icon: 'ri-qr-code-line', label: 'Sadece QR', desc: 'QR kodu tarayarak giriş', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.3)' },
                        { val: 'qr_konum', icon: 'ri-map-pin-2-line', label: 'QR + Konum', desc: 'QR + GPS konum doğrulama', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
                      ] as const).map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setFirmaForm(p => ({ ...p, ziyaretDogrulama: opt.val }))}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl cursor-pointer transition-all"
                          style={{
                            background: firmaForm.ziyaretDogrulama === opt.val ? opt.bg : 'var(--bg-item)',
                            border: `1.5px solid ${firmaForm.ziyaretDogrulama === opt.val ? opt.border : 'var(--border-subtle)'}`,
                            color: firmaForm.ziyaretDogrulama === opt.val ? opt.color : 'var(--text-muted)',
                          }}>
                          <i className={`${opt.icon} text-base`} />
                          <span className="text-xs font-bold">{opt.label}</span>
                          <span className="text-[9px] text-center leading-tight" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* QR + Konum seçiliyse ek alanlar */}
                  {firmaForm.ziyaretDogrulama === 'qr_konum' && (
                    <>
                      {/* Adres — zorunlu + geocoding */}
                      <div>
                        <label style={labelStyle}>
                          Firma Adresi <span style={{ color: '#EF4444' }}>*</span>
                          <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--text-faint)' }}>(Konum doğrulama için zorunlu)</span>
                        </label>
                        <div className="flex gap-2">
                          <textarea
                            value={firmaForm.adres}
                            onChange={e => {
                              setFirmaForm(p => ({ ...p, adres: e.target.value }));
                              setGeocodeError(null);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleGeocode(); } }}
                            placeholder="Tam adres girin, sonra 'Ara' butonuna tıklayın"
                            rows={2}
                            className="flex-1"
                            style={{ ...inputStyle, resize: 'none', height: 'auto', borderColor: !firmaForm.adres.trim() ? 'rgba(239,68,68,0.4)' : 'var(--border-input)' }}
                            onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.6)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(239,68,68,0.08)'; }}
                            onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = !firmaForm.adres.trim() ? 'rgba(239,68,68,0.4)' : 'var(--border-input)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                          />
                          <button
                            type="button"
                            onClick={() => void handleGeocode()}
                            disabled={geocodeLoading || !firmaForm.adres.trim()}
                            className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap self-stretch"
                            style={{
                              background: firmaForm.adres.trim() ? 'rgba(239,68,68,0.1)' : 'var(--bg-item)',
                              border: `1.5px solid ${firmaForm.adres.trim() ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
                              color: firmaForm.adres.trim() ? '#EF4444' : 'var(--text-faint)',
                              opacity: geocodeLoading ? 0.7 : 1,
                            }}
                          >
                            {geocodeLoading
                              ? <i className="ri-loader-4-line animate-spin text-sm" />
                              : <i className="ri-search-line text-sm" />}
                            Ara
                          </button>
                        </div>
                        {/* Geocode sonuç / hata */}
                        {geocodeError && (
                          <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg"
                            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <i className="ri-error-warning-line text-xs flex-shrink-0" style={{ color: '#EF4444' }} />
                            <p className="text-[10px]" style={{ color: '#EF4444' }}>{geocodeError}</p>
                          </div>
                        )}
                        {firmaForm.firmaLat !== null && !geocodeError && (
                          <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg"
                            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <i className="ri-map-pin-2-fill text-xs flex-shrink-0" style={{ color: '#22C55E' }} />
                            <p className="text-[10px]" style={{ color: '#16A34A' }}>
                              Konum bulundu: {firmaForm.firmaLat.toFixed(5)}, {firmaForm.firmaLng?.toFixed(5)} — haritayı kontrol edin veya tıklayarak ayarlayın
                            </p>
                          </div>
                        )}
                        <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-faint)' }}>
                          <i className="ri-information-line mr-0.5" />
                          Adresi girin ve "Ara"ya tıklayın — harita otomatik konuma gider. Ardından haritaya tıklayarak pinı ince ayarlayabilirsiniz.
                        </p>
                      </div>

                      {/* İzin verilen mesafe */}
                      <div>
                        <label style={labelStyle}>
                          İzin Verilen Mesafe
                          <span className="ml-2 font-bold" style={{ color: '#EF4444' }}>{firmaForm.izinVerilenMesafe} metre</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={50}
                            max={5000}
                            step={50}
                            value={firmaForm.izinVerilenMesafe}
                            onChange={e => setFirmaForm(p => ({ ...p, izinVerilenMesafe: Number(e.target.value) }))}
                            className="flex-1 cursor-pointer"
                            style={{ accentColor: '#EF4444' }}
                          />
                          <input
                            type="number"
                            min={50}
                            max={5000}
                            step={50}
                            value={firmaForm.izinVerilenMesafe}
                            onChange={e => setFirmaForm(p => ({ ...p, izinVerilenMesafe: Math.max(50, Math.min(5000, Number(e.target.value))) }))}
                            className="text-sm text-center rounded-lg outline-none"
                            style={{ width: '80px', padding: '6px 8px', background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)' }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          {[50, 250, 500, 1000, 2000, 5000].map(v => (
                            <button key={v} type="button"
                              onClick={() => setFirmaForm(p => ({ ...p, izinVerilenMesafe: v }))}
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded cursor-pointer transition-all"
                              style={{
                                background: firmaForm.izinVerilenMesafe === v ? 'rgba(239,68,68,0.1)' : 'var(--bg-item)',
                                color: firmaForm.izinVerilenMesafe === v ? '#EF4444' : 'var(--text-faint)',
                                border: `1px solid ${firmaForm.izinVerilenMesafe === v ? 'rgba(239,68,68,0.25)' : 'transparent'}`,
                              }}>
                              {v}m
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* GPS alınamazsa davranış */}
                      <div>
                        <label style={labelStyle}>GPS Alınamazsa</label>
                        <div className="flex gap-2">
                          {([
                            { val: true, icon: 'ri-shield-keyhole-line', label: 'Engelle', desc: 'Check-in yapılamaz', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
                            { val: false, icon: 'ri-error-warning-line', label: 'Uyar, İzin Ver', desc: 'Uyarı göster, devam et', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
                          ] as const).map(opt => (
                            <button key={String(opt.val)} type="button"
                              onClick={() => setFirmaForm(p => ({ ...p, gpsStrict: opt.val }))}
                              className="flex-1 flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl cursor-pointer transition-all"
                              style={{
                                background: firmaForm.gpsStrict === opt.val ? opt.bg : 'var(--bg-item)',
                                border: `1.5px solid ${firmaForm.gpsStrict === opt.val ? opt.border : 'var(--border-subtle)'}`,
                                color: firmaForm.gpsStrict === opt.val ? opt.color : 'var(--text-muted)',
                              }}>
                              <i className={`${opt.icon} text-base`} />
                              <span className="text-xs font-bold">{opt.label}</span>
                              <span className="text-[9px] text-center leading-tight" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] mt-2" style={{ color: 'var(--text-faint)' }}>
                          <i className="ri-information-line mr-0.5" />
                          {firmaForm.gpsStrict
                            ? 'Konum izni verilmezse uzman check-in yapamaz.'
                            : 'Konum alınamazsa uyarı gösterilir, check-in yine de yapılır.'}
                        </p>
                      </div>

                      {/* Harita */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label style={{ ...labelStyle, marginBottom: 0 }}>Haritadan Konum Seç</label>
                          {firmaForm.firmaLat !== null && firmaForm.firmaLng !== null && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
                              <i className="ri-map-pin-fill mr-1" />
                              {firmaForm.firmaLat.toFixed(5)}, {firmaForm.firmaLng.toFixed(5)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] mb-2" style={{ color: 'var(--text-faint)' }}>
                          <i className="ri-cursor-line mr-1" />Haritaya tıklayarak veya marker&apos;ı sürükleyerek konum belirleyin. Kırmızı alan izin verilen mesafeyi gösterir.
                        </p>
                        <Suspense fallback={
                          <div className="w-full h-[260px] rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--bg-item)', border: '1.5px solid rgba(239,68,68,0.2)' }}>
                            <div className="flex flex-col items-center gap-2">
                              <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#EF4444' }} />
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Harita yükleniyor...</span>
                            </div>
                          </div>
                        }>
                          <FirmaKonumSecici
                            lat={firmaForm.firmaLat}
                            lng={firmaForm.firmaLng}
                            radius={firmaForm.izinVerilenMesafe}
                            onSelect={(lat, lng) => setFirmaForm(p => ({ ...p, firmaLat: lat, firmaLng: lng }))}
                          />
                        </Suspense>
                        {firmaForm.firmaLat === null && (
                          <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg"
                            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <i className="ri-information-line text-xs flex-shrink-0" style={{ color: '#F59E0B' }} />
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Konum seçilmedi — haritaya tıklayarak seçin (isteğe bağlı)</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Sadece QR seçiliyse bilgi */}
                  {firmaForm.ziyaretDogrulama === 'sadece_qr' && (
                    <div className="flex items-start gap-3 p-4 rounded-xl"
                      style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                      <div>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sadece QR Doğrulama</p>
                        <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          Gezici uzman, firmadaki QR kodu tarayarak giriş yapacak. GPS konum doğrulaması uygulanmaz.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {firmaError && (
              <div className="mx-6 mb-3 flex items-start gap-2 p-3 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#dc2626' }}>{firmaError}</p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="flex gap-2">
                <button
                  onClick={() => setFirmaFormTab(t => Math.max(0, t - 1) as 0 | 1 | 2)}
                  disabled={firmaFormTab === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: firmaFormTab === 0 ? 0.35 : 1 }}>
                  <i className="ri-arrow-left-line" /> Geri
                </button>
                {firmaFormTab < 2 && (
                  <button
                    onClick={() => setFirmaFormTab(t => Math.min(2, t + 1) as 0 | 1 | 2)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                    style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
                    İleri <i className="ri-arrow-right-line" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setShowFirmaModal(false); setFirmaFormTab(0); }}
                  className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                  style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; }}>
                  İptal
                </button>
                <button onClick={handleFirmaEkle} disabled={firmaLoading || !firmaForm.ad.trim()}
                  className="whitespace-nowrap flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
                  style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: (firmaLoading || !firmaForm.ad.trim()) ? 0.65 : 1 }}
                  onMouseEnter={e => { if (!firmaLoading && firmaForm.ad.trim()) { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
                  {firmaLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-add-line" />Firma Ekle</>}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
