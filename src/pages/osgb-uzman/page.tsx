import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useApp } from '../../store/AppContext';
import { supabase } from '../../lib/supabase';

const LOGO_URL =
  'https://storage.readdy-site.link/project_files/5dfc0b51-b8fd-486b-9fb6-3ee0a4ec64fa/af923cef-5f87-4a0b-a5c4-17416187a328_ChatGPT-Image-3-Nis-2026-00_04_32.png?v=fb25bed443ccb679f0c66aa2ced3a518';

interface AltFirma {
  id: string;
  name: string;
}

interface FirmaStats {
  personelSayisi: number;
  uygunsuzluk: number;
  tutanak: number;
  evrak: number;
}

type Tab = 'ozet' | 'uygunsuzluklar' | 'tutanaklar' | 'personeller';

interface UygunsuzlukRow {
  id: string;
  baslik?: string;
  durum?: string;
  created_at: string;
}

interface TutanakRow {
  id: string;
  baslik?: string;
  tarih?: string;
  created_at: string;
}

interface PersonelRow {
  id: string;
  adSoyad?: string;
  unvan?: string;
}

export default function OsgbUzmanPage() {
  const { logout, user } = useAuth();
  const { org, addToast } = useApp();

  const [atananFirmalar, setAtananFirmalar] = useState<AltFirma[]>([]);
  const [aktiveFirmaId, setAktiveFirmaId] = useState<string | null>(null);
  const [firmaStats, setFirmaStats] = useState<FirmaStats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ozet');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [firmaSecModalOpen, setFirmaSecModalOpen] = useState(false);

  // Detail data
  const [uygunsuzluklar, setUygunsuzluklar] = useState<UygunsuzlukRow[]>([]);
  const [tutanaklar, setTutanaklar] = useState<TutanakRow[]>([]);
  const [personeller, setPersoneller] = useState<PersonelRow[]>([]);

  // ── Uzmanın atandığı firmaları çek ──
  const fetchAtananFirmalar = useCallback(async () => {
    if (!user || !org?.id) return;
    setLoading(true);
    try {
      // Bu uzmanın user_organizations kaydını al
      const { data: uoData } = await supabase
        .from('user_organizations')
        .select('active_firm_id')
        .eq('user_id', user.id)
        .eq('organization_id', org.id)
        .maybeSingle();

      // OSGB'ye bağlı tüm alt firmaları al (uzman hepsine erişebilir veya sadece active_firm_id'ye)
      const { data: firmData } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('parent_org_id', org.id)
        .eq('org_type', 'firma')
        .order('name');

      const firms = firmData ?? [];
      setAtananFirmalar(firms);

      // Aktif firma: önce active_firm_id, yoksa ilk firma
      const activeId = uoData?.active_firm_id ?? (firms.length > 0 ? firms[0].id : null);
      setAktiveFirmaId(activeId);
    } catch (err) {
      console.error('[UZMAN] fetchAtananFirmalar error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, org?.id]);

  useEffect(() => {
    fetchAtananFirmalar();
  }, [fetchAtananFirmalar]);

  // ── Aktif firma istatistiklerini çek ──
  const fetchFirmaStats = useCallback(async (firmaId: string) => {
    setStatsLoading(true);
    try {
      const [
        { count: personelCount },
        { count: uygunsuzlukCount },
        { count: tutanakCount },
        { count: evrakCount },
      ] = await Promise.all([
        supabase.from('personeller').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
        supabase.from('uygunsuzluklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId).neq('durum', 'Kapatıldı'),
        supabase.from('tutanaklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
        supabase.from('evraklar').select('id', { count: 'exact', head: true }).eq('organization_id', firmaId),
      ]);

      setFirmaStats({
        personelSayisi: personelCount ?? 0,
        uygunsuzluk: uygunsuzlukCount ?? 0,
        tutanak: tutanakCount ?? 0,
        evrak: evrakCount ?? 0,
      });

      // Detail verilerini de çek
      const [{ data: uData }, { data: tData }, { data: pData }] = await Promise.all([
        supabase.from('uygunsuzluklar').select('id, data').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(10),
        supabase.from('tutanaklar').select('id, data, created_at').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(10),
        supabase.from('personeller').select('id, data').eq('organization_id', firmaId).order('created_at', { ascending: false }).limit(20),
      ]);

      setUygunsuzluklar((uData ?? []).map((u: { id: string; data?: Record<string, unknown> }) => ({
        id: u.id,
        baslik: (u.data?.baslik as string) || (u.data?.konu as string) || 'Uygunsuzluk',
        durum: (u.data?.durum as string) || 'Açık',
        created_at: (u.data?.tarih as string) || new Date().toISOString(),
      })));

      setTutanaklar((tData ?? []).map((t: { id: string; data?: Record<string, unknown>; created_at: string }) => ({
        id: t.id,
        baslik: (t.data?.baslik as string) || (t.data?.konu as string) || 'Tutanak',
        tarih: (t.data?.tarih as string) || t.created_at,
        created_at: t.created_at,
      })));

      setPersoneller((pData ?? []).map((p: { id: string; data?: Record<string, unknown> }) => ({
        id: p.id,
        adSoyad: (p.data?.adSoyad as string) || (p.data?.ad as string) || 'Personel',
        unvan: (p.data?.unvan as string) || (p.data?.pozisyon as string) || '',
      })));
    } catch (err) {
      console.error('[UZMAN] fetchFirmaStats error:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (aktiveFirmaId) {
      fetchFirmaStats(aktiveFirmaId);
      setActiveTab('ozet');
    }
  }, [aktiveFirmaId, fetchFirmaStats]);

  // ── Firma değiştir ──
  const handleFirmaChange = async (firmaId: string) => {
    if (!user || !org?.id) return;
    setAktiveFirmaId(firmaId);
    setFirmaSecModalOpen(false);
    addToast('Aktif firma değiştirildi', 'success');
    // DB'ye kaydet
    await supabase
      .from('user_organizations')
      .update({ active_firm_id: firmaId })
      .eq('user_id', user.id)
      .eq('organization_id', org.id);
  };

  const aktiveFirma = atananFirmalar.find(f => f.id === aktiveFirmaId);

  const navTabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'ozet', icon: 'ri-dashboard-line', label: 'Özet' },
    { id: 'uygunsuzluklar', icon: 'ri-alert-line', label: 'Uygunsuzluklar' },
    { id: 'tutanaklar', icon: 'ri-file-list-3-line', label: 'Tutanaklar' },
    { id: 'personeller', icon: 'ri-group-line', label: 'Personeller' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="flex items-center gap-3" style={{ color: '#94a3b8' }}>
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
          <span className="text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (atananFirmalar.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(16,185,129,0.08)' }}>
            <i className="ri-building-2-line text-3xl" style={{ color: '#10B981' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#0f172a' }}>Henüz firma atanmadı</h2>
          <p className="text-sm mb-6" style={{ color: '#64748b' }}>
            OSGB admininiz size bir müşteri firma ataması yapana kadar bekleyin.
          </p>
          <button onClick={logout}
            className="whitespace-nowrap flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold cursor-pointer mx-auto"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <i className="ri-logout-box-line" />Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');`}</style>

      {/* ── TOPBAR ── */}
      <header className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #071f14 0%, #0a2e1c 100%)', borderBottom: '1px solid rgba(16,185,129,0.1)' }}>

        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <img src={LOGO_URL} alt="ISG" className="w-6 h-6 object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: '#e2fbf0' }}>ISG Denetim — Gezici Uzman</p>
          <p className="text-[10px]" style={{ color: '#3a8a60' }}>{org?.name ?? 'OSGB'}</p>
        </div>

        {/* Firma seçici */}
        <button
          onClick={() => setFirmaSecModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <i className="ri-building-2-line text-sm" style={{ color: '#6EE7B7' }} />
          <span className="text-xs font-semibold truncate max-w-[140px]" style={{ color: '#6EE7B7' }}>
            {aktiveFirma?.name ?? 'Firma Seç'}
          </span>
          <i className="ri-arrow-down-s-line text-sm" style={{ color: '#3a8a60' }} />
        </button>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
            {(org?.displayName ?? 'U').charAt(0).toUpperCase()}
          </div>
          {org?.displayName && (
            <span className="text-xs font-semibold hidden md:block" style={{ color: '#6EE7B7' }}>{org.displayName}</span>
          )}
        </div>

        <button onClick={logout}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{ color: '#ef4444' }}>
          <i className="ri-logout-box-line text-sm" />
        </button>
      </header>

      {/* ── TABS ── */}
      <div className="flex items-center gap-1 px-6 py-3 flex-shrink-0 overflow-x-auto"
        style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
        {navTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            style={{
              background: activeTab === tab.id ? 'rgba(16,185,129,0.1)' : 'transparent',
              color: activeTab === tab.id ? '#059669' : '#94a3b8',
              border: activeTab === tab.id ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
            }}>
            <i className={`${tab.icon} text-xs`} />
            {tab.label}
          </button>
        ))}
        <div className="ml-auto text-xs font-semibold" style={{ color: '#64748b' }}>
          <i className="ri-building-2-line mr-1" style={{ color: '#10B981' }} />
          {aktiveFirma?.name}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-auto p-6">
        {statsLoading ? (
          <div className="flex items-center justify-center py-20 gap-3" style={{ color: '#94a3b8' }}>
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#10B981' }} />
            <span className="text-sm">Firma verisi yükleniyor...</span>
          </div>
        ) : (
          <>
            {/* ── ÖZET ── */}
            {activeTab === 'ozet' && firmaStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Personel', value: firmaStats.personelSayisi, icon: 'ri-group-line', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)' },
                    { label: 'Açık Uygunsuzluk', value: firmaStats.uygunsuzluk, icon: 'ri-alert-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
                    { label: 'Tutanak', value: firmaStats.tutanak, icon: 'ri-file-list-3-line', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                    { label: 'Evrak', value: firmaStats.evrak, icon: 'ri-folder-line', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
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

                {/* Son uygunsuzluklar */}
                {uygunsuzluklar.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Son Uygunsuzluklar</h3>
                      <button onClick={() => setActiveTab('uygunsuzluklar')} className="text-xs font-semibold cursor-pointer" style={{ color: '#059669' }}>Tümünü Gör →</button>
                    </div>
                    <div className="space-y-2">
                      {uygunsuzluklar.slice(0, 3).map(u => (
                        <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                          <i className="ri-alert-line text-sm flex-shrink-0" style={{ color: '#F59E0B' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{u.baslik}</p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>{u.durum}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── UYGUNSUZLUKLAR ── */}
            {activeTab === 'uygunsuzluklar' && (
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>
                    {aktiveFirma?.name} — Uygunsuzluklar
                  </h3>
                </div>
                {uygunsuzluklar.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <i className="ri-checkbox-circle-line text-3xl" style={{ color: '#10B981' }} />
                    <p className="text-sm" style={{ color: '#94a3b8' }}>Açık uygunsuzluk bulunmuyor</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                    {uygunsuzluklar.map(u => (
                      <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                        <i className="ri-alert-line flex-shrink-0" style={{ color: '#F59E0B' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{u.baslik}</p>
                          <p className="text-[10px]" style={{ color: '#94a3b8' }}>{new Date(u.created_at).toLocaleDateString('tr-TR')}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>{u.durum}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TUTANAKLAR ── */}
            {activeTab === 'tutanaklar' && (
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>
                    {aktiveFirma?.name} — Tutanaklar
                  </h3>
                </div>
                {tutanaklar.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <i className="ri-file-list-3-line text-3xl" style={{ color: '#94a3b8' }} />
                    <p className="text-sm" style={{ color: '#94a3b8' }}>Henüz tutanak bulunmuyor</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                    {tutanaklar.map(t => (
                      <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                        <i className="ri-file-list-3-line flex-shrink-0" style={{ color: '#10B981' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{t.baslik}</p>
                          <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                            {t.tarih ? new Date(t.tarih).toLocaleDateString('tr-TR') : new Date(t.created_at).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PERSONELLER ── */}
            {activeTab === 'personeller' && (
              <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid #f1f5f9' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>
                    {aktiveFirma?.name} — Personeller ({personeller.length})
                  </h3>
                </div>
                {personeller.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <i className="ri-group-line text-3xl" style={{ color: '#94a3b8' }} />
                    <p className="text-sm" style={{ color: '#94a3b8' }}>Henüz personel bulunmuyor</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: '#f8fafc' }}>
                    {personeller.map(p => (
                      <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)' }}>
                          {(p.adSoyad ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#0f172a' }}>{p.adSoyad}</p>
                          {p.unvan && <p className="text-[10px]" style={{ color: '#94a3b8' }}>{p.unvan}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FİRMA SEÇİM MODAL ── */}
      {firmaSecModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setFirmaSecModalOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>Firma Seç</h3>
              <button onClick={() => setFirmaSecModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="space-y-2">
              {atananFirmalar.map(f => (
                <button key={f.id} onClick={() => handleFirmaChange(f.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left"
                  style={{
                    background: f.id === aktiveFirmaId ? 'rgba(16,185,129,0.1)' : '#f8fafc',
                    border: f.id === aktiveFirmaId ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                  }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.1)' }}>
                    <i className="ri-building-2-line text-sm" style={{ color: '#059669' }} />
                  </div>
                  <span className="text-xs font-semibold flex-1" style={{ color: '#0f172a' }}>{f.name}</span>
                  {f.id === aktiveFirmaId && (
                    <i className="ri-checkbox-circle-fill text-sm flex-shrink-0" style={{ color: '#10B981' }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
