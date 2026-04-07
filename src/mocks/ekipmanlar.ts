export interface Ekipman {
  id: string;
  ad: string;
  tip: string;
  konum: string;
  seri_no: string;
  son_kontrol: string;
  sonraki_kontrol: string;
  durum: "aktif" | "bakim" | "arizali";
}

export interface Islem {
  id: string;
  ekipman_id: string;
  tip: "kontrol" | "uygunsuzluk";
  aciklama: string;
  tarih: string;
  kullanici: string;
}

export const mockEkipmanlar: Ekipman[] = [
  {
    id: "EKP-001",
    ad: "Yangın Tüpü - A Blok Giriş",
    tip: "Yangın Güvenliği",
    konum: "A Blok, Zemin Kat",
    seri_no: "YT-2024-0041",
    son_kontrol: "2026-03-15",
    sonraki_kontrol: "2026-06-15",
    durum: "aktif",
  },
  {
    id: "EKP-002",
    ad: "Forklift #3",
    tip: "İş Makinesi",
    konum: "Depo Sahası",
    seri_no: "FK-2022-0003",
    son_kontrol: "2026-02-20",
    sonraki_kontrol: "2026-05-20",
    durum: "bakim",
  },
  {
    id: "EKP-003",
    ad: "Elektrik Panosu - B Blok",
    tip: "Elektrik Ekipmanı",
    konum: "B Blok, 2. Kat",
    seri_no: "EP-2023-0017",
    son_kontrol: "2026-01-10",
    sonraki_kontrol: "2026-04-10",
    durum: "arizali",
  },
];

export const mockIslemler: Islem[] = [
  {
    id: "ISL-001",
    ekipman_id: "EKP-001",
    tip: "kontrol",
    aciklama: "Periyodik kontrol yapıldı. Dolum tarihi uygun.",
    tarih: "2026-03-15T10:30:00",
    kullanici: "Ahmet Yılmaz",
  },
  {
    id: "ISL-002",
    ekipman_id: "EKP-001",
    tip: "uygunsuzluk",
    aciklama: "Tüp askısı gevşemiş, sabitlenmesi gerekiyor.",
    tarih: "2026-02-28T14:15:00",
    kullanici: "Mehmet Kaya",
  },
  {
    id: "ISL-003",
    ekipman_id: "EKP-002",
    tip: "kontrol",
    aciklama: "Yağ seviyesi kontrol edildi, normal.",
    tarih: "2026-02-20T09:00:00",
    kullanici: "Ahmet Yılmaz",
  },
];
