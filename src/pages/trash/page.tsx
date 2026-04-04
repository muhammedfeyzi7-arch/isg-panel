import { useState, useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import Modal from '../../components/base/Modal';
import Badge, { getFirmaStatusColor, getPersonelStatusColor, getEvrakStatusColor } from '../../components/base/Badge';

type Tab = 'firmalar' | 'personeller' | 'evraklar' | 'egitimler' | 'muayeneler' | 'ekipmanlar' | 'uygunsuzluklar' | 'tutanaklar' | 'is_izinleri';

export default function CopKutusuPage() {
  const {
    firmalar, personeller, evraklar, egitimler, muayeneler,
    ekipmanlar, uygunsuzluklar, tutanaklar, isIzinleri,
    restoreFirma, permanentDeleteFirma,
    restorePersonel, permanentDeletePersonel,
    restoreEvrak, permanentDeleteEvrak,
    restoreEgitim, permanentDeleteEgitim,
    restoreMuayene, permanentDeleteMuayene,
    restoreEkipman, permanentDeleteEkipman,
    deleteUygunsuzluk,
    restoreTutanak, permanentDeleteTutanak,
    restoreIsIzni, permanentDeleteIsIzni,
    addToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('firmalar');
  const [permDeleteItem, setPermDeleteItem] = useState<{ id: string; tip: Tab; ad: string } | null>(null);

  const deletedFirmalar    = useMemo(() => firmalar.filter(f => f.silinmis), [firmalar]);
  const deletedPersoneller = useMemo(() => personeller.filter(p => p.silinmis), [personeller]);
  const deletedEvraklar    = useMemo(() => evraklar.filter(e => e.silinmis), [evraklar]);
  const deletedEgitimler   = useMemo(() => egitimler.filter(e => e.silinmis), [egitimler]);
  const deletedMuayeneler  = useMemo(() => muayeneler.filter(m => m.silinmis), [muayeneler]);
  // Ekipman, uygunsuzluk, tutanak, iş izni için cascadeSilindi veya silinmis kontrolü
  const deletedEkipmanlar      = useMemo(() => ekipmanlar.filter(e => e.silinmis || e.cascadeSilindi), [ekipmanlar]);
  const deletedUygunsuzluklar  = useMemo(() => uygunsuzluklar.filter(u => u.silinmis || u.cascadeSilindi), [uygunsuzluklar]);
  // Tutanak ve iş izni soft-delete yok, bu yüzden bunlar kalıcı silme için ayrı gösterilir
  // Ancak cascade ile silinenleri gösterebiliriz
  const deletedTutanaklar  = useMemo(() => tutanaklar.filter(t => (t as unknown as { silinmis?: boolean }).silinmis), [tutanaklar]);
  const deletedIsIzinleri  = useMemo(() => isIzinleri.filter(iz => (iz as unknown as { silinmis?: boolean }).silinmis), [isIzinleri]);

  const totalDeleted =
    deletedFirmalar.length + deletedPersoneller.length +
    deletedEvraklar.length + deletedEgitimler.length + deletedMuayeneler.length +
    deletedEkipmanlar.length + deletedUygunsuzluklar.length +
    deletedTutanaklar.length + deletedIsIzinleri.length;

  // Firma başına cascade geri yüklenecek sayıları hesapla
  const firmaCascadeSayilari = useMemo(() => {
    const result: Record<string, { personel: number; evrak: number }> = {};
    for (const f of deletedFirmalar) {
      const cascadePersonelIds = personeller
        .filter(p => p.cascadeFirmaId === f.id && p.cascadeSilindi)
        .map(p => p.id);
      const cascadeEvrakSayisi = evraklar.filter(e => e.cascadeFirmaId === f.id && e.cascadeSilindi).length;
      result[f.id] = { personel: cascadePersonelIds.length, evrak: cascadeEvrakSayisi };
    }
    return result;
  }, [deletedFirmalar, personeller, evraklar]);

  const permDeleteCascade = useMemo(() => {
    if (!permDeleteItem || permDeleteItem.tip !== 'firmalar') return null;
    const id = permDeleteItem.id;
    const tumPersonelIds = personeller.filter(p => p.firmaId === id).map(p => p.id);
    const evrakSayisi = evraklar.filter(e =>
      e.firmaId === id || (e.personelId ? tumPersonelIds.includes(e.personelId) : false),
    ).length;
    return { personelSayisi: tumPersonelIds.length, evrakSayisi };
  }, [permDeleteItem, personeller, evraklar]);

  const handleRestore = (id: string, tip: Tab) => {
    if (tip === 'firmalar') {
      const sayilar = firmaCascadeSayilari[id];
      restoreFirma(id);
      const ekBilgi = sayilar && (sayilar.personel > 0 || sayilar.evrak > 0)
        ? ` (${sayilar.personel > 0 ? `${sayilar.personel} personel` : ''}${sayilar.personel > 0 && sayilar.evrak > 0 ? ', ' : ''}${sayilar.evrak > 0 ? `${sayilar.evrak} evrak` : ''} da geri yüklendi)`
        : '';
      addToast(`Firma geri yüklendi.${ekBilgi}`, 'success');
    }
    if (tip === 'personeller')    { restorePersonel(id);  addToast('Personel geri yüklendi.', 'success'); }
    if (tip === 'evraklar')       { restoreEvrak(id);     addToast('Evrak geri yüklendi.', 'success'); }
    if (tip === 'egitimler')      { restoreEgitim(id);    addToast('Eğitim geri yüklendi.', 'success'); }
    if (tip === 'muayeneler')     { restoreMuayene(id);   addToast('Sağlık evrakı geri yüklendi.', 'success'); }
    if (tip === 'ekipmanlar')     { restoreEkipman(id);   addToast('Ekipman geri yüklendi.', 'success'); }
    if (tip === 'tutanaklar')     { restoreTutanak(id);   addToast('Tutanak geri yüklendi.', 'success'); }
    if (tip === 'is_izinleri')    { restoreIsIzni(id);    addToast('İş izni geri yüklendi.', 'success'); }
  };

  const handlePermanentDelete = () => {
    if (!permDeleteItem) return;
    const { id, tip } = permDeleteItem;
    if (tip === 'firmalar')       permanentDeleteFirma(id);
    if (tip === 'personeller')    permanentDeletePersonel(id);
    if (tip === 'evraklar')       permanentDeleteEvrak(id);
    if (tip === 'egitimler')      permanentDeleteEgitim(id);
    if (tip === 'muayeneler')     permanentDeleteMuayene(id);
    if (tip === 'ekipmanlar')     permanentDeleteEkipman(id);
    if (tip === 'uygunsuzluklar') deleteUygunsuzluk(id);
    if (tip === 'tutanaklar')     permanentDeleteTutanak(id);
    if (tip === 'is_izinleri')    permanentDeleteIsIzni(id);
    addToast('Kayıt kalıcı olarak silindi.', 'info');
    setPermDeleteItem(null);
  };

  const canRestore = (tip: Tab) => ['firmalar', 'personeller', 'evraklar', 'egitimler', 'muayeneler', 'ekipmanlar', 'tutanaklar', 'is_izinleri'].includes(tip);

  const tabs: { id: Tab; label: string; icon: string; count: number; color: string }[] = [
    { id: 'firmalar',       label: 'Firmalar',       icon: 'ri-building-2-line',      count: deletedFirmalar.length,       color: '#3B82F6' },
    { id: 'personeller',    label: 'Personeller',    icon: 'ri-team-line',             count: deletedPersoneller.length,    color: '#10B981' },
    { id: 'evraklar',       label: 'Evraklar',       icon: 'ri-file-list-3-line',      count: deletedEvraklar.length,       color: '#F59E0B' },
    { id: 'egitimler',      label: 'Eğitimler',      icon: 'ri-graduation-cap-line',   count: deletedEgitimler.length,      color: '#60A5FA' },
    { id: 'muayeneler',     label: 'Sağlık',         icon: 'ri-heart-pulse-line',      count: deletedMuayeneler.length,     color: '#F43F5E' },
    { id: 'ekipmanlar',     label: 'Ekipmanlar',     icon: 'ri-tools-line',            count: deletedEkipmanlar.length,     color: '#FB923C' },
    { id: 'uygunsuzluklar', label: 'Saha Denetim',  icon: 'ri-map-pin-user-line',     count: deletedUygunsuzluklar.length, color: '#F97316' },
    { id: 'tutanaklar',     label: 'Tutanaklar',     icon: 'ri-article-line',          count: deletedTutanaklar.length,     color: '#14B8A6' },
    { id: 'is_izinleri',    label: 'İş İzinleri',   icon: 'ri-shield-check-line',     count: deletedIsIzinleri.length,     color: '#8B5CF6' },
  ];

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

  const EKIPMAN_STATUS_COLOR: Record<string, string> = {
    'Uygun': '#34D399', 'Uygun Değil': '#F87171', 'Bakımda': '#FBBF24', 'Hurda': '#94A3B8',
  };
  const SEVERITY_COLOR: Record<string, string> = {
    'Düşük': '#34D399', 'Orta': '#FBBF24', 'Yüksek': '#FB923C', 'Kritik': '#F87171',
  };
  const IZIN_STATUS_COLOR: Record<string, string> = {
    'Onay Bekliyor': '#FBBF24', 'Onaylandı': '#34D399', 'Reddedildi': '#F87171',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Çöp Kutusu</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {totalDeleted} silinen kayıt — geri yükleyebilir veya kalıcı silebilirsiniz
          </p>
        </div>
        {totalDeleted > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
            <i className="ri-delete-bin-line" />{totalDeleted} kayıt çöp kutusunda
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <i className="ri-information-line text-lg flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Silinen kayıtlar buradan <strong style={{ color: 'var(--text-primary)' }}>geri yüklenebilir</strong>.
          Kalıcı silme işlemi <strong className="text-red-400">geri alınamaz</strong> — dikkatli kullanın.
          Saha denetim kayıtları için yalnızca <strong style={{ color: 'var(--text-primary)' }}>kalıcı silme</strong> mevcut.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl isg-card">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
            style={activeTab === tab.id
              ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: 'white', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }
              : { color: 'var(--text-muted)' }}
          >
            <i className={tab.icon} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={activeTab === tab.id
                  ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                  : { background: 'rgba(239,68,68,0.15)', color: '#F87171' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl isg-card overflow-hidden">

        {/* Firmalar Tab */}
        {activeTab === 'firmalar' && (
          deletedFirmalar.length === 0
            ? <TrashEmpty type="firma" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedFirmalar.map(f => {
                const cascade = firmaCascadeSayilari[f.id] ?? { personel: 0, evrak: 0 };
                const hasCascade = cascade.personel > 0 || cascade.evrak > 0;
                return (
                  <div key={f.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
                      {f.ad.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{f.ad}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {f.yetkiliKisi || '—'} · Silinme: {fmt(f.silinmeTarihi)}
                        </p>
                        {hasCascade && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <i className="ri-links-line" />
                            {cascade.personel > 0 && `${cascade.personel} personel`}
                            {cascade.personel > 0 && cascade.evrak > 0 && ', '}
                            {cascade.evrak > 0 && `${cascade.evrak} evrak`}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge label={f.durum} color={getFirmaStatusColor(f.durum)} />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(f.id, 'firmalar')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" />
                        {hasCascade ? 'Tümünü Geri Yükle' : 'Geri Yükle'}
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: f.id, tip: 'firmalar', ad: f.ad })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* Personeller Tab */}
        {activeTab === 'personeller' && (
          deletedPersoneller.length === 0
            ? <TrashEmpty type="personel" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedPersoneller.map(p => {
                const ilgiFirma = p.cascadeSilindi && p.cascadeFirmaId
                  ? firmalar.find(f => f.id === p.cascadeFirmaId)
                  : null;
                return (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                      {p.adSoyad.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.adSoyad}</p>
                        {ilgiFirma && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                            style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <i className="ri-building-2-line" />
                            {ilgiFirma.ad} ile silindi
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {p.gorev || '—'} · Silinme: {fmt(p.silinmeTarihi)}
                      </p>
                    </div>
                    <Badge label={p.durum} color={getPersonelStatusColor(p.durum)} />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(p.id, 'personeller')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" /> Geri Yükle
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: p.id, tip: 'personeller', ad: p.adSoyad })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* Evraklar Tab */}
        {activeTab === 'evraklar' && (
          deletedEvraklar.length === 0
            ? <TrashEmpty type="evrak" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedEvraklar.map(e => {
                const cascadeFirma = e.cascadeSilindi && e.cascadeFirmaId
                  ? firmalar.find(f => f.id === e.cascadeFirmaId)
                  : null;
                return (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <i className="ri-file-text-line text-sm" style={{ color: '#60A5FA' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{e.ad}</p>
                        {cascadeFirma && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0"
                            style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <i className="ri-building-2-line" />
                            {cascadeFirma.ad} ile silindi
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {e.tur} · Silinme: {fmt(e.silinmeTarihi)}
                      </p>
                    </div>
                    <Badge label={e.durum} color={getEvrakStatusColor(e.durum)} />
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(e.id, 'evraklar')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" /> Geri Yükle
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: e.id, tip: 'evraklar', ad: e.ad })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* Eğitimler Tab */}
        {activeTab === 'egitimler' && (
          deletedEgitimler.length === 0
            ? <TrashEmpty type="egitim" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedEgitimler.map(eg => {
                const firma = firmalar.find(f => f.id === eg.firmaId);
                return (
                  <div key={eg.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}>
                      <i className="ri-graduation-cap-line text-sm" style={{ color: '#60A5FA' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{eg.ad}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {firma?.ad || '—'} · {eg.tarih ? new Date(eg.tarih).toLocaleDateString('tr-TR') : '—'} · Silinme: {fmt(eg.silinmeTarihi)}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.2)' }}>
                      {eg.durum}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(eg.id, 'egitimler')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" /> Geri Yükle
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: eg.id, tip: 'egitimler', ad: eg.ad })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* Muayeneler Tab */}
        {activeTab === 'muayeneler' && (
          deletedMuayeneler.length === 0
            ? <TrashEmpty type="muayene" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedMuayeneler.map(m => {
                const personel = personeller.find(p => p.id === m.personelId);
                const firma = firmalar.find(f => f.id === m.firmaId);
                const RESULT_COLOR: Record<string, string> = {
                  'Çalışabilir': '#34D399', 'Kısıtlı Çalışabilir': '#FBBF24', 'Çalışamaz': '#F87171',
                };
                const rc = RESULT_COLOR[m.sonuc] ?? '#94A3B8';
                return (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.2)' }}>
                      <i className="ri-heart-pulse-line text-sm" style={{ color: '#F43F5E' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {personel?.adSoyad || '—'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {firma?.ad || '—'} · {m.muayeneTarihi ? new Date(m.muayeneTarihi).toLocaleDateString('tr-TR') : '—'} · Silinme: {fmt(m.silinmeTarihi)}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: `${rc}18`, color: rc, border: `1px solid ${rc}30` }}>
                      {m.sonuc}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(m.id, 'muayeneler')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" /> Geri Yükle
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: m.id, tip: 'muayeneler', ad: personel?.adSoyad || 'Muayene' })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* Ekipmanlar Tab */}
        {activeTab === 'ekipmanlar' && (
          deletedEkipmanlar.length === 0
            ? <TrashEmpty type="ekipman" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedEkipmanlar.map(ek => {
                const firma = firmalar.find(f => f.id === ek.firmaId);
                const sc = EKIPMAN_STATUS_COLOR[ek.durum] ?? '#94A3B8';
                return (
                  <div key={ek.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.2)' }}>
                      <i className="ri-tools-line text-sm" style={{ color: '#FB923C' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ek.ad}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {ek.tur} · {firma?.ad || '—'} · {ek.bulunduguAlan || '—'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>
                      {ek.durum}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(ek.id, 'ekipmanlar')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" /> Geri Yükle
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: ek.id, tip: 'ekipmanlar', ad: ek.ad })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* Uygunsuzluklar Tab */}
        {activeTab === 'uygunsuzluklar' && (
          deletedUygunsuzluklar.length === 0
            ? <TrashEmpty type="uygunsuzluk" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedUygunsuzluklar.map(u => {
                const firma = firmalar.find(f => f.id === u.firmaId);
                const sc = SEVERITY_COLOR[u.severity] ?? '#94A3B8';
                return (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}>
                      <i className="ri-map-pin-user-line text-sm" style={{ color: '#F97316' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.baslik}</p>
                        {u.acilisNo && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>
                            {u.acilisNo}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {firma?.ad || '—'} · {u.tarih ? new Date(u.tarih).toLocaleDateString('tr-TR') : '—'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>
                      {u.severity}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setPermDeleteItem({ id: u.id, tip: 'uygunsuzluklar', ad: u.baslik })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* Tutanaklar Tab */}
        {activeTab === 'tutanaklar' && (
          deletedTutanaklar.length === 0
            ? <TrashEmpty type="tutanak" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedTutanaklar.map(t => {
                const firma = firmalar.find(f => f.id === t.firmaId);
                const STATUS_COLOR: Record<string, string> = {
                  'Taslak': '#94A3B8', 'Tamamlandı': '#34D399', 'Onaylandı': '#60A5FA', 'İptal': '#F87171',
                };
                const sc = STATUS_COLOR[t.durum] ?? '#94A3B8';
                return (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.2)' }}>
                      <i className="ri-article-line text-sm" style={{ color: '#14B8A6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{t.baslik}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6' }}>
                          {t.tutanakNo}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {firma?.ad || '—'} · {t.tarih ? new Date(t.tarih).toLocaleDateString('tr-TR') : '—'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>
                      {t.durum}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(t.id, 'tutanaklar')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" /> Geri Yükle
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: t.id, tip: 'tutanaklar', ad: t.baslik })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* İş İzinleri Tab */}
        {activeTab === 'is_izinleri' && (
          deletedIsIzinleri.length === 0
            ? <TrashEmpty type="is_izni" />
            : <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {deletedIsIzinleri.map(iz => {
                const firma = firmalar.find(f => f.id === iz.firmaId);
                const sc = IZIN_STATUS_COLOR[iz.durum] ?? '#94A3B8';
                return (
                  <div key={iz.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <i className="ri-shield-check-line text-sm" style={{ color: '#8B5CF6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{iz.tip}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
                          {iz.izinNo}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {firma?.ad || '—'} · {iz.bolum || '—'} · {iz.baslamaTarihi ? new Date(iz.baslamaTarihi).toLocaleDateString('tr-TR') : '—'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>
                      {iz.durum}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleRestore(iz.id, 'is_izinleri')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}>
                        <i className="ri-arrow-go-back-line" /> Geri Yükle
                      </button>
                      <button onClick={() => setPermDeleteItem({ id: iz.id, tip: 'is_izinleri', ad: `${iz.izinNo} - ${iz.tip}` })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
                        style={{ color: '#EF4444' }} title="Kalıcı Sil"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <i className="ri-delete-bin-line text-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}
      </div>

      {/* Permanent Delete Confirmation */}
      <Modal open={!!permDeleteItem} onClose={() => setPermDeleteItem(null)} title="Kalıcı Olarak Sil" size="sm" icon="ri-delete-bin-2-line"
        footer={
          <>
            <button onClick={() => setPermDeleteItem(null)} className="btn-secondary">İptal</button>
            <button onClick={handlePermanentDelete} className="btn-danger">
              <i className="ri-delete-bin-line" /> Kalıcı Sil
            </button>
          </>
        }>
        <div className="py-1 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 flex items-center justify-center rounded-2xl flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <i className="ri-error-warning-line text-lg" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-snug" style={{ color: '#E2E8F0' }}>
                &quot;{permDeleteItem?.ad}&quot; kalıcı olarak silinecek
              </p>
              <p className="text-sm mt-1.5" style={{ color: '#94A3B8' }}>
                Bu işlem <strong className="text-red-400">geri alınamaz</strong>. Kayıt sistemden tamamen kaldırılacak.
              </p>
              {permDeleteItem && !canRestore(permDeleteItem.tip) && (
                <p className="text-xs mt-2 px-2 py-1.5 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <i className="ri-information-line mr-1" />
                  Bu kayıt türü için geri yükleme desteklenmez.
                </p>
              )}
            </div>
          </div>

          {permDeleteItem?.tip === 'firmalar' && permDeleteCascade && (permDeleteCascade.personelSayisi > 0 || permDeleteCascade.evrakSayisi > 0) && (
            <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2">
                <i className="ri-links-line text-sm flex-shrink-0" style={{ color: '#F87171' }} />
                <p className="text-xs font-semibold" style={{ color: '#F87171' }}>Birlikte kalıcı olarak silinecek:</p>
              </div>
              <div className="space-y-1.5 pl-5">
                {permDeleteCascade.personelSayisi > 0 && (
                  <div className="flex items-center gap-2">
                    <i className="ri-team-line text-xs" style={{ color: '#CBD5E1' }} />
                    <p className="text-xs" style={{ color: '#CBD5E1' }}>
                      <span className="font-bold" style={{ color: '#E2E8F0' }}>{permDeleteCascade.personelSayisi}</span> personel
                    </p>
                  </div>
                )}
                {permDeleteCascade.evrakSayisi > 0 && (
                  <div className="flex items-center gap-2">
                    <i className="ri-file-list-3-line text-xs" style={{ color: '#CBD5E1' }} />
                    <p className="text-xs" style={{ color: '#CBD5E1' }}>
                      <span className="font-bold" style={{ color: '#E2E8F0' }}>{permDeleteCascade.evrakSayisi}</span> evrak
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function TrashEmpty({ type }: { type: string }) {
  const labels: Record<string, string> = {
    firma:          'Çöp kutusunda firma yok',
    personel:       'Çöp kutusunda personel yok',
    evrak:          'Çöp kutusunda evrak yok',
    egitim:         'Çöp kutusunda eğitim kaydı yok',
    muayene:        'Çöp kutusunda sağlık kaydı yok',
    ekipman:        'Çöp kutusunda ekipman kaydı yok',
    uygunsuzluk:    'Çöp kutusunda saha denetim kaydı yok',
    tutanak:        'Çöp kutusunda tutanak yok',
    is_izni:        'Çöp kutusunda iş izni yok',
  };
  return (
    <div className="flex flex-col items-center py-16 gap-3">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl"
        style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}>
        <i className="ri-delete-bin-line text-2xl" style={{ color: 'var(--text-faint)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{labels[type] ?? 'Çöp kutusu boş'}</p>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Silinen kayıtlar burada görünür</p>
    </div>
  );
}
