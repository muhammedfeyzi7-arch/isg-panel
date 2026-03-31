import type { Personel, Firma } from '../../../types';

export type DocTemplate =
  | 'egitim-katilim'
  | 'kkd-zimmet'
  | 'isbasi-egitim'
  | 'saglik-muayene'
  | 'oryantasyon'
  | 'gorevlendirme'
  | 'temel-isg-egitimi'
  | 'yuksekte-calisma-sertifika'
  | 'temel-isg-belge-konular';

export interface TemplateExtra {
  egitimKonusu?: string;
  egitimYeri?: string;
  egitmenAdi?: string;
  gorevTanimi?: string;
  muayeneTuru?: string;
  egitimTarihi?: string;
  referansNo?: string;
  egitimSuresi?: string;
  isyeriUnvani?: string;
  isverenAdSoyadi?: string;
  isverenGorevUnvani?: string;
  egitimci1AdSoyad?: string;
  egitimci1GorevUnvani?: string;
  egitimci2AdSoyad?: string;
  egitimci2GorevUnvani?: string;
  egitimciSertifikaNo?: string;
}

export interface TemplateInfo {
  label: string;
  icon: string;
  color: string;
  bg: string;
  description: string;
  extraFields: Array<{ key: keyof TemplateExtra; label: string; placeholder: string }>;
}

