import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun,
  BorderStyle, ShadingType,
} from 'docx';
import { useApp } from '../../store/AppContext';
import type { Tutanak, TutanakStatus } from '../../types';
import Modal from '../../components/base/Modal';
import { generateTutanakNo } from '../../store/useStore';
import TutanakDetailModal from './components/TutanakDetailModal';
import { usePermissions } from '../../hooks/usePermissions';

/* ── Durum renk konfig ──────────────────────────────────────── */
const STS_CONFIG: Record<TutanakStatus, { color: string; bg: string; icon: string }> = {
  'Taslak':     { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: 'ri-draft-line' },
  'Tamamlandı': { color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: 'ri-checkbox-circle-line' },
  'Onaylandı':  { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  icon: 'ri-shield-check-line' },
  'İptal':      { color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: 'ri-close-circle-line' },
};

const emptyForm: Omit<Tutanak, 'id' | 'tutanakNo' | 'olusturmaTarihi' | 'guncellemeTarihi'> = {
  firmaId: '', baslik: '', aciklama: '', tarih: '', durum: 'Taslak',
  olusturanKisi: '', dosyaAdi: '', dosyaBoyutu: 0, dosyaTipi: '', dosyaVeri: '', notlar: '',
};

/* ── Word yardımcıları ──────────────────────────────────────── */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
}

function getImageType(mimeType: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('bmp')) return 'bmp';
  return 'jpg';
}

