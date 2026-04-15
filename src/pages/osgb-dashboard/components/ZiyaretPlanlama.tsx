import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';

const TR_DAYS = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

interface Firma {
  id: string;
  name: string;
}

interface Personel {
  user_id: string;
  display_name: string;
  email: string;
  osgb_role: string | null;
}

interface Plan {
  id: string;
  firma_org_id: string;
  firma_name?: string;
  gunler: number[];
  hedef_uzman_user_ids: string[];
  notlar: string | null;
  aktif: boolean;
}

interface ZiyaretPlanlamaProps {
  firmalar: Firma[];
  personeller: Personel[];
  isDark: boolean;
}

interface BugunPlan {
  firma_name: string;
  gunler: number[];
  atananlar: string[];
}

export default function ZiyaretPlanlama({ firmalar, personeller, isDark }: ZiyaretPlanlamaProps) {
  const { org, addToast } = useApp();
  const [planlar, setPlanlar] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formFirmaId, setFormFirmaId] = useState('');
  const [formGunler, setFormGunler] = useState<number[]>([]);
  const [formUzmanIds, setFormUzmanIds] = useState<string[]>([]);
  const [formNotlar, setFormNotlar] = useState('');

  const todayDow = (() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  })();

  const bugunPlanlari: BugunPlan[] = planlar
    .filter(p => p.aktif && p.gunler.includes(todayDow))
    .map(p => ({
      firma_name: p.firma_name ?? '—',
      gunler: p.gunler,
      atananlar: personeller
        .filter(per => p.hedef_uzman_user_ids.includes(per.user_id))
        .map(per => per.display_name ?? per.email),
    }));

  const fetchPlanlar = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('osgb_ziyaret_planlari')
        .select('*')
        .eq('osgb_org_id', org.id)
        .order('created_at', { ascending: false });

      const firmaMap: Record<string, string> = {};
      firmalar.forEach(f => { firmaMap[f.id] = f.name; });

      const enriched: Plan[] = (data ?? []).map(p => ({
        id: p.id,
        firma_org_id: p.firma_org_id,
        firma_name: firmaMap[p.firma_org_id] ?? '—',
        gunler: p.gunler ?? [],
        hedef_uzman_user_ids: p.hedef_uzman_user_ids ?? [],
        notlar: p.notlar,
        aktif: p.aktif,
      }));
      setPlanlar(enriched);
    } finally {
      setLoading(false);
    }
  }, [org?.id, firmalar]);

  useEffect(() => { void fetchPlanlar(); }, [fetchPlanlar]);

  const openNew = () => {
    setEditingPlan(null);
    setFormFirmaId(firmalar[0]?.id ?? '');
    setFormGunler([]);
    setFormUzmanIds([]);
    setFormNotlar('');
    setShowModal(true);
  };

  const openEdit = (p: Plan) => {
    setEditingPlan(p);
    setFormFirmaId(p.firma_org_id);
    setFormGunler([...p.gunler]);
    setFormUzmanIds([...p.hedef_uzman_user_ids]);
    setFormNotlar(p.notlar ?? '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!org?.id || !formFirmaId || formGunler.length === 0) {
      addToast('Firma ve en az bir gün seçin.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        osgb_org_id: org.id,
        firma_org_id: formFirmaId,
        gunler: formGunler,
        hedef_uzman_user_ids: formUzmanIds,
        notlar: formNotlar || null,
        aktif: true,
        updated_at: new Date().toISOString(),
      };

      if (editingPlan) {
        await supabase.from('osgb_ziyaret_planlari').update(payload).eq('id', editingPlan.id);
      } else {
        await supabase.from('osgb_ziyaret_planlari').insert(payload);
      }

      // Bildirimleri yaz — atanan personele
      if (formUzmanIds.length > 0 && org?.id) {
        const firma = firmalar.find(f => f.id === formFirmaId);
        const gunLabel = formGunler.map(g => TR_DAYS[g]).join(', ');
        await Promise.all(formUzmanIds.map(uid =>
          supabase.from('notifications').insert({
            user_id: uid,
            organization_id: org.id,
            title: `Ziyaret Planı: ${firma?.name ?? '—'}`,
            message: `${firma?.name ?? '—'} firması için haftalık ziyaret programınız güncellendi. Günler: ${gunLabel}`,
            is_read: false,
            ticket_id: null,
          })
        ));
      }

      addToast(editingPlan ? 'Plan güncellendi!' : 'Plan oluşturuldu ve personele bildirim gönderildi!', 'success');
      setShowModal(false);
      void fetchPlanlar();
    } catch (err) {
      addToast(String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId: string) => {
    await supabase.from('osgb_ziyaret_planlari').update({ aktif: false }).eq('id', planId);
    setPlanlar(prev => prev.filter(p => p.id !== planId));
    addToast('Plan silindi.', 'info');
  };

  const toggleGun = (g: number) => {
    setFormGunler(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort());
  };

  const toggleUzman = (uid: string) => {
    setFormUzmanIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  const textPrimary = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const border = 'var(--border-subtle)';
  const cardBg = 'var(--bg-card-solid)';

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Ziyaret Planlama</h3>
          <p className="text-xs mt-0.5" style={{ color: textMuted }}>Firmalar için haftalık ziyaret programı · Personele otomatik bildirim</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
          <i className="ri-add-line" /> Yeni Plan
        </button>
      </div>

      {/* Bugün planlı ziyaretler banner */}
      {bugunPlanlari.length > 0 && (
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(34,197,94,0.07)', border: '1.5px solid rgba(34,197,94,0.25)' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ background: 'rgba(34,197,94,0.15)' }}>
              <i className="ri-calendar-check-line text-xs" style={{ color: '#22C55E' }} />
            </div>
            <p className="text-xs font-bold" style={{ color: '#16A34A' }}>
              Bugün {bugunPlanlari.length} firmada ziyaret planlanmış
            </p>
          </div>
          <div className="space-y-1.5">
            {bugunPlanlari.map((b, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: textPrimary }}>{b.firma_name}</span>
                {b.atananlar.length > 0 && (
                  <span className="text-[10px]" style={{ color: textMuted }}>
                    → {b.atananlar.join(', ')}
                  </span>
                )}
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                  Bugün planlanmış
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan listesi */}
      <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <i className="ri-loader-4-line animate-spin text-lg" style={{ color: '#0EA5E9' }} />
            <span className="text-xs" style={{ color: textMuted }}>Yükleniyor...</span>
          </div>
        ) : planlar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <i className="ri-calendar-2-line text-2xl" style={{ color: 'var(--text-faint)' }} />
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: textPrimary }}>Henüz plan yok</p>
              <p className="text-xs mt-1" style={{ color: textMuted }}>Firmalara haftalık ziyaret programı tanımlayın</p>
            </div>
            <button onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
              <i className="ri-add-line" /> İlk Planı Oluştur
            </button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: border }}>
            {planlar.map(p => {
              const atananlar = personeller.filter(per => p.hedef_uzman_user_ids.includes(per.user_id));
              const bugunVar = p.aktif && p.gunler.includes(todayDow);

              return (
                <div key={p.id}
                  className="flex items-center gap-3 px-4 py-3.5 transition-all"
                  style={{ opacity: p.aktif ? 1 : 0.5 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Firma */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold" style={{ color: textPrimary }}>{p.firma_name}</p>
                      {bugunVar && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.25)' }}>
                          ● Bugün
                        </span>
                      )}
                    </div>
                    {/* Günler */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {[1,2,3,4,5,6,7].map(g => (
                        <span key={g}
                          className="w-6 h-6 flex items-center justify-center rounded-full text-[9px] font-bold"
                          style={{
                            background: p.gunler.includes(g)
                              ? (g === todayDow ? '#22C55E' : 'rgba(14,165,233,0.15)')
                              : 'transparent',
                            color: p.gunler.includes(g)
                              ? (g === todayDow ? 'white' : '#0EA5E9')
                              : 'var(--text-faint)',
                            border: p.gunler.includes(g) ? 'none' : `1px solid ${border}`,
                          }}>
                          {TR_DAYS[g]}
                        </span>
                      ))}
                    </div>
                    {/* Atanan personel */}
                    {atananlar.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <i className="ri-user-line text-[9px] flex-shrink-0" style={{ color: textMuted }} />
                        <span className="text-[10px]" style={{ color: textMuted }}>
                          {atananlar.map(a => a.display_name ?? a.email).join(', ')}
                        </span>
                      </div>
                    )}
                    {p.notlar && (
                      <p className="text-[10px] mt-1 italic" style={{ color: 'var(--text-faint)' }}>{p.notlar}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(p)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                      style={{ background: 'var(--bg-item)', border: `1px solid ${border}`, color: textMuted }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0EA5E9'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; (e.currentTarget as HTMLElement).style.borderColor = border; }}>
                      <i className="ri-pencil-line text-xs" />
                    </button>
                    <button onClick={() => void handleDelete(p.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                      style={{ background: 'var(--bg-item)', border: `1px solid ${border}`, color: textMuted }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; (e.currentTarget as HTMLElement).style.borderColor = border; }}>
                      <i className="ri-delete-bin-line text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
            style={{ background: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${border}`, maxHeight: '90vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: `1px solid ${border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <i className="ri-calendar-2-line text-base" style={{ color: '#0EA5E9' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: textPrimary }}>
                    {editingPlan ? 'Planı Düzenle' : 'Yeni Ziyaret Planı'}
                  </h3>
                  <p className="text-[10.5px] mt-0.5" style={{ color: textMuted }}>Haftalık ziyaret programı tanımlayın</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                style={{ background: 'var(--bg-item)', color: textMuted }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textMuted; }}>
                <i className="ri-close-line text-sm" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* Firma seç */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: textMuted }}>
                  Firma <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select value={formFirmaId} onChange={e => setFormFirmaId(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none cursor-pointer"
                  style={{ background: 'var(--bg-input)', border: `1.5px solid var(--border-input)`, color: textPrimary }}>
                  <option value="">— Firma seçin —</option>
                  {firmalar.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Günler */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: textMuted }}>
                  Ziyaret Günleri <span style={{ color: '#EF4444' }}>*</span>
                  <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>({formGunler.length} gün seçili)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1,2,3,4,5,6,7].map(g => {
                    const secili = formGunler.includes(g);
                    const bugun = g === todayDow;
                    return (
                      <button key={g} onClick={() => toggleGun(g)}
                        className="flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: secili ? 'rgba(14,165,233,0.12)' : 'var(--bg-item)',
                          border: `1.5px solid ${secili ? 'rgba(14,165,233,0.35)' : border}`,
                          minWidth: '44px',
                        }}>
                        <span className="text-[11px] font-bold" style={{ color: secili ? '#0EA5E9' : textMuted }}>{TR_DAYS[g]}</span>
                        {bugun && (
                          <span className="w-1 h-1 rounded-full" style={{ background: secili ? '#0EA5E9' : '#22C55E' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Personel */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: textMuted }}>
                  Sorumlu Personel
                  <span className="ml-1.5 font-normal" style={{ color: 'var(--text-faint)' }}>(bildirim gönderilecek)</span>
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {personeller.map(p => {
                    const secili = formUzmanIds.includes(p.user_id);
                    return (
                      <button key={p.user_id} onClick={() => toggleUzman(p.user_id)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all text-left"
                        style={{
                          background: secili ? 'rgba(14,165,233,0.08)' : 'var(--bg-item)',
                          border: `1.5px solid ${secili ? 'rgba(14,165,233,0.25)' : border}`,
                        }}>
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: secili ? '#0EA5E9' : 'var(--bg-input)', border: `1.5px solid ${secili ? '#0EA5E9' : border}` }}>
                          {secili && <i className="ri-check-line text-white text-[9px]" />}
                        </div>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)' }}>
                          {(p.display_name ?? p.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: secili ? '#0EA5E9' : textPrimary }}>
                            {p.display_name ?? p.email}
                          </p>
                          <p className="text-[9px]" style={{ color: textMuted }}>
                            {p.osgb_role === 'isyeri_hekimi' ? 'Hekim' : 'Uzman'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Not */}
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: textMuted }}>Not (opsiyonel)</label>
                <textarea value={formNotlar} onChange={e => setFormNotlar(e.target.value)}
                  placeholder="Bu ziyaret planıyla ilgili not..."
                  rows={2}
                  maxLength={300}
                  className="w-full text-sm px-3 py-2.5 rounded-xl outline-none resize-none"
                  style={{ background: 'var(--bg-input)', border: `1.5px solid var(--border-input)`, color: textPrimary }} />
              </div>

              {/* Bildirim notu */}
              {formUzmanIds.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <i className="ri-notification-3-line text-xs flex-shrink-0 mt-0.5" style={{ color: '#0EA5E9' }} />
                  <p className="text-[10.5px]" style={{ color: textMuted }}>
                    <span style={{ fontWeight: 600, color: '#0EA5E9' }}>{formUzmanIds.length} personele</span> ziyaret planı bildirimi gönderilecek.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 flex-shrink-0"
              style={{ borderTop: `1px solid ${border}` }}>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap"
                style={{ background: 'var(--bg-item)', border: `1px solid ${border}`, color: textMuted }}>
                İptal
              </button>
              <button onClick={() => void handleSave()}
                disabled={saving || !formFirmaId || formGunler.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white cursor-pointer whitespace-nowrap transition-all"
                style={{
                  background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                  opacity: (saving || !formFirmaId || formGunler.length === 0) ? 0.6 : 1,
                }}>
                {saving
                  ? <><i className="ri-loader-4-line animate-spin" /> Kaydediliyor...</>
                  : <><i className="ri-save-line" /> {editingPlan ? 'Güncelle' : 'Planı Oluştur'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
