export interface MockZiyaret {
  id: string;
  uzman_id: string;
  uzman_ad: string;
  uzman_email: string;
  firma_id: string;
  firma_ad: string;
  giris_saati: string; // ISO
  cikis_saati: string | null;
  durum: 'aktif' | 'tamamlandi';
  konum_lat: number | null;
  konum_lng: number | null;
  notlar: string;
  qr_ile_giris: boolean;
}

const now = new Date();
const today = now.toISOString().split('T')[0];

function dt(hh: number, mm: number, daysAgo = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export const mockZiyaretler: MockZiyaret[] = [];

export const mockUzmanlar: { id: string; ad: string }[] = [];

export const mockFirmalar: { id: string; ad: string }[] = [];
