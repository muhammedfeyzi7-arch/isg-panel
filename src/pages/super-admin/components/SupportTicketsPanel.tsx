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

const TYPE_LABELS: Record<string, string> = {
  bug: 'Hata',
  feature: 'Özellik',
  question: 'Soru',
  other: 'Diğer',
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
      setToast('Yanıt gönderildi.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-slate-800 font-semibold text-sm">Destek Talepleri</h2>
          {openCount > 0 && (
            <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-md">
              {openCount} açık
            </span>
          )}
          <span className="text-slate-400 text-xs">{tickets.length} toplam</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-white border border-slate-200 rounded-lg p-1">
            {(['all', 'open', 'replied'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filter === f
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f === 'all' ? 'Tümü' : f === 'open' ? 'Açık' : 'Yanıtlandı'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchTickets}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <i className="ri-loader-4-line animate-spin text-lg mr-2"></i>
          <span className="text-sm">Yükleniyor...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <i className="ri-customer-service-2-line text-2xl mb-2 text-slate-300"></i>
          <p className="text-sm">Talep bulunamadı.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {filtered.map(ticket => (
            <div
              key={ticket.id}
              onClick={() => { setSelected(ticket); setReply(ticket.admin_reply || ''); }}
              className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors cursor-pointer group"
            >
              {/* Sol: status dot */}
              <div className="flex-shrink-0 mt-1">
                <span className={`w-2 h-2 rounded-full block ${ticket.status === 'open' ? 'bg-red-400' : 'bg-slate-300'}`} />
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-800 font-medium text-sm truncate">{ticket.subject}</p>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">{ticket.message}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                      ticket.status === 'open'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {ticket.status === 'open' ? 'Açık' : 'Yanıtlandı'}
                    </span>
                    <i className="ri-arrow-right-s-line text-slate-300 group-hover:text-slate-500 transition-colors text-base"></i>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                    {TYPE_LABELS[ticket.issue_type] ?? 'Diğer'}
                  </span>
                  <span>{ticket.user_name || ticket.user_email || '—'}</span>
                  {ticket.org_name && <><span>·</span><span>{ticket.org_name}</span></>}
                  <span>·</span>
                  <span>{timeAgo(ticket.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white text-sm rounded-xl px-4 py-2.5">
          <i className="ri-checkbox-circle-line text-emerald-400 text-sm"></i>
          {toast}
        </div>
      )}

      {/* Detay Sheet */}
      {selected && createPortal(
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full md:max-w-lg bg-white border-l border-slate-200 z-50 flex flex-col">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="text-slate-800 font-semibold text-sm truncate">{selected.subject}</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  {selected.user_name || selected.user_email || '—'}
                  {selected.org_name && ` · ${selected.org_name}`}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex-shrink-0"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#f8fafc]">
              {/* Meta */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-xs rounded-md">
                  {TYPE_LABELS[selected.issue_type] ?? 'Diğer'}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-md font-medium ${
                  selected.status === 'open' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                }`}>
                  {selected.status === 'open' ? 'Açık' : 'Yanıtlandı'}
                </span>
                <span className="text-slate-400 text-xs">{new Date(selected.created_at).toLocaleString('tr-TR')}</span>
              </div>

              {/* Kullanıcı mesajı */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold flex-shrink-0">
                    {(selected.user_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-slate-700 text-xs font-medium">{selected.user_name || '—'}</p>
                    <p className="text-slate-400 text-xs">{selected.user_email}</p>
                  </div>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed">{selected.message}</p>
              </div>

              {/* Önceki cevap */}
              {selected.admin_reply && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-slate-500 text-xs font-medium mb-2 flex items-center gap-1.5">
                    <i className="ri-reply-line"></i> Önceki yanıtınız
                  </p>
                  <p className="text-slate-700 text-sm leading-relaxed">{selected.admin_reply}</p>
                  {selected.replied_at && (
                    <p className="text-slate-400 text-xs mt-2">{new Date(selected.replied_at).toLocaleString('tr-TR')}</p>
                  )}
                </div>
              )}

              {/* Yanıt yaz */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-slate-600 text-xs font-medium">
                  {selected.admin_reply ? 'Yanıtı güncelle' : 'Yanıt yaz'}
                </p>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={5}
                  placeholder="Kullanıcıya yanıtınızı yazın..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-slate-400 focus:bg-white transition-all resize-none"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                >
                  {sending
                    ? <><i className="ri-loader-4-line animate-spin text-sm"></i> Gönderiliyor...</>
                    : <><i className="ri-send-plane-line text-sm"></i> Yanıtla &amp; Bildir</>
                  }
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
