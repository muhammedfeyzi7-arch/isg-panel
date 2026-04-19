import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as firmSvc from '@/services/firmService';
import * as personnelSvc from '@/services/personnelService';
import * as visitSvc from '@/services/visitService';
import * as reportSvc from '@/services/reportService';
import type { AppFirm, AppPersonnel, AppVisit, AppReport, HazardClass, VisitStatus, ReportType } from '@/types/database';

let _idCounter = 1;
const genId = () => String(Date.now()) + String(_idCounter++);

export type ToastType = 'success' | 'error' | 'info';
export interface Toast { id: string; message: string; type: ToastType }

// ─── Session info — tek obje, race condition yok ──────────────────────────────
interface SessionInfo {
  organizationId: string;
  userId: string;
  role: string;
}

interface AppContextValue {
  firms: AppFirm[];
  personnel: AppPersonnel[];
  visits: AppVisit[];
  reports: AppReport[];
  loading: boolean;
  error: string | null;

  // Session (tek obje)
  organizationId: string | null;
  userId: string | null;
  userRole: string | null;
  setSessionInfo: (orgId: string, userId: string, role: string) => void;

  addFirm: (firm: Omit<AppFirm, 'id' | 'lastVisit'>) => Promise<void>;
  updateFirm: (id: string, data: Partial<AppFirm>) => Promise<void>;
  deleteFirm: (id: string) => Promise<void>;
  softDeleteFirm: (id: string) => Promise<void>;
  softDeletePersonnel: (id: string) => Promise<void>;
  updatePersonnel: (id: string, data: Partial<AppPersonnel>) => Promise<void>;

  addVisit: (v: { personnelId: string; firmId: string; date: string; startTime: string; notes?: string }) => Promise<void>;
  updateVisit: (id: string, data: Partial<AppVisit>) => Promise<void>;
  endVisit: (id: string, checkIn: string, checkOut: string) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;

  addReport: (r: { name: string; type: ReportType; description?: string }) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;

  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;

  refresh: (organizationId: string, userId?: string, role?: string) => Promise<void>;
  refreshFirms: () => Promise<void>;
  refreshPersonnel: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [firms, setFirms] = useState<AppFirm[]>([]);
  const [personnel, setPersonnel] = useState<AppPersonnel[]>([]);
  const [visits, setVisits] = useState<AppVisit[]>([]);
  const [reports, setReports] = useState<AppReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ─── Tek obje — race condition yok ───────────────────────────────────────
  const [sessionInfo, setSessionInfoState] = useState<SessionInfo | null>(null);
  const sessionInfoRef = useRef<SessionInfo | null>(null);

  const configured = isSupabaseConfigured();

  // Tek setState çağrısı — üç ayrı state yerine tek obje
  const setSessionInfo = useCallback((orgId: string, uid: string, role: string) => {
    const info: SessionInfo = { organizationId: orgId, userId: uid, role };
    sessionInfoRef.current = info;
    setSessionInfoState(info);
  }, []);

