export type TehlikeSinifi = 'Az Tehlikeli' | 'Tehlikeli' | 'Çok Tehlikeli';
export type FirmaStatus = 'Aktif' | 'Pasif' | 'Askıda';
export type PersonelStatus = 'Aktif' | 'Ayrıldı';
export type EvrakStatus = 'Yüklü' | 'Eksik' | 'Süre Yaklaşıyor' | 'Süre Dolmuş';
export type UygunsuzlukSeverity = 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik';
export type UygunsuzlukStatus = 'Açık' | 'Kapandı';
export type EgitimStatus = 'Planlandı' | 'Tamamlandı' | 'Eksik';
export type MuayeneResult = 'Çalışabilir' | 'Kısıtlı Çalışabilir' | 'Çalışamaz';
export type UserRole = 'Admin' | 'ISG Uzmanı' | 'Firma Yetkilisi' | 'Görüntüleyici';
export type EkipmanStatus = 'Uygun' | 'Uygun Değil' | 'Bakımda' | 'Hurda';
export type GorevStatus = 'Bekliyor' | 'Devam Ediyor' | 'Tamamlandı' | 'İptal';
export type GorevOncelik = 'Düşük' | 'Normal' | 'Yüksek' | 'Kritik';
export type TutanakStatus = 'Taslak' | 'Tamamlandı' | 'Onaylandı' | 'İptal';

export interface Firma {
  id: string;
  ad: string;
  yetkiliKisi: string;
  telefon: string;
  email: string;
  vergiNo: string;
  sgkSicil: string;
  adres: string;
  tehlikeSinifi: TehlikeSinifi;
  sozlesmeBas: string;
  sozlesmeBit: string;
  durum: FirmaStatus;
  notlar: string;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
}

export interface Personel {
  id: string;
  adSoyad: string;
  tc: string;
  telefon: string;
  email: string;
  dogumTarihi: string;
  gorev: string;
  departman: string;
  iseGirisTarihi: string;
  firmaId: string;
  durum: PersonelStatus;
  kanGrubu: string;
  acilKisi: string;
  acilTelefon: string;
  adres: string;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
}

export interface Evrak {
  id: string;
  ad: string;
  tur: string;
  kategori?: string;
  firmaId: string;
  personelId?: string;
  durum: EvrakStatus;
  yuklemeTarihi: string;
  gecerlilikTarihi?: string;
  dosyaAdi?: string;
  dosyaBoyutu?: number;
  dosyaTipi?: string;
  dosyaVeri?: string;
  dosyaUrl?: string;
  notlar: string;
  olusturmaTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
}

export interface EgitimKatilimci {
  personelId: string;
  katildi: boolean;
}

export interface Egitim {
  id: string;
  ad: string;
  firmaId: string;       // Legacy — tek firma (eski kayıtlar için)
  firmaIds?: string[];   // Yeni — çoklu firma desteği
  tarih: string;
  egitmen?: string;
  aciklama?: string;
  katilimcilar?: EgitimKatilimci[];
  // Legacy uyumluluk — eski kayıtlar için tutuldu
  katilimciIds?: string[];
  gecerlilikSuresi?: number;
  egitmen_eski?: string;
  yer?: string;
  sure?: number;
  durum?: EgitimStatus;
  belgeMevcut?: boolean;
  belgeDosyaAdi?: string;
  belgeDosyaBoyutu?: number;
  belgeDosyaTipi?: string;
  belgeDosyaVeri?: string;
  belgeDosyaUrl?: string;
  notlar?: string;
  olusturmaTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
}

export interface Muayene {
  id: string;
  personelId: string;
  firmaId: string;
  muayeneTarihi: string;
  sonrakiTarih: string;
  sonuc: MuayeneResult;
  hastane: string;
  doktor: string;
  notlar: string;
  belgeMevcut: boolean;
  dosyaAdi?: string;
  dosyaBoyutu?: number;
  dosyaTipi?: string;
  dosyaVeri?: string;
  dosyaUrl?: string;
  olusturmaTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
}

export interface Uygunsuzluk {
  id: string;
  acilisNo?: string;
  baslik: string;
  aciklama: string;
  onlem?: string;
  firmaId: string;
  personelId?: string;
  tarih: string;
  severity: UygunsuzlukSeverity;
  durum: UygunsuzlukStatus;
  sorumlu?: string;
  hedefTarih?: string;
  kapatmaTarihi?: string;
  kapatmaAciklama?: string;
  acilisFotoMevcut?: boolean;
  kapatmaFotoMevcut?: boolean;
  acilisFotoUrl?: string;
  kapatmaFotoUrl?: string;
  notlar?: string;
  olusturmaTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
}

