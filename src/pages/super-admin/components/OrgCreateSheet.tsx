import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;

const inputCls = 'w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:bg-white text-slate-900 placeholder-slate-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/15 transition-all';

export default function OrgCreateSheet({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    org_name: '',
    subscription_start: new Date().toISOString().split('T')[0],
    subscription_end: '',
    admin_email: '',
    admin_password: '',
    admin_display_name: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ org_name: string; invite_code: string; admin_email: string } | null>(null);

  const set = (key: keyof typeof form, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.org_name.trim()) { setError('Organizasyon adı zorunludur.'); return; }
    if (!form.admin_email.trim()) { setError('Admin e-posta zorunludur.'); return; }
    if (!form.admin_password) { setError('Şifre zorunludur.'); return; }
    if (form.admin_password.length < 8) { setError('Şifre en az 8 karakter olmalıdır.'); return; }
    if (!form.admin_display_name.trim()) { setError('Ad soyad zorunludur.'); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Oturum bulunamadı.'); setLoading(false); return; }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/super-admin-create-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `Hata (${res.status}): Sunucudan yanıt alınamadı.`);
        setLoading(false);
        return;
      }

      setSuccess({ org_name: data.organization.name, invite_code: data.organization.invite_code, admin_email: data.admin_user.email });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Bağlantı hatası: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({ org_name: '', subscription_start: new Date().toISOString().split('T')[0], subscription_end: '', admin_email: '', admin_password: '', admin_display_name: '' });
    setError(''); setSuccess(null); onClose();
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={handleClose} />
      <div className="fixed right-0 top-0 h-full w-full md:max-w-md bg-white border-l border-slate-200 z-50 overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
              <i className="ri-add-circle-line text-indigo-600 text-base"></i>
            </div>
            <div>
              <h2 className="text-slate-900 font-bold text-sm">Yeni Organizasyon</h2>
              <p className="text-slate-400 text-xs">Org + admin kullanıcı oluştur</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="flex-1 px-4 md:px-6 py-6 bg-slate-50">
          {success ? (
            /* Başarı ekranı */
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 flex items-center justify-center rounded-3xl bg-emerald-50 border border-emerald-200 mb-5">
                  <i className="ri-checkbox-circle-line text-emerald-600 text-3xl"></i>
                </div>
                <h3 className="text-slate-900 font-black text-lg mb-1">Oluşturuldu!</h3>
                <p className="text-slate-500 text-sm">Bu bilgileri müşteriye iletin.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {[
                  { label: 'Organizasyon', value: success.org_name, mono: false },
                  { label: 'Davet Kodu', value: success.invite_code, mono: true },
                  { label: 'Admin E-posta', value: success.admin_email, mono: false },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500 text-xs font-medium">{row.label}</span>
                    <span className={`text-sm font-semibold text-slate-900 ${row.mono ? 'font-mono bg-slate-100 px-2 py-0.5 rounded-lg text-xs' : ''}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <button onClick={handleClose} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all cursor-pointer">
                Kapat
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Org Bilgileri */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <p className="text-slate-600 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <i className="ri-building-2-line text-indigo-500"></i>
                  Organizasyon
                </p>
                <Field label="Organizasyon Adı" required>
                  <input type="text" value={form.org_name} onChange={e => set('org_name', e.target.value)} placeholder="Örn: ABC İş Güvenliği Ltd." className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Abonelik Başlangıç">
                    <input type="date" value={form.subscription_start} onChange={e => set('subscription_start', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Abonelik Bitiş">
                    <input type="date" value={form.subscription_end} onChange={e => set('subscription_end', e.target.value)} className={inputCls} />
                  </Field>
                </div>
              </div>

              {/* Admin Kullanıcı */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <p className="text-slate-600 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <i className="ri-user-star-line text-indigo-500"></i>
                  Admin Kullanıcı
                </p>
                <Field label="Ad Soyad" required>
                  <input type="text" value={form.admin_display_name} onChange={e => set('admin_display_name', e.target.value)} placeholder="Ahmet Yılmaz" className={inputCls} />
                </Field>
                <Field label="E-posta" required>
                  <input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@firma.com" className={inputCls} />
                </Field>
                <Field label="Şifre" required>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.admin_password}
                      onChange={e => set('admin_password', e.target.value)}
                      placeholder="En az 8 karakter"
                      className={`${inputCls} pr-10`}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
                      <i className={showPw ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
                    </button>
                  </div>
                </Field>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  <i className="ri-error-warning-line flex-shrink-0"></i>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {loading ? <><i className="ri-loader-4-line animate-spin"></i> Oluşturuluyor...</> : <><i className="ri-add-circle-line"></i> Organizasyon Oluştur</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