  // sessionInfo hazır olunca refresh tetikle
  useEffect(() => {
    if (sessionInfo && configured) {
      refresh(sessionInfo.organizationId, sessionInfo.userId, sessionInfo.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo?.organizationId, sessionInfo?.userId, sessionInfo?.role, configured]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = genId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Refresh ────────────────────────────────────────────────────────────────
  const refresh = useCallback(async (orgId: string, uid?: string, role?: string) => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const isAdmin = role === 'owner' || role === 'admin';
      const [f, p, v, r] = await Promise.all([
        isAdmin ? firmSvc.getFirms(orgId) : (uid ? firmSvc.getAssignedFirms(uid) : Promise.resolve([])),
        personnelSvc.getPersonnel(orgId),
        isAdmin ? visitSvc.getVisits(orgId) : (uid ? visitSvc.getMyVisits(uid) : Promise.resolve([])),
        isAdmin ? reportSvc.getReports(orgId) : (uid ? reportSvc.getMyReports(uid) : Promise.resolve([])),
      ]);
      setFirms(f);
      setPersonnel(p);
      setVisits(v);
      setReports(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [configured]);

  // ── Firms ──────────────────────────────────────────────────────────────────
  const addFirm = useCallback(async (firm: Omit<AppFirm, 'id' | 'lastVisit'>) => {
    const orgId = sessionInfoRef.current?.organizationId;
    if (configured && orgId) {
      const created = await firmSvc.createFirm(orgId, {
        name: firm.name, contact: firm.contact, phone: firm.phone, email: firm.email,
        sector: firm.sector, employeeCount: firm.employeeCount,
        dangerClass: firm.dangerClass as HazardClass,
        contractStart: firm.contractStart, contractEnd: firm.contractEnd, address: firm.address,
        latitude: firm.latitude, longitude: firm.longitude,
        verificationType: firm.verificationType,
      });
      setFirms((prev) => [created, ...prev]);
    } else {
      setFirms((prev) => [{ id: genId(), lastVisit: '—', ...firm }, ...prev]);
    }
  }, [configured]);

  const updateFirm = useCallback(async (id: string, data: Partial<AppFirm>) => {
    if (configured) {
      const updated = await firmSvc.updateFirm(id, data);
      setFirms((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } else {
      setFirms((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));
    }
  }, [configured]);

  const deleteFirm = useCallback(async (id: string) => {
    if (configured) await firmSvc.deleteFirm(id);
    setFirms((prev) => prev.filter((f) => f.id !== id));
  }, [configured]);

  const softDeleteFirm = useCallback(async (id: string) => {
    if (configured) await firmSvc.softDeleteFirm(id);
    setFirms((prev) => prev.filter((f) => f.id !== id));
  }, [configured]);

  const softDeletePersonnel = useCallback(async (id: string) => {
    if (configured) await personnelSvc.softDeletePersonnel(id);
    setPersonnel((prev) => prev.filter((p) => p.id !== id));
  }, [configured]);

  const refreshFirms = useCallback(async () => {
    const info = sessionInfoRef.current;
    if (!configured || !info) return;
    try {
      const isAdmin = info.role === 'owner' || info.role === 'admin';
      const f = isAdmin
        ? await firmSvc.getFirms(info.organizationId)
        : await firmSvc.getAssignedFirms(info.userId);
      setFirms(f);
    } catch { /* silent */ }
  }, [configured]);

  const refreshPersonnel = useCallback(async () => {
    const info = sessionInfoRef.current;
    if (!configured || !info) return;
    try {
      const p = await personnelSvc.getPersonnel(info.organizationId);
      setPersonnel(p);
    } catch { /* silent */ }
  }, [configured]);

  // ── Personnel ──────────────────────────────────────────────────────────────
  const updatePersonnel = useCallback(async (id: string, data: Partial<AppPersonnel>) => {
    if (configured) {
      const updated = await personnelSvc.updatePersonnel(id, data);
      setPersonnel((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    } else {
      setPersonnel((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    }
  }, [configured]);

  // ── Visits ─────────────────────────────────────────────────────────────────
  const addVisit = useCallback(async (v: { personnelId: string; firmId: string; date: string; startTime: string; notes?: string }) => {
    const info = sessionInfoRef.current;
    if (configured && info) {
      const created = await visitSvc.createVisit(info.organizationId, v);
      setVisits((prev) => [created, ...prev]);
    } else {
      const person = personnel.find((p) => p.id === v.personnelId);
      const firm = firms.find((f) => f.id === v.firmId);
      setVisits((prev) => [{
        id: genId(), personnelId: v.personnelId,
        personnel: person?.name ?? '—', role: person?.role === 'doctor' ? 'Hekim' : 'Uzman',
        firmId: v.firmId, firm: firm?.name ?? '—',
        date: v.date, startTime: v.startTime, endTime: '', duration: '—',
        status: 'active' as VisitStatus, notes: v.notes ?? '',
        verificationType: null, locationVerified: false, startedViaQr: false, endedViaQr: false,
      }, ...prev]);
    }
  }, [configured, personnel, firms]);

  const updateVisit = useCallback(async (id: string, data: Partial<AppVisit>) => {
    if (configured) {
      const updated = await visitSvc.updateVisit(id, { status: data.status, notes: data.notes });
      setVisits((prev) => prev.map((v) => (v.id === id ? updated : v)));
    } else {
      setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, ...data } : v)));
    }
  }, [configured]);

  const endVisit = useCallback(async (id: string, checkIn: string, checkOut: string) => {
    if (configured) {
      const updated = await visitSvc.endVisit(id, checkIn, checkOut);
      setVisits((prev) => prev.map((v) => (v.id === id ? updated : v)));
    } else {
      const [sh, sm] = checkIn.split(':').map(Number);
      const [eh, em] = checkOut.split(':').map(Number);
      const diffMin = (eh * 60 + em) - (sh * 60 + sm);
      const duration = diffMin > 0 ? `${Math.floor(diffMin / 60)}s ${diffMin % 60}dk` : '—';
      setVisits((prev) => prev.map((v) => v.id === id
        ? { ...v, endTime: checkOut, duration, status: 'completed' as VisitStatus }
        : v));
    }
  }, [configured]);

  const deleteVisit = useCallback(async (id: string) => {
    if (configured) await visitSvc.deleteVisit(id);
    setVisits((prev) => prev.filter((v) => v.id !== id));
  }, [configured]);

  // ── Reports ────────────────────────────────────────────────────────────────
  const addReport = useCallback(async (r: { name: string; type: ReportType; description?: string }) => {
    const info = sessionInfoRef.current;
    if (configured && info) {
      const created = await reportSvc.createReport(info.organizationId, info.userId, {
        title: r.name, type: r.type, description: r.description,
      });
      setReports((prev) => [created, ...prev]);
    } else {
      const today = new Date().toLocaleDateString('tr-TR');
      setReports((prev) => [{
        id: genId(), name: r.name, createdAt: today,
        status: 'Hazır', type: r.type, createdBy: '—',
      }, ...prev]);
    }
  }, [configured]);

  const deleteReport = useCallback(async (id: string) => {
    if (configured) await reportSvc.deleteReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, [configured]);

  return (
    <AppContext.Provider value={{
      firms, personnel, visits, reports, loading, error,
      organizationId: sessionInfo?.organizationId ?? null,
      userId: sessionInfo?.userId ?? null,
      userRole: sessionInfo?.role ?? null,
      setSessionInfo,
      addFirm, updateFirm, deleteFirm, softDeleteFirm, softDeletePersonnel,
      updatePersonnel,
      addVisit, updateVisit, endVisit, deleteVisit,
      addReport, deleteReport,
      toasts, showToast, dismissToast,
      refresh, refreshFirms, refreshPersonnel,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
