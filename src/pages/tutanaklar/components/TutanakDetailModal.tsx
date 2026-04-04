import Modal from '../../../components/base/Modal';
import type { Tutanak, Firma } from '../../../types';
import type { TutanakStatus } from '../../../types';

const STS_CONFIG: Record<TutanakStatus, { color: string; bg: string; icon: string; label: string }> = {
  'Taslak':     { color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', icon: 'ri-draft-line',           label: 'Taslak' },
  'Tamamlandı': { color: '#34D399', bg: 'rgba(52,211,153,0.15)',  icon: 'ri-checkbox-circle-line',  label: 'Tamamlandı' },
  'Onaylandı':  { color: '#10B981', bg: 'rgba(16,185,129,0.15)',  icon: 'ri-shield-check-line',     label: 'Onaylandı' },
  'İptal':      { color: '#F87171', bg: 'rgba(248,113,113,0.15)', icon: 'ri-close-circle-line',     label: 'İptal' },
};

interface Props {
  tutanak: Tutanak | null;
  firma: Firma | undefined;
  dosyaVeri?: string;
  onClose: () => void;
  onEdit?: (t: Tutanak) => void;
  onWordDownload: (t: Tutanak) => void;
  wordLoading: string | null;
  canEdit?: boolean;
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)' }}
    >
      {icon && (
        <div className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(99,102,241,0.1)' }}>
          <i className={`${icon} text-sm`} style={{ color: '#6366F1' }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-faint)' }}>{label}</p>
        <p className="text-sm font-semibold break-words" style={{ color: 'var(--text-primary)' }}>{value || '—'}</p>
      </div>
    </div>
  );
}

export default function TutanakDetailModal({ tutanak, firma, dosyaVeri, onClose, onEdit, onWordDownload, wordLoading, canEdit }: Props) {
  if (!tutanak) return null;

  const stc = STS_CONFIG[tutanak.durum];
  const tarihStr = tutanak.tarih ? new Date(tutanak.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const olusturmaTarih = new Date(tutanak.olusturmaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  const handleEdit = () => {
    if (onEdit) {
      onEdit(tutanak);
      onClose();
    }
  };

  return (
    <Modal
      open={!!tutanak}
      onClose={onClose}
      title="Tutanak Detayı"
      size="lg"
      icon="ri-article-line"
      footer={
        <div className="flex items-center gap-2 w-full flex-wrap">
          <button
            onClick={onClose}
            className="btn-secondary whitespace-nowrap mr-auto"
          >
            Kapat
          </button>
          {canEdit && onEdit && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all whitespace-nowrap"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
            >
              <i className="ri-edit-line text-base" />Düzenle
            </button>
          )}
          <button
            onClick={() => onWordDownload(tutanak)}
            disabled={wordLoading === tutanak.id}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all whitespace-nowrap"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
          >
            {wordLoading === tutanak.id
              ? <><i className="ri-loader-line animate-spin" />Oluşturuluyor...</>
              : <><i className="ri-file-word-line text-base" />Word İndir</>}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* ── Doküman Başlığı ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          {/* Üst şerit */}
          <div
            className="px-6 py-4 flex items-center justify-between gap-3"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.05) 100%)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <i className="ri-article-line text-lg" style={{ color: '#6366F1' }} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-faint)' }}>
                  İŞ SAĞLIĞI VE GÜVENLİĞİ
                </p>
                <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  DENETİM TUTANAĞI
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Tutanak No</p>
              <code
                className="text-base font-bold tracking-wide px-3 py-1 rounded-lg"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                {tutanak.tutanakNo}
              </code>
            </div>
          </div>

          {/* Başlık ve Durum Satırı */}
          <div className="px-6 py-4" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wide font-medium mb-1" style={{ color: 'var(--text-faint)' }}>Tutanak Başlığı</p>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{tutanak.baslik}</h2>
              </div>
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0"
                style={{ background: stc.bg, color: stc.color }}
              >
                <i className={stc.icon} />{stc.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Bilgi Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoRow label="Firma" value={firma?.ad || '—'} icon="ri-building-2-line" />
          <InfoRow label="Tutanak Tarihi" value={tarihStr} icon="ri-calendar-line" />
          <InfoRow label="Oluşturan Kişi" value={tutanak.olusturanKisi || '—'} icon="ri-user-line" />
          <InfoRow label="Kayıt Tarihi" value={olusturmaTarih} icon="ri-time-line" />
          {firma?.tehlikeSinifi && (
            <InfoRow label="Tehlike Sınıfı" value={firma.tehlikeSinifi} icon="ri-shield-flash-line" />
          )}
          {firma?.yetkiliKisi && (
            <InfoRow label="Firma Yetkilisi" value={firma.yetkiliKisi} icon="ri-user-star-line" />
          )}
        </div>

        {/* ── Açıklama ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full" style={{ background: '#6366F1' }} />
            <p className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Açıklama / Tutanak Detayı
            </p>
          </div>
          <div
            className="rounded-xl p-4 text-sm leading-relaxed"
            style={{
              background: 'var(--bg-item)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              minHeight: '80px',
            }}
          >
            {tutanak.aciklama || <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Açıklama girilmemiş.</span>}
          </div>
        </div>

        {/* ── Ek Dosya ── */}
        {tutanak.dosyaAdi && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ background: '#34D399' }} />
              <p className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Ek Dosya
              </p>
            </div>

            {/* Görsel önizleme — Storage URL veya base64 */}
            {dosyaVeri && (tutanak.dosyaTipi?.startsWith('image/') || dosyaVeri.startsWith('http')) ? (
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(52,211,153,0.2)', background: 'var(--bg-item)' }}
              >
                {/* Görsel */}
                <div className="flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.04)', minHeight: '120px' }}>
                  <img
                    src={dosyaVeri}
                    alt={tutanak.dosyaAdi}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '320px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      display: 'block',
                    }}
                  />
                </div>
                {/* Dosya bilgisi */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: '1px solid rgba(52,211,153,0.15)' }}
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.12)' }}>
                    <i className="ri-image-line text-sm" style={{ color: '#34D399' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {tutanak.dosyaAdi}
                    </p>
                    {tutanak.dosyaBoyutu ? (
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {(tutanak.dosyaBoyutu / 1024).toFixed(1)} KB &bull; Görsel
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399' }}
                  >
                    Önizleme
                  </span>
                </div>
              </div>
            ) : (
              /* Görsel olmayan dosya — mevcut stil korundu */
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(52,211,153,0.12)' }}>
                  <i className="ri-attachment-2 text-base" style={{ color: '#34D399' }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>Ek Dosya</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tutanak.dosyaAdi}</p>
                  {tutanak.dosyaBoyutu ? (
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      {(tutanak.dosyaBoyutu / 1024).toFixed(1)} KB
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── İmza Alanı ── */}
        <div
          className="rounded-xl p-5"
          style={{ border: '1px dashed var(--border-subtle)', background: 'var(--bg-item)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-faint)' }}>
            İmza ve Onay Alanı
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Tutanağı Düzenleyen</p>
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                {tutanak.olusturanKisi || '___________________'}
              </p>
              <div className="border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>İmza</p>
              </div>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>Tarih</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tarihStr}</p>
            </div>
          </div>
        </div>

        {/* Footer notu */}
        <p className="text-center text-xs" style={{ color: 'var(--text-faint)' }}>
          ISG Denetim Sistemi — {new Date().toLocaleDateString('tr-TR')}
        </p>
      </div>
    </Modal>
  );
}