import { useState } from 'react';
import type { IsIzni } from '@/types';
import type { Firma } from '@/types';

const TIP_COLORS: Record<string, string> = {
  'Sıcak Çalışma':      '#F97316',
  'Yüksekte Çalışma':   '#F59E0B',
  'Kapalı Alan':        '#8B5CF6',
  'Elektrikli Çalışma': '#EAB308',
  'Kazı':               '#A16207',
  'Genel':              '#64748B',
};

interface Props {
  izinler: IsIzni[];
  firmalar: Firma[];
  onView: (iz: IsIzni) => void;
}

export default function IsIzniTakvim({ izinler, firmalar, onView }: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Pazartesi başlangıç için offset
  const startOffset = (firstDay + 6) % 7;

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const dayNames = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

  // Her gün için aktif izinleri bul
  const getIzinlerForDay = (day: number) => {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return izinler.filter(iz => {
      if (!iz.baslamaTarihi) return false;
      const start = new Date(iz.baslamaTarihi);
      start.setHours(0, 0, 0, 0);
      const end = iz.bitisTarihi ? new Date(iz.bitisTarihi) : start;
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  };

  const isToday = (day: number) => {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) => {
    const day = i - startOffset + 1;
    return day > 0 ? day : null;
  });

  // 6 satır için padding
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="isg-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-main)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-item)'; }}
        >
          <i className="ri-arrow-left-s-line text-sm" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {monthNames[month]} {year}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {izinler.filter(iz => {
              if (!iz.baslamaTarihi) return false;
              const d = new Date(iz.baslamaTarihi);
              return d.getFullYear() === year && d.getMonth() === month;
            }).length} iş izni bu ay
          </p>
        </div>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
          style={{ background: 'var(--bg-item)', border: '1px solid var(--border-main)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-item)'; }}
        >
          <i className="ri-arrow-right-s-line text-sm" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 px-3 pt-3">
        {dayNames.map(d => (
          <div key={d} className="text-center py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{d}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px px-3 pb-4" style={{ background: 'var(--border-subtle)' }}>
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[80px]" style={{ background: 'var(--bg-app)' }} />;
          }
          const dayIzinler = getIzinlerForDay(day);
          const todayCell = isToday(day);

          return (
            <div
              key={day}
              className="min-h-[80px] p-1.5 flex flex-col gap-1"
              style={{
                background: todayCell ? 'rgba(99,102,241,0.06)' : 'var(--bg-app)',
              }}
            >
              {/* Day number */}
              <div className="flex items-center justify-center">
                <span
                  className="w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-bold"
                  style={todayCell
                    ? { background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: 'white' }
                    : { color: 'var(--text-muted)' }
                  }
                >
                  {day}
                </span>
              </div>

              {/* İzinler */}
              {dayIzinler.slice(0, 3).map(iz => {
                const color = TIP_COLORS[iz.tip] ?? '#64748B';
                const firma = firmalar.find(f => f.id === iz.firmaId);
                return (
                  <button
                    key={iz.id}
                    onClick={() => onView(iz)}
                    className="w-full text-left px-1.5 py-0.5 rounded text-[9px] font-semibold truncate cursor-pointer transition-all"
                    style={{
                      background: `${color}18`,
                      color,
                      border: `1px solid ${color}30`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${color}18`; }}
                    title={`${iz.izinNo} — ${firma?.ad || ''}`}
                  >
                    {iz.izinNo}
                  </button>
                );
              })}
              {dayIzinler.length > 3 && (
                <span className="text-[9px] font-semibold px-1" style={{ color: 'var(--text-faint)' }}>
                  +{dayIzinler.length - 3} daha
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-5 py-3 flex flex-wrap gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {Object.entries(TIP_COLORS).map(([tip, color]) => (
          <div key={tip} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
