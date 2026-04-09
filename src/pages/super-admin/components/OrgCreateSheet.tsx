import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;

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
  const [success, setSuccess] = useState<{
    org_name: string;
    invite_code: string;
    admin_email: string;
  } | null>(null);

  const set = (key: keyof typeof form, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

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

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/super-admin-create-org`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(form),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Bir hata oluştu.');
        setLoading(false);
        return;
      }

      setSuccess({
        org_name: data.organization.name,
        invite_code: data.organization.invite_code,
        admin_email: data.admin_user.email,
      });
      onSuccess();
    } catch {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm({
      org_name: '',
      subscription_start: new Date().toISOString().split('T')[0],
      subscription_end: '',
      admin_email: '',
      admin_password: '',
      admin_display_name: '',
    });
    setError('');
    setSuccess(null);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-slate-900 border-l border-slate-700/50 z-50 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <i className="ri-add-circle-line text-emerald-400 text-base"></i>
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Yeni Organizasyon</h2>
              <p className="text-slate-400 text-xs">Org + admin kullanıcı oluştur</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="flex-1 px-6 py-6">
          {/* Başarı ekranı */}
          {success ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-16 h-16 flex items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/20 mb-4">
                  <i className="ri-checkbox-circle-line text-emerald-400 text-3xl"></i>
                </div>
                <h3 className="text-white font-bold text-lg mb-1">Organizasyon Oluşturuldu!</h3>
                <p className="text-slate-400 text-sm">Aşağıdaki bilgileri müşteriye iletin.</p>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 divide-y divide-slate-700/30">
                <InfoRow label="Organizasyon" value={success.org_name} />
                <InfoRow label="Davet Kodu" value={success.invite_code} mono />
                <InfoRow label="Admin E-posta" value={success.admin_email} />
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Organizasyon Bilgileri */}
              <div className="space-y-4">
                <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <i className="ri-building-2-line text-amber-400"></i>
                  Organizasyon Bilgileri
                </h3>

                <Field label="Organizasyon Adı" required>
                  <input
                    type="text"
                    value={form.org_name}
                    onChange={e => set('org_name', e.target.value)}
                    placeholder="Örn: ABC İş Güvenliği Ltd."
                    className={inputCls}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Abonelik Başlangıç">
                    <input
                      type="date"
                      value={form.subscription_start}
                      onChange={e => set('subscription_start', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Abonelik Bitiş">
                    <input
                      type="date"
                      value={form.subscription_end}
                      onChange={e => set('subscription_end', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>

              {/* Admin Kullanıcı */}
              <div className="space-y-4">
                <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <i className="ri-user-star-line text-amber-400"></i>
                  Admin Kullanıcı
                </h3>

                <Field label="Ad Soyad" required>
                  <input
                    type="text"
                    value={form.admin_display_name}
                    onChange={e => set('admin_display_name', e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className={inputCls}
                  />
                </Field>

                <Field label="E-posta" required>
                  <input
                    type="email"
                    value={form.admin_email}
                    onChange={e => set('admin_email', e.target.value)}
                    placeholder="admin@firma.com"
                    className={inputCls}
                  />
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
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                    >
                      <i className={showPw ? 'ri-eye-off-line text-sm' : 'ri-eye-line text-sm'}></i>
                    </button>
                  </div>
                </Field>
              </div>

              {/* Hata */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
                  <i className="ri-error-warning-line flex-shrink-0"></i>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 text-white font-semibold text-sm rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><i className="ri-loader-4-line animate-spin"></i> Oluşturuluyor...</>
                ) : (
                  <><i className="ri-add-circle-line"></i> Organizasyon Oluştur</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

const inputCls = 'w-full bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-white text-sm font-medium ${mono ? 'font-mono bg-slate-700 px-2 py-0.5 rounded' : ''}`}>
        {value}
      </span>
    </div>
  );
}
