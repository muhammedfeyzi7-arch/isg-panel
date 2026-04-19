interface StatusBadgeProps {
  status: string;
}

interface BadgeConfig {
  bg: string;
  text: string;
  dot: string;
}

const statusMap: Record<string, BadgeConfig> = {
  // Türkçe
  'Aktif':              { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Pasif':              { bg: 'var(--surface)',      text: 'var(--text-muted)',    dot: 'var(--text-muted)' },
  'Yenileme Bekliyor':  { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  'Süresi Dolmuş':      { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  'Çok Tehlikeli':      { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  'Tehlikeli':          { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  'Az Tehlikeli':       { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Hekim':              { bg: 'var(--purple-bg)',   text: 'var(--purple-text)',   dot: 'var(--purple)' },
  'Uzman':              { bg: 'var(--info-bg)',     text: 'var(--info-text)',     dot: 'var(--info)' },
  'Tamamlandı':         { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Aktif Ziyaret':      { bg: 'var(--info-bg)',     text: 'var(--info-text)',     dot: 'var(--info)' },
  'Eksik Kayıt':        { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  'Hazır':              { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Taslak':             { bg: 'var(--surface)',      text: 'var(--text-muted)',    dot: 'var(--text-muted)' },
  'İncelemede':         { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  'Yönetici':           { bg: 'var(--purple-bg)',   text: 'var(--purple-text)',   dot: 'var(--purple)' },
  'İşleniyor':          { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  'Hata':               { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  // DB lowercase değerleri (visits.status, profiles.status)
  'active':             { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'completed':          { bg: 'var(--info-bg)',     text: 'var(--info-text)',     dot: 'var(--info)' },
  'passive':            { bg: 'var(--surface)',      text: 'var(--text-muted)',    dot: 'var(--text-muted)' },
  // QR / GPRS badge'leri
  'QR':                 { bg: 'var(--info-bg)',     text: 'var(--info-text)',     dot: 'var(--info)' },
  'Manuel':             { bg: 'var(--surface)',      text: 'var(--text-muted)',    dot: 'var(--text-muted)' },
  'GPRS':               { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  // İş İzinleri statüsleri
  'Beklemede':          { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  'Onaylı':             { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Reddedildi':         { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  // Eğitim statüsleri
  'Planlandı':          { bg: 'var(--info-bg)',     text: 'var(--info-text)',     dot: 'var(--info)' },
  'İptal':              { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  // Ekipman statüsleri
  'Uygun':              { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Uygun Değil':        { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  // Sağlık kaydı statüsleri
  'Uygun (Çalışabilir)':    { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Uygun Değil (Çalışamaz)':{ bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  'Kısıtlı Uygun':          { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  // Sağlık muayene statüsleri (basit)
  'Muayene Gerekli':    { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  // Belge statüsleri
  'Güncel':             { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Yaklaşıyor':         { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  'Geçerli':            { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'Eksik':              { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
  'Güncelleme Gerekli': { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  // DÖF statüsleri
  'open':               { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  dot: 'var(--warning)' },
  'closed':             { bg: 'var(--success-bg)',  text: 'var(--success-text)',  dot: 'var(--success)' },
  'critical':           { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   dot: 'var(--danger)' },
};

const fallback: BadgeConfig = { bg: 'var(--surface)', text: 'var(--text-muted)', dot: 'var(--text-muted)' };

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusMap[status] ?? fallback;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
      {status}
    </span>
  );
}
