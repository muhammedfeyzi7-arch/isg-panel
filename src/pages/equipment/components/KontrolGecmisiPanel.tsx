import type { EkipmanKontrolKaydi, EkipmanStatus } from '@/types';

const DURUM_CFG: Record<EkipmanStatus, { color: string; bg: string; icon: string }> = {
  'Uygun':       { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: 'ri-checkbox-circle-line' },
  'Uygun Değil': { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
  'Bakımda':     { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  icon: 'ri-time-line' },
  'Hurda':       { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-delete-bin-line' },
};

interface Props {
  gecmis: EkipmanKontrolKaydi[];
}

export default function KontrolGecmisiPanel({ gecmis }: Props) {
  if (gecmis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <div className="w-12 h-12 flex items-center justify-center rounded-xl mb-3"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <i className="ri-history-line text-xl" style={{ color: '#FBBF24' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Henüz kontrol kaydı yok</p>
        <p className="text-xs mt-1" style={{ color: '#334155' }}>
          QR okutulduğunda veya manuel kontrol yapıldığında burada görünür
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Özet */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <i className="ri-history-line text-sm" style={{ color: '#818CF8' }} />
        <span className="text-xs font-semibold" style={{ color: '#818CF8' }}>
          Toplam {gecmis.length} kontrol kaydı
        </span>
        <span className="text-xs ml-auto" style={{ color: '#475569' }}>
          Son: {new Date(gecmis[0].tarih).toLocaleDateString('tr-TR')}
        </span>
      </div>

      {/* Kayıtlar */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {gecmis.map((kayit, idx) => {
          const cfg = DURUM_CFG[kayit.durum] ?? DURUM_CFG['Uygun'];
          const isFirst = idx === 0;
          return (
            <div key={kayit.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: isFirst ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isFirst ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {/* İkon */}
              <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                style={{ background: cfg.bg }}>
                <i className={`${cfg.icon} text-xs`} style={{ color: cfg.color }} />
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {kayit.durum}
                  </span>
                  {isFirst && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
                      Son Kontrol
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap"
                    style={{
                      background: kayit.kaynak === 'qr' ? 'rgba(168,85,247,0.12)' : 'rgba(99,102,241,0.12)',
                      color: kayit.kaynak === 'qr' ? '#A855F7' : '#818CF8',
                    }}>
                    <i className={`${kayit.kaynak === 'qr' ? 'ri-qr-code-line' : 'ri-edit-line'} mr-0.5`} />
                    {kayit.kaynak === 'qr' ? 'QR' : 'Manuel'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs flex items-center gap-1" style={{ color: '#94A3B8' }}>
                    <i className="ri-user-line text-[10px]" />
                    {kayit.kontrolEden}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: '#64748B' }}>
                    <i className="ri-calendar-line text-[10px]" />
                    {new Date(kayit.tarih).toLocaleDateString('tr-TR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                    {' '}
                    <span style={{ color: '#475569' }}>
                      {new Date(kayit.tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>
                {kayit.notlar && (
                  <p className="text-xs mt-1 italic" style={{ color: '#64748B' }}>
                    <i className="ri-chat-1-line mr-1 text-[10px]" />
                    {kayit.notlar}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