export const TEMPLATE_META: Record<DocTemplate, TemplateInfo> = {
  'egitim-katilim': {
    label: 'Eğitim Katılım Belgesi',
    icon: 'ri-graduation-cap-line',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    description: 'SAYIN alanı, katılımcı bilgileri ve imza alanları içerir',
    extraFields: [
      { key: 'egitimKonusu', label: 'Eğitim Konusu', placeholder: 'İş Güvenliği Temel Eğitimi' },
      { key: 'egitimYeri', label: 'Eğitim Yeri', placeholder: 'Toplantı Salonu / Online' },
      { key: 'egitmenAdi', label: 'Eğitmen Adı', placeholder: 'Eğitmen adı soyadı' },
    ],
  },
  'kkd-zimmet': {
    label: 'KKD Zimmet Tutanağı',
    icon: 'ri-shield-check-line',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    description: 'Kişisel koruyucu donanım zimmet teslim tutanağı',
    extraFields: [],
  },
  'isbasi-egitim': {
    label: 'İş Başı Eğitim Formu',
    icon: 'ri-briefcase-line',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    description: 'Yeni işe başlayan personel için oryantasyon ve eğitim formu',
    extraFields: [
      { key: 'egitmenAdi', label: 'Eğitim Veren Kişi', placeholder: 'İSG Uzmanı / Amir adı' },
    ],
  },
  'saglik-muayene': {
    label: 'Sağlık Muayene Talep Formu',
    icon: 'ri-heart-pulse-line',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    description: 'Periyodik sağlık muayenesi talep ve yönlendirme formu',
    extraFields: [
      { key: 'muayeneTuru', label: 'Muayene Türü', placeholder: 'Periyodik / İşe Giriş / Ayrılış' },
    ],
  },
  'oryantasyon': {
    label: 'Oryantasyon Formu',
    icon: 'ri-user-follow-line',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    description: 'İşe yeni başlayan personel oryantasyon belgesi',
    extraFields: [],
  },
  'gorevlendirme': {
    label: 'Görevlendirme Yazısı',
    icon: 'ri-file-text-line',
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.12)',
    description: 'Resmi görevlendirme ve bilgilendirme yazısı',
    extraFields: [
      { key: 'gorevTanimi', label: 'Görev Tanımı / Konu', placeholder: 'Görev veya yazı konusu' },
    ],
  },
  'temel-isg-egitimi': {
    label: 'Temel İSG Eğitimi Belgesi',
    icon: 'ri-shield-star-line',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.12)',
    description: 'Kırmızı/turuncu temalı resmi Temel İSG Eğitimi katılım belgesi',
    extraFields: [
      { key: 'egitimYeri', label: 'Eğitim Yeri', placeholder: 'Toplantı Salonu / Online' },
      { key: 'egitmenAdi', label: 'Eğitimi Veren Kişi', placeholder: 'Eğitimci adı soyadı' },
    ],
  },
  'yuksekte-calisma-sertifika': {
    label: 'Yüksekte Çalışma Sertifikası',
    icon: 'ri-award-fill',
    color: '#922020',
    bg: 'rgba(146,32,32,0.1)',
    description: 'Bordo çerçeveli resmi yüksekte güvenli çalışma eğitimi katılım sertifikası',
    extraFields: [
      { key: 'referansNo', label: 'Referans No', placeholder: 'No.2-1/009-2025' },
      { key: 'egitimTarihi', label: 'Eğitim Tarihi', placeholder: 'gg/aa/yyyy' },
      { key: 'egitmenAdi', label: 'Eğitimci Adı Soyadı', placeholder: 'Eğitimci adı soyadı' },
      { key: 'egitimciSertifikaNo', label: 'Eğitimci Sertifika No', placeholder: 'Sertifika numarası' },
    ],
  },
  'temel-isg-belge-konular': {
    label: 'Temel İSG Belge + Konular (2 Sayfa)',
    icon: 'ri-file-list-3-line',
    color: '#92400E',
    bg: 'rgba(146,64,14,0.12)',
    description: 'Altın çerçeveli iki sayfalık temel İSG eğitim belgesi ve eğitim konuları listesi',
    extraFields: [
      { key: 'egitimTarihi', label: 'Eğitim Tarihi', placeholder: 'gg/aa/yyyy' },
      { key: 'egitimSuresi', label: 'Eğitim Süresi (Saat)', placeholder: '8' },
      { key: 'isyeriUnvani', label: 'İşyeri Unvanı', placeholder: 'Firma / İşyeri adı' },
      { key: 'isverenAdSoyadi', label: 'İşveren Adı Soyadı', placeholder: 'İşveren adı soyadı' },
      { key: 'isverenGorevUnvani', label: 'İşveren Görev Unvanı', placeholder: 'İşveren unvanı' },
      { key: 'egitimci1AdSoyad', label: 'Eğitimci 1 Adı Soyadı', placeholder: 'Eğitimci adı soyadı' },
      { key: 'egitimci1GorevUnvani', label: 'Eğitimci 1 Görev Unvanı', placeholder: 'Eğitimci unvanı' },
      { key: 'egitimci2AdSoyad', label: 'Eğitimci 2 Adı Soyadı', placeholder: 'İkinci eğitimci (opsiyonel)' },
      { key: 'egitimci2GorevUnvani', label: 'Eğitimci 2 Görev Unvanı', placeholder: 'İkinci eğitimci unvanı (opsiyonel)' },
    ],
  },
};

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function today(): string {
  return new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const COMMON_CSS = `
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .doc{width:800px;margin:0 auto;padding:40px}
  .top-bar{height:5px;background:linear-gradient(90deg,#1E3A5F,#3B82F6,#06B6D4);margin-bottom:0;border-radius:3px 3px 0 0}
  .header{background:linear-gradient(135deg,#0F172A,#1E293B);color:white;padding:24px 32px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0}
  .header-title{font-size:20px;font-weight:800;letter-spacing:0.5px;color:white}
  .header-sub{font-size:11px;color:#94A3B8;margin-top:4px;letter-spacing:1px;text-transform:uppercase}
  .header-right{text-align:right}
  .header-date{font-size:12px;color:#94A3B8}
  .header-no{font-size:11px;color:#60A5FA;margin-top:4px;font-family:monospace}
  .body-pad{padding:32px}
  .salutation{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #E2E8F0}
  .intro{font-size:13px;color:#374151;line-height:1.8;margin-bottom:24px}
  .info-box{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:20px 24px;margin-bottom:24px}
  .info-box-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;margin-bottom:14px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .info-row{display:flex;flex-direction:column;gap:3px}
  .info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94A3B8}
  .info-value{font-size:13px;font-weight:600;color:#1E293B}
  .info-value.highlight{color:#1D4ED8;font-size:14px;font-weight:800}
  .info-full{grid-column:1/-1}
  .sign-section{display:flex;gap:24px;margin-top:32px;padding-top:24px;border-top:2px solid #E2E8F0}
  .sign-box{flex:1;text-align:center;border:1px solid #E2E8F0;border-radius:10px;padding:24px 16px}
  .sign-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;margin-bottom:32px}
  .sign-line{border-bottom:2px solid #CBD5E1;margin:0 16px 8px}
  .sign-name{font-size:11px;color:#94A3B8}
  .footer-doc{background:#F8FAFC;border-top:2px solid #E2E8F0;padding:14px 32px;display:flex;align-items:center;justify-content:space-between;margin-top:0}
  .footer-brand{font-size:11px;font-weight:700;color:#64748B;letter-spacing:1px}
  .footer-date{font-size:10px;color:#94A3B8}
  .accent-line{width:40px;height:3px;background:linear-gradient(90deg,#3B82F6,#06B6D4);border-radius:2px;margin-bottom:8px}
  .kkd-table{width:100%;border-collapse:collapse;margin-top:8px}
  .kkd-table th{background:#1E293B;color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding:10px 12px;text-align:left}
  .kkd-table td{padding:10px 12px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#374151}
  .kkd-table tr:nth-child(even) td{background:#F8FAFC}
  .check-list{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
  .check-item{display:flex;align-items:center;gap:8px;font-size:12px;color:#374151;padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px}
  .check-box{width:16px;height:16px;border:2px solid #CBD5E1;border-radius:3px;flex-shrink:0}
  @media print{body{background:#fff!important}.doc{width:100%!important;padding:0!important}@page{size:A4;margin:0.8cm}}
`;

function docNo(template: DocTemplate): string {
  const prefix: Record<DocTemplate, string> = {
    'egitim-katilim': 'EKB', 'kkd-zimmet': 'KKD', 'isbasi-egitim': 'IBE',
    'saglik-muayene': 'SMF', 'oryantasyon': 'ORY', 'gorevlendirme': 'GRV',
    'temel-isg-egitimi': 'TIE', 'yuksekte-calisma-sertifika': 'YCS', 'temel-isg-belge-konular': 'TBK',
  };
  return `${prefix[template]}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
}

function tplEgitimKatilim(p: Personel, firma: Firma | undefined, extra: TemplateExtra): string {
  const konu = extra.egitimKonusu || 'İş Sağlığı ve Güvenliği Eğitimi';
  const yer = extra.egitimYeri || '—';
  const egitmen = extra.egitmenAdi || '—';
  const no = docNo('egitim-katilim');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Eğitim Katılım Belgesi</title><style>${COMMON_CSS}</style></head><body>
<div class="doc"><div class="top-bar"></div>
<div class="header"><div><div class="header-title">EĞİTİM KATILIM BELGESİ</div><div class="header-sub">İSG • ${esc(firma?.ad ?? 'Firma')}</div></div><div class="header-right"><div class="header-date">${today()}</div><div class="header-no">${esc(no)}</div></div></div>
<div class="body-pad"><div class="salutation">Sayın, ${esc(p.adSoyad)}</div>
<div class="intro"><strong>${today()}</strong> tarihinde <strong>"${esc(konu)}"</strong> konulu İSG eğitimine başarıyla katıldığınız belgelenmektedir.</div>
<div class="info-box"><div class="accent-line"></div><div class="info-box-title">Katılımcı Bilgileri</div><div class="info-grid">
<div class="info-row"><span class="info-label">Adı Soyadı</span><span class="info-value highlight">${esc(p.adSoyad)}</span></div>
<div class="info-row"><span class="info-label">T.C. Kimlik No</span><span class="info-value">${esc(p.tc || '—')}</span></div>
<div class="info-row"><span class="info-label">Görev / Ünvan</span><span class="info-value">${esc(p.gorev || '—')}</span></div>
<div class="info-row"><span class="info-label">Departman</span><span class="info-value">${esc(p.departman || '—')}</span></div>
<div class="info-row info-full"><span class="info-label">Firma</span><span class="info-value">${esc(firma?.ad || '—')}</span></div>
</div></div>
<div class="info-box"><div class="accent-line"></div><div class="info-box-title">Eğitim Bilgileri</div><div class="info-grid">
<div class="info-row"><span class="info-label">Eğitim Konusu</span><span class="info-value highlight">${esc(konu)}</span></div>
<div class="info-row"><span class="info-label">Tarih</span><span class="info-value">${today()}</span></div>
<div class="info-row"><span class="info-label">Eğitim Yeri</span><span class="info-value">${esc(yer)}</span></div>
<div class="info-row"><span class="info-label">Eğitmen</span><span class="info-value">${esc(egitmen)}</span></div>
</div></div>
<div class="sign-section">
<div class="sign-box"><div class="sign-label">Katılımcı İmzası</div><div class="sign-line"></div><div class="sign-name">${esc(p.adSoyad)}</div></div>
<div class="sign-box"><div class="sign-label">Eğitmen İmzası</div><div class="sign-line"></div><div class="sign-name">${esc(egitmen !== '—' ? egitmen : 'İSG Uzmanı')}</div></div>
<div class="sign-box"><div class="sign-label">Yetkili İmzası</div><div class="sign-line"></div><div class="sign-name">${esc(firma?.yetkiliKisi || 'Firma Yetkilisi')}</div></div>
</div></div>
<div class="footer-doc"><div class="footer-brand">ISG DENETİM SİSTEMİ</div><div class="footer-date">${esc(no)} • ${today()}</div></div>
</div></body></html>`;
}

function tplKkdZimmet(p: Personel, firma: Firma | undefined): string {
  const no = docNo('kkd-zimmet');
  const items = ['Baret (Koruyucu Kask)','Güvenlik Gözlüğü','İş Eldiveni','İş Güvenlik Ayakkabısı','Reflektörlü Yelek','Toz Maskesi (FFP2)','Kulaklık / Kulak Tıkacı','Güvenlik Kemeri'];
  const rows = items.map((item, i) => `<tr><td style="text-align:center;font-weight:700">${i+1}</td><td style="font-weight:600">${item}</td><td>1 Adet</td><td>—</td><td style="text-align:center"><span style="display:inline-block;width:16px;height:16px;border:2px solid #CBD5E1;border-radius:3px;"></span></td></tr>`).join('');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>KKD Zimmet Tutanağı</title><style>${COMMON_CSS}</style></head><body>
<div class="doc"><div class="top-bar" style="background:linear-gradient(90deg,#064E3B,#10B981,#34D399)"></div>
<div class="header"><div><div class="header-title">KİŞİSEL KORUYUCU DONANIM ZİMMET TUTANAĞI</div><div class="header-sub">İSG • ${esc(firma?.ad ?? 'Firma')}</div></div><div class="header-right"><div class="header-date">${today()}</div><div class="header-no">${esc(no)}</div></div></div>
<div class="body-pad"><div class="salutation">Sayın, ${esc(p.adSoyad)}</div>
<div class="intro">Aşağıda listesi verilen KKD'ler <strong>${esc(p.adSoyad)}</strong> adlı personele teslim edilmiştir.</div>
<div class="info-box"><div class="accent-line" style="background:linear-gradient(90deg,#10B981,#34D399)"></div><div class="info-box-title">Personel Bilgileri</div><div class="info-grid">
<div class="info-row"><span class="info-label">Adı Soyadı</span><span class="info-value highlight">${esc(p.adSoyad)}</span></div>
<div class="info-row"><span class="info-label">T.C. Kimlik No</span><span class="info-value">${esc(p.tc || '—')}</span></div>
<div class="info-row"><span class="info-label">Görev</span><span class="info-value">${esc(p.gorev || '—')}</span></div>
<div class="info-row"><span class="info-label">Teslim Tarihi</span><span class="info-value">${today()}</span></div>
</div></div>
<div style="margin-bottom:24px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;margin-bottom:10px">Teslim Edilen KKD Listesi</div>
<table class="kkd-table"><thead><tr><th style="width:40px">No</th><th>KKD Adı</th><th>Miktar</th><th>Seri/Barkod No</th><th style="width:60px;text-align:center">Teslim</th></tr></thead><tbody>${rows}</tbody></table>
</div>
<div class="sign-section">
<div class="sign-box"><div class="sign-label">Teslim Alan (Personel)</div><div class="sign-line"></div><div class="sign-name">${esc(p.adSoyad)}</div></div>
<div class="sign-box"><div class="sign-label">Teslim Eden (Yetkili)</div><div class="sign-line"></div><div class="sign-name">${esc(firma?.yetkiliKisi || 'İSG Uzmanı')}</div></div>
</div></div>
<div class="footer-doc"><div class="footer-brand">ISG DENETİM SİSTEMİ</div><div class="footer-date">${esc(no)} • ${today()}</div></div>
</div></body></html>`;
}

function tplIsbasiEgitim(p: Personel, firma: Firma | undefined, extra: TemplateExtra): string {
  const egitmen = extra.egitmenAdi || '—';
  const no = docNo('isbasi-egitim');
  const konular = ['Firma tanıtımı ve organizasyon yapısı','Acil durum prosedürleri ve tahliye planı','İş kazası bildirimi ve ilk yardım','KKD kullanımı','Tehlikeli madde ve kimyasalların yönetimi','Elektrik güvenliği','Yangın güvenliği','Ergonomi ve meslek hastalıkları','Çevresel faktörler ve gürültü','İSG mevzuatı ve yasal yükümlülükler'];
  const checks = konular.map(k => `<li class="check-item"><div class="check-box"></div><span>${k}</span></li>`).join('');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>İş Başı Eğitim Formu</title><style>${COMMON_CSS}</style></head><body>
<div class="doc"><div class="top-bar" style="background:linear-gradient(90deg,#78350F,#F59E0B,#FDE68A)"></div>
<div class="header"><div><div class="header-title">İŞ BAŞI EĞİTİM FORMU</div><div class="header-sub">İSG • ${esc(firma?.ad ?? 'Firma')}</div></div><div class="header-right"><div class="header-date">${today()}</div><div class="header-no">${esc(no)}</div></div></div>
<div class="body-pad"><div class="salutation">Sayın, ${esc(p.adSoyad)}</div>
<div class="intro"><strong>${esc(firma?.ad || 'Firmanıza')}</strong> bünyesinde göreve başlamanız nedeniyle aşağıdaki konularda iş başı eğitimi verilmiştir.</div>
<div class="info-box"><div class="accent-line" style="background:linear-gradient(90deg,#F59E0B,#FDE68A)"></div><div class="info-box-title">Personel Bilgileri</div><div class="info-grid">
<div class="info-row"><span class="info-label">Adı Soyadı</span><span class="info-value highlight">${esc(p.adSoyad)}</span></div>
<div class="info-row"><span class="info-label">T.C. Kimlik No</span><span class="info-value">${esc(p.tc || '—')}</span></div>
<div class="info-row"><span class="info-label">Görev</span><span class="info-value">${esc(p.gorev || '—')}</span></div>
<div class="info-row"><span class="info-label">Eğitim Veren</span><span class="info-value">${esc(egitmen)}</span></div>
</div></div>
<div style="margin-bottom:24px"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;margin-bottom:10px">Eğitim Konuları</div>
<ul class="check-list">${checks}</ul></div>
<div class="sign-section">
<div class="sign-box"><div class="sign-label">Katılımcı İmzası</div><div class="sign-line"></div><div class="sign-name">${esc(p.adSoyad)}</div></div>
<div class="sign-box"><div class="sign-label">Eğitim Veren</div><div class="sign-line"></div><div class="sign-name">${esc(egitmen !== '—' ? egitmen : 'İSG Uzmanı')}</div></div>
<div class="sign-box"><div class="sign-label">İşveren / Yetkili</div><div class="sign-line"></div><div class="sign-name">${esc(firma?.yetkiliKisi || 'Firma Yetkilisi')}</div></div>
</div></div>
<div class="footer-doc"><div class="footer-brand">ISG DENETİM SİSTEMİ</div><div class="footer-date">${esc(no)} • ${today()}</div></div>
</div></body></html>`;
}

function tplSaglikMuayene(p: Personel, firma: Firma | undefined, extra: TemplateExtra): string {
  const muayeneTuru = extra.muayeneTuru || 'Periyodik Muayene';
  const no = docNo('saglik-muayene');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Sağlık Muayene Talep Formu</title><style>${COMMON_CSS}</style></head><body>
<div class="doc"><div class="top-bar" style="background:linear-gradient(90deg,#7F1D1D,#EF4444,#FCA5A5)"></div>
<div class="header"><div><div class="header-title">SAĞLIK MUAYENESİ TALEP VE YÖNLENDİRME FORMU</div><div class="header-sub">İSG • ${esc(firma?.ad ?? 'Firma')}</div></div><div class="header-right"><div class="header-date">${today()}</div><div class="header-no">${esc(no)}</div></div></div>
<div class="body-pad"><div class="salutation">Sayın, ${esc(p.adSoyad)}</div>
<div class="intro">6331 Sayılı Kanun kapsamında <strong>${esc(muayeneTuru)}</strong> yaptırılması talep edilmektedir.</div>
<div class="info-box"><div class="accent-line" style="background:linear-gradient(90deg,#EF4444,#FCA5A5)"></div><div class="info-box-title">Personel Bilgileri</div><div class="info-grid">
<div class="info-row"><span class="info-label">Adı Soyadı</span><span class="info-value highlight">${esc(p.adSoyad)}</span></div>
<div class="info-row"><span class="info-label">T.C. Kimlik No</span><span class="info-value">${esc(p.tc || '—')}</span></div>
<div class="info-row"><span class="info-label">Görev</span><span class="info-value">${esc(p.gorev || '—')}</span></div>
<div class="info-row"><span class="info-label">Muayene Türü</span><span class="info-value highlight">${esc(muayeneTuru)}</span></div>
<div class="info-row"><span class="info-label">Talep Tarihi</span><span class="info-value">${today()}</span></div>
<div class="info-row"><span class="info-label">Firma</span><span class="info-value">${esc(firma?.ad || '—')}</span></div>
</div></div>
<div class="sign-section">
<div class="sign-box"><div class="sign-label">Personel</div><div class="sign-line"></div><div class="sign-name">${esc(p.adSoyad)}</div></div>
<div class="sign-box"><div class="sign-label">İşveren / Yetkili</div><div class="sign-line"></div><div class="sign-name">${esc(firma?.yetkiliKisi || 'Firma Yetkilisi')}</div></div>
<div class="sign-box"><div class="sign-label">İSG Uzmanı</div><div class="sign-line"></div><div class="sign-name">İSG Uzmanı</div></div>
</div></div>
<div class="footer-doc"><div class="footer-brand">ISG DENETİM SİSTEMİ</div><div class="footer-date">${esc(no)} • ${today()}</div></div>
</div></body></html>`;
}

function tplOryantasyon(p: Personel, firma: Firma | undefined): string {
  const no = docNo('oryantasyon');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Oryantasyon Formu</title><style>${COMMON_CSS}</style></head><body>
<div class="doc"><div class="top-bar" style="background:linear-gradient(90deg,#4C1D95,#8B5CF6,#C4B5FD)"></div>
<div class="header"><div><div class="header-title">PERSONEL ORYANTASYon ve İSG BİLGİLENDİRME FORMU</div><div class="header-sub">İSG • ${esc(firma?.ad ?? 'Firma')}</div></div><div class="header-right"><div class="header-date">${today()}</div><div class="header-no">${esc(no)}</div></div></div>
<div class="body-pad"><div class="salutation">Sayın, ${esc(p.adSoyad)}</div>
<div class="intro"><strong>${esc(firma?.ad || 'Firmamıza')}</strong> bünyesine katıldığınız için hoş geldiniz. Bu form oryantasyon sürecinizin tamamlandığını belgeler.</div>
<div class="info-box"><div class="accent-line" style="background:linear-gradient(90deg,#8B5CF6,#C4B5FD)"></div><div class="info-box-title">Personel Bilgileri</div><div class="info-grid">
<div class="info-row"><span class="info-label">Adı Soyadı</span><span class="info-value highlight">${esc(p.adSoyad)}</span></div>
<div class="info-row"><span class="info-label">T.C. Kimlik No</span><span class="info-value">${esc(p.tc || '—')}</span></div>
<div class="info-row"><span class="info-label">Görev</span><span class="info-value">${esc(p.gorev || '—')}</span></div>
<div class="info-row"><span class="info-label">Kan Grubu</span><span class="info-value" style="color:#DC2626;font-weight:800">${esc(p.kanGrubu || '—')}</span></div>
<div class="info-row"><span class="info-label">Acil Durum Kişisi</span><span class="info-value">${esc(p.acilKisi || '—')}</span></div>
<div class="info-row"><span class="info-label">Acil Telefon</span><span class="info-value">${esc(p.acilTelefon || '—')}</span></div>
</div></div>
<div class="sign-section">
<div class="sign-box"><div class="sign-label">Personel İmzası</div><div class="sign-line"></div><div class="sign-name">${esc(p.adSoyad)}</div></div>
<div class="sign-box"><div class="sign-label">İK / İSG Yetkili</div><div class="sign-line"></div><div class="sign-name">${esc(firma?.yetkiliKisi || 'Yetkili Kişi')}</div></div>
</div></div>
<div class="footer-doc"><div class="footer-brand">ISG DENETİM SİSTEMİ</div><div class="footer-date">${esc(no)} • ${today()}</div></div>
</div></body></html>`;
}

function tplGorevlendirme(p: Personel, firma: Firma | undefined, extra: TemplateExtra): string {
  const konu = extra.gorevTanimi || 'İş Sağlığı ve Güvenliği Görevi';
  const no = docNo('gorevlendirme');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Görevlendirme Yazısı</title><style>${COMMON_CSS}</style></head><body>
<div class="doc"><div class="top-bar" style="background:linear-gradient(90deg,#164E63,#06B6D4,#67E8F9)"></div>
<div class="header"><div><div class="header-title">GÖREVLENDİRME YAZISI</div><div class="header-sub">İSG • ${esc(firma?.ad ?? 'Firma')}</div></div><div class="header-right"><div class="header-date">${today()}</div><div class="header-no">${esc(no)}</div></div></div>
<div class="body-pad"><div class="salutation">Sayın, ${esc(p.adSoyad)}</div>
<div class="intro">${today()} tarihi itibariyle <strong>"${esc(konu)}"</strong> konusunda görevlendirilmiş bulunmaktasınız.</div>
<div class="info-box"><div class="accent-line" style="background:linear-gradient(90deg,#06B6D4,#67E8F9)"></div><div class="info-box-title">Personel Bilgileri</div><div class="info-grid">
<div class="info-row"><span class="info-label">Adı Soyadı</span><span class="info-value highlight">${esc(p.adSoyad)}</span></div>
<div class="info-row"><span class="info-label">T.C. Kimlik No</span><span class="info-value">${esc(p.tc || '—')}</span></div>
<div class="info-row"><span class="info-label">Görev</span><span class="info-value">${esc(p.gorev || '—')}</span></div>
<div class="info-row"><span class="info-label">Tarih</span><span class="info-value">${today()}</span></div>
<div class="info-row info-full"><span class="info-label">Görevlendirme Konusu</span><span class="info-value highlight">${esc(konu)}</span></div>
</div></div>
<div class="sign-section">
<div class="sign-box"><div class="sign-label">Personel</div><div class="sign-line"></div><div class="sign-name">${esc(p.adSoyad)}</div></div>
<div class="sign-box"><div class="sign-label">Yetkili İmzası / Kaşe</div><div class="sign-line"></div><div class="sign-name">${esc(firma?.yetkiliKisi || 'Firma Yetkilisi')}</div></div>
</div></div>
<div class="footer-doc"><div class="footer-brand">ISG DENETİM SİSTEMİ</div><div class="footer-date">${esc(no)} • ${today()}</div></div>
</div></body></html>`;
}

function tplTemelIsgEgitimi(p: Personel, firma: Firma | undefined, extra: TemplateExtra): string {
  const egitmen = extra.egitmenAdi || '';
  const yer = extra.egitimYeri || '—';
  const no = docNo('temel-isg-egitimi');
  const konular = [
    'İSG Mevzuatı (6331 Sayılı Kanun)','Çalışanların hak ve yükümlülükleri',
    'Risk değerlendirmesi ve tehlike tanımlama','KKD seçimi ve kullanımı',
    'Acil durum prosedürleri','Yangın güvenliği',
    'İş kazası ve meslek hastalıklarının önlenmesi','Kimyasal tehlikeler',
    'Ergonomi ve çalışma ortamı','İlk yardım uygulamaları',
    'Elektrik güvenliği','Gürültü ve titreşim standartları',
  ];
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Temel İSG Eğitimi Belgesi</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:794px;margin:0 auto;background:#fff}
.hdr{background:linear-gradient(135deg,#B91C1C 0%,#DC2626 40%,#EA580C 100%)}
.hdr-inner{display:flex;align-items:stretch;min-height:110px}
.hdr-logo{width:130px;background:rgba(0,0,0,0.18);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;flex-shrink:0}
.hdr-logo-circle{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;margin-bottom:6px}
.hdr-logo-circle i{font-size:28px;color:#fff}
.hdr-logo-name{font-size:8px;font-weight:800;color:rgba(255,255,255,0.8);text-align:center;letter-spacing:0.5px;text-transform:uppercase}
.hdr-body{flex:1;padding:20px 28px;display:flex;flex-direction:column;justify-content:center}
.hdr-badge{display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:3px 12px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;width:fit-content}
.hdr-title{font-size:22px;font-weight:900;color:#fff;letter-spacing:0.3px;line-height:1.2}
.hdr-title span{display:block;font-size:13px;font-weight:500;color:rgba(255,255,255,0.8);margin-top:4px}
.hdr-right{width:140px;background:rgba(0,0,0,0.12);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;flex-shrink:0;text-align:center}
.hdr-right-label{font-size:8px;font-weight:700;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.hdr-right-val{font-size:12px;font-weight:800;color:#fff;margin-bottom:8px;font-family:monospace}
.hdr-right-date{font-size:10px;font-weight:600;color:rgba(255,255,255,0.85)}
.strip{height:5px;background:linear-gradient(90deg,#FEF3C7,#FBBF24,#EA580C,#DC2626)}
.body{padding:28px 36px}
.sayin{font-size:14px;color:#374151;margin-bottom:20px;padding:14px 18px;background:#FFF7ED;border-left:4px solid #EA580C;border-radius:0 8px 8px 0}
.sayin strong{color:#B91C1C;font-size:15px}
.intro{font-size:12px;color:#4B5563;line-height:1.8;margin-bottom:22px;padding:12px 16px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px}
.sec-title{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.sec-title-bar{width:4px;height:20px;background:linear-gradient(180deg,#DC2626,#EA580C);border-radius:2px;flex-shrink:0}
.sec-title-text{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#1F2937}
.p-table{width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #FCA5A5;overflow:hidden}
.p-table thead tr{background:linear-gradient(90deg,#B91C1C,#DC2626)}
.p-table thead th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.8px}
.p-table tbody tr:nth-child(odd){background:#FFF7ED}
.p-table tbody tr:nth-child(even){background:#FEF2F2}
.p-table tbody td{padding:10px 14px;font-size:12px;color:#1F2937;border-bottom:1px solid #FCA5A580}
.p-table tbody td.label{font-weight:700;color:#B91C1C;width:40%}
.egitim-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:22px}
.egitim-card{background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px;text-align:center}
.egitim-card i{font-size:22px;color:#EA580C;margin-bottom:6px;display:block}
.egitim-card-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:4px}
.egitim-card-val{font-size:12px;font-weight:800;color:#1F2937}
.konular-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:22px}
.konu-item{display:flex;align-items:flex-start;gap:8px;padding:8px 12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;font-size:11px;color:#374151}
.konu-no{width:20px;height:20px;background:linear-gradient(135deg,#DC2626,#EA580C);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0}
.sign-area{margin-top:24px;padding-top:20px;border-top:2px dashed #FCA5A5}
.sign-boxes{display:flex;gap:20px}
.sign-box{flex:1;border:1px solid #FCA5A5;border-radius:10px;overflow:hidden}
.sign-box-hdr{background:linear-gradient(90deg,#DC2626,#EA580C);padding:8px 14px;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.8px;text-align:center}
.sign-box-body{padding:16px;min-height:80px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;background:#FFF7ED}
.sign-line{width:100%;border-bottom:2px solid #FCA5A5;margin-bottom:6px}
.sign-name{font-size:10px;font-weight:700;color:#4B5563;text-align:center}
.sign-title{font-size:9px;color:#9CA3AF;text-align:center;margin-top:2px}
.onay{margin-top:20px;background:linear-gradient(135deg,#FEF3C7,#FDE68A);border:2px solid #F59E0B;border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px}
.onay i{font-size:24px;color:#B45309;flex-shrink:0}
.onay-text{font-size:11px;color:#78350F;line-height:1.6}
.onay-text strong{display:block;font-size:12px;margin-bottom:2px}
.ftr{background:linear-gradient(90deg,#1F2937,#374151);padding:12px 36px;display:flex;align-items:center;justify-content:space-between}
.ftr-brand{font-size:11px;font-weight:800;color:#D1D5DB;letter-spacing:1px}
.ftr-info{font-size:9px;color:#6B7280;font-family:monospace}
@media print{body{background:#fff!important}.page{width:100%!important}@page{size:A4 portrait;margin:0.5cm}}
</style></head><body>
<div class="page">
<div class="hdr"><div class="hdr-inner">
<div class="hdr-logo"><div class="hdr-logo-circle"><i class="ri-shield-check-fill"></i></div><div class="hdr-logo-name">${esc(firma?.ad || 'Firma')}</div></div>
<div class="hdr-body"><div class="hdr-badge">Resmi Belge</div><div class="hdr-title">TEMEL İSG EĞİTİMİ<span>Katılım ve Tamamlama Belgesi</span></div></div>
<div class="hdr-right"><div class="hdr-right-label">Belge No</div><div class="hdr-right-val">${esc(no)}</div><div class="hdr-right-label" style="margin-top:6px">Tarih</div><div class="hdr-right-date">${today()}</div></div>
</div></div><div class="strip"></div>
<div class="body">
<div class="sayin">Sayın, <strong>${esc(p.adSoyad)}</strong></div>
<div class="intro"><strong>${today()}</strong> tarihinde <strong>${esc(firma?.ad || '')}</strong> bünyesinde düzenlenen <strong>"Temel İSG Eğitimi"</strong>ni başarıyla tamamladığınız onaylanmaktadır.</div>
<div class="sec-title"><div class="sec-title-bar"></div><div class="sec-title-text">Katılımcı Bilgileri</div></div>
<table class="p-table"><thead><tr><th>Bilgi Alanı</th><th>Değer</th></tr></thead><tbody>
<tr><td class="label">Adı Soyadı</td><td style="font-weight:800">${esc(p.adSoyad)}</td></tr>
<tr><td class="label">T.C. Kimlik No</td><td>${esc(p.tc || '—')}</td></tr>
<tr><td class="label">Görev / Ünvan</td><td>${esc(p.gorev || '—')}</td></tr>
<tr><td class="label">Bağlı Firma</td><td>${esc(firma?.ad || '—')}</td></tr>
</tbody></table>
<div class="sec-title"><div class="sec-title-bar"></div><div class="sec-title-text">Eğitim Bilgileri</div></div>
<div class="egitim-grid">
<div class="egitim-card"><i class="ri-calendar-event-line"></i><div class="egitim-card-label">Tarih</div><div class="egitim-card-val">${today()}</div></div>
<div class="egitim-card"><i class="ri-time-line"></i><div class="egitim-card-label">Süre</div><div class="egitim-card-val">8 Saat</div></div>
<div class="egitim-card"><i class="ri-user-star-line"></i><div class="egitim-card-label">Eğitimi Veren</div><div class="egitim-card-val">${esc(egitmen || 'İSG Uzmanı')}</div></div>
<div class="egitim-card"><i class="ri-map-pin-line"></i><div class="egitim-card-label">Yer</div><div class="egitim-card-val">${esc(yer)}</div></div>
<div class="egitim-card"><i class="ri-building-2-line"></i><div class="egitim-card-label">Firma</div><div class="egitim-card-val">${esc(firma?.ad || '—')}</div></div>
<div class="egitim-card"><i class="ri-award-line"></i><div class="egitim-card-label">Durum</div><div class="egitim-card-val" style="color:#16A34A">Tamamlandı ✓</div></div>
</div>
<div class="sec-title"><div class="sec-title-bar"></div><div class="sec-title-text">Eğitim Konuları</div></div>
<div class="konular-grid">${konular.map((k, i) => `<div class="konu-item"><div class="konu-no">${i+1}</div><span>${esc(k)}</span></div>`).join('')}</div>
<div class="onay"><i class="ri-information-line"></i><div class="onay-text"><strong>Önemli Not</strong>Bu belge 6331 Sayılı Kanun'un 17. maddesi kapsamında düzenlenmiştir.</div></div>
<div class="sign-area"><div class="sign-boxes">
<div class="sign-box"><div class="sign-box-hdr">Katılımcı İmzası</div><div class="sign-box-body"><div class="sign-line"></div><div class="sign-name">${esc(p.adSoyad)}</div><div class="sign-title">${esc(p.gorev || 'Personel')}</div></div></div>
<div class="sign-box"><div class="sign-box-hdr">Eğitimi Veren</div><div class="sign-box-body"><div class="sign-line"></div><div class="sign-name">${esc(egitmen || 'İSG Uzmanı')}</div><div class="sign-title">Eğitmen</div></div></div>
<div class="sign-box"><div class="sign-box-hdr">İşveren / Yetkili</div><div class="sign-box-body"><div class="sign-line"></div><div class="sign-name">${esc(firma?.yetkiliKisi || 'Firma Yetkilisi')}</div></div></div>
</div></div>
</div>
<div class="ftr"><div class="ftr-brand">ISG DENETİM SİSTEMİ</div><div class="ftr-info">${esc(no)} • ${today()}</div></div>
</div></body></html>`;
}

function tplYuksekteCalisma(p: Personel, _firma: Firma | undefined, extra: TemplateExtra): string {
  const referansNo = extra.referansNo || '';
  const egitimTarihi = extra.egitimTarihi || '';
  const egitimciAd = extra.egitmenAdi || '';
  const egitimciSertNo = extra.egitimciSertifikaNo || '';
  const no = docNo('yuksekte-calisma-sertifika');
  const egitimKonulari = [
    'Yüksekte Güvenli Çalışmalarda İş Sağlığı',
    'İş Sağlığı ve Güvenliği Temel İlkeleri',
    'Risk Değerlendirme ve Korunma Yöntemleri',
    'Kişisel Koruyucu Donanım Kullanımı',
    'Güvenli Çalışma Ekipmanları ve Bakımı',
    'Yasal Mevzuat ve Talimatlar',
    'Acil Durum ve Kurtarma Prosedürleri',
    'Eğitim Değerlendirme Testi',
  ];
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Yüksekte Çalışma Sertifikası</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Georgia,serif;color:#2D0A0A;background:#f9f5f0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:794px;min-height:1122px;margin:0 auto;background:#fff;padding:24px;position:relative}
.outer-border{border:7px solid #922020;min-height:calc(1122px - 48px);position:relative;padding:10px}
.inner-border{border:2px solid #A83030;min-height:calc(1122px - 88px);position:relative;padding:8px;background:linear-gradient(180deg,#FFF9F5 0%,#FFFAF7 50%,#FFF9F5 100%)}
.corner{position:absolute;width:50px;height:50px;z-index:2}
.corner-tl{top:-2px;left:-2px;border-top:4px solid #922020;border-left:4px solid #922020}
.corner-tr{top:-2px;right:-2px;border-top:4px solid #922020;border-right:4px solid #922020}
.corner-bl{bottom:-2px;left:-2px;border-bottom:4px solid #922020;border-left:4px solid #922020}
.corner-br{bottom:-2px;right:-2px;border-bottom:4px solid #922020;border-right:4px solid #922020}
.corner-star{position:absolute;font-size:22px;color:#922020;font-style:normal;z-index:3;line-height:1}
.cs-tl{top:6px;left:6px}.cs-tr{top:6px;right:6px}.cs-bl{bottom:6px;left:6px}.cs-br{bottom:6px;right:6px}
.content{padding:28px 40px}
.brand-header{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:3px double #922020}
.brand-shield{width:64px;height:64px;background:linear-gradient(135deg,#922020,#B03030);border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #C04040;flex-shrink:0}
.brand-shield i{font-size:28px;color:#FFD700}
.brand-name{text-align:center}
.brand-name-main{font-size:20px;font-weight:900;letter-spacing:2px;color:#922020;text-transform:uppercase}
.brand-name-sub{font-size:10px;letter-spacing:3px;color:#A83030;text-transform:uppercase;margin-top:2px}
.gold-line{display:flex;align-items:center;gap:8px;justify-content:center;margin:14px 0}
.gold-line-bar{flex:1;height:1px;background:linear-gradient(90deg,transparent,#C0A020,transparent)}
.gold-line-diamond{width:8px;height:8px;background:#C0A020;transform:rotate(45deg);flex-shrink:0}
.cert-title{text-align:center;margin:16px 0}
.cert-title-main{font-size:17px;font-weight:900;letter-spacing:1.5px;color:#5A1010;text-transform:uppercase;line-height:1.4}
.cert-title-sub{font-size:11px;letter-spacing:2px;color:#8A2020;margin-top:6px;text-transform:uppercase}
.sayin-wrap{text-align:center;margin:18px 0 10px}
.sayin-label{font-size:13px;color:#6A1A1A;letter-spacing:1px;margin-bottom:6px}
.sayin-name{font-size:22px;font-weight:900;color:#2D0A0A;letter-spacing:1px;border-bottom:2px solid #922020;display:inline-block;padding:0 20px 6px;min-width:300px;text-align:center}
.desc-box{background:linear-gradient(135deg,#FFF8F8,#FFF9F5);border:1px solid #E8C8C8;border-radius:4px;padding:16px 20px;margin:16px 0;text-align:center;font-size:12.5px;line-height:1.9;color:#3D0808}
.desc-box strong{color:#922020}
.divider{display:flex;align-items:center;gap:10px;margin:14px 0}
.divider-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,#A02020,transparent)}
.divider-text{font-size:11px;font-weight:700;letter-spacing:2px;color:#A02020;text-transform:uppercase;white-space:nowrap}
.topics-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.topic-item{display:flex;align-items:flex-start;gap:8px;padding:7px 12px;background:#FFF8F8;border:1px solid #E8C8C8;border-left:3px solid #A02020;font-size:11.5px;color:#3D0808}
.topic-no{font-weight:900;color:#922020;min-width:18px;flex-shrink:0}
.bottom-section{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px}
.bottom-card{background:#FFF8F8;border:1px solid #E8C8C8;border-radius:4px;overflow:hidden}
.bottom-card-hdr{background:linear-gradient(90deg,#922020,#A83030);padding:8px 14px;font-size:10px;font-weight:700;color:#FFD700;letter-spacing:1.5px;text-transform:uppercase;text-align:center}
.bottom-card-body{padding:14px}
.bottom-info-row{display:flex;flex-direction:column;margin-bottom:10px}
.b-label{font-size:9px;font-weight:700;color:#A02020;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px}
.b-value{font-size:12px;font-weight:700;color:#2D0A0A;border-bottom:1px solid #E8C8C8;padding-bottom:4px}
.b-value.big{font-size:14px;font-weight:900}
.seal-area{text-align:center;margin-top:10px}
.seal-circle{width:70px;height:70px;border:3px solid #922020;border-radius:50%;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#FFF8F8,#FFECE8)}
.seal-circle i{font-size:26px;color:#922020}
.seal-label{font-size:9px;color:#A02020;letter-spacing:1px;text-transform:uppercase}
.sign-line-d{width:100%;border-bottom:1px dashed #A02020;margin:8px 0 4px}
.sign-name-sm{font-size:9px;color:#6A1A1A;text-align:center}
.cert-footer{margin-top:16px;padding-top:14px;border-top:3px double #922020;display:flex;align-items:center;justify-content:space-between}
.cert-footer-left{font-size:9px;color:#A02020;font-style:italic}
.cert-footer-right{font-size:9px;color:#A02020;font-family:monospace}
.cert-footer-badge{background:#922020;color:#FFD700;font-size:9px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:1px}
@media print{body{background:#fff!important}.page{width:100%!important;padding:10px!important;min-height:auto!important}.outer-border{min-height:auto!important}.inner-border{min-height:auto!important}@page{size:A4 portrait;margin:0.3cm}}
</style></head><body>
<div class="page"><div class="outer-border">
<div class="corner corner-tl"></div><div class="corner corner-tr"></div><div class="corner corner-bl"></div><div class="corner corner-br"></div>
<i class="corner-star cs-tl">✦</i><i class="corner-star cs-tr">✦</i><i class="corner-star cs-bl">✦</i><i class="corner-star cs-br">✦</i>
<div class="inner-border"><div class="content">
<div class="brand-header">
<div class="brand-shield"><i class="ri-shield-star-fill"></i></div>
<div class="brand-name"><div class="brand-name-main">İŞ SAĞLIĞI VE GÜVENLİĞİ</div><div class="brand-name-sub">Eğitim Katılım Sertifikası</div></div>
<div class="brand-shield"><i class="ri-award-fill"></i></div>
</div>
<div class="gold-line"><div class="gold-line-bar"></div><div class="gold-line-diamond"></div><div class="gold-line-bar"></div></div>
<div class="cert-title">
<div class="cert-title-main">YÜKSEKTE GÜVENLİ ÇALIŞMALARDA<br>İŞ SAĞLIĞI ve GÜVENLİĞİ EĞİTİMİ<br>KATILIM SERTİFİKASI</div>
<div class="cert-title-sub">— Resmi Eğitim Katılım Belgesi —</div>
</div>
<div class="gold-line"><div class="gold-line-bar"></div><div class="gold-line-diamond"></div><div class="gold-line-bar"></div></div>
<div class="sayin-wrap"><div class="sayin-label">SAYIN;</div><div class="sayin-name">${esc(p.adSoyad)}</div></div>
<div class="desc-box">
<strong>Yüksekte Güvenli Çalışmalarda İş Sağlığı ve Güvenliği Eğitimi</strong> programına katılmıştır.
${referansNo ? `<strong>${esc(referansNo)}</strong> referanslı ve ` : ''}<strong>${esc(egitimTarihi || today())}</strong> tarihinde düzenlenen
<strong>2 saat</strong> süreli eğitimi başarıyla tamamlayarak bu sertifikayı almaya hak kazanmıştır.
</div>
<div class="divider"><div class="divider-line"></div><div class="divider-text">Eğitim Konuları</div><div class="divider-line"></div></div>
<div class="topics-grid">${egitimKonulari.map((k, i) => `<div class="topic-item"><span class="topic-no">${i+1}.</span><span>${esc(k)}</span></div>`).join('')}</div>
<div class="divider" style="margin-top:16px"><div class="divider-line"></div><div class="divider-line"></div></div>
<div class="bottom-section">
<div class="bottom-card"><div class="bottom-card-hdr">Katılımcının</div><div class="bottom-card-body">
<div class="bottom-info-row"><span class="b-label">Adı ve Soyadı</span><span class="b-value big">${esc(p.adSoyad)}</span></div>
<div class="bottom-info-row"><span class="b-label">T.C. Kimlik No</span><span class="b-value">${esc(p.tc || '—')}</span></div>
<div class="bottom-info-row"><span class="b-label">Görev Unvanı</span><span class="b-value">${esc(p.gorev || '—')}</span></div>
<div class="seal-area"><div class="sign-line-d"></div><div class="sign-name-sm">Katılımcı İmzası</div></div>
</div></div>
<div class="bottom-card"><div class="bottom-card-hdr">Eğitim Veren</div><div class="bottom-card-body">
<div class="bottom-info-row"><span class="b-label">Eğitimci Adı Soyadı</span><span class="b-value big">${esc(egitimciAd)}</span></div>
${egitimciSertNo ? `<div class="bottom-info-row"><span class="b-label">Sertifika No</span><span class="b-value">${esc(egitimciSertNo)}</span></div>` : ''}
<div class="seal-area"><div class="seal-circle"><i class="ri-award-fill"></i></div><div class="seal-label">Mühür &amp; Eğitimci İmzası</div></div>
</div></div>
</div>
<div class="cert-footer">
<div class="cert-footer-left">Bu sertifika eğitimi tamamlayan katılımcıya verilmiştir.</div>
<div class="cert-footer-badge">ISG EĞİTİM BELGESİ</div>
<div class="cert-footer-right">${esc(no)} • ${esc(egitimTarihi || today())}</div>
</div>
</div></div></div></div>
</body></html>`;
}

function tplTemelIsgBelgeKonular(p: Personel, _firma: Firma | undefined, extra: TemplateExtra): string {
  const egitimTarihi = extra.egitimTarihi || today();
  const egitimSuresi = extra.egitimSuresi || '8';
  const isyeriUnvani = extra.isyeriUnvani || (_firma?.ad || '—');
  const isverenAd = extra.isverenAdSoyadi || (_firma?.yetkiliKisi || '—');
  const isverenGorev = extra.isverenGorevUnvani || 'İşveren';
  const eg1Ad = extra.egitimci1AdSoyad || '';
  const eg1Gorev = extra.egitimci1GorevUnvani || '';
  const eg2Ad = extra.egitimci2AdSoyad || '';
  const eg2Gorev = extra.egitimci2GorevUnvani || '';
  const no = docNo('temel-isg-belge-konular');
  const kkdListesi = ['Baret (Koruyucu Kask)','İş Güvenlik Ayakkabısı','Güvenlik Gözlüğü','İş Eldiveni','Reflektörlü Yelek','Toz Maskesi (FFP2)','Kulaklık / Kulak Tıkacı','Güvenlik Kemeri / Emniyet Halatı'];
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Temel İSG Eğitim Belgesi ve Konuları</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Georgia,serif;color:#1A1A1A;background:#f5f0e8;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page1{width:1122px;min-height:794px;margin:0 auto 40px;background:#fff;padding:22px;position:relative}
.page2{width:1122px;min-height:794px;margin:0 auto;background:#fff;padding:22px;position:relative}
.gold-outer{border:6px solid #C0A020;padding:8px;min-height:calc(794px - 44px);position:relative;background:#fff}
.gold-mid{border:1px solid #DAB840;padding:6px;min-height:calc(794px - 72px);position:relative}
.gold-inner{border:3px solid #C0A020;padding:0;min-height:calc(794px - 90px);position:relative;background:linear-gradient(135deg,#FFFDF0 0%,#FFFFF8 50%,#FFFDF0 100%)}
.gc{position:absolute;width:45px;height:45px;z-index:2}
.gc-tl{top:-3px;left:-3px;border-top:5px solid #C0A020;border-left:5px solid #C0A020}
.gc-tr{top:-3px;right:-3px;border-top:5px solid #C0A020;border-right:5px solid #C0A020}
.gc-bl{bottom:-3px;left:-3px;border-bottom:5px solid #C0A020;border-left:5px solid #C0A020}
.gc-br{bottom:-3px;right:-3px;border-bottom:5px solid #C0A020;border-right:5px solid #C0A020}
.g-star{position:absolute;font-size:18px;color:#C0A020;font-style:normal;z-index:3;line-height:1}
.gs-tl{top:4px;left:4px}.gs-tr{top:4px;right:4px}.gs-bl{bottom:4px;left:4px}.gs-br{bottom:4px;right:4px}
.p1-content{padding:20px 30px}
.p1-title-block{text-align:center;padding:14px 20px 12px;border-bottom:3px double #C0A020;margin-bottom:16px}
.p1-main-title{font-size:19px;font-weight:900;letter-spacing:1.5px;color:#3D2800;text-transform:uppercase}
.p1-sub-title{font-size:10px;letter-spacing:2.5px;color:#7A5B00;margin-top:5px;text-transform:uppercase}
.gl{display:flex;align-items:center;gap:6px;margin:10px 0}
.gl-bar{flex:1;height:1px;background:linear-gradient(90deg,transparent,#C0A020,transparent)}
.gl-d{width:6px;height:6px;background:#C0A020;transform:rotate(45deg);flex-shrink:0}
.p1-desc{background:#FFFBEE;border:1px solid #EDD88A;border-radius:3px;padding:12px 16px;margin:12px 0;font-size:11.5px;line-height:1.8;color:#3D2800;text-align:center}
.p1-form{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:14px 0}
.p1-section-title{font-size:10px;font-weight:700;letter-spacing:1.5px;color:#7A5B00;text-transform:uppercase;border-bottom:2px solid #C0A020;padding-bottom:5px;margin-bottom:10px;grid-column:1/-1}
.form-field{display:flex;flex-direction:column;gap:4px}
.form-field.full{grid-column:1/-1}
.form-field.half{grid-column:span 2}
.f-label{font-size:9px;font-weight:700;color:#7A5B00;text-transform:uppercase;letter-spacing:0.8px}
.f-line{border-bottom:1px solid #C0A020;min-height:22px;font-size:12px;font-weight:600;color:#1A1A1A;padding-bottom:2px}
.f-line.bold-val{font-size:13px;font-weight:900}
.p1-sign-area{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-top:14px;padding-top:12px;border-top:2px solid #C0A020}
.sign-col{text-align:center}
.sign-col-title{font-size:9px;font-weight:700;color:#7A5B00;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:30px}
.sign-line-gold{border-bottom:1px solid #C0A020;margin:0 8px 4px}
.sign-name-gold{font-size:9px;color:#5A4200}
.sign-name-gold.bold{font-size:10px;font-weight:700;color:#1A1A1A}
.geo-outer{border:5px solid #2D4A7A;padding:8px;min-height:calc(794px - 44px);position:relative}
.geo-inner{border:1px solid #4A6FA5;padding:0;min-height:calc(794px - 68px);background:#FAFCFF}
.geo-corner{position:absolute;width:40px;height:40px}
.geo-tl{top:0;left:0;border-top:4px solid #1A3A6A;border-left:4px solid #1A3A6A;z-index:2}
.geo-tr{top:0;right:0;border-top:4px solid #1A3A6A;border-right:4px solid #1A3A6A;z-index:2}
.geo-bl{bottom:0;left:0;border-bottom:4px solid #1A3A6A;border-left:4px solid #1A3A6A;z-index:2}
.geo-br{bottom:0;right:0;border-bottom:4px solid #1A3A6A;border-right:4px solid #1A3A6A;z-index:2}
.p2-content{padding:20px 30px}
.p2-title-block{text-align:center;padding:12px;border-bottom:3px double #2D4A7A;margin-bottom:16px;background:linear-gradient(90deg,#F0F4FF,#E8EEFF,#F0F4FF)}
.p2-main-title{font-size:17px;font-weight:900;letter-spacing:2px;color:#1A3A6A;text-transform:uppercase}
.p2-cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.topic-section-hdr{font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;background:linear-gradient(90deg,#2D4A7A,#4A6FA5);color:#fff;border-radius:2px;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.topic-section-hdr i{font-size:14px}
.topic-ul{list-style:none;margin-bottom:12px}
.topic-li{display:flex;align-items:flex-start;gap:7px;padding:5px 8px;border-bottom:1px dotted #C8D8F0;font-size:11px;color:#1A2A4A}
.topic-li:last-child{border-bottom:none}
.topic-bullet{width:14px;height:14px;background:#2D4A7A;border-radius:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.topic-bullet i{font-size:8px;color:#fff}
.kkd-title{font-size:11px;font-weight:900;letter-spacing:1px;color:#fff;text-transform:uppercase;padding:6px 12px;background:linear-gradient(90deg,#1A5C1A,#2E7D2E);border-radius:2px;margin:10px 0 8px;display:flex;align-items:center;gap:8px}
.kkd-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
.kkd-tbl thead tr{background:#1A5C1A;color:#fff}
.kkd-tbl thead th{padding:6px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.kkd-tbl tbody tr:nth-child(odd){background:#F0FFF0}
.kkd-tbl tbody tr:nth-child(even){background:#E8F5E8}
.kkd-tbl tbody td{padding:5px 8px;border-bottom:1px solid #B8D8B8;color:#1A3A1A}
.kkd-tbl tbody td.sign-td{border-bottom:1px dashed #5A7A5A;min-width:80px}
@media print{body{background:#fff!important}.page1,.page2{width:100%!important;padding:8px!important;min-height:auto!important;margin:0!important}.gold-outer,.gold-mid,.gold-inner,.geo-outer,.geo-inner{min-height:auto!important}.page1{page-break-after:always}@page{size:A4 landscape;margin:0.3cm}}
</style></head><body>
<div class="page1"><div class="gold-outer">
<div class="gc gc-tl"></div><div class="gc gc-tr"></div><div class="gc gc-bl"></div><div class="gc gc-br"></div>
<i class="g-star gs-tl">✦</i><i class="g-star gs-tr">✦</i><i class="g-star gs-bl">✦</i><i class="g-star gs-br">✦</i>
<div class="gold-mid"><div class="gold-inner"><div class="p1-content">
<div class="p1-title-block"><div class="p1-main-title">İŞ SAĞLIĞI VE GÜVENLİĞİ TEMEL EĞİTİM BELGESİ</div><div class="p1-sub-title">— Resmi Eğitim Tamamlama Belgesi —</div></div>
<div class="gl"><div class="gl-bar"></div><div class="gl-d"></div><div class="gl-bar"></div></div>
<div class="p1-desc">Yukarıda adı geçen çalışan, <em>Çalışanların İSG Eğitimlerinin Usul ve Esasları Hakkındaki Yönetmelik</em> kapsamında eğitimleri başarıyla tamamlayarak bu belgeyi almaya hak kazanmıştır.</div>
<div class="gl"><div class="gl-bar"></div><div class="gl-d"></div><div class="gl-bar"></div></div>
<div class="p1-form">
<div class="p1-section-title">Katılımcı Bilgileri</div>
<div class="form-field half"><span class="f-label">Adı Soyadı</span><span class="f-line bold-val">${esc(p.adSoyad)}</span></div>
<div class="form-field"><span class="f-label">T.C. Kimlik No</span><span class="f-line">${esc(p.tc || '—')}</span></div>
<div class="form-field full"><span class="f-label">Görev Unvanı</span><span class="f-line">${esc(p.gorev || '—')}</span></div>
<div class="p1-section-title" style="margin-top:6px">Eğitim Bilgileri</div>
<div class="form-field"><span class="f-label">Eğitim Tarihi</span><span class="f-line">${esc(egitimTarihi)}</span></div>
<div class="form-field"><span class="f-label">Eğitim Süresi</span><span class="f-line">${esc(egitimSuresi)} Saat</span></div>
<div class="form-field"><span class="f-label">Eğitimin Şekli</span><span class="f-line">Örgün</span></div>
<div class="form-field full"><span class="f-label">İşyeri Unvanı</span><span class="f-line">${esc(isyeriUnvani)}</span></div>
<div class="p1-section-title" style="margin-top:6px">İşveren Bilgileri</div>
<div class="form-field half"><span class="f-label">İşverenin Adı Soyadı</span><span class="f-line">${esc(isverenAd)}</span></div>
<div class="form-field"><span class="f-label">Görev Unvanı</span><span class="f-line">${esc(isverenGorev)}</span></div>
<div class="p1-section-title" style="margin-top:6px">Eğitimci Bilgileri</div>
<div class="form-field half"><span class="f-label">Eğitimci 1 — Adı Soyadı</span><span class="f-line">${esc(eg1Ad)}</span></div>
<div class="form-field"><span class="f-label">Görev Unvanı</span><span class="f-line">${esc(eg1Gorev)}</span></div>
<div class="form-field half"><span class="f-label">Eğitimci 2 — Adı Soyadı</span><span class="f-line">${esc(eg2Ad)}</span></div>
<div class="form-field"><span class="f-label">Görev Unvanı</span><span class="f-line">${esc(eg2Gorev)}</span></div>
</div>
<div class="gl" style="margin-top:10px"><div class="gl-bar"></div><div class="gl-d"></div><div class="gl-bar"></div></div>
<div class="p1-sign-area">
<div class="sign-col"><div class="sign-col-title">Katılımcı İmzası</div><div class="sign-line-gold"></div><div class="sign-name-gold bold">${esc(p.adSoyad)}</div><div class="sign-name-gold">${esc(p.gorev || '—')}</div></div>
<div class="sign-col"><div class="sign-col-title">İşveren İmzası / Kaşe</div><div class="sign-line-gold"></div><div class="sign-name-gold bold">${esc(isverenAd)}</div><div class="sign-name-gold">${esc(isverenGorev)}</div></div>
<div class="sign-col"><div class="sign-col-title">Eğitimci 1 İmzası</div><div class="sign-line-gold"></div><div class="sign-name-gold bold">${esc(eg1Ad)}</div><div class="sign-name-gold">${esc(eg1Gorev)}</div></div>
<div class="sign-col"><div class="sign-col-title">Eğitimci 2 İmzası</div><div class="sign-line-gold"></div><div class="sign-name-gold bold">${esc(eg2Ad)}</div><div class="sign-name-gold">${esc(eg2Gorev)}</div></div>
</div>
</div></div></div></div></div>

<div class="page2"><div class="geo-outer">
<div class="geo-corner geo-tl"></div><div class="geo-corner geo-tr"></div><div class="geo-corner geo-bl"></div><div class="geo-corner geo-br"></div>
<div class="geo-inner"><div class="p2-content">
<div class="p2-title-block"><div class="p2-main-title">EĞİTİM KONULARI</div></div>
<div class="p2-cols">
<div>
<div class="topic-section-hdr"><i class="ri-file-list-line"></i>1. Genel Konular</div>
<ul class="topic-ul">${['Çalışma mevzuatı ile ilgili bilgiler','Çalışanların yasal hak ve sorumlulukları','İşyeri temizliği ve düzeni','İş kazası ve meslek hastalığından doğan hukuki sonuçlar'].map(k=>`<li class="topic-li"><div class="topic-bullet"><i class="ri-check-line"></i></div><span>${esc(k)}</span></li>`).join('')}</ul>
<div class="topic-section-hdr" style="margin-top:6px"><i class="ri-tools-line"></i>2. Teknik Konular</div>
<ul class="topic-ul">${['Kimyasal, fiziksel ve ergonomik risk etmenleri','Elle kaldırma ve taşıma','Parlama, patlama, yangın ve yangından korunma','İş ekipmanlarının güvenli kullanımı','Ekranlı araçlarla çalışma','Elektrik tehlikeleri, riskleri ve önlemleri','İş kazalarının sebepleri ve korunma prensipleri','Güvenlik ve sağlık işaretleri','Kişisel koruyucu donanım kullanımı','İSG genel kuralları ve güvenlik kültürü','Tahliye ve kurtarma'].map(k=>`<li class="topic-li"><div class="topic-bullet"><i class="ri-check-line"></i></div><span>${esc(k)}</span></li>`).join('')}</ul>
<div class="topic-section-hdr" style="margin-top:6px"><i class="ri-heart-pulse-line"></i>3. Sağlık Konuları</div>
<ul class="topic-ul">${['Meslek hastalıklarının sebepleri','Hastalıktan korunma prensipleri','Biyolojik ve psikososyal risk etmenleri','İlkyardım','Tütün ürünlerinin zararları ve pasif etkilenim'].map(k=>`<li class="topic-li"><div class="topic-bullet"><i class="ri-check-line"></i></div><span>${esc(k)}</span></li>`).join('')}</ul>
</div>
<div>
<div class="topic-section-hdr"><i class="ri-list-check"></i>4. Diğer Konular</div>
<ul class="topic-ul">${['Düzenli istifleme yöntemleri','El aletlerinin güvenli kullanımı','Kimyasallarla çalışmalarda dikkat edilmesi gerekenler','Duvar işlerinde güvenli çalışma','Elektrik işlerinde güvenli çalışma','Mekanik işlerinde güvenli çalışma','Dış cephe işlerinde güvenli çalışma','Alçı işlerinde güvenli çalışma','İş makinaları ile yapılan işlerde güvenli çalışma'].map(k=>`<li class="topic-li"><div class="topic-bullet"><i class="ri-check-line"></i></div><span>${esc(k)}</span></li>`).join('')}</ul>
<div class="kkd-title"><i class="ri-shield-check-line"></i>KKD Zimmet Listesi</div>
<table class="kkd-tbl"><thead><tr><th>No</th><th>KKD Adı</th><th>Miktar</th><th>Teslim Tarihi</th><th>İmza</th></tr></thead><tbody>
${kkdListesi.map((kkd,i)=>`<tr><td style="text-align:center;font-weight:700;width:28px">${i+1}</td><td style="font-weight:600">${esc(kkd)}</td><td style="text-align:center;width:55px">1 Adet</td><td style="width:80px">${esc(egitimTarihi)}</td><td class="sign-td" style="width:90px">&nbsp;</td></tr>`).join('')}
</tbody></table>
</div>
</div>
<div style="margin-top:12px;padding-top:8px;border-top:2px solid #2D4A7A;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#4A6FA5">
<span><strong>ISG DENETİM SİSTEMİ</strong> — Eğitim Konuları Listesi</span>
<span style="font-family:monospace">${esc(no)} • Sayfa 2/2</span>
</div>
</div></div></div></div>
</body></html>`;
}

export function generateDocument(template: DocTemplate, personel: Personel, firma: Firma | undefined, extra: TemplateExtra): void {
  let html = '';
  switch (template) {
    case 'egitim-katilim': html = tplEgitimKatilim(personel, firma, extra); break;
    case 'kkd-zimmet': html = tplKkdZimmet(personel, firma); break;
    case 'isbasi-egitim': html = tplIsbasiEgitim(personel, firma, extra); break;
    case 'saglik-muayene': html = tplSaglikMuayene(personel, firma, extra); break;
    case 'oryantasyon': html = tplOryantasyon(personel, firma); break;
    case 'gorevlendirme': html = tplGorevlendirme(personel, firma, extra); break;
    case 'temel-isg-egitimi': html = tplTemelIsgEgitimi(personel, firma, extra); break;
    case 'yuksekte-calisma-sertifika': html = tplYuksekteCalisma(personel, firma, extra); break;
    case 'temel-isg-belge-konular': html = tplTemelIsgBelgeKonular(personel, firma, extra); break;
    default: return;
  }
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) { URL.revokeObjectURL(url); return; }
  win.addEventListener('load', () => {
    setTimeout(() => { try { win.focus(); win.print(); } catch { /* ignore */ } setTimeout(() => URL.revokeObjectURL(url), 2000); }, 600);
  });
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
