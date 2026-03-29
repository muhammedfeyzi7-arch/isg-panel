import { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useOrganization } from '../../hooks/useOrganization';

type Tab = 'create' | 'join';

export default function OnboardingPage() {
  const { user, logout } = useAuth();
  const { org, loading, createOrg, joinOrg } = useOrganization(user);
  const [tab, setTab] = useState<Tab>('create');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLegacy = Boolean(user && localStorage.getItem(`isg_data_${user.id}`));

  // If org loads (e.g., user already has one or just created one), go to dashboard
  useEffect(() => {
    if (!loading && org) {
      const nav = (window as unknown as { REACT_APP_NAVIGATE?: (path: string) => void }).REACT_APP_NAVIGATE;
      if (nav) nav('/');
    }
  }, [org, loading]);

  const handleCreate = async () => {
    if (!orgName.trim()) { setError('Organizasyon adı zorunludur.'); return; }
    if (!user) return;
    setSubmitting(true);
    setError(null);
    const result = await createOrg(orgName.trim(), user.id);
    if (result.error) {
      setError(result.error);
    }
    setSubmitting(false);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) { setError('Davet kodu zorunludur.'); return; }
    setSubmitting(true);
    setError(null);
    const result = await joinOrg(inviteCode.trim());
    if (result.error) {
      setError(result.error);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #0D1526 50%, #0A1020 100%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
            <i className="ri-shield-check-line text-white text-xl" />
          </div>
          <div className="flex items-center gap-2" style={{ color: '#475569' }}>
            <i className="ri-loader-4-line text-lg animate-spin" />
            <span className="text-sm">Yükleniyor...</span>
          </div>
        </div>
      </div>
    );
  }

  const cardBg = 'rgba(255,255,255,0.03)';
  const border = '1px solid rgba(255,255,255,0.08)';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #0D1526 50%, #0A1020 100%)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 8px 30px rgba(99,102,241,0.45)' }}>
          <i className="ri-shield-check-line text-white text-2xl" />
        </div>
        <h1 className="text-2xl font-bold text-white">ISG Denetim</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Organizasyonunuza bağlanın</p>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md rounded-2xl p-8 space-y-6"
        style={{ background: cardBg, border, backdropFilter: 'blur(20px)' }}>

        <div>
          <h2 className="text-lg font-bold text-white">Hoş geldiniz!</h2>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            {user?.email && <span className="text-slate-400">{user.email}</span>} hesabınızla giriş yaptınız.
            Devam etmek için bir organizasyon oluşturun veya mevcut birine katılın.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['create', 'join'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
              style={{
                background: tab === t ? 'linear-gradient(135deg, #3B82F6, #6366F1)' : 'transparent',
                color: tab === t ? '#fff' : '#64748B',
                boxShadow: tab === t ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              <i className={`${t === 'create' ? 'ri-add-circle-line' : 'ri-group-line'} mr-1.5`} />
              {t === 'create' ? 'Yeni Organizasyon' : 'Davet Koduyla Katıl'}
            </button>
          ))}
        </div>

        {/* Create Tab */}
        {tab === 'create' && (
          <div className="space-y-4">
            {hasLegacy && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <i className="ri-information-line text-amber-400 flex-shrink-0 mt-0.5" />
                <span style={{ color: '#FCD34D' }}>
                  Mevcut verileriniz yeni organizasyona otomatik aktarılacak.
                </span>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#94A3B8' }}>
                Organizasyon Adı
              </label>
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Örn: ABC İnşaat A.Ş."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#E2E8F0',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={submitting || !orgName.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
                opacity: (submitting || !orgName.trim()) ? 0.6 : 1,
              }}
            >
              {submitting
                ? <><i className="ri-loader-4-line animate-spin" /> Oluşturuluyor...</>
                : <><i className="ri-add-circle-line" /> Organizasyon Oluştur</>}
            </button>
          </div>
        )}

        {/* Join Tab */}
        {tab === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#94A3B8' }}>
                Davet Kodu
              </label>
              <input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="Örn: ABC123"
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all tracking-widest font-mono uppercase"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#E2E8F0',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
              <p className="text-xs mt-1.5" style={{ color: '#475569' }}>
                Organizasyon yöneticinizden 6 haneli davet kodunu isteyin.
              </p>
            </div>
            <button
              onClick={handleJoin}
              disabled={submitting || !inviteCode.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                opacity: (submitting || !inviteCode.trim()) ? 0.6 : 1,
              }}
            >
              {submitting
                ? <><i className="ri-loader-4-line animate-spin" /> Katılınıyor...</>
                : <><i className="ri-group-line" /> Organizasyona Katıl</>}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-red-400 flex-shrink-0 mt-0.5" />
            <span style={{ color: '#FCA5A5' }}>{error}</span>
          </div>
        )}

        {/* Divider + logout */}
        <div className="pt-2 flex items-center justify-center">
          <button
            onClick={logout}
            className="text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{ color: '#475569' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
          >
            <i className="ri-logout-box-line" />
            Farklı hesapla giriş yap
          </button>
        </div>
      </div>
    </div>
  );
}
