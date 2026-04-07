import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

const ISSUE_TYPES = [
  { value: 'bug', label: 'Hata / Bug', icon: 'ri-bug-line', color: '#EF4444' },
  { value: 'feature', label: 'Özellik İsteği', icon: 'ri-lightbulb-line', color: '#F59E0B' },
  { value: 'question', label: 'Soru / Yardım', icon: 'ri-question-line', color: '#10B981' },
  { value: 'other', label: 'Diğer', icon: 'ri-more-line', color: '#94A3B8' },
];

export default function SupportModal({ open, onClose }: SupportModalProps) {
  const { theme, currentUser } = useApp();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [issueType, setIssueType] = useState('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setSubject('');
      setMessage('');
      setIssueType('bug');
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const bg = isDark ? 'var(--bg-card-solid)' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)';
  const textMain = isDark ? '#E2E8F0' : '#0F172A';
  const textMuted = isDark ? '#64748B' : '#94A3B8';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.03)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const divider = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)';

  const selectedType = ISSUE_TYPES.find(t => t.value === issueType) ?? ISSUE_TYPES[0];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    if (message.length > 500) return;

    setStatus('sending');
    try {
      const form = e.currentTarget;
      const data = new URLSearchParams();
      data.append('email', user?.email ?? currentUser.email ?? '');
      data.append('name', currentUser.ad ?? 'Kullanıcı');
      data.append('issue_type', selectedType.label);
      data.append('subject', subject);
      data.append('message', message);

      const res = await fetch('https://readdy.ai/api/form/d79r8j9rcamcd36dbltg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });

      if (res.ok) {
        setStatus('success');
        form.reset();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-[480px] animate-slide-up overflow-hidden"
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: '20px',
          boxShadow: isDark
            ? '0 30px 80px rgba(0,0,0,0.7)'
            : '0 20px 60px rgba(15,23,42,0.18)',
        }}
      >
        {/* Top accent */}
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #10B981, #34D399, #6EE7B7)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${divider}` }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <i className="ri-customer-service-2-line text-sm" style={{ color: '#10B981' }} />
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: textMain }}>Destek / Sorun Bildir</p>
              <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>Ekibimiz en kısa sürede dönüş yapar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
            style={{ color: textMuted, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${border}` }}
            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; }}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div className="px-5 py-10 text-center">
            <div
              className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-4"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <i className="ri-check-double-line text-2xl" style={{ color: '#10B981' }} />
            </div>
            <p className="text-[15px] font-bold mb-1.5" style={{ color: textMain }}>Talebiniz Alındı!</p>
            <p className="text-[12.5px]" style={{ color: textMuted }}>
              Destek ekibimiz en kısa sürede e-posta ile dönüş yapacak.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}
            >
              Kapat
            </button>
          </div>
        ) : (
          <form data-readdy-form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Issue type */}
            <div>
              <p className="text-[11px] font-semibold mb-2" style={{ color: textMuted }}>Konu Türü</p>
              <div className="grid grid-cols-4 gap-1.5">
                {ISSUE_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setIssueType(type.value)}
                    className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: issueType === type.value
                        ? `${type.color}18`
                        : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)'),
                      border: issueType === type.value
                        ? `1px solid ${type.color}40`
                        : `1px solid ${border}`,
                    }}
                  >
                    <i className={`${type.icon} text-sm`} style={{ color: issueType === type.value ? type.color : textMuted }} />
                    <span className="text-[10px] font-semibold leading-tight text-center" style={{ color: issueType === type.value ? type.color : textMuted }}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-[11px] font-semibold block mb-1.5" style={{ color: textMuted }}>Konu Başlığı</label>
              <input
                name="subject"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Kısaca açıklayın..."
                required
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none transition-all"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: textMain,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.15)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold" style={{ color: textMuted }}>Açıklama</label>
                <span className="text-[10px]" style={{ color: message.length > 450 ? '#EF4444' : textMuted }}>
                  {message.length}/500
                </span>
              </div>
              <textarea
                name="message"
                value={message}
                onChange={e => { if (e.target.value.length <= 500) setMessage(e.target.value); }}
                placeholder="Sorunu veya isteğinizi detaylıca anlatın..."
                required
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none transition-all resize-none"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: textMain,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.15)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Error */}
            {status === 'error' && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px]"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}
              >
                <i className="ri-error-warning-line text-sm" />
                Gönderim başarısız. Lütfen tekrar deneyin.
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-2 pt-1" style={{ borderTop: `1px solid ${divider}` }}>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                  border: `1px solid ${border}`,
                  color: textMuted,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; }}
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={status === 'sending' || !subject.trim() || !message.trim()}
                className="flex-[2] py-2.5 rounded-xl text-[13px] font-bold cursor-pointer transition-all whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff' }}
                onMouseEnter={e => { if (status !== 'sending') e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {status === 'sending' ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-sm" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-line text-sm" />
                    Gönder
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