export interface EkipmanSahaFoto {
  id: string;
  url: string;
  aciklama: string;
  tarih: string;
  yukleyenKisi?: string;
}

export interface Ekipman {
  id: string;
  ad: string;
  tur: string;
  firmaId: string;
  bulunduguAlan: string;
  seriNo: string;
  marka: string;
  model: string;
  sonKontrolTarihi: string;
  sonrakiKontrolTarihi: string;
  durum: EkipmanStatus;
  aciklama: string;
  belgeMevcut: boolean;
  dosyaAdi?: string;
  dosyaBoyutu?: number;
  dosyaTipi?: string;
  dosyaVeri?: string;
  dosyaUrl?: string;
  notlar: string;
  sahaFotolari?: EkipmanSahaFoto[];
  olusturmaTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
}

export interface Gorev {
  id: string;
  baslik: string;
  aciklama: string;
  firmaId?: string;
  personelId?: string;
  atananKisi: string;
  oncelik: GorevOncelik;
  durum: GorevStatus;
  baslangicTarihi: string;
  bitisTarihi: string;
  tamamlanmaTarihi?: string;
  notlar: string;
  olusturmaTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
  belgeDosyaUrl?: string;
}

export interface Tutanak {
  id: string;
  tutanakNo: string;
  firmaId: string;
  baslik: string;
  aciklama: string;
  tarih: string;
  durum: TutanakStatus;
  olusturanKisi: string;
  dosyaAdi?: string;
  dosyaBoyutu?: number;
  dosyaTipi?: string;
  dosyaVeri?: string;
  dosyaUrl?: string;
  sahadenetimId?: string;
  notlar: string;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
}

export interface CurrentUser {
  id: string;
  ad: string;
  email: string;
  rol: UserRole;
  firmaId?: string;
  avatar?: string;
}

export type IsIzniTip = 'Sıcak Çalışma' | 'Yüksekte Çalışma' | 'Kapalı Alan' | 'Elektrikli Çalışma' | 'Kazı' | 'Genel';
export type IsIzniStatus = 'Onay Bekliyor' | 'Onaylandı' | 'Reddedildi';

export interface IsIzniEvrak {
  id: string;
  ad: string;
  tur: string;
  yuklemeTarihi: string;
  dosyaAdi: string;
  dosyaBoyutu: number;
  dosyaTipi: string;
  dosyaUrl?: string;
  notlar?: string;
}

export interface IsIzni {
  id: string;
  izinNo: string;
  tip: IsIzniTip;
  firmaId: string;
  bolum: string;
  sorumlu: string;
  calisanlar: string;
  calisanSayisi: number;
  aciklama: string;
  tehlikeler: string;
  onlemler: string;
  gerekliEkipman: string;
  baslamaTarihi: string;
  bitisTarihi: string;
  durum: IsIzniStatus;
  onaylayanKisi: string;
  onayTarihi?: string;
  sahaNotu?: string;
  reddedenKisi?: string;
  reddetmeTarihi?: string;
  redFotoUrl?: string;
  notlar: string;
  olusturanKisi: string;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
  evraklar?: IsIzniEvrak[];
  belgeMevcut?: boolean;
  belgeDosyaAdi?: string;
  belgeDosyaBoyutu?: number;
  belgeDosyaTipi?: string;
  belgeDosyaUrl?: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
}

export interface AppData {
  firmalar: Firma[];
  personeller: Personel[];
  evraklar: Evrak[];
  egitimler: Egitim[];
  muayeneler: Muayene[];
  uygunsuzluklar: Uygunsuzluk[];
  ekipmanlar: Ekipman[];
  gorevler: Gorev[];
  tutanaklar: Tutanak[];
  isIzinleri: IsIzni[];
  currentUser: CurrentUser;
}

export type CompanyDocumentStatus = 'Aktif' | 'Süresi Dolmuş' | 'Yaklaşan';

export interface CompanyDocument {
  id: string;
  organization_id: string;
  company_id: string | null;
  title: string;
  document_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number;
  file_type: string | null;
  description: string;
  version: string;
  valid_from: string | null;
  valid_until: string | null;
  status: CompanyDocumentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