/* ── Modern Word Doküman Üretici (Blok Yapı) ─────────────────── */
async function generateWordDoc(
  tutanak: Tutanak,
  firmaAd: string,
  fileVeri?: string,
  firmaLogo?: string,
): Promise<void> {
  const tarihStr = tutanak.tarih ? new Date(tutanak.tarih).toLocaleDateString('tr-TR') : '—';
  const FONT = 'Calibri';

  /* — Logo — */
  const logoParagraflar: Paragraph[] = [];
  if (firmaLogo && firmaLogo.startsWith('data:image')) {
    try {
      const logoData = dataUrlToUint8Array(firmaLogo);
      const logoType = getImageType(firmaLogo.split(';')[0].split(':')[1] || 'image/png');
      logoParagraflar.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [new ImageRun({ data: logoData, transformation: { width: 140, height: 70 }, type: logoType })],
      }));
    } catch { /* logo eklenemedi */ }
  }

  /* — Ayraç çizgisi — */
  const divider = () => new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' } },
    children: [],
  });

  /* — Bölüm başlığı — */
  const sectionTitle = (text: string, before = 320) => new Paragraph({
    spacing: { before, after: 160 },
    children: [
      new TextRun({ text: '▌  ', size: 24, font: FONT, color: '4F46E5' }),
      new TextRun({ text, bold: true, size: 26, font: FONT, color: '1F2937' }),
    ],
  });

  /* — Bilgi bloğu (label + value) — */
  const infoBlock = (label: string, value: string) => [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: label.toUpperCase(), bold: true, size: 18, font: FONT, color: '64748B', allCaps: true }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({ text: value || '—', size: 24, font: FONT, color: '111827' }),
      ],
    }),
  ];

  /* — Fotoğraf bölümü — */
  const fotoParagraflar: Paragraph[] = [];
  const hasPhoto = fileVeri && tutanak.dosyaTipi?.startsWith('image/');
  if (hasPhoto && fileVeri) {
    try {
      const imgData = dataUrlToUint8Array(fileVeri);
      const imgType = getImageType(tutanak.dosyaTipi || 'image/jpeg');
      fotoParagraflar.push(
        divider(),
        sectionTitle('EK GÖRSEL / FOTOĞRAF', 160),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 300 },
          children: [new ImageRun({ data: imgData, transformation: { width: 500, height: 360 }, type: imgType })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 100 },
          children: [
            new TextRun({ text: tutanak.dosyaAdi || 'Ek Görsel', size: 18, font: FONT, italics: true, color: '6B7280' }),
          ],
        }),
      );
    } catch {
      fotoParagraflar.push(
        divider(),
        sectionTitle('EK DOSYA', 160),
        new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({ text: `Ek Dosya: ${tutanak.dosyaAdi || 'dosya eklenmiştir'}`, size: 21, font: FONT, italics: true, color: '6B7280' }),
          ],
        }),
      );
    }
  } else if (tutanak.dosyaAdi && !hasPhoto) {
    fotoParagraflar.push(
      divider(),
      sectionTitle('EK DOSYA', 160),
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({ text: `Ek Dosya: ${tutanak.dosyaAdi}`, size: 21, font: FONT, italics: true, color: '6B7280' }),
        ],
      }),
    );
  }

  /* — İmza bölümü (Tespit Eden sayfa sonunda) — */
  const signatureBlock = [
    divider(),
    sectionTitle('TESPİT EDEN / İMZA', 240),
    /* Sağa hizalı imza bloğu */
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 160, after: 80 },
      children: [
        new TextRun({ text: 'Tespit Eden', bold: true, size: 20, font: FONT, color: '64748B', allCaps: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: 'Ad Soyad:  ', size: 22, font: FONT, color: '374151', bold: true }),
        new TextRun({ text: tutanak.olusturanKisi || '___________________________', size: 22, font: FONT, color: '111827' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 400 },
      children: [
        new TextRun({ text: 'Tarih:  ', size: 22, font: FONT, color: '374151', bold: true }),
        new TextRun({ text: tarihStr, size: 22, font: FONT, color: '111827' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: 'İmza:  ', size: 22, font: FONT, color: '374151', bold: true }),
        new TextRun({ text: '______________________________', size: 22, font: FONT, color: 'CBD5E1' }),
      ],
    }),
  ];

  /* — Üst dekoratif çizgi — */
  const topAccentLine = new Paragraph({
    spacing: { before: 0, after: 0 },
    border: { top: { style: BorderStyle.THICK, size: 36, color: '4F46E5' } },
    children: [],
  });

  /* — Başlık bloğu — */
  const headerBlock = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({ text: 'İŞ SAĞLIĞI VE GÜVENLİĞİ', bold: true, size: 32, font: FONT, color: '1F2937' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({ text: 'DENETİM TUTANAĞI', bold: true, size: 28, font: FONT, color: '4F46E5' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 300 },
      shading: { type: ShadingType.SOLID, color: 'EEF2FF' },
      children: [
        new TextRun({ text: 'Tutanak No: ', size: 22, font: FONT, color: '6366F1' }),
        new TextRun({ text: tutanak.tutanakNo, bold: true, size: 26, font: FONT, color: '4338CA' }),
        new TextRun({ text: '    |    Tarih: ', size: 22, font: FONT, color: '6366F1' }),
        new TextRun({ text: tarihStr, bold: true, size: 22, font: FONT, color: '4338CA' }),
      ],
    }),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: {
        page: { margin: { top: 900, right: 1000, bottom: 900, left: 1000 } },
      },
      children: [
        /* Üst accent çizgisi */
        topAccentLine,

        /* Logo */
        ...logoParagraflar,

        /* Başlık */
        ...headerBlock,

        divider(),

        /* Bilgi blokları (tablo yerine) */
        sectionTitle('GENEL BİLGİLER', 160),
        ...infoBlock('Firma', firmaAd),
        ...infoBlock('Başlık', tutanak.baslik),

        divider(),

        /* Açıklama */
        sectionTitle('AÇIKLAMA / TUTANAK DETAYI', 160),
        new Paragraph({
          spacing: { before: 160, after: 160 },
          shading: { type: ShadingType.SOLID, color: 'F8FAFC' },
          border: {
            top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            left: { style: BorderStyle.THICK, size: 16, color: '4F46E5' },
            right: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
          },
          indent: { left: 200, right: 200 },
          children: [new TextRun({ text: tutanak.aciklama || '—', size: 22, font: FONT, color: '374151' })],
        }),

        /* Fotoğraf */
        ...fotoParagraflar,

        /* Notlar */
        ...(tutanak.notlar ? [
          divider(),
          sectionTitle('NOTLAR', 160),
          new Paragraph({
            spacing: { before: 160, after: 160 },
            shading: { type: ShadingType.SOLID, color: 'FFFBEB' },
            border: {
              top: { style: BorderStyle.SINGLE, size: 2, color: 'FDE68A' },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: 'FDE68A' },
              left: { style: BorderStyle.THICK, size: 16, color: 'F59E0B' },
              right: { style: BorderStyle.SINGLE, size: 2, color: 'FDE68A' },
            },
            indent: { left: 200, right: 200 },
            children: [new TextRun({ text: tutanak.notlar, size: 20, font: FONT, italics: true, color: '78716C' })],
          }),
        ] : []),

        /* İmza */
        ...signatureBlock,

        /* Footer */
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 0 },
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' } },
          children: [
            new TextRun({ text: 'ISG Denetim Sistemi', size: 16, font: FONT, color: '94A3B8', bold: true }),
            new TextRun({ text: `   ·   ${tutanak.tutanakNo}`, size: 16, font: FONT, color: '94A3B8' }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Tutanak-${tutanak.tutanakNo}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── Ana Bileşen ───────────────────────────────────────────── */
export default function TutanaklarPage() {
  const {
    tutanaklar, firmalar, currentUser,
    addTutanak, updateTutanak, deleteTutanak,
    getTutanakFile, getFirmaLogo, addToast,
    quickCreate, setQuickCreate,
  } = useApp();
  const { canEdit, canCreate, canDelete, isReadOnly } = usePermissions();

  const [search, setSearch] = useState('');
  const [firmaFilter, setFirmaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [wordLoading, setWordLoading] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Tutanak, 'id' | 'tutanakNo' | 'olusturmaTarihi' | 'guncellemeTarihi'>>(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const viewTutanak = useMemo(() => tutanaklar.find(t => t.id === viewId) ?? null, [tutanaklar, viewId]);

  // Sadece aktif (silinmemiş) firmalar
  const aktivFirmalar = firmalar.filter(f => !f.silinmis);

  useEffect(() => {
    if (quickCreate === 'tutanaklar') {
      setEditId(null);
      setForm({ ...emptyForm, olusturanKisi: currentUser.ad });
      setShowModal(true);
      setQuickCreate(null);
    }
  }, [quickCreate, setQuickCreate, currentUser.ad]);

  const filtered = useMemo(() => tutanaklar.filter(t => {
    const firma = firmalar.find(f => f.id === t.firmaId);
    const q = search.toLowerCase();
    return (
      (!q || t.baslik.toLowerCase().includes(q) || t.tutanakNo.toLowerCase().includes(q) || (firma?.ad.toLowerCase().includes(q) ?? false))
      && (!firmaFilter || t.firmaId === firmaFilter)
      && (!statusFilter || t.durum === statusFilter)
    );
  }), [tutanaklar, firmalar, search, firmaFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: tutanaklar.length,
    taslak: tutanaklar.filter(t => t.durum === 'Taslak').length,
    tamamlandi: tutanaklar.filter(t => t.durum === 'Tamamlandı').length,
    onaylandi: tutanaklar.filter(t => t.durum === 'Onaylandı').length,
  }), [tutanaklar]);

  /* ── Modal açma/kapama ──────────────────────────────────── */
  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm, olusturanKisi: currentUser.ad });
    setShowModal(true);
  };

  const openEdit = (t: Tutanak) => {
    setEditId(t.id);
    setForm({
      firmaId: t.firmaId, baslik: t.baslik, aciklama: t.aciklama, tarih: t.tarih,
      durum: t.durum, olusturanKisi: t.olusturanKisi,
      dosyaAdi: t.dosyaAdi || '', dosyaBoyutu: t.dosyaBoyutu || 0,
      dosyaTipi: t.dosyaTipi || '', dosyaVeri: '', notlar: t.notlar,
    });
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  /* ── Form işlemleri ─────────────────────────────────────── */
  const sf = (field: keyof typeof form, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleFileChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const veri = e.target?.result as string;
      setForm(prev => ({
        ...prev,
        dosyaAdi: file.name,
        dosyaBoyutu: file.size,
        dosyaTipi: file.type,
        dosyaVeri: veri,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.baslik.trim()) { addToast('Başlık zorunludur.', 'error'); return; }
    if (!form.firmaId)       { addToast('Firma seçimi zorunludur.', 'error'); return; }
    if (!form.aciklama.trim()) { addToast('Açıklama zorunludur.', 'error'); return; }

    if (editId) {
      updateTutanak(editId, form);
      addToast('Tutanak güncellendi.', 'success');
    } else {
      const tutanakNo = generateTutanakNo(tutanaklar);
      addTutanak({ ...form, tutanakNo });
      addToast(`Tutanak oluşturuldu: ${tutanakNo}`, 'success');
    }
    closeModal();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTutanak(deleteId);
    addToast('Tutanak silindi.', 'success');
    setDeleteId(null);
  };

  /* ── Dosya indirme ──────────────────────────────────────── */
  const handleFileDownload = (t: Tutanak) => {
    const veri = getTutanakFile(t.id) || t.dosyaVeri;
    if (!veri) { addToast('Bu tutanak için yüklenmiş dosya bulunamadı.', 'error'); return; }
    const link = document.createElement('a');
    link.href = veri;
    link.download = t.dosyaAdi || 'tutanak-eki';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`"${t.dosyaAdi}" indiriliyor...`, 'success');
  };

  const handleWordDownload = async (t: Tutanak) => {
    setWordLoading(t.id);
    try {
      const firma = firmalar.find(f => f.id === t.firmaId);
      const fileVeri = getTutanakFile(t.id) || t.dosyaVeri;
      const firmaLogoVeri = getFirmaLogo(t.firmaId);
      await generateWordDoc(t, firma?.ad || '—', fileVeri, firmaLogoVeri);
      addToast(`Tutanak-${t.tutanakNo}.docx indiriliyor...`, 'success');
    } catch {
      addToast('Word belgesi oluşturulurken hata oluştu.', 'error');
    } finally {
      setWordLoading(null);
    }
  };

  /* ── İnput ortak stil sınıfı ─────────────────────────────── */
  const inp = 'isg-input w-full';

  return (
    <div className="space-y-5">
      {/* Read-only Banner */}
      {isReadOnly && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)' }}>
          <i className="ri-search-eye-line flex-shrink-0" style={{ color: '#06B6D4' }} />
          <p className="text-sm" style={{ color: '#06B6D4' }}>
            <strong>Denetçi Modu:</strong> Tutanaklar yalnızca görüntüleme amaçlıdır. Değişiklik yapma yetkiniz bulunmamaktadır.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tutanaklar</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Firma bazlı tutanakları yönetin ve Word belgesi oluşturun
          </p>
        </div>
        {canCreate && (
          <button onClick={openAdd} className="btn-primary whitespace-nowrap self-start sm:self-auto">
            <i className="ri-add-line" /> Yeni Tutanak
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Tutanak', value: stats.total,      icon: 'ri-article-line',         color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Taslak',         value: stats.taslak,     icon: 'ri-draft-line',            color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
          { label: 'Tamamlandı',     value: stats.tamamlandi, icon: 'ri-checkbox-circle-line',  color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'Onaylandı',      value: stats.onaylandi,  icon: 'ri-shield-check-line',     color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
        ].map(s => (
          <div key={s.label} className="isg-card rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0" style={{ background: s.bg }}>
              <i className={`${s.icon} text-xl`} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 px-4 py-3 rounded-2xl isg-card">
        <div className="relative flex-1 min-w-[200px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tutanak no, başlık veya firma ara..."
            className="isg-input pl-9"
          />
        </div>
        <select
          value={firmaFilter}
          onChange={e => setFirmaFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '180px' }}
        >
          <option value="">Tüm Firmalar</option>
          {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="isg-input"
          style={{ width: 'auto', minWidth: '140px' }}
        >
          <option value="">Tüm Durumlar</option>
          {(Object.keys(STS_CONFIG) as TutanakStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(search || firmaFilter || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setFirmaFilter(''); setStatusFilter(''); }}
            className="btn-secondary whitespace-nowrap"
          >
            <i className="ri-filter-off-line" /> Temizle
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="isg-card rounded-xl py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <i className="ri-article-line text-3xl" style={{ color: '#60A5FA' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>Tutanak kaydı bulunamadı</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>Yeni tutanak oluşturmak için butonu kullanın</p>
          {canCreate && <button onClick={openAdd} className="btn-primary mt-5"><i className="ri-add-line" /> Yeni Tutanak</button>}
        </div>
      ) : (
        <div className="isg-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-premium w-full">
              <thead>
                <tr>
                  <th className="text-left">Tutanak No</th>
                  <th className="text-left">Başlık</th>
                  <th className="text-left hidden md:table-cell">Firma</th>
                  <th className="text-left hidden lg:table-cell">Tarih</th>
                  <th className="text-left">Durum</th>
                  <th className="text-left hidden lg:table-cell">Oluşturan</th>
                  <th className="text-left hidden md:table-cell">Ek Dosya</th>
                  <th className="text-right w-36">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const firma = firmalar.find(f => f.id === t.firmaId);
                  const stc = STS_CONFIG[t.durum];
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>
                          {t.tutanakNo}
                        </span>
                      </td>
                      <td>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.baslik}</p>
                        {t.aciklama && (
                          <p className="text-xs mt-0.5 truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                            {t.aciklama}
                          </p>
                        )}
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{firma?.ad || '—'}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {t.tarih ? new Date(t.tarih).toLocaleDateString('tr-TR') : '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ background: stc.bg, color: stc.color }}
                        >
                          <i className={stc.icon} />{t.durum}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.olusturanKisi || '—'}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        {t.dosyaAdi ? (
                          <button
                            onClick={() => handleFileDownload(t)}
                            className="flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all hover:gap-2 whitespace-nowrap"
                            style={{ color: '#34D399' }}
                          >
                            <i className="ri-attachment-2 text-sm" />
                            <span className="max-w-[70px] truncate">{t.dosyaAdi}</span>
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          <button
                            onClick={() => setViewId(t.id)}
                            title="Tutanağı Görüntüle / İndir"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap"
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                          >
                            <i className="ri-eye-line" />
                            <span className="hidden lg:inline">Görüntüle</span>
                          </button>
                          {canEdit && <TableBtn icon="ri-edit-line" color="#F59E0B" onClick={() => openEdit(t)} title="Düzenle" />}
                          {canDelete && <TableBtn icon="ri-delete-bin-line" color="#EF4444" onClick={() => setDeleteId(t.id)} title="Sil" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Form Modal ─────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editId ? 'Tutanak Düzenle' : 'Yeni Tutanak Oluştur'}
        size="lg"
        icon="ri-article-line"
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleSave} className="btn-primary whitespace-nowrap">
              <i className={editId ? 'ri-save-line' : 'ri-add-line'} />
              {editId ? 'Güncelle' : 'Oluştur'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Otomatik tutanak no bilgisi */}
          {!editId && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <i className="ri-barcode-line flex-shrink-0" style={{ color: '#60A5FA' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tutanak numarası otomatik üretilir</p>
                <p className="text-sm font-mono font-semibold" style={{ color: '#60A5FA' }}>
                  {generateTutanakNo(tutanaklar)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Başlık */}
            <div className="sm:col-span-2">
              <label className="form-label">Başlık *</label>
              <input
                value={form.baslik}
                onChange={e => sf('baslik', e.target.value)}
                placeholder="Tutanak başlığı..."
                className={inp}
              />
            </div>

            {/* Firma */}
            <div>
              <label className="form-label">Firma *</label>
              <select
                value={form.firmaId}
                onChange={e => sf('firmaId', e.target.value)}
                className={inp}
              >
                <option value="">Firma Seçin</option>
                {aktivFirmalar.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
              </select>
              {aktivFirmalar.length === 0 && (
                <p className="text-xs mt-1" style={{ color: '#F59E0B' }}>
                  Önce firma eklemeniz gerekmektedir.
                </p>
              )}
            </div>

            {/* Tarih */}
            <div>
              <label className="form-label">Tutanak Tarihi</label>
              <input
                type="date"
                value={form.tarih}
                onChange={e => sf('tarih', e.target.value)}
                className={inp}
              />
            </div>

            {/* Oluşturan Kişi */}
            <div>
              <label className="form-label">Oluşturan Kişi</label>
              <input
                value={form.olusturanKisi}
                onChange={e => sf('olusturanKisi', e.target.value)}
                placeholder="Ad Soyad"
                className={inp}
              />
            </div>

            {/* Açıklama */}
            <div className="sm:col-span-2">
              <label className="form-label">Açıklama *</label>
              <textarea
                value={form.aciklama}
                onChange={e => sf('aciklama', e.target.value)}
                placeholder="Tutanak detayları ve açıklaması..."
                rows={4}
                maxLength={500}
                className={`${inp} resize-y`}
              />
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-faint)' }}>
                {form.aciklama.length}/500
              </p>
            </div>

            {/* Dosya Yükleme */}
            <div className="sm:col-span-2">
              <label className="form-label">Ek Dosya / Görsel (PDF / JPG / PNG)</label>
              <div
                className="rounded-xl p-5 text-center cursor-pointer transition-all duration-200"
                style={{ border: '2px dashed var(--border-subtle)', background: 'var(--bg-item)' }}
                onClick={() => fileRef.current?.click()}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                  e.currentTarget.style.background = 'rgba(59,130,246,0.04)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-item)';
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}
              >
                {form.dosyaAdi ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.12)' }}>
                      <i className="ri-file-check-line text-xl" style={{ color: '#10B981' }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{form.dosyaAdi}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {form.dosyaBoyutu ? `${(form.dosyaBoyutu / 1024).toFixed(1)} KB` : ''}
                        {' — Değiştirmek için tıklayın'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <i className="ri-upload-cloud-2-line text-2xl mb-2" style={{ color: 'var(--text-faint)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                      Dosya sürükleyin veya tıklayın
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>PDF, JPG, PNG • Maks. 5MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => handleFileChange(e.target.files?.[0])}
              />
            </div>

            {/* Notlar */}
            <div className="sm:col-span-2">
              <label className="form-label">Notlar</label>
              <textarea
                value={form.notlar}
                onChange={e => sf('notlar', e.target.value)}
                placeholder="Ek notlar..."
                rows={2}
                maxLength={500}
                className={`${inp} resize-y`}
              />
            </div>

            {/* İndirme bilgi notu */}
            <div className="sm:col-span-2">
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                <i className="ri-download-line mt-0.5 flex-shrink-0" style={{ color: '#3B82F6' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Kayıt oluşturduktan sonra{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>Görüntüle</strong>{' '}
                  butonuna tıklayarak tutanağı önizleyebilir ve{' '}
                  <strong style={{ color: '#3B82F6' }}>Word (.docx)</strong>{' '}
                  formatında indirebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Silme Onay Modal ──────────────────────────────── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Tutanağı Sil"
        size="sm"
        icon="ri-delete-bin-line"
        footer={
          <>
            <button onClick={() => setDeleteId(null)} className="btn-secondary whitespace-nowrap">İptal</button>
            <button onClick={handleDelete} className="btn-danger whitespace-nowrap">Evet, Sil</button>
          </>
        }
      >
        <div className="py-2">
          <div className="w-12 h-12 flex items-center justify-center rounded-2xl mb-4"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ri-error-warning-line text-xl" style={{ color: '#EF4444' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
            Bu tutanağı silmek istediğinizden emin misiniz?
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Bu işlem geri alınamaz.
          </p>
        </div>
      </Modal>

      {/* ── Tutanak Detay / Önizleme Modal ─────────────────── */}
      <TutanakDetailModal
        tutanak={viewTutanak}
        firma={viewTutanak ? firmalar.find(f => f.id === viewTutanak.firmaId) : undefined}
        dosyaVeri={viewTutanak ? (getTutanakFile(viewTutanak.id) || viewTutanak.dosyaVeri) : undefined}
        onClose={() => setViewId(null)}
        onEdit={(t) => { setViewId(null); openEdit(t); }}
        onWordDownload={handleWordDownload}
        wordLoading={wordLoading}
        canEdit={canEdit}
      />
    </div>
  );
}

/* ── Tablo aksiyon butonu ──────────────────────────────────── */
function TableBtn({ icon, color, onClick, title }: {
  icon: string; color: string; onClick: () => void; title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 hover:scale-110"
      style={{ color: '#475569' }}
      onMouseEnter={e => {
        e.currentTarget.style.color = color;
        e.currentTarget.style.background = `${color}18`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = '#475569';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <i className={`${icon} text-sm`} />
    </button>
  );
}
