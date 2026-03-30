export type TehlikeSinifi = 'Az Tehlikeli' | 'Tehlikeli' | 'Çok Tehlikeli';
export type FirmaStatus = 'Aktif' | 'Pasif' | 'Askıda';
export type PersonelStatus = 'Aktif' | 'Pasif' | 'Ayrıldı';
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
  notlar: string;
  olusturmaTarihi: string;
  silinmis?: boolean;
  silinmeTarihi?: string;
  cascadeSilindi?: boolean;
  cascadeFirmaId?: string;
}

export interface Egitim {
  id: string;
  ad: string;
  firmaId: string;
  katilimciIds: string[];
  tarih: string;
  gecerlilikSuresi: number;
  egitmen: string;
  yer: string;
  sure: number;
  durum: EgitimStatus;
  belgeMevcut: boolean;
  aciklama?: string;
  belgeDosyaAdi?: string;
  belgeDosyaBoyutu?: number;
  belgeDosyaTipi?: string;
  belgeDosyaVeri?: string;
  notlar: string;
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
  notlar: string;
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
  sahadenetimId?: string;
  notlar: string;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
}

export interface CurrentUser {
  id: string;
  ad: string;
  email: string;
  rol: UserRole;
  firmaId?: string;
  avatar?: string;
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
  currentUser: CurrentUser;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
