import { useState } from 'react';
import JSZip from 'jszip';
import type { Evrak } from '../../../types';
import Badge, { getEvrakStatusColor } from '../../../components/base/Badge';
import { useApp } from '../../../store/AppContext';
import {
  getEvrakKategori,
  KATEGORI_META,
  KATEGORI_SIRASI,
  type EvrakKategoriId,
} from '../../../utils/evrakKategori';

/* ── Prop Tipi ─────────────────────────────────────────────── */
interface Props {
  evraklar: Evrak[];
  personelAdi: string;
}

/* ── Ana Bileşen ───────────────────────────────────────────── */
export default function CategorizedEvraklar({ evraklar, personelAdi }: Props) {
  const { addToast, getEvrakFile } = useApp();
  const [zipLoading, setZipLoading] = useState<string | null>(null);

  /* ── Tek Dosya İndir ─────────────────────────────────────── */
  const handleEvrakDownload = (ev: Evrak) => {
    const veri = getEvrakFile(ev.id) || ev.dosyaVeri;
    if (!veri) { addToast('İndirilebilir dosya bulunamadı.', 'error'); return; }
    try {
      const arr = veri.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bstr = atob(arr[1]);
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8arr], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = ev.dosyaAdi || ev.ad;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      addToast(`"${ev.dosyaAdi || ev.ad}" indiriliyor...`, 'success');
    } catch {
      addToast('Dosya indirilemedi.', 'error');
    }
  };

  /* ── ZIP İndir ───────────────────────────────────────────── */
  const handleZipDownload = async (kategoriId: EvrakKategoriId | 'all') => {
    const hedef =
      kategoriId === 'all'
        ? evraklar.filter(e => e.dosyaAdi)
        : evraklar.filter(e => e.dosyaAdi && getEvrakKategori(e.tur, e.ad) === kategoriId);

    if (hedef.length === 0) { addToast('İndirilecek dosya bulunamadı.', 'warning'); return; }

    setZipLoading(kategoriId);
    try {
      const zip = new JSZip();
      let count = 0;

      for (const ev of hedef) {
        const veri = getEvrakFile(ev.id) || ev.dosyaVeri;
        if (!veri) continue;
        const base64 = veri.split(',')[1];
        if (!base64) continue;

        if (kategoriId === 'all') {
          const meta = KATEGORI_META[getEvrakKategori(ev.tur, ev.ad)];
          const folder = zip.folder(meta.label);
          folder?.file(ev.dosyaAdi || `${ev.ad}.bin`, base64, { base64: true });
        } else {
          zip.file(ev.dosyaAdi || `${ev.ad}.bin`, base64, { base64: true });
        }
        count++;
      }

      if (count === 0) { addToast('Dosya içeriği bulunamadı.', 'warning'); return; }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const temizAd = personelAdi.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim().replace(/\s+/g, '_');
      link.download = kategoriId === 'all'
        ? `${temizAd}_Tum_Evraklar.zip`
        : `${temizAd}_${KATEGORI_META[kategoriId].label}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      addToast(`${count} dosya ZIP olarak indirildi.`, 'success');
    } catch {
      addToast('ZIP oluşturulurken hata oluştu.', 'error');
    } finally {
      setZipLoading(null);
    }
  };

  /* ── Gruplandırma — utility üzerinden ───────────────────── */
  const gruplar = KATEGORI_SIRASI
    .map(katId => ({
      meta: KATEGORI_META[katId],
      evraklar: evraklar.filter(e => getEvrakKategori(e.tur, e.ad) === katId),
    }))
    .filter(g => g.evraklar.length > 0);

  const indirilabilir = evraklar.filter(e => e.dosyaAdi).length;

  /* ── Boş Durum ───────────────────────────────────────────── */
  if (evraklar.length === 0) {
    return (
      <div className="text-center py-8">
        <i className="ri-file-list-3-line text-3xl" style={{ color: '#1E293B' }} />
        <p className="text-sm mt-2" style={{ color: '#334155' }}>Bu personele ait evrak bulunmuyor.</p>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Tüm Evrakları İndir */}
      {indirilabilir > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: '#475569' }}>
            {evraklar.length} evrak • {indirilabilir} dosya mevcut
          </p>
          <button
            onClick={() => handleZipDownload('all')}
            disabled={zipLoading === 'all'}
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#34D399',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.2))'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))'; }}
          >
            {zipLoading === 'all'
              ? <><i className="ri-loader-4-line animate-spin" />Hazırlanıyor...</>
              : <><i className="ri-folder-zip-line" />Tüm Evrakları İndir ({indirilabilir})</>
            }
          </button>
        </div>
      )}

      {/* Kategori Grupları */}
      {gruplar.map(({ meta, evraklar: katEvraklar }) => {
        const katIndirilabilir = katEvraklar.filter(e => e.dosyaAdi).length;
        return (
          <div key={meta.id} className="space-y-2">
            {/* Kategori Başlığı */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: meta.bgColor, border: `1px solid ${meta.borderColor}` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${meta.color}20` }}>
                  <i className={`${meta.icon} text-xs`} style={{ color: meta.color }} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${meta.color}20`, color: meta.color }}
                >
                  {katEvraklar.length}
                </span>
              </div>
              {katIndirilabilir > 0 && (
                <button
                  onClick={() => handleZipDownload(meta.id)}
                  disabled={zipLoading === meta.id}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap"
                  style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${meta.color}28`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${meta.color}18`; }}
                >
                  {zipLoading === meta.id
                    ? <><i className="ri-loader-4-line animate-spin text-xs" />İndiriliyor...</>
                    : <><i className="ri-download-line text-xs" />ZIP ({katIndirilabilir})</>
                  }
                </button>
              )}
            </div>

            {/* Evrak Satırları */}
            {katEvraklar.map(ev => (
              <div
                key={ev.id}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 ml-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {/* Dosya İkonu */}
                <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${meta.color}15` }}>
                  <i
                    className={`text-sm ${
                      ev.dosyaTipi?.includes('image') ? 'ri-image-line'
                        : ev.dosyaTipi?.includes('pdf') ? 'ri-file-pdf-line'
                          : ev.dosyaTipi?.includes('word') || ev.dosyaTipi?.includes('docx') ? 'ri-file-word-line'
                            : 'ri-file-text-line'
                    }`}
                    style={{ color: meta.color }}
                  />
                </div>

                {/* Evrak Bilgisi */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{ev.ad}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    {ev.tur && <p className="text-xs" style={{ color: '#475569' }}>{ev.tur}</p>}
                    {ev.gecerlilikTarihi && (
                      <span className="text-[10px] font-medium" style={{ color: '#475569' }}>
                        • Geçerlilik: {new Date(ev.gecerlilikTarihi).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                    {ev.dosyaAdi && ev.dosyaBoyutu && (
                      <span className="text-[10px]" style={{ color: '#334155' }}>
                        {(ev.dosyaBoyutu / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                </div>

                {/* Durum Badge */}
                <Badge label={ev.durum} color={getEvrakStatusColor(ev.durum)} />

                {/* İndir Butonu */}
                {ev.dosyaAdi && (
                  <button
                    onClick={() => handleEvrakDownload(ev)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 cursor-pointer transition-all"
                    title={`İndir: ${ev.dosyaAdi}`}
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}
                  >
                    <i className="ri-download-line text-xs" />
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
