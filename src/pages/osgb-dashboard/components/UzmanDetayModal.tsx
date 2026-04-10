import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface AltFirma {
  id: string;
  name: string;
}

interface UzmanDetayModalProps {
  uzman: {
    user_id: string;
    display_name: string;
    email: string;
    is_active: boolean;
    active_firm_id: string | null;
    active_firm_name: string | null;
  };
  orgId: string;
  altFirmalar: AltFirma[];
  onClose: () => void;
  onRefresh: () => void;
  addToast: (msg: string, type: 'success' | 'error') => void;
}

export default function UzmanDetayModal({
  uzman, orgId, altFirmalar, onClose, onRefresh, addToast,
}: UzmanDetayModalProps) {
  const [isActive, setIsActive] = useState(uzman.is_active);
  const [secilenFirmaId, setSecilenFirmaId] = useState(uzman.active_firm_id ?? '');
  const [loading, setLoading] = useState(false);
  const [uygunsuzluklar, setUygunsuzluklar] = useState<{ id: string; baslik: string; created_at: string; }[]>([]);
  const [statLoading, setStatLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async () => {
    setStatLoading(true);
    // Uzmanın aktif firmasındaki son uygunsuzlukları çek (örnek aktivite)
    if (uzman.active_firm_id) {
      const { data } = await supabase
        .from('uygunsuzluklar')
        .select('id, baslik, created_at')
        .eq('organization_id', uzman.active_firm_id)
        .order('created_at', { ascending: false })
        .limit(5);
      setUygunsuzluklar(data ?? []);
    }
    setStatLoading(false);
  };

  const handleKaydet = async () => {
    setLoading(true);
    try {
      const updates: Record<string, unknown> = {
        is_active: isActive,
        active_firm_id: secilenFirmaId || null,
      };

      const { error } = await supabase
        .from('user_organizations')
        .update(updates)
        .eq('user_id', uzman.user_id)
        .eq('organization_id', orgId);

      if (error) throw error;

      addToast('Uzman bilgileri güncellendi!', 'success');
      onRefresh();
      onClose();
    } catch {
      addToast('Güncelleme yapılamadı.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px',
    color: '#1e293b', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '13px',
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl flex flex-col"
        style={{ background: '#fff', border: '1px solid #e2e8f0', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
              style={{ background: isActive ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #94a3b8, #64748b)' }}>
              {(uzman.display_name ?? uzman.email ?? '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: '#0f172a' }}>{uzman.display_name}</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{uzman.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}>
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* Aktif/Pasif Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl"
            style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>Hesap Durumu</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
                {isActive ? 'Uzman sisteme giriş yapabilir' : 'Uzmanın erişimi kısıtlı'}
              </p>
            </div>
            <button
              onClick={() => setIsActive(p => !p)}
              className="relative cursor-pointer flex-shrink-0"
              style={{ width: '44px', height: '24px' }}
            >
              <div className="w-full h-full rounded-full transition-colors"
                style={{ background: isActive ? '#10B981' : '#e2e8f0' }} />
              <div className="absolute top-1 transition-all rounded-full"
                style={{
                  width: '16px', height: '16px',
                  background: '#fff',
                  left: isActive ? '24px' : '4px',
                }} />
            </button>
          </div>

          {/* Firma Atama */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#475569' }}>
              Atanacak Firma
            </label>
            <select
              value={secilenFirmaId}
              onChange={e => setSecilenFirmaId(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">— Firma Atanmadı —</option>
              {altFirmalar.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Bilgi kartı */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
            <p className="text-xs font-semibold" style={{ color: '#475569' }}>Uzman Bilgileri</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-mail-line text-xs" style={{ color: '#94a3b8' }} />
                </div>
                <span className="text-xs" style={{ color: '#64748b' }}>{uzman.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-building-2-line text-xs" style={{ color: '#94a3b8' }} />
                </div>
                <span className="text-xs" style={{ color: '#64748b' }}>
                  {uzman.active_firm_name ?? 'Firma atanmadı'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-user-star-line text-xs" style={{ color: '#94a3b8' }} />
                </div>
                <span className="text-xs" style={{ color: '#64748b' }}>Gezici Uzman</span>
              </div>
            </div>
          </div>

          {/* Son Aktiviteler */}
          {!statLoading && uygunsuzluklar.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#475569' }}>Atandığı Firmadaki Son Uygunsuzluklar</p>
              <div className="space-y-1.5">
                {uygunsuzluklar.map(u => (
                  <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-lg"
                    style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <i className="ri-alert-line text-xs flex-shrink-0" style={{ color: '#F59E0B' }} />
                    <span className="text-xs truncate flex-1" style={{ color: '#64748b' }}>{u.baslik}</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: '#94a3b8' }}>
                      {new Date(u.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5" style={{ borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onClose}
            className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.1)', color: '#64748b' }}>
            İptal
          </button>
          <button onClick={handleKaydet} disabled={loading}
            className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', opacity: loading ? 0.7 : 1 }}>
            {loading
              ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</>
              : <><i className="ri-save-line" />Kaydet</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
