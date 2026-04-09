import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface Ticket {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  issue_type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  org_name?: string;
}

const TYPE_CFG: Record<string, { label: string; cls: string }> = {
  bug:     { label: 'Hata',           cls: 'bg-red-50 text-red-600 border-red-200' },
  feature: { label: 'Özellik İsteği', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  question:{ label: 'Soru',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  other:   { label: 'Diğer',          cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}

export default function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'replied'>('all');
  const [toast, setToast] = useState('');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const orgIds = [...new Set(data.map(t => t.organization_id).filter(Boolean))] as string[];
      let orgMap: Record<string, string> = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds);
        (orgs || []).forEach(o => { orgMap[o.id] = o.name; });
      }
      setTickets(data.map(t => ({ ...t, org_name: t.organization_id ? orgMap[t.organization_id] : undefined })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); }
  }, [toast]);

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ admin_reply: reply.trim(), status: 'replied', replied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', selected.id);

      if (error) throw error;

      if (selected.user_id) {
        await supabase.from('notifications').insert({
          user_id: selected.user_id,
          organization_id: selected.organization_id,
          ticket_id: selected.id,
          title: 'Destek talebiniz yanıtlandı',
          message: `"${selected.subject}" konulu talebiniz yanıtlandı.`,
          is_read: false,
        });
      }

      setToast('Cevap gönderildi, kullanıcıya bildirim iletildi.');
      setReply('');
      setSelected(null);
      await fetchTickets();
    } catch {
      setToast('Gönderim başarısız.');
    } finally {
      setSending(false);
    }
  };

  const filtered = tickets.filter(t => {
    if (filter === 'open') return t.status === 'open';
    if (filter === 'replied') return t.status === 'replied';
    return true;
  });

  const openCount = tickets.filter(t => t.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-slate-900 font-bold text-base flex items-center gap-2">
            <i className="ri-customer-service-2-line text-emerald-600"></i>
            Destek Talepleri
            {openCount > 0 && (
              <span className="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 text-xs rounded-full font-bold">
                {openCount} açık
              </span>
            )}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">{tickets.length} toplam talep</p>
        </div>
        <div className="flex gap-1.5 items-center">
          <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(['all', 'open', 'replied'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  filter === f ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}>
                {f === 'all' ? 'Tümü' : f === 'open' ? 'Açık' : 'Yanıtlandı'}
              </button>
            ))}
          </div>
          <button onClick={fetchTickets} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-all shadow-sm">
            <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <i className="ri-loader-4-line animate-spin text-xl mr-2"></i>
          <span className="text-sm font-medium">Yükleniyor...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 mb-3">
            <i className="ri-customer-service-2-line text-xl"></i>
          </div>
          <p className="text-sm font-medium">Talep bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => {
            const typeCfg = TYPE_CFG[ticket.issue_type] ?? TYPE_CFG.other;
            return (
              <div
                key={ticket.id}
                onClick={() => { setSelected(ticket); setReply(ticket.admin_reply || ''); }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md group ${
                  ticket.status === 'open'
                    ? 'bg-white border-slate-200 shadow-sm'
                    : 'bg-slate-50 border-slate-200 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${typeCfg.cls}`}>
                        {typeCfg.label}
                      </span>
                      {ticket.status === 'open' ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Açık</span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Yanıtlandı</span>
                      )}
                    </div>
                    <p className="text-slate-900 text-sm font-semibold truncate">{ticket.subject}</p>
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{ticket.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><i className="ri-user-line"></i>{ticket.user_name || ticket.user_email || '—'}</span>
                      {ticket.org_name && <span className="flex items-center gap-1"><i className="ri-building-2-line"></i>{ticket.org_name}</span>}
                      <span>{timeAgo(ticket.created_at)}</span>
                    </div>
                  </div>
                  <i className="ri-arrow-right-s-line text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-1 transition-colors"></i>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white text-sm rounded-2xl px-5 py-3 shadow-xl">
          <i className="ri-checkbox-circle-line text-emerald-400"></i>{toast}
        </div>
      )}

      {/* Detay / Cevap Sheet */}
      {selected && createPortal(
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white">
              <div>
                <h3 className="text-slate-900 font-bold text-sm">{selected.subject}</h3>
                <p className="text-slate-400 text-xs mt-0.5">{selected.user_name} · {selected.org_name || '—'}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-slate-50">
              {/* Kullanıcı mesajı */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
                    {(selected.user_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-slate-900 text-xs font-semibold">{selected.user_name || '—'}</p>
                    <p className="text-slate-400 text-xs">{selected.user_email}</p>
                  </div>
                  <span className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full border ${(TYPE_CFG[selected.issue_type] ?? TYPE_CFG.other).cls}`}>
                    {(TYPE_CFG[selected.issue_type] ?? TYPE_CFG.other).label}
                  </span>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{selected.message}</p>
                <p className="text-slate-400 text-xs mt-3 font-medium">{new Date(selected.created_at).toLocaleString('tr-TR')}</p>
              </div>

              {/* Önceki cevap */}
              {selected.admin_reply && (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
                  <p className="text-emerald-700 text-xs font-bold mb-2 flex items-center gap-1.5">
                    <i className="ri-reply-line"></i> Önceki Cevabınız
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">{selected.admin_reply}</p>
                  {selected.replied_at && (
                    <p className="text-slate-400 text-xs mt-2 font-medium">{new Date(selected.replied_at).toLocaleString('tr-TR')}</p>
                  )}
                </div>
              )}

              {/* Cevap yaz */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
                <h4 className="text-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <i className="ri-reply-line text-amber-500"></i>
                  {selected.admin_reply ? 'Cevabı Güncelle' : 'Cevap Yaz'}
                </h4>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={5}
                  placeholder="Kullanıcıya cevabınızı yazın..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 transition-all resize-none"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 shadow-lg shadow-emerald-400/20"
                >
                  {sending ? <><i className="ri-loader-4-line animate-spin"></i> Gönderiliyor...</> : <><i className="ri-send-plane-line"></i> Cevabı Gönder &amp; Bildir</>}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
