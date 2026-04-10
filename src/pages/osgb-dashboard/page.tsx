import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';
import { downloadOsgbReportPdf } from './utils/osgbReportPdf';
import { downloadOsgbReportExcel } from './utils/osgbReportExcel';
import FirmaDetayModal from './components/FirmaDetayModal';
import UzmanDetayModal from './components/UzmanDetayModal';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

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
  active_firm_name: string | null;
}

type Tab = 'dashboard' | 'firmalar' | 'uzmanlar' | 'raporlar';

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
  const { logout, user } = useAuth();
  const { org, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchFirma, setSearchFirma] = useState('');
  const [searchUzman, setSearchUzman] = useState('');

  // Data
  const [altFirmalar, setAltFirmalar] = useState<AltFirma[]>([]);
  const [uzmanlar, setUzmanlar] = useState<Uzman[]>([]);
  const [firmaDetaylar, setFirmaDetaylar] = useState<FirmaDetay[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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
  const [firmaAd, setFirmaAd] = useState('');
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [firmaError, setFirmaError] = useState<string | null>(null);

  // Uzman Ekle Modal
  const [showUzmanModal, setShowUzmanModal] = useState(false);
  const [uzmanForm, setUzmanForm] = useState({ ad: '', email: '', password: '', atananFirmaId: '' });
  const [uzmanLoading, setUzmanLoading] = useState(false);
  const [uzmanError, setUzmanError] = useState<string | null>(null);
  const [showUzmanPw, setShowUzmanPw] = useState(false);

  // ── Veri çek ──
  const fetchData = useCallback(async () => {
    if (!org?.id) return;
    setDataLoading(true);
    try {
      // Alt firmalar (parent_org_id = bu OSGB'nin org id'si)
      const { data: firmData } = await supabase
        .from('organizations')
        .select('id, name, invite_code, created_at')
        .eq('parent_org_id', org.id)
        .eq('org_type', 'firma')
        .order('created_at', { ascending: false });

      // Uzmanlar (osgb_role = 'gezici_uzman' olan user_organizations kayıtları)
      const { data: uzmanData } = await supabase
        .from('user_organizations')
        .select('user_id, display_name, email, is_active, active_firm_id')
        .eq('organization_id', org.id)
        .eq('osgb_role', 'gezici_uzman');

      // Her alt firma için personel, uygunsuzluk, tutanak, eğitim say
      const enrichedFirmalar: AltFirma[] = [];
      const detaylar: FirmaDetay[] = [];

      await Promise.all(
        (firmData ?? []).map(async (f) => {
          const [
            { count: personelCount },
            { count: uygunsuzlukCount },
            { count: kapatılanCount },
            { count: tutanakCount },
            { count: egitimCount },
          ] = await Promise.all([
            supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', f.id),
            supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id).neq('durum', 'Kapatıldı'),
            supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true })
              .eq('organization_id', f.id).eq('durum', 'Kapatıldı'),
            supabase.from('tutanaklar').select('id', { count: 'exact', head: true }).eq('organization_id', f.id),
            supabase.from('egitimler').select('id', { count: 'exact', head: true }).eq('organization_id', f.id),
          ]);

          // Bu firmaya atanmış uzmanı bul
          const atananUzman = (uzmanData ?? []).find(u => u.active_firm_id === f.id);

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
            kapatilan: kapatılanCount ?? 0,
            tutanakSayisi: tutanakCount ?? 0,
            egitimSayisi: egitimCount ?? 0,
          });
        })
      );

      // Sıralama koru (created_at desc)
      enrichedFirmalar.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      detaylar.sort((a, b) => enrichedFirmalar.findIndex(x => x.id === a.id) - enrichedFirmalar.findIndex(x => x.id === b.id));

      // Uzmanlar için aktif firma adını çek
      const enrichedUzmanlar: Uzman[] = await Promise.all(
        (uzmanData ?? []).map(async (u) => {
          let active_firm_name: string | null = null;
          if (u.active_firm_id) {
            const { data: firmRow } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', u.active_firm_id)
              .maybeSingle();
            active_firm_name = firmRow?.name ?? null;
          }
          return { ...u, active_firm_name };
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

  // ── Firma Ekle ──
  const handleFirmaEkle = async () => {
    if (!firmaAd.trim()) { setFirmaError('Firma adı zorunludur.'); return; }
    if (!org?.id) return;
    setFirmaLoading(true);
    setFirmaError(null);
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const inviteCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const { data: newFirma, error } = await supabase
        .from('organizations')
        .insert({
          name: firmaAd.trim(),
          invite_code: inviteCode,
          created_by: user?.id,
          org_type: 'firma',
          parent_org_id: org.id,
        })
        .select()
        .maybeSingle();

      if (error || !newFirma) {
        setFirmaError(error?.message ?? 'Firma oluşturulamadı.');
        return;
      }

      // app_data oluştur
      await supabase.from('app_data').upsert(
        { organization_id: newFirma.id, data: {}, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id' }
      );

      addToast(`${firmaAd.trim()} başarıyla eklendi!`, 'success');
      setShowFirmaModal(false);
      setFirmaAd('');
      await fetchData();
    } catch (err) {
      setFirmaError(String(err));
    } finally {
      setFirmaLoading(false);
    }
  };

  // ── Uzman Ekle ──
  const handleUzmanEkle = async () => {
    if (!uzmanForm.ad.trim()) { setUzmanError('Ad Soyad zorunludur.'); return; }
    if (!uzmanForm.email.trim()) { setUzmanError('E-posta zorunludur.'); return; }
    if (uzmanForm.password.length < 8) { setUzmanError('Şifre en az 8 karakter olmalıdır.'); return; }
    if (!org?.id) return;
    setUzmanLoading(true);
    setUzmanError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setUzmanError('Oturum bulunamadı.'); return; }

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          organization_id: org.id,
          email: uzmanForm.email.trim().toLowerCase(),
          password: uzmanForm.password,
          display_name: uzmanForm.ad.trim(),
          role: 'member',
          osgb_role: 'gezici_uzman',
        }),
      });

      const json = await res.json();
      if (json.error) {
        setUzmanError(json.error);
        return;
      }

      // Atanan firma varsa active_firm_id güncelle
      if (uzmanForm.atananFirmaId && json.user_id) {
        await supabase
          .from('user_organizations')
          .update({ active_firm_id: uzmanForm.atananFirmaId })
          .eq('user_id', json.user_id)
          .eq('organization_id', org.id);
      }

      addToast(`${uzmanForm.ad.trim()} gezici uzman olarak eklendi!`, 'success');
      setShowUzmanModal(false);
      setUzmanForm({ ad: '', email: '', password: '', atananFirmaId: '' });
      await fetchData();
    } catch (err) {
      setUzmanError(String(err));
    } finally {
      setUzmanLoading(false);
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
  const aktifUzman = uzmanlar.filter(u => u.is_active).length;

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

  const inputStyle: React.CSSProperties = {
    background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px',
    color: '#1e293b', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '13px',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#475569',
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* ── SIDEBAR ── */}
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-300"
        style={{
          width: sidebarOpen ? '240px' : '64px',
          background: 'linear-gradient(180deg, #071f14 0%, #0a2e1c 100%)',
          borderRight: '1px solid rgba(16,185,129,0.1)',
          minHeight: '100vh',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(16,185,129,0.08)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: '#e2fbf0' }}>ISG Denetim</p>
              <p className="text-[10px] truncate" style={{ color: '#3a8a60' }}>OSGB Paneli</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(p => !p)}
            className="ml-auto w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
            style={{ color: '#3a8a60' }}>
            <i className={`${sidebarOpen ? 'ri-arrow-left-s-line' : 'ri-arrow-right-s-line'} text-base`} />
          </button>
        </div>

        {sidebarOpen && (
          <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>
            <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#3a8a60' }}>OSGB</p>
            <p className="text-xs font-bold truncate" style={{ color: '#6EE7B7' }}>{org?.name ?? 'OSGB'}</p>
          </div>
        )}

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: activeTab === item.id ? 'rgba(16,185,129,0.15)' : 'transparent',
                border: activeTab === item.id ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
                color: activeTab === item.id ? '#6EE7B7' : '#3a8a60',
              }}>
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className={`${item.icon} text-sm`} />
              </div>
              {sidebarOpen && <span className="text-xs font-semibold">{item.label}</span>}
              {sidebarOpen && activeTab === item.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
              )}
            </button>
          ))}
        </nav>

        <div className="px-2 py-4" style={{ borderTop: '1px solid rgba(16,185,129,0.08)' }}>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer whitespace-nowrap"
            style={{ color: '#ef4444' }}>
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-logout-box-line text-sm" />
            </div>
            {sidebarOpen && <span className="text-xs font-semibold">Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h1 className="text-base font-bold" style={{ color: '#0f172a' }}>
              {activeTab === 'dashboard' ? 'Genel Bakış' : activeTab === 'firmalar' ? 'Müşteri Firmalar' : activeTab === 'uzmanlar' ? 'Gezici Uzmanlar' : 'Raporlar'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
              OSGB Admin
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff' }}>
              {(org?.displayName ?? 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {dataLoading ? (
            <div className="flex items-center justify-center py-20 gap-3" style={{ color: '#94a3b8' }}>
              <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
              <span className="text-sm">Veriler yükleniyor...</span>
            </div>
          ) : (
            <>
              {/* ── DASHBOARD ── */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Müşteri Firma', value: altFirmalar.length, icon: 'ri-building-2-line', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                      { label: 'Toplam Personel', value: totalPersonel, icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
                      { label: 'Açık Uygunsuzluk', value: totalUygunsuzluk, icon: 'ri-alert-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
                      { label: 'Aktif Uzman', value: aktifUzman, icon: 'ri-user-star-line', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
                    ].map(s => (
                      <div key={s.label} className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                          <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
                        </div>
                        <p className="text-2xl font-extrabold mb-1" style={{ color: '#0f172a' }}>{s.value}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Firmalar özet */}
                    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Müşteri Firmalar</h3>
                        <button onClick={() => setActiveTab('firmalar')} className="text-xs font-semibold cursor-pointer" style={{ color: '#059669' }}>
                          Tümünü Gör →
                        </button>
                      </div>
                      {altFirmalar.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                            <i className="ri-building-2-line text-xl" style={{ color: '#10B981' }} />
                          </div>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>Henüz firma eklenmedi</p>
                          <button onClick={() => setShowFirmaModal(true)}
                            className="whitespace-nowrap flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                            <i className="ri-add-line" />Firma Ekle
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {altFirmalar.slice(0, 5).map(f => (
                            <div key={f.id}
                              onClick={() => setSecilenFirma({ id: f.id, name: f.name })}
                              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                              style={{ background: '#f8fafc' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                                <i className="ri-building-2-line text-sm" style={{ color: '#059669' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{f.name}</p>
                                <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                                  {f.uzmanAd ?? 'Uzman atanmadı'} · {f.personelSayisi} personel
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {f.uygunsuzluk > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                    {f.uygunsuzluk}
                                  </span>
                                )}
                                <i className="ri-arrow-right-s-line text-sm" style={{ color: '#cbd5e1' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Uzmanlar özet */}
                    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Gezici Uzmanlar</h3>
                        <button onClick={() => setActiveTab('uzmanlar')} className="text-xs font-semibold cursor-pointer" style={{ color: '#059669' }}>
                          Tümünü Gör →
                        </button>
                      </div>
                      {uzmanlar.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                            <i className="ri-user-star-line text-xl" style={{ color: '#8B5CF6' }} />
                          </div>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>Henüz uzman eklenmedi</p>
                          <button onClick={() => setShowUzmanModal(true)}
                            className="whitespace-nowrap flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                            style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
                            <i className="ri-user-add-line" />Uzman Ekle
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {uzmanlar.slice(0, 5).map(u => (
                            <div key={u.user_id}
                              onClick={() => setSecilenUzman(u)}
                              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                              style={{ background: '#f8fafc' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: u.is_active ? 'linear-gradient(135deg, #10B981, #059669)' : '#94a3b8' }}>
                                {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{u.display_name ?? u.email}</p>
                                <p className="text-[10px] truncate" style={{ color: '#94a3b8' }}>{u.active_firm_name ?? 'Firma atanmadı'}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="w-2 h-2 rounded-full" style={{ background: u.is_active ? '#10B981' : '#94a3b8' }} />
                                <i className="ri-arrow-right-s-line text-sm" style={{ color: '#cbd5e1' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Uyarı Bandı — uzman atanmamış firmalar */}
                  {altFirmalar.filter(f => !f.uzmanAd).length > 0 && (
                    <div className="rounded-2xl p-4 flex items-start gap-4"
                      style={{ background: 'rgba(245,158,11,0.05)', border: '1.5px solid rgba(245,158,11,0.2)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.1)' }}>
                        <i className="ri-alert-line text-base" style={{ color: '#D97706' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: '#92400E' }}>
                          {altFirmalar.filter(f => !f.uzmanAd).length} firmaya uzman atanmadı
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: '#B45309' }}>
                          {altFirmalar.filter(f => !f.uzmanAd).map(f => f.name).join(', ')} — hemen atama yapın.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('firmalar')}
                        className="whitespace-nowrap text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#D97706' }}
                      >
                        Firmalara Git →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── FİRMALAR TAB ── */}
              {activeTab === 'firmalar' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative max-w-sm w-full sm:w-auto">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#94a3b8' }} />
                      <input value={searchFirma} onChange={e => setSearchFirma(e.target.value)}
                        placeholder="Firma ara..." className="text-sm pl-9 pr-4 py-2.5 rounded-xl w-full"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', outline: 'none', color: '#0f172a' }} />
                    </div>
                    <button onClick={() => { setShowFirmaModal(true); setFirmaError(null); setFirmaAd(''); }}
                      className="whitespace-nowrap ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                      <i className="ri-add-line" />Firma Ekle
                    </button>
                  </div>

                  {filteredFirmalar.length === 0 ? (
                    <div className="rounded-2xl p-12 flex flex-col items-center gap-4" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                        <i className="ri-building-2-line text-2xl" style={{ color: '#10B981' }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold mb-1" style={{ color: '#0f172a' }}>Henüz firma eklenmedi</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>Müşteri firmalarınızı ekleyerek ISG süreçlerini yönetmeye başlayın.</p>
                      </div>
                      <button onClick={() => setShowFirmaModal(true)}
                        className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                        <i className="ri-add-line" />İlk Firmayı Ekle
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {['Firma Adı', 'Sorumlu Uzman', 'Personel', 'Uygunsuzluk', 'Eklenme Tarihi', ''].map(h => (
                              <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#94a3b8' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFirmalar.map((f, i) => (
                            <tr key={f.id} style={{ borderBottom: i < filteredFirmalar.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                                    <i className="ri-building-2-line text-xs" style={{ color: '#059669' }} />
                                  </div>
                                  <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{f.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs" style={{ color: f.uzmanAd ? '#64748b' : '#94a3b8' }}>
                                  {f.uzmanAd ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{f.personelSayisi}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{
                                    background: f.uygunsuzluk > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                    color: f.uygunsuzluk > 0 ? '#EF4444' : '#10B981',
                                  }}>
                                  {f.uygunsuzluk}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs" style={{ color: '#94a3b8' }}>
                                  {new Date(f.created_at).toLocaleDateString('tr-TR')}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSecilenFirma({ id: f.id, name: f.name })}
                                  className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}
                                >
                                  <i className="ri-eye-line text-xs" />
                                  Detay
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── UZMANLAR TAB ── */}
              {activeTab === 'uzmanlar' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative max-w-sm w-full sm:w-auto">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#94a3b8' }} />
                      <input value={searchUzman} onChange={e => setSearchUzman(e.target.value)}
                        placeholder="Uzman ara..." className="text-sm pl-9 pr-4 py-2.5 rounded-xl w-full"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', outline: 'none', color: '#0f172a' }} />
                    </div>
                    <button onClick={() => { setShowUzmanModal(true); setUzmanError(null); setUzmanForm({ ad: '', email: '', password: '', atananFirmaId: '' }); }}
                      className="whitespace-nowrap ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                      <i className="ri-user-add-line" />Uzman Ekle
                    </button>
                  </div>

                  {filteredUzmanlar.length === 0 ? (
                    <div className="rounded-2xl p-12 flex flex-col items-center gap-4" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                        <i className="ri-user-star-line text-2xl" style={{ color: '#8B5CF6' }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold mb-1" style={{ color: '#0f172a' }}>Henüz gezici uzman eklenmedi</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>Gezici uzmanlarınızı ekleyip firmalara atayın.</p>
                      </div>
                      <button onClick={() => setShowUzmanModal(true)}
                        className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                        <i className="ri-user-add-line" />İlk Uzmanı Ekle
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredUzmanlar.map(u => (
                        <div key={u.user_id} className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                          <div className="flex items-start gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                              style={{ background: u.is_active ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
                              {(u.display_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate" style={{ color: '#0f172a' }}>{u.display_name}</p>
                              <p className="text-xs truncate" style={{ color: '#94a3b8' }}>{u.email}</p>
                            </div>
                            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                              style={{ background: u.is_active ? '#10B981' : '#94a3b8' }} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                              <i className="ri-building-2-line text-xs" style={{ color: '#059669' }} />
                              <span className="truncate">{u.active_firm_name ?? 'Firma atanmadı'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                              <i className="ri-user-star-line text-xs" style={{ color: '#8B5CF6' }} />
                              <span>Gezici Uzman</span>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #f1f5f9' }}>
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                              style={{
                                background: u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                                color: u.is_active ? '#10B981' : '#94a3b8',
                              }}>
                              {u.is_active ? 'Aktif' : 'Pasif'}
                            </span>
                            <button
                              onClick={() => setSecilenUzman(u)}
                              className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#059669' }}
                            >
                              <i className="ri-settings-3-line text-xs" />
                              Düzenle
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* ── RAPORLAR TAB ── */}
              {activeTab === 'raporlar' && (
                <div className="space-y-5">
                  {/* Filtre bar */}
                  <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Rapor Oluştur</h3>
                        <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Dönem ve firma seçerek PDF veya Excel raporu indirin</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Dönem</label>
                        <input
                          type="month"
                          value={raporDonem}
                          onChange={e => setRaporDonem(e.target.value)}
                          className="text-sm px-3 py-2 rounded-xl"
                          style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#1e293b', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Firma Filtresi</label>
                        <select
                          value={raporFirmaFilter}
                          onChange={e => setRaporFirmaFilter(e.target.value)}
                          className="text-sm px-3 py-2 rounded-xl cursor-pointer"
                          style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#1e293b', outline: 'none', minWidth: '200px' }}
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
                          className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                          style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1.5px solid rgba(239,68,68,0.25)',
                            color: '#DC2626',
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
                          className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                          style={{
                            background: 'rgba(16,185,129,0.08)',
                            border: '1.5px solid rgba(16,185,129,0.25)',
                            color: '#059669',
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
                      { label: 'Seçili Firma', value: filteredRaporFirmalar.length, icon: 'ri-building-2-line', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                      { label: 'Toplam Personel', value: filteredRaporFirmalar.reduce((s, f) => s + f.personelSayisi, 0), icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
                      { label: 'Açık Uygunsuzluk', value: filteredRaporFirmalar.reduce((s, f) => s + f.uygunsuzluk, 0), icon: 'ri-alert-line', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
                      { label: 'Toplam Tutanak', value: filteredRaporFirmalar.reduce((s, f) => s + f.tutanakSayisi, 0), icon: 'ri-file-list-3-line', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
                    ].map(s => (
                      <div key={s.label} className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                          <i className={`${s.icon} text-lg`} style={{ color: s.color }} />
                        </div>
                        <p className="text-2xl font-extrabold mb-1" style={{ color: '#0f172a' }}>{s.value}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Firma detay tablosu */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Firma Detay Tablosu</h3>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                        {donemLabel()}
                      </span>
                    </div>
                    {filteredRaporFirmalar.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                          <i className="ri-file-chart-line text-xl" style={{ color: '#10B981' }} />
                        </div>
                        <p className="text-sm" style={{ color: '#94a3b8' }}>Rapor için firma bulunamadı</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              {['Firma Adı', 'Sorumlu Uzman', 'Personel', 'Açık Uyg.', 'Kapatılan', 'Tutanak', 'Eğitim', 'Kapanma %'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRaporFirmalar.map((f, i) => {
                              const kapanmaOran = f.uygunsuzluk > 0 ? Math.round((f.kapatilan / f.uygunsuzluk) * 100) : 100;
                              const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';
                              const uyColor = f.uygunsuzluk > 5 ? '#DC2626' : f.uygunsuzluk > 2 ? '#D97706' : '#16A34A';
                              const uyBg = f.uygunsuzluk > 5 ? 'rgba(220,38,38,0.08)' : f.uygunsuzluk > 2 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)';
                              return (
                                <tr key={f.id} style={{ background: rowBg, borderTop: '1px solid #f1f5f9' }}>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                                        <i className="ri-building-2-line text-xs" style={{ color: '#059669' }} />
                                      </div>
                                      <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{f.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs" style={{ color: f.uzmanAd ? '#64748b' : '#94a3b8' }}>
                                    {f.uzmanAd ?? '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#0f172a' }}>{f.personelSayisi}</td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: uyBg, color: uyColor }}>
                                      {f.uygunsuzluk}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#16A34A' }}>{f.kapatilan}</td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#6366F1' }}>{f.tutanakSayisi}</td>
                                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#0891B2' }}>{f.egitimSayisi}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0', minWidth: '48px' }}>
                                        <div
                                          className="h-full rounded-full"
                                          style={{ width: `${kapanmaOran}%`, background: kapanmaOran >= 80 ? '#10B981' : kapanmaOran >= 50 ? '#F59E0B' : '#EF4444' }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold flex-shrink-0" style={{ color: kapanmaOran >= 80 ? '#059669' : kapanmaOran >= 50 ? '#D97706' : '#DC2626' }}>
                                        {kapanmaOran}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: '#f0fdf4', borderTop: '2px solid rgba(16,185,129,0.2)' }}>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#0f172a' }}>TOPLAM</td>
                              <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>—</td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#0f172a' }}>
                                {filteredRaporFirmalar.reduce((s, f) => s + f.personelSayisi, 0)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                                  {filteredRaporFirmalar.reduce((s, f) => s + f.uygunsuzluk, 0)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#16A34A' }}>
                                {filteredRaporFirmalar.reduce((s, f) => s + f.kapatilan, 0)}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#6366F1' }}>
                                {filteredRaporFirmalar.reduce((s, f) => s + f.tutanakSayisi, 0)}
                              </td>
                              <td className="px-4 py-3 text-xs font-bold" style={{ color: '#0891B2' }}>
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

      {/* ── FİRMA EKLE MODAL ── */}
      {showFirmaModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setShowFirmaModal(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <i className="ri-building-2-line text-base" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Müşteri Firma Ekle</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>OSGB'nize bağlı yeni firma</p>
                </div>
              </div>
              <button onClick={() => setShowFirmaModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
                <i className="ri-close-line" />
              </button>
            </div>

            <div>
              <label style={labelStyle}>Firma Adı *</label>
              <input value={firmaAd}
                onChange={e => { setFirmaAd(e.target.value); setFirmaError(null); }}
                placeholder="Örn: ABC Tekstil A.Ş."
                style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') handleFirmaEkle(); }}
              />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
              <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>
                Firma eklendikten sonra, firmaya ait kullanıcılar bu firmanın davet kodu ile sisteme katılabilir veya siz gezici uzman atayabilirsiniz.
              </p>
            </div>

            {firmaError && (
              <div className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#dc2626' }}>{firmaError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowFirmaModal(false)}
                className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.1)', color: '#64748b' }}>
                İptal
              </button>
              <button onClick={handleFirmaEkle} disabled={firmaLoading}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: firmaLoading ? 0.7 : 1 }}>
                {firmaLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-add-line" />Firma Ekle</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── FİRMA DETAY MODAL ── */}
      {secilenFirma && org?.id && (
        <FirmaDetayModal
          firmaId={secilenFirma.id}
          firmaAdi={secilenFirma.name}
          orgId={org.id}
          uzmanlar={uzmanlar}
          onClose={() => setSecilenFirma(null)}
          onRefresh={fetchData}
          addToast={addToast}
        />
      )}

      {/* ── UZMAN DETAY MODAL ── */}
      {secilenUzman && org?.id && (
        <UzmanDetayModal
          uzman={secilenUzman}
          orgId={org.id}
          altFirmalar={altFirmalar}
          onClose={() => setSecilenUzman(null)}
          onRefresh={fetchData}
          addToast={addToast}
        />
      )}

      {/* ── UZMAN EKLE MODAL ── */}
      {showUzmanModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setShowUzmanModal(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <i className="ri-user-star-line text-base" style={{ color: '#8B5CF6' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Gezici Uzman Ekle</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>OSGB'nize bağlı yeni uzman</p>
                </div>
              </div>
              <button onClick={() => setShowUzmanModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Ad Soyad *</label>
                <input value={uzmanForm.ad} onChange={e => { setUzmanForm(p => ({ ...p, ad: e.target.value })); setUzmanError(null); }}
                  placeholder="Mehmet Yılmaz" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>E-posta *</label>
                <input type="email" value={uzmanForm.email} onChange={e => { setUzmanForm(p => ({ ...p, email: e.target.value })); setUzmanError(null); }}
                  placeholder="uzman@osgb.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Geçici Şifre *</label>
                <div className="relative">
                  <input type={showUzmanPw ? 'text' : 'password'} value={uzmanForm.password}
                    onChange={e => { setUzmanForm(p => ({ ...p, password: e.target.value })); setUzmanError(null); }}
                    placeholder="En az 8 karakter" style={{ ...inputStyle, paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowUzmanPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center cursor-pointer"
                    style={{ color: '#64748b' }}>
                    <i className={`${showUzmanPw ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>Uzman ilk girişinde şifresini değiştirmeye zorlanacak.</p>
              </div>
              <div>
                <label style={labelStyle}>Atanacak Firma (isteğe bağlı)</label>
                <select value={uzmanForm.atananFirmaId} onChange={e => setUzmanForm(p => ({ ...p, atananFirmaId: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">— Şimdilik atama yapma —</option>
                  {altFirmalar.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {uzmanError && (
              <div className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#ef4444' }} />
                <p className="text-xs" style={{ color: '#dc2626' }}>{uzmanError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowUzmanModal(false)}
                className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.1)', color: '#64748b' }}>
                İptal
              </button>
              <button onClick={handleUzmanEkle} disabled={uzmanLoading}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: uzmanLoading ? 0.7 : 1 }}>
                {uzmanLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-user-add-line" />Uzman Ekle</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
