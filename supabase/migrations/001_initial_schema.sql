-- ═══════════════════════════════════════════════════════════════════════════
-- OSGB SaaS — Full Schema + RLS
-- Supabase SQL Editor'a yapıştırarak çalıştırın
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE member_role AS ENUM ('owner','admin','specialist','doctor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE profile_status AS ENUM ('active','passive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE hazard_class AS ENUM ('Az Tehlikeli','Tehlikeli','Çok Tehlikeli'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contract_status AS ENUM ('Aktif','Yenileme Bekliyor','Süresi Dolmuş'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE visit_status AS ENUM ('active','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_type AS ENUM ('firm_report','visit_report'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_status AS ENUM ('Hazır','İşleniyor','Hata'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  tax_no     text,
  phone      text,
  email      text,
  address    text,
  website    text,
  auth_no    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── PROFILES (replaces organization_members + old profiles) ─────────────────
-- profiles.id = auth.users.id
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  email           text NOT NULL,
  phone           text,
  role            member_role NOT NULL DEFAULT 'specialist',
  status          profile_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── FIRMS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  authorized_person text,
  phone             text,
  email             text,
  sector            text,
  employee_count    integer DEFAULT 0,
  hazard_class      hazard_class NOT NULL DEFAULT 'Az Tehlikeli',
  contract_status   contract_status NOT NULL DEFAULT 'Aktif',
  contract_start    date,
  contract_end      date,
  address           text,
  latitude          double precision,
  longitude         double precision,
  status            text NOT NULL DEFAULT 'Aktif',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── FIRM ASSIGNMENTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firm_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  firm_id         uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  personnel_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(firm_id, personnel_id)
);

-- ─── VISITS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  personnel_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  firm_id          uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  visit_date       date NOT NULL DEFAULT CURRENT_DATE,
  check_in         time NOT NULL,
  check_out        time,
  duration_minutes integer,
  status           visit_status NOT NULL DEFAULT 'active',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── REPORTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            report_type NOT NULL,
  title           text NOT NULL,
  description     text,
  status          report_status NOT NULL DEFAULT 'Hazır',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── updated_at TRIGGERS ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at   BEFORE UPDATE ON profiles   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER firms_updated_at       BEFORE UPDATE ON firms       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER visits_updated_at      BEFORE UPDATE ON visits      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER reports_updated_at     BEFORE UPDATE ON reports     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE firms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports          ENABLE ROW LEVEL SECURITY;

-- ─── Helper functions ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION my_org_id() RETURNS uuid AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION my_role() RETURNS member_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT role IN ('owner','admin') FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
CREATE POLICY "org_select" ON organizations FOR SELECT USING (id = my_org_id());
CREATE POLICY "org_update" ON organizations FOR UPDATE USING (id = my_org_id() AND is_admin());

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
-- Admin: tüm org üyelerini görür; user: sadece kendini
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  organization_id = my_org_id()
);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE USING (
  organization_id = my_org_id() AND is_admin()
);

-- ─── FIRMS ────────────────────────────────────────────────────────────────────
-- Admin: tüm firmalar; specialist/doctor: sadece atandıkları
CREATE POLICY "firms_select_admin" ON firms FOR SELECT USING (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "firms_select_personnel" ON firms FOR SELECT USING (
  organization_id = my_org_id() AND
  id IN (SELECT firm_id FROM firm_assignments WHERE personnel_id = auth.uid())
);
CREATE POLICY "firms_insert" ON firms FOR INSERT WITH CHECK (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "firms_update" ON firms FOR UPDATE USING (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "firms_delete" ON firms FOR DELETE USING (
  organization_id = my_org_id() AND is_admin()
);

-- ─── FIRM ASSIGNMENTS ─────────────────────────────────────────────────────────
CREATE POLICY "fa_select_admin" ON firm_assignments FOR SELECT USING (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "fa_select_own" ON firm_assignments FOR SELECT USING (
  personnel_id = auth.uid()
);
CREATE POLICY "fa_insert" ON firm_assignments FOR INSERT WITH CHECK (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "fa_delete" ON firm_assignments FOR DELETE USING (
  organization_id = my_org_id() AND is_admin()
);

-- ─── VISITS ───────────────────────────────────────────────────────────────────
-- Admin: tüm ziyaretler; user: sadece kendi
CREATE POLICY "visits_select_admin" ON visits FOR SELECT USING (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "visits_select_own" ON visits FOR SELECT USING (
  personnel_id = auth.uid()
);
CREATE POLICY "visits_insert" ON visits FOR INSERT WITH CHECK (
  organization_id = my_org_id()
);
CREATE POLICY "visits_update_own" ON visits FOR UPDATE USING (
  personnel_id = auth.uid()
);
CREATE POLICY "visits_update_admin" ON visits FOR UPDATE USING (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "visits_delete" ON visits FOR DELETE USING (
  organization_id = my_org_id() AND is_admin()
);

-- ─── REPORTS ──────────────────────────────────────────────────────────────────
CREATE POLICY "reports_select_admin" ON reports FOR SELECT USING (
  organization_id = my_org_id() AND is_admin()
);
CREATE POLICY "reports_select_own" ON reports FOR SELECT USING (
  created_by = auth.uid()
);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (
  organization_id = my_org_id()
);
CREATE POLICY "reports_delete" ON reports FOR DELETE USING (
  organization_id = my_org_id() AND is_admin()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INITIAL SETUP (Supabase bağlandıktan sonra çalıştırın)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Supabase Auth > Users > Add User ile ilk kullanıcıyı oluşturun
-- 2. Aşağıdaki SQL'i doldurup çalıştırın:
--
-- INSERT INTO organizations (name) VALUES ('Feyzi OSGB') RETURNING id;
-- -- Dönen org_id ve Auth'dan aldığınız user_id ile:
-- INSERT INTO profiles (id, organization_id, full_name, email, role, status)
--   VALUES ('<user_id>', '<org_id>', 'Admin', 'admin@osgb.com', 'owner', 'active');
