import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

const EDGE_URL = 'https://niuvjthvhjbfyuuhoowq.supabase.co/functions/v1/admin-user-management';

interface AltFirma {
  id: string;
  name: string;
  personelSayisi: number;
  uzmanAd: string | null;
}

interface UzmanModalProps {
  open: boolean;
  orgId: string;
  altFirmalar: AltFirma[];
  onClose: () => void;
  onSuccess: (uzman: {
    user_id: string; display_name: string; email: string; is_active: boolean;
    active_firm_id: string | null; active_firm_ids: string[] | null;
    active_firm_name: string | null; osgb_role: string;
  }) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type UzmanFormTab = 0 | 1 | 2;

interface UzmanForm {
  ad: string; soyad: string; email: string; telefon: string;
  rol: 'gezici_uzman' | 'isyeri_hekimi';
  password: string; passwordConfirm: string; atananFirmaIds: string[];
}

const defaultUzmanForm: UzmanForm = {
  ad: '', soyad: '', email: '', telefon: '',
  rol: 'gezici_uzman', password: '', passwordConfirm: '', atananFirmaIds: [],
};

const TABS = [
  { idx: 0, icon: 'ri-user-line', label: 'Kişisel Bilgiler', color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)' },
  { idx: 1, icon: 'ri-lock-password-line', label: 'Giriş Bilgileri', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  { idx: 2, icon: 'ri-building-2-line', label: 'Firma Atama', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
];

export default function UzmanModal({ open, orgId, altFirmalar, onClose, onSuccess, addToast }: UzmanModalProps) {
  const [uzmanForm, setUzmanForm] = useState<UzmanForm>(defaultUzmanForm);
  const [uzmanFormTab, setUzmanFormTab] = useState<UzmanFormTab>(0);
  const [uzmanLoading, setUzmanLoading] = useState(false);
  const [uzmanError, setUzmanError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

  const handleClose = () => {
    setUzmanForm(defaultUzmanForm);
    setUzmanFormTab(0);
    setUzmanError(null);
    setShowPw(false);
    setShowPwConfirm(false);
    onClose();
  };

  const pwStrength = (pw: string) => {
    if (pw.length >= 12) return { level: 4, label: 'Güçlü', color: '#22C55E' };
    if (pw.length >= 8) return { level: 3, label: 'İyi', color: '#10B981' };
    if (pw.length >= 6) return { level: 2, label: 'Orta', color: '#F59E0B' };
    return { level: 1, label: 'Zayıf', color: '#EF4444' };
  };

  const handleUzmanEkle = async () => {
    const fullName = `${uzmanForm.ad.trim()} ${uzmanForm.soyad.trim()}`.trim();
    if (!fullName) { setUzmanError('Ad ve soyad zorunludur.'); return; }
    if (!uzmanForm.email.trim()) { setUzmanError('E-posta zorunludur.'); return; }
    if (uzmanForm.password.length < 8) { setUzmanError('Şifre en az 8 karakter olmalıdır.'); return; }
    if (uzmanForm.password !== uzmanForm.passwordConfirm) { setUzmanError('Şifreler eşleşmiyor.'); return; }
    if (!orgId) return;
    setUzmanLoading(true);
    setUzmanError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setUzmanError('Oturum bulunamadı.'); return; }
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create', organization_id: orgId,
          email: uzmanForm.email.trim().toLowerCase(), password: uzmanForm.password,
          display_name: fullName, role: 'member', osgb_role: uzmanForm.rol,
          active_firm_id: uzmanForm.atananFirmaIds[0] || null,
          active_firm_ids: uzmanForm.atananFirmaIds.length > 0 ? uzmanForm.atananFirmaIds : null,
        }),
      });
      const json = await res.json() as { error?: string; user_id?: string };
      if (json.error) { setUzmanError(json.error); return; }
      const atananFirmaAd = uzmanForm.atananFirmaIds.length > 0
        ? altFirmalar.filter(f => uzmanForm.atananFirmaIds.includes(f.id)).map(f => f.name).join(', ')
        : null;
      onSuccess({
        user_id: json.user_id ?? `temp_${Date.now()}`, display_name: fullName,
        email: uzmanForm.email.trim().toLowerCase(), is_active: true,
        active_firm_id: uzmanForm.atananFirmaIds[0] || null,
        active_firm_ids: uzmanForm.atananFirmaIds.length > 0 ? uzmanForm.atananFirmaIds : null,
        active_firm_name: atananFirmaAd, osgb_role: uzmanForm.rol,
      });
      addToast(`${fullName} başarıyla eklendi!`, 'success');
      handleClose();
    } catch (err) { setUzmanError(String(err)); }
    finally { setUzmanLoading(false); }
  };

  if (!open) return null;

  const activeTab = TABS[uzmanFormTab];
  const strength = uzmanForm.password.length > 0 ? pwStrength(uzmanForm.password) : null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(18px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col overflow-hidden"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '92vh' }}>

        {/* ── HEADER ── */}
        <div className="relative overflow-hidden px-6 py-5 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(2,132,199,0.06) 100%)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(14,165,233,0.2)', border: '1.5px solid rgba(14,165,233,0.35)' }}>
                <i className="ri-user-add-line text-lg" style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Personel Ekle</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>OSGB ekibinize gezici uzman veya hekim ekleyin</p>
              </div>
            </div>
            <button onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
              <i className="ri-close-line text-base" />
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {TABS.map(tab => (
            <button key={tab.idx} onClick={() => setUzmanFormTab(tab.idx as UzmanFormTab)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: uzmanFormTab === tab.idx ? tab.bg : 'var(--bg-item)',
                border: `1.5px solid ${uzmanFormTab === tab.idx ? tab.border : 'var(--border-subtle)'}`,
                color: uzmanFormTab === tab.idx ? tab.color : 'var(--text-muted)',
              }}>
              <i className={`${tab.icon} text-xs`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.idx + 1}</span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Tab 0: Kişisel Bilgiler */}
          {uzmanFormTab === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 p-3 rounded-xl"
                style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.15)' }}>
                  <i className="ri-user-line text-xs" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Kişisel Bilgiler</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Kimlik ve iletişim bilgileri</p>
                </div>
              </div>

              {/* Rol Seçimi */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                  Rol <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: 'gezici_uzman' as const, icon: 'ri-shield-user-line', label: 'Gezici Uzman', desc: 'Saha ziyaretleri ve ISG denetimleri' },
                    { val: 'isyeri_hekimi' as const, icon: 'ri-heart-pulse-line', label: 'İşyeri Hekimi', desc: 'Sağlık muayene ve takibi' },
                  ]).map(opt => (
                    <button key={opt.val} type="button" onClick={() => setUzmanForm(p => ({ ...p, rol: opt.val }))}
                      className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl cursor-pointer transition-all text-left"
                      style={{
                        background: uzmanForm.rol === opt.val ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                        border: `1.5px solid ${uzmanForm.rol === opt.val ? 'rgba(14,165,233,0.3)' : 'var(--border-subtle)'}`,
                      }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center rounded-lg"
                          style={{ background: uzmanForm.rol === opt.val ? 'rgba(14,165,233,0.2)' : 'var(--bg-hover)' }}>
                          <i className={`${opt.icon} text-xs`} style={{ color: uzmanForm.rol === opt.val ? '#0EA5E9' : 'var(--text-muted)' }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: uzmanForm.rol === opt.val ? '#0EA5E9' : 'var(--text-primary)' }}>{opt.label}</span>
                      </div>
                      <span className="text-[10px] leading-tight" style={{ color: 'var(--text-faint)' }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Preview */}
              <div className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-extrabold text-white flex-shrink-0"
                  style={{ background: uzmanForm.ad ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                  {uzmanForm.ad ? uzmanForm.ad.charAt(0).toUpperCase() : <i className="ri-user-line text-lg" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {uzmanForm.ad || uzmanForm.soyad ? `${uzmanForm.ad} ${uzmanForm.soyad}`.trim() : 'Personel Adı'}
                  </p>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-1"
                    style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                    {uzmanForm.rol === 'isyeri_hekimi' ? 'İşyeri Hekimi' : 'Gezici Uzman'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Ad', key: 'ad', req: true, placeholder: 'Ad' },
                  { label: 'Soyad', key: 'soyad', req: true, placeholder: 'Soyad' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {f.label} {f.req && <span style={{ color: '#EF4444' }}>*</span>}
                    </label>
                    <input value={(uzmanForm as Record<string, unknown>)[f.key] as string}
                      onChange={e => { setUzmanForm(p => ({ ...p, [f.key]: e.target.value })); setUzmanError(null); }}
                      placeholder={f.placeholder}
                      className="w-full text-sm px-3 py-2.5 rounded-xl outline-none transition-all"
                      style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.09)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }} />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Telefon</label>
                <input value={uzmanForm.telefon} onChange={e => setUzmanForm(p => ({ ...p, telefon: e.target.value }))}
                  placeholder="0555 000 00 00"
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none transition-all"
                  style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.09)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }} />
              </div>
            </div>
          )}

          {/* Tab 1: Giriş Bilgileri */}
          {uzmanFormTab === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 p-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>
                  <i className="ri-lock-password-line text-xs" style={{ color: '#F59E0B' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Giriş Bilgileri</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Sisteme giriş için e-posta ve şifre</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  E-posta <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                  <input type="email" value={uzmanForm.email}
                    onChange={e => { setUzmanForm(p => ({ ...p, email: e.target.value })); setUzmanError(null); }}
                    placeholder="uzman@ornek.com"
                    className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl outline-none transition-all"
                    style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.09)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Şifre <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                  <input type={showPw ? 'text' : 'password'} value={uzmanForm.password}
                    onChange={e => setUzmanForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="En az 8 karakter"
                    className="w-full text-sm pl-10 pr-12 py-2.5 rounded-xl outline-none transition-all"
                    style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', color: 'var(--text-primary)', fontSize: '13px' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.09)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}>
                    <i className={`${showPw ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
                {strength && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                          style={{ background: i <= strength.level ? strength.color : 'var(--border-subtle)' }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Şifre Tekrar <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                  <input type={showPwConfirm ? 'text' : 'password'} value={uzmanForm.passwordConfirm}
                    onChange={e => setUzmanForm(p => ({ ...p, passwordConfirm: e.target.value }))}
                    placeholder="Şifreyi tekrar girin"
                    className="w-full text-sm pl-10 pr-12 py-2.5 rounded-xl outline-none transition-all"
                    style={{
                      background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px',
                      border: `1.5px solid ${uzmanForm.passwordConfirm && uzmanForm.password !== uzmanForm.passwordConfirm ? '#EF4444' : 'var(--border-input)'}`,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.55)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.09)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = uzmanForm.passwordConfirm && uzmanForm.password !== uzmanForm.passwordConfirm ? '#EF4444' : 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }} />
                  <button type="button" onClick={() => setShowPwConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}>
                    <i className={`${showPwConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
                {uzmanForm.passwordConfirm && uzmanForm.password !== uzmanForm.passwordConfirm && (
                  <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: '#EF4444' }}>
                    <i className="ri-error-warning-line" />Şifreler eşleşmiyor
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl flex items-start gap-2.5"
                style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <i className="ri-information-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Personel bu bilgilerle sisteme giriş yapacak. Şifreyi güvenli bir şekilde iletin.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Firma Atama */}
          {uzmanFormTab === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 p-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <i className="ri-building-2-line text-xs" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Firma Atama</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Hangi firmalara atanacak? (isteğe bağlı)</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Atanacak Firma(lar)
                  <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>({uzmanForm.atananFirmaIds.length} seçili)</span>
                </label>
                {uzmanForm.atananFirmaIds.length > 0 && (
                  <button onClick={() => setUzmanForm(p => ({ ...p, atananFirmaIds: [] }))}
                    className="text-[10px] cursor-pointer" style={{ color: '#EF4444' }}>
                    Temizle
                  </button>
                )}
              </div>

              {altFirmalar.length === 0 ? (
                <div className="flex items-start gap-2.5 p-4 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                  <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Henüz firma eklenmedi. Personeli oluşturduktan sonra Firmalar sekmesinden atama yapabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {altFirmalar.map(f => {
                    const secili = uzmanForm.atananFirmaIds.includes(f.id);
                    const birincil = uzmanForm.atananFirmaIds[0] === f.id;
                    return (
                      <button key={f.id} type="button"
                        onClick={() => setUzmanForm(p => ({
                          ...p,
                          atananFirmaIds: p.atananFirmaIds.includes(f.id)
                            ? p.atananFirmaIds.filter(id => id !== f.id)
                            : [...p.atananFirmaIds, f.id],
                        }))}
                        className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          background: secili ? 'rgba(16,185,129,0.08)' : 'var(--bg-item)',
                          border: `1.5px solid ${secili ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
                        }}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                          style={secili ? { background: 'linear-gradient(135deg, #10B981, #059669)' } : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                          {secili && <i className="ri-check-line text-white text-[10px]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: secili ? '#10B981' : 'var(--text-primary)' }}>{f.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {f.uzmanAd ? `${f.uzmanAd} atanmış` : `${f.personelSayisi} personel`}
                          </p>
                        </div>
                        {birincil && secili && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>Birincil</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {uzmanError && (
          <div className="mx-6 mb-3 flex items-start gap-2 p-3 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)' }}>
            <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#EF4444' }} />
            <p className="text-xs" style={{ color: '#dc2626' }}>{uzmanError}</p>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-item)' }}>
          <div className="flex items-center gap-2">
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {TABS.map(t => (
                <button key={t.idx} onClick={() => setUzmanFormTab(t.idx as UzmanFormTab)}
                  className="cursor-pointer transition-all"
                  style={{ width: uzmanFormTab === t.idx ? '20px' : '6px', height: '6px', borderRadius: '9999px', background: uzmanFormTab === t.idx ? activeTab.color : 'var(--border-main)' }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5 ml-1">
              {uzmanFormTab > 0 && (
                <button onClick={() => setUzmanFormTab(t => Math.max(0, t - 1) as UzmanFormTab)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  <i className="ri-arrow-left-line text-xs" /> Geri
                </button>
              )}
              {uzmanFormTab < 2 && (
                <button onClick={() => setUzmanFormTab(t => Math.min(2, t + 1) as UzmanFormTab)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                  İleri <i className="ri-arrow-right-line text-xs" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleClose}
              className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              İptal
            </button>
            <button onClick={handleUzmanEkle}
              disabled={uzmanLoading || !uzmanForm.ad.trim() || !uzmanForm.email.trim() || uzmanForm.password.length < 8}
              className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: (uzmanLoading || !uzmanForm.ad.trim() || !uzmanForm.email.trim() || uzmanForm.password.length < 8) ? 0.6 : 1 }}>
              {uzmanLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-user-add-line" />Personel Ekle</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
