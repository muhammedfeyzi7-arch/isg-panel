import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
  /** Eğer verilirse, bu ticket'ı görüntüleme modunda açar */
  viewTicketId?: string | null;
}

interface TicketDetail {
  id: string;
  subject: string;
  message: string;
  issue_type: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const ISSUE_TYPES = [
  { value: 'bug', label: 'Hata / Bug', icon: 'ri-bug-line', color: '#EF4444' },
  { value: 'feature', label: 'Özellik İsteği', icon: 'ri-lightbulb-line', color: '#F59E0B' },
  { value: 'question', label: 'Soru / Yardım', icon: 'ri-question-line', color: '#10B981' },
  { value: 'other', label: 'Diğer', icon: 'ri-more-line', color: '#94A3B8' },
];

export default function SupportModal({ open, onClose, viewTicketId }: SupportModalProps) {
  const { theme, currentUser, org } = useApp();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [issueType, setIssueType] = useState('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Ticket görüntüleme modu
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [viewMode, setViewMode] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      setSubject('');
      setMessage('');
      setIssueType('bug');
      setTicketDetail(null);
      setViewMode(false);
    }
  }, [open]);

  // viewTicketId gelince ticket'ı yükle
  useEffect(() => {
    if (open && viewTicketId) {
      setViewMode(true);
      setTicketLoading(true);
      supabase
        .from('support_tickets')
        .select('id, subject, message, issue_type, status, admin_reply, replied_at, created_at')
        .eq('id', viewTicketId)
        .maybeSingle()
        .then(({ data }) => {
          setTicketDetail(data as TicketDetail | null);
          setTicketLoading(false);
        });
    } else if (open && !viewTicketId) {
      setViewMode(false);
      setTicketDetail(null);
    }
  }, [open, viewTicketId]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    if (message.length > 500) return;

    setStatus('sending');
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id ?? user?.id ?? null;

      if (!currentUserId) {
        setErrorMsg('Oturum bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
        setStatus('error');
        return;
      }

      const { error } = await supabase.from('support_tickets').insert({
        organization_id: org?.id ?? null,
        user_id: currentUserId,
        user_email: session?.user?.email ?? user?.email ?? currentUser.email ?? '',
        user_name: currentUser.ad ?? 'Kullanıcı',
        issue_type: issueType,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
      });

      if (error) {
        setErrorMsg(`Hata: ${error.message}`);
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Bağlantı hatası: ${msg}`);
      setStatus('error');
    }
  };

  const typeCfg = ticketDetail ? (ISSUE_TYPES.find(t => t.value === ticketDetail.issue_type) ?? ISSUE_TYPES[3]) : null;

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
          boxShadow: isDark ? '0 30px 80px rgba(0,0,0,0.7)' : '0 20px 60px rgba(15,23,42,0.18)',
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
              <i className={`${viewMode ? 'ri-message-3-line' : 'ri-customer-service-2-line'} text-sm`} style={{ color: '#10B981' }} />
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: textMain }}>
                {viewMode ? 'Destek Talebi' : 'Destek / Sorun Bildir'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
                {viewMode ? 'Admin yanıtını görüntüleyin' : 'Ekibimiz en kısa sürede dönüş yapar'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewMode && (
              <button
                onClick={() => setViewMode(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <i className="ri-add-line text-xs" />
                Yeni Talep
              </button>
            )}
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
        </div>

        {/* ── Ticket Görüntüleme Modu ── */}
        {viewMode ? (
          <div className="px-5 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {ticketLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <i className="ri-loader-4-line animate-spin text-xl mr-2"></i>
                <span className="text-sm">Yükleniyor...</span>
              </div>
            ) : !ticketDetail ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <i className="ri-error-warning-line text-3xl mb-2"></i>
                <p className="text-sm">Talep bulunamadı.</p>
              </div>
            ) : (
              <>
                {/* Talep başlığı ve meta */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeCfg && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                        style={{ background: `${typeCfg.color}15`, color: typeCfg.color, borderColor: `${typeCfg.color}30` }}>
                        <i className={`${typeCfg.icon} text-xs`}></i>
                        {typeCfg.label}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      ticketDetail.status === 'open'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ticketDetail.status === 'open' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                      {ticketDetail.status === 'open' ? 'Açık' : 'Yanıtlandı'}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-bold" style={{ color: textMain }}>{ticketDetail.subject}</h3>
                  <p className="text-[11px]" style={{ color: textMuted }}>
                    {new Date(ticketDetail.created_at).toLocaleString('tr-TR')}
                  </p>
                </div>

                {/* Kullanıcı mesajı */}
                <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)', border: `1px solid ${border}` }}>
                  <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: textMuted }}>
                    <i className="ri-user-line"></i> Talebiniz
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: textMain }}>{ticketDetail.message}</p>
                </div>

                {/* Admin yanıtı */}
                {ticketDetail.admin_reply ? (
                  <div className="rounded-2xl p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#10B981' }}>
                      <i className="ri-reply-line"></i> Admin Yanıtı
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: textMain }}>{ticketDetail.admin_reply}</p>
                    {ticketDetail.replied_at && (
                      <p className="text-[10px] mt-2" style={{ color: textMuted }}>
                        {new Date(ticketDetail.replied_at).toLocaleString('tr-TR')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl p-4 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)', border: `1px solid ${border}` }}>
                    <i className="ri-time-line text-2xl mb-2 block" style={{ color: textMuted }}></i>
                    <p className="text-[12px] font-semibold" style={{ color: textMuted }}>Yanıt bekleniyor</p>
                    <p className="text-[11px] mt-1" style={{ color: textMuted }}>Ekibimiz en kısa sürede dönüş yapacak.</p>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)', color: textMuted, border: `1px solid ${border}` }}
                >
                  Kapat
                </button>
              </>
            )}
          </div>
        ) : (
          /* ── Form Modu ── */
          <>
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
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textMain }}
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
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textMain }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.15)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Error */}
                {status === 'error' && (
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px]"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}
                  >
                    <i className="ri-error-warning-line text-sm flex-shrink-0 mt-0.5" />
                    <span>{errorMsg || 'Gönderim başarısız. Lütfen tekrar deneyin.'}</span>
                  </div>
                )}

                {/* Submit */}
                <div className="flex items-center gap-2 pt-1" style={{ borderTop: `1px solid ${divider}` }}>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                    style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${border}`, color: textMuted }}
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
                      <><i className="ri-loader-4-line animate-spin text-sm" />Gönderiliyor...</>
                    ) : (
                      <><i className="ri-send-plane-line text-sm" />Gönder</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
