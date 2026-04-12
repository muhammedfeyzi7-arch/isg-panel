import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;

type OrgType = 'osgb' | 'firma';

const inputCls =
  'w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-400 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all';

export default function OrgCreateSheet({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [orgType, setOrgType] = useState<OrgType>('osgb');
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
    org_type: OrgType;
  } | null>(null);

  const set = (key: keyof typeof form, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleNextStep = () => {
    setError('');
    if (!form.org_name.trim()) { setError('Organizasyon adı zorunludur.'); return; }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.admin_email.trim()) { setError('E-posta zorunludur.'); return; }
    if (!form.admin_password) { setError('Şifre zorunludur.'); return; }
    if (form.admin_password.length < 8) { setError('Şifre en az 8 karakter olmalıdır.'); return; }
    if (!form.admin_display_name.trim()) { setError('Ad soyad zorunludur.'); return; }

    setLoading(true);
    try {
      const saToken = sessionStorage.getItem('sa_access_token');
      if (!saToken) { setError('Oturum bulunamadı.'); setLoading(false); return; }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/super-admin-create-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${saToken}` },
        body: JSON.stringify({ ...form, org_type: orgType }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `Hata (${res.status})`);
        setLoading(false);
        return;
      }
      setSuccess({
        org_name: data.organization.name,
        invite_code: data.organization.invite_code,
        admin_email: data.admin_user.email,
        org_type: orgType,
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bağlantı hatası');
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
    setOrgType('osgb');
    setStep(1);
    setError('');
    setSuccess(null);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={handleClose} />
      <div className="fixed right-0 top-0 h-full w-full md:max-w-[460px] z-50 flex flex-col bg-white border-l border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <i className="ri-add-circle-line text-white text-base"></i>
            </div>
            <div>
              <h2 className="text-slate-800 font-bold text-sm">Yeni Hesap Oluştur</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {success ? 'Tamamlandı' : step === 1 ? 'Adım 1 / 2 — Hesap Bilgileri' : 'Adım 2 / 2 — Admin Kullanıcı'}
              </p>
            </div>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Adım göstergesi */}
        {!success && (
          <div className="flex items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  step > s
                    ? 'bg-emerald-500 text-white'
                    : step === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  {step > s ? <i className="ri-check-line text-xs"></i> : s}
                </div>
                <span className={`text-xs ml-2 font-medium ${step >= s ? 'text-slate-700' : 'text-slate-400'}`}>
                  {s === 1 ? 'Hesap Bilgileri' : 'Admin Kullanıcı'}
                </span>
                {s < 2 && (
                  <div className={`flex-1 h-px mx-3 transition-all ${step > s ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8fafc]">

          {/* Başarı ekranı */}
          {success ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
                  <i className="ri-checkbox-circle-line text-emerald-500 text-3xl"></i>
                </div>
                <h3 className="text-slate-800 font-bold text-base mb-1">Hesap Oluşturuldu!</h3>
                <p className="text-slate-400 text-sm">Bu bilgileri müşteriye iletin.</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {[
                  { label: 'Hesap Türü', value: success.org_type === 'osgb' ? 'OSGB' : 'Normal Firma', mono: false },
                  { label: 'Organizasyon', value: success.org_name, mono: false },
                  { label: 'Davet Kodu', value: success.invite_code, mono: true },
                  { label: 'Admin E-posta', value: success.admin_email, mono: false },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500 text-xs">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.mono ? 'font-mono text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg text-xs' : 'text-slate-800'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <button onClick={handleClose}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer whitespace-nowrap transition-colors">
                Kapat
              </button>
            </div>
          ) : step === 1 ? (
            /* Adım 1 */
            <div className="space-y-5">
              {/* Tip seçimi */}
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Hesap Türü</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'osgb' as OrgType, icon: 'ri-hospital-line', title: 'OSGB', desc: 'İş güvenliği firması', activeBg: 'bg-teal-600', activeText: 'text-white' },
                    { key: 'firma' as OrgType, icon: 'ri-building-2-line', title: 'Normal Firma', desc: 'Müşteri / işletme', activeBg: 'bg-slate-900', activeText: 'text-white' },
                  ] as const).map(opt => (
                    <button key={opt.key} type="button" onClick={() => setOrgType(opt.key)}
                      className={`relative flex flex-col items-start p-4 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                        orgType === opt.key
                          ? `${opt.activeBg} border-transparent`
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}>
                      {orgType === opt.key && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                          <i className="ri-check-line text-white text-xs"></i>
                        </div>
                      )}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${
                        orgType === opt.key ? 'bg-white/20' : 'bg-slate-100'
                      }`}>
                        <i className={`${opt.icon} text-base ${orgType === opt.key ? 'text-white' : 'text-slate-600'}`}></i>
                      </div>
                      <span className={`font-bold text-sm ${orgType === opt.key ? 'text-white' : 'text-slate-800'}`}>
                        {opt.title}
                      </span>
                      <span className={`text-xs mt-0.5 ${orgType === opt.key ? 'text-white/60' : 'text-slate-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Org bilgileri */}
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">
                  {orgType === 'osgb' ? 'OSGB Bilgileri' : 'Firma Bilgileri'}
                </p>
                <div className="space-y-3">
                  <Field label={orgType === 'osgb' ? 'OSGB Adı' : 'Firma Adı'} required>
                    <input type="text" value={form.org_name} onChange={e => set('org_name', e.target.value)}
                      placeholder={orgType === 'osgb' ? 'ABC İş Güvenliği Ltd.' : 'XYZ Sanayi A.Ş.'}
                      className={inputCls} />
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
              </div>

              {error && <ErrorBox msg={error} />}

              <button type="button" onClick={handleNextStep}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 transition-colors">
                Devam Et <i className="ri-arrow-right-line text-sm"></i>
              </button>
            </div>
          ) : (
            /* Adım 2 */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">Admin Kullanıcı</p>
                <div className="space-y-3">
                  <Field label="Ad Soyad" required>
                    <input type="text" value={form.admin_display_name} onChange={e => set('admin_display_name', e.target.value)}
                      placeholder="Ahmet Yılmaz" className={inputCls} />
                  </Field>
                  <Field label="E-posta" required>
                    <input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)}
                      placeholder="admin@firma.com" className={inputCls} />
                  </Field>
                  <Field label="Şifre" required>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} value={form.admin_password}
                        onChange={e => set('admin_password', e.target.value)}
                        placeholder="En az 8 karakter" className={`${inputCls} pr-11`} />
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
                        <i className={`${showPw ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                      </button>
                    </div>
                  </Field>
                </div>
              </div>

              {/* Özet şerit */}
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${orgType === 'osgb' ? 'bg-teal-50' : 'bg-slate-100'}`}>
                  <i className={`${orgType === 'osgb' ? 'ri-hospital-line text-teal-600' : 'ri-building-2-line text-slate-600'} text-sm`}></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-400 text-xs">{orgType === 'osgb' ? 'OSGB' : 'Firma'}</p>
                  <p className="text-slate-800 font-semibold text-sm truncate">{form.org_name}</p>
                </div>
                <button type="button" onClick={() => { setStep(1); setError(''); }}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors flex-shrink-0">
                  <i className="ri-edit-line text-sm"></i>
                </button>
              </div>

              {error && <ErrorBox msg={error} />}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(1); setError(''); }}
                  className="flex-1 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm cursor-pointer whitespace-nowrap transition-colors">
                  Geri
                </button>
                <button type="submit" disabled={loading}
                  className={`flex-[2] py-3 rounded-xl text-white font-bold text-sm cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                    orgType === 'osgb' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-900 hover:bg-slate-800'
                  }`}>
                  {loading
                    ? <><i className="ri-loader-4-line animate-spin text-sm"></i> Oluşturuluyor...</>
                    : <><i className={`${orgType === 'osgb' ? 'ri-hospital-line' : 'ri-building-2-line'} text-sm`}></i> Hesabı Oluştur</>
                  }
                </button>
              </div>
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
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
      <i className="ri-error-warning-line flex-shrink-0 mt-0.5"></i>
      <span>{msg}</span>
    </div>
  );
}
