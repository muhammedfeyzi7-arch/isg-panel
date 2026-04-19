// ─── Enums ────────────────────────────────────────────────────────────────────
export type MemberRole = 'owner' | 'admin' | 'specialist' | 'doctor';
export type ProfileStatus = 'active' | 'passive';
export type HazardClass = 'Az Tehlikeli' | 'Tehlikeli' | 'Çok Tehlikeli';
export type ContractStatus = 'Aktif' | 'Yenileme Bekliyor' | 'Süresi Dolmuş';
export type VisitStatus = 'active' | 'completed';
export type ReportType = 'firm_report' | 'visit_report';
export type ReportStatus = 'Hazır' | 'İşleniyor' | 'Hata';
export type VerificationType = 'qr' | 'qr_gprs';

// ─── DB Row Types ─────────────────────────────────────────────────────────────

export interface OrganizationRow {
  id: string;
  name: string;
  tax_no: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  auth_no: string | null;
  created_at: string;
}

export type SpecializationClass = 'A' | 'B' | 'C' | 'Tekniker';

export interface ProfileRow {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: MemberRole;
  status: ProfileStatus;
  specialization_class: SpecializationClass | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FirmRow {
  id: string;
  organization_id: string;
  name: string;
  authorized_person: string | null;
  phone: string | null;
  email: string | null;
  sector: string | null;
  employee_count: number;
  hazard_class: HazardClass;
  contract_status: ContractStatus;
  contract_start: string | null;
  contract_end: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  verification_type: VerificationType;
  qr_token: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FirmAssignmentRow {
  id: string;
  organization_id: string;
  firm_id: string;
  personnel_id: string;
  created_at: string;
  firm?: FirmRow;
  personnel?: ProfileRow;
}

export interface VisitRow {
  id: string;
  organization_id: string;
  personnel_id: string | null; // SET NULL when personnel hard-deleted
  firm_id: string | null;      // SET NULL when firm hard-deleted
  visit_date: string;
  check_in: string;
  check_out: string | null;
  duration_minutes: number | null;
  status: VisitStatus;
  notes: string | null;
  verification_type: VerificationType | null;
  location_verified: boolean;
  started_via_qr: boolean;
  ended_via_qr: boolean;
  created_at: string;
  updated_at: string;
  personnel?: ProfileRow;
  firm?: FirmRow;
}

export interface ReportRow {
  id: string;
  organization_id: string;
  created_by: string;
  type: ReportType;
  title: string;
  description: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  creator?: ProfileRow;
}

// ─── App-level types (UI) ─────────────────────────────────────────────────────

export interface AppFirm {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  sector: string;
  employeeCount: number;
  dangerClass: HazardClass;
  contractStatus: ContractStatus;
  contractStart: string;
  contractEnd: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  lastVisit: string;
  verificationType: VerificationType;
  qrToken: string | null;
}

export interface AppPersonnel {
  id: string;
  name: string;
  role: MemberRole;
  phone: string;
  email: string;
  specialization: string;
  specializationClass: SpecializationClass | null;
  certNo: string;
  assignedFirms: number;
  status: ProfileStatus;
  assignedFirmList: string[];
  recentVisits: { firm: string; date: string; duration: string }[];
}

export interface AppVisit {
  id: string;
  personnel: string;
  personnelId: string; // '' when personnel hard-deleted
  role: string;
  firm: string;
  firmId: string; // '' when firm hard-deleted
  date: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: VisitStatus;
  notes: string;
  verificationType: VerificationType | null;
  locationVerified: boolean;
  startedViaQr: boolean;
  endedViaQr: boolean;
}

export interface AppReport {
  id: string;
  name: string;
  createdAt: string;
  status: ReportStatus;
  type: ReportType;
  createdBy: string;
}

export interface AppProfile {
  id: string;
  organizationId: string;
  fullName: string;
  email: string;
  phone: string;
  role: MemberRole;
  status: ProfileStatus;
}

// ─── Auth Session ─────────────────────────────────────────────────────────────

export interface AuthSession {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: MemberRole;
  fullName: string;
  status: ProfileStatus;
}

// ─── Supabase Database generic type ──────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: Omit<OrganizationRow, 'id' | 'created_at'>;
        Update: Partial<Omit<OrganizationRow, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      firms: {
        Row: FirmRow;
        Insert: Omit<FirmRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FirmRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      firm_assignments: {
        Row: FirmAssignmentRow;
        Insert: Omit<FirmAssignmentRow, 'id' | 'created_at' | 'firm' | 'personnel'>;
        Update: Partial<Omit<FirmAssignmentRow, 'id' | 'created_at' | 'firm' | 'personnel'>>;
      };
      visits: {
        Row: VisitRow;
        Insert: Omit<VisitRow, 'id' | 'created_at' | 'updated_at' | 'personnel' | 'firm'>;
        Update: Partial<Omit<VisitRow, 'id' | 'created_at' | 'updated_at' | 'personnel' | 'firm'>>;
      };
      activity_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          meta: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          meta?: Record<string, unknown> | null;
        };
        Update: never;
      };
      reports: {
        Row: ReportRow;
        Insert: Omit<ReportRow, 'id' | 'created_at' | 'updated_at' | 'creator'>;
        Update: Partial<Omit<ReportRow, 'id' | 'created_at' | 'updated_at' | 'creator'>>;
      };
    };
  };
}
