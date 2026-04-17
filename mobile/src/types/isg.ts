export interface FirmaRow {
  id: string;
  ad?: string;
  durum?: string;
  tehlikeSinifi?: string;
}

export interface PersonelRow {
  id: string;
  adSoyad: string;
  gorev?: string;
  firmaId?: string;
  durum?: string;
}

export interface DashboardSummary {
  firmaCount: number;
  aktifFirmaCount: number;
  personelCount: number;
  aktifPersonelCount: number;
}

export interface MembershipRow {
  organization_id: string;
  role?: string | null;
  osgb_role?: 'osgb_admin' | 'gezici_uzman' | 'isyeri_hekimi' | null;
  active_firm_ids?: string[] | null;
  active_firm_id?: string | null;
}

export interface OrganizationRow {
  id: string;
  name: string;
  org_type?: 'firma' | 'osgb' | null;
}
