import {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { useStore, type StoreType } from './useStore';
import { useAuth } from './AuthContext';
import { useOrganization } from '../hooks/useOrganization';
import { logActivity } from '../utils/activityLog';
import { supabase } from '../lib/supabase';
import type { Toast } from '../types';

interface KontrolFormuBildirim {
  id: string;
  ad: string;
  kategori: string;
  sonrakiKontrolTarihi?: string;
  firmaId?: string;
}

export interface Bildirim {
  id: string;
  tip: 'evrak_surecek' | 'evrak_dolmus' | 'ekipman_kontrol' | 'egitim_surecek' | 'saglik_surecek' | 'kontrol_formu_yaklasan' | 'kontrol_formu_gecikti';
  mesaj: string;
  detay: string;
  tarih: string;
  okundu: boolean;
  kalanGun: number;
}

export type Theme = 'dark' | 'light';

export interface OrgInfo {
  id: string;
  name: string;
  invite_code: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  displayName?: string;
  email?: string;
}

// StoreType zaten restoreEgitim, permanentDeleteEgitim, restoreMuayene, permanentDeleteMuayene içeriyor
interface AppContextType extends StoreType {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  activeModule: string;
  setActiveModule: (m: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  quickCreate: string | null;
  setQuickCreate: (v: string | null) => void;
  theme: Theme;
  toggleTheme: () => void;
  bildirimler: Bildirim[];
  okunmamisBildirimSayisi: number;
  bildirimOku: (id: string) => void;
  tumunuOku: () => void;
  org: OrgInfo | null;
  orgLoading: boolean;
  orgError: string | null;
  mustChangePassword: boolean;
  clearMustChangePassword: () => Promise<void>;
  createOrg: (name: string, userId: string) => Promise<{ error: string | null }>;
  joinOrg: (code: string) => Promise<{ error: string | null }>;
  regenerateInviteCode: () => Promise<{ error: string | null; newCode?: string }>;
  refetchOrg: () => Promise<void>;
  logAction: (actionType: string, module: string, recordId: string, recordName?: string, description?: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('isg_theme') as Theme | null;
    return saved === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function getUserDisplayName(user: User | null): string {
  if (!user) return 'Kullanıcı';
  const fullName = user.user_metadata?.full_name as string | undefined;
  if (fullName) return fullName;
  if (user.email) return user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return 'Kullanıcı';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    org: rawOrg,
    loading: orgLoading,
    loadError,
    createOrg,
    joinOrg,
    regenerateInviteCode,
    refetch: refetchOrg,
    autoCreateOrg,
    clearMustChangePassword: clearMustChangePw,
  } = useOrganization(user);

  // Auto-create org when user has no org
  // IMPORTANT: autoCreateOrgRef prevents the effect from re-firing every time
  // autoCreateOrg gets a new reference (which would reset the 500ms timer indefinitely).
  const autoCreateAttemptedRef = useRef<string | null>(null);
  const autoCreateOrgRef = useRef(autoCreateOrg);
  useEffect(() => { autoCreateOrgRef.current = autoCreateOrg; }, [autoCreateOrg]);

  useEffect(() => {
    if (!user || orgLoading || rawOrg) return;
    if (autoCreateAttemptedRef.current === user.id) return;
    autoCreateAttemptedRef.current = user.id;
    const t = setTimeout(() => { autoCreateOrgRef.current(); }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, orgLoading, rawOrg]);

  const org = useMemo<OrgInfo | null>(() => {
    if (!rawOrg) return null;
    return {
      ...rawOrg,
      displayName: rawOrg.displayName || getUserDisplayName(user),
      email: rawOrg.email || user?.email,
    };
  }, [rawOrg, user]);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2);
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Activity logging — writes to Supabase activity_logs table ──
  const orgRef = useRef(org);
  const userRef = useRef(user);
  useEffect(() => { orgRef.current = org; }, [org]);
  useEffect(() => { userRef.current = user; }, [user]);

  const logAction = useCallback((
    actionType: string, module: string, recordId: string,
    recordName?: string, description?: string,
  ) => {
    const currentOrg = orgRef.current;
    const currentUser = userRef.current;
    if (!currentUser || !currentOrg) return;
    logActivity({
      organizationId: currentOrg.id,
      userId: currentUser.id,
      userEmail: currentUser.email ?? '',
      userName: currentOrg.displayName || getUserDisplayName(currentUser),
      userRole: currentOrg.role,
      actionType,
      module,
      recordId,
      recordName,
      description,
    });
  }, []);

  // ── Log user_login once per session ──
  const loginLoggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !org) return;
    if (loginLoggedRef.current === user.id) return;
    loginLoggedRef.current = user.id;
    logActivity({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email ?? '',
      userName: org.displayName || getUserDisplayName(user),
      userRole: org.role,
      actionType: 'user_login',
      module: 'Sistem',
      recordId: user.id,
      description: 'Sisteme giriş yapıldı.',
    });
  }, [user?.id, org?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const addToastRef = useRef(addToast);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  const store = useStore(
    org?.id ?? null,
    logAction,
    useCallback((msg: string) => { addToastRef.current(msg, 'error'); }, []),
    user?.id,
    orgLoading,
    useCallback((module: string) => {
      addToastRef.current(`${module} modülünde başka bir kullanıcı değişiklik yaptı — veriler güncellendi.`, 'info');
    }, []),
  );

  // Persist active module across page refreshes
  const [activeModule, setActiveModuleState] = useState<string>(() => {
    try { return localStorage.getItem('isg_active_module') || 'dashboard'; } catch { return 'dashboard'; }
  });
  const setActiveModule = useCallback((m: string) => {
    setActiveModuleState(m);
    try { localStorage.setItem('isg_active_module', m); } catch { /* ignore */ }
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickCreate, setQuickCreate] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [okunanlar, setOkunanlar] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('isg_okunan_bildirimler');
      return saved ? new Set<string>(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [kontrolFormlar, setKontrolFormlar] = useState<KontrolFormuBildirim[]>([]);

  // Kontrol formlarını Supabase'den çek (bildirim için)
  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    supabase
      .from('kontrol_formlari')
      .select('id, ad, kategori, sonraki_kontrol_tarihi, firma_id')
      .eq('organization_id', org.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setKontrolFormlar(data.map(r => ({
          id: r.id,
          ad: r.ad,
          kategori: r.kategori ?? '',
          sonrakiKontrolTarihi: r.sonraki_kontrol_tarihi ?? undefined,
          firmaId: r.firma_id ?? undefined,
        })));
      });
    return () => { cancelled = true; };
  }, [org?.id]);

  // Sync user info into store's currentUser (including full_name from user_metadata)
  useEffect(() => {
    if (!user) return;
    const metaName = user.user_metadata?.full_name as string | undefined;
    const metaRole = user.user_metadata?.role as string | undefined;
    const resolvedName = metaName || getUserDisplayName(user);
    const needsUpdate =
      store.currentUser.email !== user.email ||
      (resolvedName && store.currentUser.ad !== resolvedName) ||
      (metaRole && store.currentUser.rol !== metaRole);
    if (needsUpdate) {
      store.updateCurrentUser({
        email: user.email,
        ad: resolvedName,
        ...(metaRole ? { rol: metaRole } : {}),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.role]);

  // Theme sync
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
    localStorage.setItem('isg_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const bildirimler = useMemo<Bildirim[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in60 = new Date(today.getTime() + 60 * 86400000);
    const result: Bildirim[] = [];

    // Tarih string'ini güvenli şekilde parse et — geçersizse null döner
    const parseDate = (dateStr: string | null | undefined): Date | null => {
      if (!dateStr || !dateStr.trim()) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    };

    // Sadece geçerli tarih için gün hesapla — geçersizse null döner
    const getDaysRemaining = (dateStr: string | null | undefined): number | null => {
      const d = parseDate(dateStr);
      if (!d) return null;
      return Math.ceil((d.getTime() - today.getTime()) / 86400000);
    };

    // ── Evraklar ──
    store.evraklar.forEach(e => {
      if (e.silinmis) return;
      // Geçerlilik tarihi yoksa veya geçersizse → uyarı üretme
      const d = parseDate(e.gecerlilikTarihi);
      if (!d) return;
      const kalanGun = getDaysRemaining(e.gecerlilikTarihi)!;
      const personel = e.personelId ? store.personeller.find(p => p.id === e.personelId) : null;
      const firma = store.firmalar.find(f => f.id === e.firmaId);
      const detayBase = `${personel ? personel.adSoyad + ' — ' : ''}${firma?.ad || ''}`;

      if (d >= today && d <= in60) {
        result.push({
          id: `evrak_surecek_${e.id}`,
          tip: 'evrak_surecek',
          mesaj: `${e.ad} evrakının süresi yaklaşıyor`,
          detay: `${detayBase}${detayBase ? ' — ' : ''}${kalanGun === 0 ? 'Bugün dolacak!' : `${kalanGun} gün kaldı`}`,
          tarih: e.gecerlilikTarihi!,
          okundu: okunanlar.has(`evrak_surecek_${e.id}`),
          kalanGun,
        });
      } else if (d < today) {
        result.push({
          id: `evrak_dolmus_${e.id}`,
          tip: 'evrak_dolmus',
          mesaj: `${e.ad} evrakının süresi dolmuş`,
          detay: `${detayBase}${detayBase ? ' — ' : ''}${d.toLocaleDateString('tr-TR')} tarihinde doldu`,
          tarih: e.gecerlilikTarihi!,
          okundu: okunanlar.has(`evrak_dolmus_${e.id}`),
          kalanGun,
        });
      }
    });

    // ── Ekipman kontrolleri ──
    store.ekipmanlar.forEach(ek => {
      if (ek.silinmis) return;

      // ⚠️ UYGUN DEĞİL override: tarih hesaplama yapma, anında kritik bildirim üret
      if (ek.durum === 'Uygun Değil') {
        const firma = store.firmalar.find(f => f.id === ek.firmaId);
        result.push({
          id: `ekipman_uygunsuz_${ek.id}`,
          tip: 'ekipman_kontrol',
          mesaj: `${ek.ad} — KRİTİK: Uygun Değil`,
          detay: `${firma?.ad ? firma.ad + ' — ' : ''}Ekipman uygunsuz olarak işaretlendi`,
          tarih: new Date().toISOString().split('T')[0],
          okundu: okunanlar.has(`ekipman_uygunsuz_${ek.id}`),
          kalanGun: -999, // kritik flag
        });
        return; // tarih bazlı kontrol yapma
      }

      const d = parseDate(ek.sonrakiKontrolTarihi);
      if (!d) return; // Kontrol tarihi yoksa → uyarı üretme
      const kalanGun = getDaysRemaining(ek.sonrakiKontrolTarihi)!;
      if (kalanGun < 0 || kalanGun > 60) return;
      const firma = store.firmalar.find(f => f.id === ek.firmaId);
      result.push({
        id: `ekipman_${ek.id}`,
        tip: 'ekipman_kontrol',
        mesaj: `${ek.ad} kontrolü yaklaşıyor`,
        detay: `${firma?.ad ? firma.ad + ' — ' : ''}${kalanGun === 0 ? 'Bugün kontrol edilmeli!' : `${kalanGun} gün kaldı`}`,
        tarih: ek.sonrakiKontrolTarihi,
        okundu: okunanlar.has(`ekipman_${ek.id}`),
        kalanGun,
      });
    });

    // ── Eğitimler ──
    // Sadece gecerlilikSuresi > 0 olan eğitimler hesaplanır.
    // Toolbox, seminer gibi "süresiz" eğitimler (gecerlilikSuresi = 0 veya null) → uyarı üretmez.
    store.egitimler.forEach(eg => {
      if (eg.silinmis) return;
      const egitimTarihi = parseDate(eg.tarih);
      if (!egitimTarihi) return; // Eğitim tarihi geçersizse atla
      const suresi = eg.gecerlilikSuresi ?? 0;
      if (suresi <= 0) return; // Geçerlilik süresi tanımlanmamış → uyarı üretme
      const bitis = new Date(egitimTarihi);
      bitis.setDate(bitis.getDate() + suresi);
      bitis.setHours(0, 0, 0, 0);
      if (isNaN(bitis.getTime())) return; // Hesaplama sonucu geçersizse atla
      const tarihStr = bitis.toISOString().split('T')[0];
      const kalanGun = getDaysRemaining(tarihStr);
      if (kalanGun === null || kalanGun < 0 || kalanGun > 60) return;
      const firma = store.firmalar.find(f => f.id === eg.firmaId);
      result.push({
        id: `egitim_${eg.id}`,
        tip: 'egitim_surecek',
        mesaj: `${eg.ad} eğitiminin geçerlilik süresi yaklaşıyor`,
        detay: `${firma?.ad ? firma.ad + ' — ' : ''}${kalanGun === 0 ? 'Bugün!' : `${kalanGun} gün kaldı`}`,
        tarih: tarihStr,
        okundu: okunanlar.has(`egitim_${eg.id}`),
        kalanGun,
      });
    });

    // ── Sağlık muayeneleri ──
    store.muayeneler.forEach(m => {
      if (m.silinmis) return;
      // sonrakiTarih öncelikli; yoksa muayeneTarihi kullan
      const tarihStr = m.sonrakiTarih || m.muayeneTarihi;
      const d = parseDate(tarihStr);
      if (!d) return; // Geçerli tarih yoksa → uyarı üretme
      const kalanGun = getDaysRemaining(tarihStr)!;
      if (kalanGun < 0 || kalanGun > 60) return;
      const personel = store.personeller.find(p => p.id === m.personelId);
      result.push({
        id: `saglik_${m.id}`,
        tip: 'saglik_surecek',
        mesaj: `${personel?.adSoyad || 'Personel'} muayene tarihi yaklaşıyor`,
        detay: `Periyodik Muayene — ${kalanGun === 0 ? 'Bugün!' : `${kalanGun} gün kaldı`}`,
        tarih: tarihStr!,
        okundu: okunanlar.has(`saglik_${m.id}`),
        kalanGun,
      });
    });

    // ── Kontrol Formları (Supabase) ──
    kontrolFormlar.forEach(f => {
      if (!f.sonrakiKontrolTarihi) return;
      const d = parseDate(f.sonrakiKontrolTarihi);
      if (!d) return;
      const kalanGun = getDaysRemaining(f.sonrakiKontrolTarihi)!;
      const firma = store.firmalar.find(x => x.id === f.firmaId);
      const detay = `${f.kategori}${firma ? ' — ' + firma.ad : ''}`;

      if (kalanGun < 0) {
        result.push({
          id: `kontrol_formu_gecikti_${f.id}`,
          tip: 'kontrol_formu_gecikti',
          mesaj: `${f.ad} kontrolü gecikti`,
          detay: `${detay} — ${Math.abs(kalanGun)} gün gecikti`,
          tarih: f.sonrakiKontrolTarihi,
          okundu: okunanlar.has(`kontrol_formu_gecikti_${f.id}`),
          kalanGun,
        });
      } else if (kalanGun <= 30) {
        result.push({
          id: `kontrol_formu_yaklasan_${f.id}`,
          tip: 'kontrol_formu_yaklasan',
          mesaj: `${f.ad} kontrol tarihi yaklaşıyor`,
          detay: `${detay} — ${kalanGun === 0 ? 'Bugün son gün!' : `${kalanGun} gün kaldı`}`,
          tarih: f.sonrakiKontrolTarihi,
          okundu: okunanlar.has(`kontrol_formu_yaklasan_${f.id}`),
          kalanGun,
        });
      }
    });

    return result.sort((a, b) => a.kalanGun - b.kalanGun);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.evraklar, store.ekipmanlar, store.egitimler, store.muayeneler, store.personeller, store.firmalar, okunanlar, kontrolFormlar]);

  const okunmamisBildirimSayisi = useMemo(
    () => bildirimler.filter(b => !b.okundu).length,
    [bildirimler],
  );

  const bildirimOku = useCallback((id: string) => {
    setOkunanlar(prev => {
      const next = new Set([...prev, id]);
      try { localStorage.setItem('isg_okunan_bildirimler', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const tumunuOku = useCallback(() => {
    const ids = bildirimler.map(b => b.id);
    setOkunanlar(prev => {
      const next = new Set([...prev, ...ids]);
      try { localStorage.setItem('isg_okunan_bildirimler', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [bildirimler]);

  const clearMustChangePassword = useCallback(async () => {
    await clearMustChangePw();
  }, [clearMustChangePw]);

  return (
    <AppContext.Provider value={{
      ...store,
      toasts, addToast, removeToast,
      activeModule, setActiveModule,
      sidebarCollapsed, setSidebarCollapsed,
      quickCreate, setQuickCreate,
      theme, toggleTheme,
      bildirimler, okunmamisBildirimSayisi, bildirimOku, tumunuOku,
      org, orgLoading, orgError: loadError,
      mustChangePassword: org?.mustChangePassword ?? false,
      clearMustChangePassword,
      createOrg,
      joinOrg,
      regenerateInviteCode,
      refetchOrg,
      logAction,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
