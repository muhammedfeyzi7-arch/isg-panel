/**
 * PersonelDetayModal — Merkezi Personel Detay Modalı
 *
 * Bu bileşen, hangi sayfadan açılırsa açılsın (personel listesi, firma detay,
 * vb.) HER ZAMAN aynı personelId üzerinden store'dan direkt veri çeker.
 * Hiçbir parent bileşenden pre-filtered array almaz; tüm veri bağlama
 * kendi içindedir.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../../store/AppContext';
import Modal from '../../../components/base/Modal';
import Badge, { getPersonelStatusColor, getEvrakStatusColor } from '../../../components/base/Badge';
import CategorizedEvraklar from './CategorizedEvraklar';
import { getEvrakKategori } from '../../../utils/evrakKategori';
import PersonelAvatar from '../../../components/base/PersonelAvatar';
import PersonelKartvizit from './PersonelKartvizit';

interface Props {
  /** Görüntülenecek personelin ID'si. null ise modal kapalıdır. */
  personelId: string | null;
  onClose: () => void;
}

/* ── Küçük bilgi satırı ──────────────────────────────────────── */
function IR({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>{label}</p>
      <p className="text-sm font-medium text-slate-200">{value || '—'}</p>
    </div>
  );
}

/* ── Liste satırı ────────────────────────────────────────────── */
function ListRow({
  icon, iconColor, title, sub, badge,
}: {
  icon: string; iconColor: string; title: string; sub: string; badge: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3.5 py-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${iconColor}18` }}>
        <i className={`${icon} text-sm`} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="text-xs" style={{ color: '#475569' }}>{sub}</p>
      </div>
      {badge}
    </div>
  );
}

/* ── Boş durum ───────────────────────────────────────────────── */
function EmptyTab({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-8">
      <i className={`${icon} text-3xl`} style={{ color: '#1E293B' }} />
      <p className="text-sm mt-2" style={{ color: '#334155' }}>{text}</p>
    </div>
  );
}

/* ── Ana Bileşen ─────────────────────────────────────────────── */
export default function PersonelDetayModal({ personelId, onClose }: Props) {
  const {
    personeller, firmalar, evraklar, egitimler, muayeneler, uygunsuzluklar, getPersonelFoto,
  } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState('bilgiler');
  const [showKartvizit, setShowKartvizit] = useState(false);

  // personelId değiştiğinde sekmeyi sıfırla
  useEffect(() => {
    if (personelId) { setTab('bilgiler'); setShowKartvizit(false); }
  }, [personelId]);

  /* ── Veri bağlama — tamamıyla store'dan, personelId üzerinden ── */

  // Erken çıkış: modal kapalıysa hiç hesaplama yapmaz
  const personel = personelId ? personeller.find(p => p.id === personelId) ?? null : null;
  const fotoUrl = personelId ? getPersonelFoto(personelId) : undefined;

  // Sadece bu personele ait, silinmemiş evraklar
  const pEvraklar = personelId
    ? evraklar.filter(e => e.personelId === personelId && !e.silinmis)
    : [];

  const pEgitimler = personelId
    ? egitimler.filter(e => e.katilimciIds.includes(personelId) && !e.silinmis)
    : [];

  const pMuayeneler = personelId
    ? muayeneler.filter(m => m.personelId === personelId && !m.silinmis)
    : [];

  const pUygunsuzluklar = personelId
    ? uygunsuzluklar.filter(u => u.personelId === personelId && !u.silinmis)
    : [];

  /**
   * Sağlık sekmesi evrakları:
   * - stored `kategori === 'saglik'` (yeni kayıtlar — kesin)
   * - VEYA runtime fallback: getEvrakKategori(tur, ad) === 'saglik' (eski kayıtlar)
   */
  const pSaglikEvraklar = pEvraklar.filter(
    e => (e.kategori ? e.kategori === 'saglik' : getEvrakKategori(e.tur, e.ad) === 'saglik'),
  );

  /** Evrak Ekle — documents sayfasına personelId/firmaId pre-fill ile gider */
  const handleEvrakEkle = () => {
    onClose();
    navigate('/documents', {
      state: { personelId, firmaId: personel?.firmaId, autoOpen: true },
    });
  };

  const firma = firmalar.find(f => f.id === personel?.firmaId);

  if (!personel) return null;

  /* ── Sekmeler ────────────────────────────────────────────────── */
  const tabs = [
    { id: 'bilgiler',     label: 'Bilgiler',    icon: 'ri-user-line',          count: undefined },
    { id: 'evraklar',     label: 'Evraklar',    icon: 'ri-file-list-line',     count: pEvraklar.length },
    { id: 'egitimler',    label: 'Eğitimler',   icon: 'ri-graduation-cap-line', count: pEgitimler.length },
    { id: 'saglik',       label: 'Sağlık',      icon: 'ri-heart-pulse-line',   count: pMuayeneler.length + pSaglikEvraklar.length },
    { id: 'uygunsuzluk',  label: 'Uygunsuzluk', icon: 'ri-alert-line',         count: pUygunsuzluklar.length },
  ];

  return (
    <>
      <Modal
        open={!!personelId}
        onClose={onClose}
        title={personel.adSoyad}
        size="xl"
        icon="ri-user-line"
      >
        <div className="space-y-4">
          {/* Avatar + badge strip */}
          <div className="flex flex-wrap items-center gap-2">
            <PersonelAvatar adSoyad={personel.adSoyad} fotoUrl={fotoUrl} size="md" ring />
            <Badge label={personel.durum} color={getPersonelStatusColor(personel.durum)} />
            {firma && (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                {firma.ad}
              </span>
            )}
            {personel.kanGrubu && (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {personel.kanGrubu}
              </span>
            )}
            {/* Kartvizit button */}
            <button
              onClick={() => setShowKartvizit(true)}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#818CF8',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))'; }}
            >
              <i className="ri-contacts-book-2-line" />
              Kartvizit
            </button>
          </div>

          {/* Tab bar */}
          <div
            className="flex gap-1 p-1 rounded-xl overflow-x-auto"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap flex-shrink-0 flex-1"
                style={
                  tab === t.id
                    ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: 'white', boxShadow: '0 4px 15px rgba(99,102,241,0.3)' }
                    : { color: '#64748B' }
                }
              >
                <i className={t.icon} />
                <span className="hidden sm:inline">{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={
                      tab === t.id
                        ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                        : { background: 'rgba(255,255,255,0.08)', color: '#94A3B8' }
                    }
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Bilgiler ── */}
          {tab === 'bilgiler' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <IR label="TC Kimlik"   value={personel.tc} />
              <IR label="Telefon"     value={personel.telefon} />
              <IR label="E-posta"     value={personel.email} />
              <IR label="Doğum Tarihi"
                value={personel.dogumTarihi ? new Date(personel.dogumTarihi).toLocaleDateString('tr-TR') : '—'} />
              <IR label="İşe Giriş"
                value={personel.iseGirisTarihi ? new Date(personel.iseGirisTarihi).toLocaleDateString('tr-TR') : '—'} />
              <IR label="Görev"       value={personel.gorev} />
              <IR label="Departman"   value={personel.departman} />
              <IR label="Acil Kişi"   value={personel.acilKisi} />
              <IR label="Acil Telefon" value={personel.acilTelefon} />
              <div className="col-span-2">
                <IR label="Adres" value={personel.adres} />
              </div>
            </div>
          )}

          {/* ── Evraklar ── */}
          {tab === 'evraklar' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={handleEvrakEkle}
                  className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.1))',
                    border: '1px solid rgba(99,102,241,0.25)',
                    color: '#818CF8',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.2))'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.1))'; }}
                >
                  <i className="ri-add-line" />
                  Bu Personel İçin Evrak Ekle
                </button>
              </div>
              <CategorizedEvraklar evraklar={pEvraklar} personelAdi={personel.adSoyad} />
            </div>
          )}

          {/* ── Eğitimler ── */}
          {tab === 'egitimler' && (
            <div className="space-y-2">
              {pEgitimler.length === 0
                ? <EmptyTab icon="ri-graduation-cap-line" text="Bu personele ait eğitim kaydı bulunmuyor." />
                : pEgitimler.map(eg => (
                  <ListRow
                    key={eg.id}
                    icon="ri-graduation-cap-line"
                    iconColor="#F59E0B"
                    title={eg.ad}
                    sub={eg.tarih ? new Date(eg.tarih).toLocaleDateString('tr-TR') : '—'}
                    badge={<Badge label={eg.durum} color={eg.durum === 'Tamamlandı' ? 'green' : eg.durum === 'Eksik' ? 'red' : 'sky'} />}
                  />
                ))
              }
            </div>
          )}

          {/* ── Sağlık ── */}
          {tab === 'saglik' && (
            <div className="space-y-3">
              {pMuayeneler.length === 0 && pSaglikEvraklar.length === 0
                ? <EmptyTab icon="ri-heart-pulse-line" text="Bu personele ait sağlık kaydı bulunmuyor." />
                : (
                  <>
                    {pMuayeneler.length > 0 && (
                      <div className="space-y-2">
                        {(pMuayeneler.length > 0 || pSaglikEvraklar.length > 0) && (
                          <p className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: '#EF4444' }}>
                            <i className="ri-heart-pulse-line mr-1.5" />Muayene Kayıtları
                          </p>
                        )}
                        {pMuayeneler.map(m => (
                          <ListRow
                            key={m.id}
                            icon="ri-heart-pulse-line"
                            iconColor="#EF4444"
                            title={m.muayeneTarihi ? new Date(m.muayeneTarihi).toLocaleDateString('tr-TR') : '—'}
                            sub={[m.hastane, m.doktor].filter(Boolean).join(' · ') || '—'}
                            badge={
                              <Badge
                                label={m.sonuc}
                                color={m.sonuc === 'Çalışabilir' ? 'green' : m.sonuc === 'Kısıtlı Çalışabilir' ? 'amber' : 'red'}
                              />
                            }
                          />
                        ))}
                      </div>
                    )}
                    {pSaglikEvraklar.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: '#F87171' }}>
                          <i className="ri-file-text-line mr-1.5" />Sağlık Belgeleri
                        </p>
                        {pSaglikEvraklar.map(ev => (
                          <ListRow
                            key={ev.id}
                            icon="ri-file-text-line"
                            iconColor="#F87171"
                            title={ev.ad}
                            sub={ev.tur}
                            badge={<Badge label={ev.durum} color={getEvrakStatusColor(ev.durum)} />}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )
              }
            </div>
          )}

          {/* ── Uygunsuzluk ── */}
          {tab === 'uygunsuzluk' && (
            <div className="space-y-2">
              {pUygunsuzluklar.length === 0
                ? <EmptyTab icon="ri-alert-line" text="Bu personele ait uygunsuzluk kaydı bulunmuyor." />
                : pUygunsuzluklar.map(u => (
                  <ListRow
                    key={u.id}
                    icon="ri-alert-line"
                    iconColor="#F97316"
                    title={u.baslik}
                    sub={u.tarih ? new Date(u.tarih).toLocaleDateString('tr-TR') : '—'}
                    badge={
                      <Badge
                        label={u.durum}
                        color={u.durum === 'Kapatıldı' ? 'green' : u.durum === 'İncelemede' ? 'amber' : 'red'}
                      />
                    }
                  />
                ))
              }
            </div>
          )}
        </div>
      </Modal>

      {/* Kartvizit overlay rendered outside the modal scroll area */}
      {showKartvizit && (
        <PersonelKartvizit
          personelId={personelId}
          onClose={() => setShowKartvizit(false)}
        />
      )}
    </>
  );
}
