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
    user_id: string;
    display_name: string;
    email: string;
    is_active: boolean;
    active_firm_id: string | null;
    active_firm_ids: string[] | null;
    active_firm_name: string | null;
    osgb_role: string;
  }) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type UzmanFormTab = 0 | 1 | 2;

interface UzmanForm {
  ad: string;
  soyad: string;
  email: string;
  telefon: string;
  rol: 'gezici_uzman' | 'isyeri_hekimi';
  password: string;
  passwordConfirm: string;
  atananFirmaIds: string[];
}

const defaultUzmanForm: UzmanForm = {
  ad: '', soyad: '', email: '', telefon: '',
  rol: 'gezici_uzman', password: '', passwordConfirm: '', atananFirmaIds: [],
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1.5px solid var(--border-input)', borderRadius: '10px',
  color: 'var(--text-primary)', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '13px',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)',
};

export default function UzmanModal({ open, orgId, altFirmalar, onClose, onSuccess, addToast }: UzmanModalProps) {
  const [uzmanForm, setUzmanForm] = useState<UzmanForm>(defaultUzmanForm);
  const [uzmanFormTab, setUzmanFormTab] = useState<UzmanFormTab>(0);
  const [uzmanLoading, setUzmanLoading] = useState(false);
  const [uzmanError, setUzmanError] = useState<string | null>(null);
  const [showUzmanPw, setShowUzmanPw] = useState(false);
  const [showUzmanPwConfirm, setShowUzmanPwConfirm] = useState(false);

  const handleClose = () => {
    setUzmanForm(defaultUzmanForm);
    setUzmanFormTab(0);
    setUzmanError(null);
    setShowUzmanPw(false);
    setShowUzmanPwConfirm(false);
    onClose();
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
      const rolLabel = uzmanForm.rol === 'isyeri_hekimi' ? 'işyeri hekimi' : 'gezici uzman';
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create',
          organization_id: orgId,
          email: uzmanForm.email.trim().toLowerCase(),
          password: uzmanForm.password,
          display_name: fullName,
          role: 'member',
          osgb_role: uzmanForm.rol,
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
        user_id: json.user_id ?? `temp_${Date.now()}`,
        display_name: fullName,
        email: uzmanForm.email.trim().toLowerCase(),
        is_active: true,
        active_firm_id: uzmanForm.atananFirmaIds[0] || null,
        active_firm_ids: uzmanForm.atananFirmaIds.length > 0 ? uzmanForm.atananFirmaIds : null,
        active_firm_name: atananFirmaAd,
        osgb_role: uzmanForm.rol,
      });

      addToast(`${fullName} ${rolLabel} olarak eklendi!`, 'success');
      handleClose();
    } catch (err) {
      setUzmanError(String(err));
    } finally {
      setUzmanLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <i className="ri-user-add-line text-base" style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Personel Ekle</h3>
              <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>OSGB ekibinize yeni personel ekleyin</p>
            </div>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
            style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 px-6 pt-4 flex-shrink-0">
          {[
            { idx: 0, icon: 'ri-user-line', label: 'Kişisel Bilgiler' },
            { idx: 1, icon: 'ri-lock-password-line', label: 'Giriş Bilgileri' },
            { idx: 2, icon: 'ri-building-2-line', label: 'Firma Atama' },
          ].map(tab => (
            <button key={tab.idx}
              onClick={() => setUzmanFormTab(tab.idx as UzmanFormTab)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: uzmanFormTab === tab.idx ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                border: uzmanFormTab === tab.idx ? '1.5px solid rgba(14,165,233,0.25)' : '1px solid var(--border-subtle)',
                color: uzmanFormTab === tab.idx ? '#0EA5E9' : 'var(--text-muted)',
              }}>
              <i className={`${tab.icon} text-xs`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.idx + 1}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Tab 0: Kişisel Bilgiler */}
          {uzmanFormTab === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(14,165,233,0.1)' }}>
                  <i className="ri-user-line text-xs" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Kişisel Bilgiler</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanın kimlik ve iletişim bilgileri</p>
                </div>
              </div>

              {/* Rol Seçimi */}
              <div>
                <label style={labelStyle}>Rol <span style={{ color: '#EF4444' }}>*</span></label>
                <div className="flex gap-2">
                  {([
                    { val: 'gezici_uzman' as const, label: 'Gezici Uzman', icon: 'ri-shield-user-line' },
                    { val: 'isyeri_hekimi' as const, label: 'İşyeri Hekimi', icon: 'ri-heart-pulse-line' },
                  ]).map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setUzmanForm(p => ({ ...p, rol: opt.val }))}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      style={{
                        background: uzmanForm.rol === opt.val ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                        border: `1.5px solid ${uzmanForm.rol === opt.val ? 'rgba(14,165,233,0.3)' : 'var(--border-subtle)'}`,
                        color: uzmanForm.rol === opt.val ? '#0EA5E9' : 'var(--text-muted)',
                      }}>
                      <i className={`${opt.icon} text-xs`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar önizleme */}
              <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0"
                  style={{ background: uzmanForm.ad ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : 'linear-gradient(135deg, #64748b, #475569)' }}>
                  {uzmanForm.ad ? uzmanForm.ad.charAt(0).toUpperCase() : <i className="ri-user-line text-xl" />}
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {uzmanForm.ad || uzmanForm.soyad ? `${uzmanForm.ad} ${uzmanForm.soyad}`.trim() : 'Personel Adı'}
                  </p>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-1"
                    style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
                    {uzmanForm.rol === 'isyeri_hekimi' ? 'İşyeri Hekimi' : 'Gezici Uzman'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Ad <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={uzmanForm.ad} onChange={e => { setUzmanForm(p => ({ ...p, ad: e.target.value })); setUzmanError(null); }}
                    placeholder="Ad" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Soyad <span style={{ color: '#EF4444' }}>*</span></label>
                  <input value={uzmanForm.soyad} onChange={e => setUzmanForm(p => ({ ...p, soyad: e.target.value }))}
                    placeholder="Soyad" style={inputStyle} />
                </div>
                <div className="sm:col-span-2">
                  <label style={labelStyle}>Telefon</label>
                  <input value={uzmanForm.telefon} onChange={e => setUzmanForm(p => ({ ...p, telefon: e.target.value }))}
                    placeholder="0555 000 00 00" style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Giriş Bilgileri */}
          {uzmanFormTab === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <i className="ri-lock-password-line text-xs" style={{ color: '#F59E0B' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Giriş Bilgileri</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanın sisteme giriş için e-posta ve şifresi</p>
                </div>
              </div>
              <div>
                <label style={labelStyle}>E-posta <span style={{ color: '#EF4444' }}>*</span></label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                  <input type="email" value={uzmanForm.email}
                    onChange={e => { setUzmanForm(p => ({ ...p, email: e.target.value })); setUzmanError(null); }}
                    placeholder="uzman@ornek.com"
                    style={{ ...inputStyle, paddingLeft: '36px' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Şifre <span style={{ color: '#EF4444' }}>*</span></label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                  <input type={showUzmanPw ? 'text' : 'password'} value={uzmanForm.password}
                    onChange={e => setUzmanForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="En az 8 karakter"
                    style={{ ...inputStyle, paddingLeft: '36px', paddingRight: '44px' }} />
                  <button type="button" onClick={() => setShowUzmanPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}>
                    <i className={`${showUzmanPw ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
                {uzmanForm.password.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {[...Array(4)].map((_, i) => {
                      const len = uzmanForm.password.length;
                      const active = (i === 0 && len >= 1) || (i === 1 && len >= 6) || (i === 2 && len >= 8) || (i === 3 && len >= 12);
                      const color = len < 6 ? '#EF4444' : len < 8 ? '#F59E0B' : len < 12 ? '#10B981' : '#22C55E';
                      return <div key={i} className="flex-1 h-1 rounded-full" style={{ background: active ? color : 'var(--border-subtle)' }} />;
                    })}
                    <span className="text-[10px] ml-1" style={{ color: uzmanForm.password.length < 6 ? '#EF4444' : uzmanForm.password.length < 8 ? '#F59E0B' : uzmanForm.password.length < 12 ? '#10B981' : '#22C55E' }}>
                      {uzmanForm.password.length < 6 ? 'Zayıf' : uzmanForm.password.length < 8 ? 'Orta' : uzmanForm.password.length < 12 ? 'İyi' : 'Güçlü'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Şifre Tekrar <span style={{ color: '#EF4444' }}>*</span></label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
                  <input type={showUzmanPwConfirm ? 'text' : 'password'} value={uzmanForm.passwordConfirm}
                    onChange={e => setUzmanForm(p => ({ ...p, passwordConfirm: e.target.value }))}
                    placeholder="Şifreyi tekrar girin"
                    style={{
                      ...inputStyle, paddingLeft: '36px', paddingRight: '44px',
                      borderColor: uzmanForm.passwordConfirm && uzmanForm.password !== uzmanForm.passwordConfirm ? '#EF4444' : undefined,
                    }} />
                  <button type="button" onClick={() => setShowUzmanPwConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}>
                    <i className={`${showUzmanPwConfirm ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                  </button>
                </div>
                {uzmanForm.passwordConfirm && uzmanForm.password !== uzmanForm.passwordConfirm && (
                  <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>Şifreler eşleşmiyor</p>
                )}
              </div>
              <div className="p-3 rounded-xl flex items-start gap-2.5" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                <p className="text-[10.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Uzman bu e-posta ve şifre ile sisteme giriş yapabilecek. Şifreyi güvenli bir şekilde iletin.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Firma Atama */}
          {uzmanFormTab === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(139,92,246,0.1)' }}>
                  <i className="ri-building-2-line text-xs" style={{ color: '#8B5CF6' }} />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Firma Atama</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Uzmanı bir müşteri firmaya atayın (isteğe bağlı)</p>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1">
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  Atanacak Firma(lar)
                  <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>({uzmanForm.atananFirmaIds.length} seçili)</span>
                </label>
                {uzmanForm.atananFirmaIds.length > 0 && (
                  <button onClick={() => setUzmanForm(p => ({ ...p, atananFirmaIds: [] }))}
                    className="text-[10px] cursor-pointer" style={{ color: '#EF4444' }}>
                    Tümünü kaldır
                  </button>
                )}
              </div>
              {altFirmalar.length === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl mb-3" style={{ background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
                  <i className="ri-information-line text-sm flex-shrink-0" style={{ color: '#0EA5E9' }} />
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Henüz müşteri firma eklenmedi. Personeli şimdi oluşturup daha sonra Firmalar sekmesinden atama yapabilirsiniz.</p>
                </div>
              )}
              {altFirmalar.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
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
                          background: secili ? 'rgba(14,165,233,0.1)' : 'var(--bg-item)',
                          border: secili ? '1.5px solid rgba(14,165,233,0.3)' : '1.5px solid var(--border-subtle)',
                        }}>
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={secili ? { background: 'linear-gradient(135deg,#0EA5E9,#0284C7)' } : { background: 'var(--bg-input)', border: '1.5px solid var(--border-main)' }}>
                          {secili && <i className="ri-check-line text-white text-[10px]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: secili ? '#0EA5E9' : 'var(--text-primary)' }}>{f.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {f.uzmanAd ? `${f.uzmanAd} atanmış` : `${f.personelSayisi} personel`}
                          </p>
                        </div>
                        {birincil && secili && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(14,165,233,0.15)', color: '#0284C7' }}>Birincil</span>
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
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-sm flex-shrink-0" style={{ color: '#ef4444' }} />
            <p className="text-xs" style={{ color: '#dc2626' }}>{uzmanError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex gap-2">
            <button onClick={() => setUzmanFormTab(t => Math.max(0, t - 1) as UzmanFormTab)} disabled={uzmanFormTab === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: uzmanFormTab === 0 ? 0.35 : 1 }}>
              <i className="ri-arrow-left-line" /> Geri
            </button>
            {uzmanFormTab < 2 && (
              <button onClick={() => setUzmanFormTab(t => Math.min(2, t + 1) as UzmanFormTab)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#0EA5E9' }}>
                İleri <i className="ri-arrow-right-line" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose}
              className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
              style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-item)'; }}>
              İptal
            </button>
            <button onClick={handleUzmanEkle}
              disabled={uzmanLoading || !uzmanForm.ad.trim() || !uzmanForm.email.trim() || uzmanForm.password.length < 8}
              className="whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', opacity: (uzmanLoading || !uzmanForm.ad.trim() || !uzmanForm.email.trim() || uzmanForm.password.length < 8) ? 0.6 : 1 }}
              onMouseEnter={e => { if (!uzmanLoading && uzmanForm.ad.trim() && uzmanForm.email.trim() && uzmanForm.password.length >= 8) { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
              {uzmanLoading ? <><i className="ri-loader-4-line animate-spin" />Ekleniyor...</> : <><i className="ri-user-add-line" />Personel Ekle</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
