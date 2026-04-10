import { useState, useCallback, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { supabase } from '../../lib/supabase';

interface AltFirma {
  id: string;
  name: string;
}

export default function GeziciUzmanBanner() {
  const { org, addToast } = useApp();
  const { user, logout } = useAuth();
  const [firmalar, setFirmalar] = useState<AltFirma[]>([]);
  const [firmaSecOpen, setFirmaSecOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // OSGB org'u bul ve alt firmaları çek
  const fetchFirmalar = useCallback(async () => {
    if (!user) return;
    // Uzmanın osgb org kaydını bul
    const { data: uoData } = await supabase
      .from('user_organizations')
      .select('organization_id, active_firm_id')
      .eq('user_id', user.id)
      .eq('osgb_role', 'gezici_uzman')
      .eq('is_active', true)
      .maybeSingle();

    if (!uoData?.organization_id) return;

    const { data: firms } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('parent_org_id', uoData.organization_id)
      .eq('org_type', 'firma')
      .order('name');

    setFirmalar(firms ?? []);
  }, [user]);

  useEffect(() => {
    fetchFirmalar();
  }, [fetchFirmalar]);

  const handleFirmaChange = async (firmaId: string) => {
    if (!user || firmaId === org?.id) {
      setFirmaSecOpen(false);
      return;
    }
    setSwitching(true);
    try {
      // OSGB org kaydını bul
      const { data: uoData } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('osgb_role', 'gezici_uzman')
        .eq('is_active', true)
        .maybeSingle();

      if (!uoData) return;

      await supabase
        .from('user_organizations')
        .update({ active_firm_id: firmaId })
        .eq('user_id', user.id)
        .eq('organization_id', uoData.organization_id);

      addToast('Firma değiştirildi, sayfa yenileniyor...', 'success');
      setFirmaSecOpen(false);
      // Sayfa tamamen yenileniyor — useOrganization yeni firm ID'yi çekecek
      setTimeout(() => window.location.reload(), 800);
    } catch {
      addToast('Firma değiştirilirken hata oluştu', 'error');
    } finally {
      setSwitching(false);
    }
  };

  if (org?.osgbRole !== 'gezici_uzman') return null;

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-3 px-4"
        style={{
          height: '36px',
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
          borderBottom: '1px solid rgba(16,185,129,0.25)',
        }}
      >
        {/* Gezici uzman badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-5 h-5 flex items-center justify-center rounded-md" style={{ background: 'rgba(16,185,129,0.2)' }}>
            <i className="ri-user-star-line text-[10px]" style={{ color: '#6EE7B7' }} />
          </div>
          <span className="text-[11px] font-bold" style={{ color: '#6EE7B7' }}>Gezici Uzman</span>
        </div>

        <span className="text-[10px]" style={{ color: 'rgba(110,231,183,0.4)' }}>|</span>

        {/* Aktif firma */}
        <button
          onClick={() => setFirmaSecOpen(true)}
          className="flex items-center gap-1.5 cursor-pointer transition-all px-2 py-1 rounded-lg"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)'; }}
        >
          <i className="ri-building-2-line text-[10px]" style={{ color: '#34D399' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#34D399' }}>
            {org.name}
          </span>
          {firmalar.length > 1 && (
            <i className="ri-arrow-down-s-line text-[10px]" style={{ color: 'rgba(52,211,153,0.6)' }} />
          )}
        </button>

        <div className="flex-1" />

        {/* Çıkış */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg transition-all"
          style={{ color: 'rgba(110,231,183,0.6)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(110,231,183,0.6)'; }}
        >
          <i className="ri-logout-box-line text-[11px]" />
          <span className="text-[11px] font-medium hidden sm:block">Çıkış</span>
        </button>
      </div>

      {/* Firma seçim modalı */}
      {firmaSecOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setFirmaSecOpen(false); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--bg-card-solid)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <i className="ri-building-2-line text-sm" style={{ color: '#10B981' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Firma Değiştir</h3>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Çalışacağınız firmayı seçin</p>
                </div>
              </div>
              <button
                onClick={() => setFirmaSecOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                style={{ background: 'var(--bg-item)', color: 'var(--text-muted)' }}
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            <div className="space-y-1.5">
              {firmalar.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Firma bulunamadı</p>
              ) : (
                firmalar.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFirmaChange(f.id)}
                    disabled={switching}
                    className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all text-left"
                    style={{
                      background: f.id === org?.id ? 'rgba(16,185,129,0.1)' : 'var(--bg-item)',
                      border: f.id === org?.id ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--bg-item-border)',
                      opacity: switching ? 0.7 : 1,
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <i className="ri-building-2-line text-sm" style={{ color: '#059669' }} />
                    </div>
                    <span className="text-xs font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                    {f.id === org?.id && (
                      <i className="ri-checkbox-circle-fill text-sm flex-shrink-0" style={{ color: '#10B981' }} />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}