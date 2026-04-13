import { useState, useEffect, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import Human3DModel from './Human3DModel';

interface TekrarUyari {
  tip: 'personel' | 'firma';
  kazaTuru: string;
  sayi: number;
  sonTarih: string;
  etiket: string;
}

interface PersonelOption {
  id: string;
  adSoyad: string;
  gorev: string;
  firmaId: string;
}

interface BesNedenItem {
  sira: number;
  neden: string;
  aciklama: string;
}

interface IsKazasiFormData {
  personelId: string;
  firmaId: string;
  kazaTarihi: string;
  kazaSaati: string;
  kazaYeri: string;
  kazaTuru: string;
  kazaTipi: string;
  kazaAciklamasi: string;
  yaraliVucutBolgeleri: string[];
  yaralanmaTuru: string;
  yaralanmaSiddeti: string;
  riskSeviyesi: string;
  isGunuKaybi: number;
  hastaneyeKaldirildi: boolean;
  hastaneAdi: string;
  tanikBilgileri: string;
  onlemler: string;
  durum: string;
  olumNedeni: string;
  olumTarihi: string;
  // Yeni alanlar
  sgkBildirildi: boolean;
  sgkBildirimTarihi: string;
  sgkBildirimNotu: string;
  fotografPaths: string[];
  olayYeriDiagram: string;
  besNeden: BesNedenItem[];
}

interface HekimIsKazasiModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  atanmisFirmaIds: string[];
  isDark: boolean;
  editData?: (IsKazasiFormData & { id: string }) | null;
  preselectedPersonelId?: string | null;
  addToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const BES_NEDEN_TEMPLATE: BesNedenItem[] = [
  { sira: 1, neden: '', aciklama: '' },
  { sira: 2, neden: '', aciklama: '' },
  { sira: 3, neden: '', aciklama: '' },
  { sira: 4, neden: '', aciklama: '' },
  { sira: 5, neden: '', aciklama: '' },
];

const KAZA_TURLERI = ['Düşme', 'Çarpma/Temas', 'Elektrik Çarpması', 'Yanma/Haşlanma', 'Kesik/Yara', 'Kimyasal Temas', 'Kas-İskelet Zorlanması', 'Trafik Kazası', 'Diğer'];
const YARALANMA_TURLERI = ['Kırık', 'Burkulma/Gerilme', 'Kesik/Yara', 'Yanık', 'Ezilme', 'Zehirlenme', 'Çıkık', 'Diğer'];

const VUCUT_BOLGELERI: { id: string; label: string }[] = [
  { id: 'bas', label: 'Baş' },
  { id: 'boyun', label: 'Boyun' },
  { id: 'sag_omuz', label: 'Sağ Omuz' },
  { id: 'sol_omuz', label: 'Sol Omuz' },
  { id: 'gogus', label: 'Göğüs' },
  { id: 'sirt', label: 'Sırt' },
  { id: 'sag_kol', label: 'Sağ Kol' },
  { id: 'sol_kol', label: 'Sol Kol' },
  { id: 'sag_el', label: 'Sağ El' },
  { id: 'sol_el', label: 'Sol El' },
  { id: 'karin', label: 'Karın/Bel' },
  { id: 'sag_kalca', label: 'Sağ Kalça' },
  { id: 'sol_kalca', label: 'Sol Kalça' },
  { id: 'sag_bacak', label: 'Sağ Bacak' },
  { id: 'sol_bacak', label: 'Sol Bacak' },
  { id: 'sag_ayak', label: 'Sağ Ayak' },
  { id: 'sol_ayak', label: 'Sol Ayak' },
];

const KAZA_TIPI_OPTIONS = [
  { value: 'is_kazasi', label: 'İş Kazası' },
  { value: 'ramak_kala', label: 'Ramak Kala (Near Miss)' },
  { value: 'meslek_hastaligi', label: 'Meslek Hastalığı' },
];

const RISK_SEVIYESI_OPTIONS = [
  { value: 'dusuk', label: 'Düşük' },
  { value: 'orta', label: 'Orta' },
  { value: 'yuksek', label: 'Yüksek' },
  { value: 'kritik', label: 'Kritik' },
];

const SIDDET_OPTIONS = [
  { label: 'Hafif',    value: 'Hafif',    color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',  border: 'rgba(34,211,238,0.4)'  },
  { label: 'Orta',    value: 'Orta',     color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.4)'  },
  { label: 'Ağır',    value: 'Ağır',     color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)'  },
  { label: 'Çok Ağır', value: 'Çok Ağır', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)'  },
  { label: 'Ölüm',   value: 'Ölüm',     color: '#7f1d1d', bg: 'rgba(127,29,29,0.2)',    border: 'rgba(127,29,29,0.5)'  },
];

const BOLGE_RISK_MAP: Record<string, { color: string; label: string; note: string }> = {
  bas:       { color: '#ef4444', label: 'Kritik', note: 'Kafa travması, beyin sarsıntısı riski yüksek' },
  boyun:     { color: '#ef4444', label: 'Kritik', note: 'Omurga hasarı — immobilizasyon gerekebilir' },
  gogus:     { color: '#f97316', label: 'Yüksek', note: 'Pnömotoraks, kot kırığı olasılığını değerlendir' },
  sirt:      { color: '#f97316', label: 'Yüksek', note: 'Vertebra hasarı olasılığını değerlendir' },
  karin:     { color: '#f97316', label: 'Yüksek', note: 'İç organ hasarı, lomber vertebra değerlendir' },
  sag_omuz:  { color: '#fbbf24', label: 'Orta', note: 'Rotator cuff, klavikula kırığı değerlendir' },
  sol_omuz:  { color: '#fbbf24', label: 'Orta', note: 'Rotator cuff, klavikula kırığı değerlendir' },
  sag_kol:   { color: '#22d3ee', label: 'Düşük', note: 'Biseps/humerus kırığı, sinir hasarı' },
  sol_kol:   { color: '#22d3ee', label: 'Düşük', note: 'Biseps/humerus kırığı, sinir hasarı' },
  sag_el:    { color: '#22d3ee', label: 'Düşük', note: 'Parmak kırıkları, tendon hasarı' },
  sol_el:    { color: '#22d3ee', label: 'Düşük', note: 'Parmak kırıkları, tendon hasarı' },
  sag_kalca: { color: '#22d3ee', label: 'Düşük', note: 'Kalça eklemi, femur boynu kırığı' },
  sol_kalca: { color: '#22d3ee', label: 'Düşük', note: 'Kalça eklemi, femur boynu kırığı' },
  sag_bacak: { color: '#22d3ee', label: 'Düşük', note: 'Tibia/fibula kırığı, menisküs hasarı' },
  sol_bacak: { color: '#22d3ee', label: 'Düşük', note: 'Tibia/fibula kırığı, menisküs hasarı' },
  sag_ayak:  { color: '#22d3ee', label: 'Düşük', note: 'Metatars kırığı, ayak bileği burkulması' },
  sol_ayak:  { color: '#22d3ee', label: 'Düşük', note: 'Metatars kırığı, ayak bileği burkulması' },
};

const emptyForm: IsKazasiFormData = {
  personelId: '', firmaId: '', kazaTarihi: '', kazaSaati: '',
  kazaYeri: '', kazaTuru: '', kazaTipi: 'is_kazasi', kazaAciklamasi: '',
  yaraliVucutBolgeleri: [], yaralanmaTuru: '', yaralanmaSiddeti: 'Hafif',
  riskSeviyesi: 'orta',
  isGunuKaybi: 0, hastaneyeKaldirildi: false, hastaneAdi: '',
  tanikBilgileri: '', onlemler: '', durum: 'Açık',
  olumNedeni: '', olumTarihi: '',
  sgkBildirildi: false, sgkBildirimTarihi: '', sgkBildirimNotu: '',
  fotografPaths: [], olayYeriDiagram: '',
  besNeden: JSON.parse(JSON.stringify(BES_NEDEN_TEMPLATE)),
};

export default function HekimIsKazasiModal({
  open, onClose, onSaved, atanmisFirmaIds, isDark, editData, preselectedPersonelId, addToast,
}: HekimIsKazasiModalProps) {
  const [form, setForm] = useState<IsKazasiFormData>(emptyForm);
  const [personelOptions, setPersonelOptions] = useState<PersonelOption[]>([]);
  const [firmaAdMap, setFirmaAdMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'kaza' | 'yaralanma' | 'onceki' | 'sgk' | 'foto' | 'analiz'>('kaza');
  const [tekrarUyarilari, setTekrarUyarilari] = useState<TekrarUyari[]>([]);
  const [uyariGizle, setUyariGizle] = useState(false);
  const [fotografYukleniyor, setFotografYukleniyor] = useState(false);
  const [fotografOnizleme, setFotografOnizleme] = useState<string[]>([]);
  // canvas/diyagram state'leri kaldırıldı
  const [sgkSonGun, setSgkSonGun] = useState<string | null>(null);
  const [pastKazalar, setPastKazalar] = useState<{
    id: string; kaza_tarihi: string; kaza_yeri: string;
    yarali_vucut_bolgeleri: string[]; yaralanma_siddeti: string; durum: string;
  }[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  // ── Tema renkleri ──
  const bg       = isDark ? '#0f172a'            : '#ffffff';
  const bgPanel  = isDark ? '#070d1a'            : '#f8fafc';
  const bgCard   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)';
  const borderSubtle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)';
  const textPrimary  = isDark ? '#f1f5f9'       : '#0f172a';
  const textMuted    = isDark ? '#94a3b8'       : '#64748b';
  const textFaint    = isDark ? '#475569'       : '#94a3b8';
  const inputBg  = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.15)';
  const colorScheme = isDark ? 'dark' : 'light';

  const INPUT_STYLE: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    color: textPrimary,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
    colorScheme,
  };

  const LABEL_STYLE: React.CSSProperties = {
    color: textMuted,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    display: 'block',
    marginBottom: 5,
  };

  const SECTION_STYLE: React.CSSProperties = {
    background: bgCard,
    border: `1px solid ${border}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 0,
  };

  useEffect(() => {
    if (!open || atanmisFirmaIds.length === 0) return;
    const load = async () => {
      const safeIds = atanmisFirmaIds.filter(id => typeof id === 'string' && id.length > 0);
      const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', safeIds);
      const adMap: Record<string, string> = {};
      (orgs ?? []).forEach(o => { adMap[o.id] = o.name; });
      setFirmaAdMap(adMap);
      const allPersonel: PersonelOption[] = [];
      await Promise.all(safeIds.map(async (firmaId) => {
        const { data: rows } = await supabase.from('personeller').select('id, data').eq('organization_id', firmaId).is('deleted_at', null);
        (rows ?? []).forEach(r => {
          const d = r.data as Record<string, unknown>;
          allPersonel.push({ id: r.id, adSoyad: (d.adSoyad as string) ?? '', gorev: (d.gorev as string) ?? '', firmaId });
        });
      }));
      setPersonelOptions(allPersonel);
    };
    load();
  }, [open, atanmisFirmaIds]);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        ...emptyForm,
        ...editData,
        kazaTipi: (editData as IsKazasiFormData).kazaTipi ?? 'is_kazasi',
        riskSeviyesi: (editData as IsKazasiFormData).riskSeviyesi ?? 'orta',
        olumNedeni: (editData as IsKazasiFormData).olumNedeni ?? '',
        olumTarihi: (editData as IsKazasiFormData).olumTarihi ?? '',
        sgkBildirildi: editData.sgkBildirildi ?? false,
        sgkBildirimTarihi: editData.sgkBildirimTarihi ?? '',
        sgkBildirimNotu: editData.sgkBildirimNotu ?? '',
        fotografPaths: editData.fotografPaths ?? [],
        olayYeriDiagram: editData.olayYeriDiagram ?? '',
        besNeden: editData.besNeden?.length ? editData.besNeden : JSON.parse(JSON.stringify(BES_NEDEN_TEMPLATE)),
      });
    } else if (preselectedPersonelId) {
      const p = personelOptions.find(x => x.id === preselectedPersonelId);
      setForm({ ...emptyForm, personelId: preselectedPersonelId, firmaId: p?.firmaId ?? '' });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
    setActiveTab('kaza');
    setPastKazalar([]);
    setTekrarUyarilari([]);
    setUyariGizle(false);
    setFotografOnizleme([]);
    setSgkSonGun(null);
  }, [open, editData, preselectedPersonelId, personelOptions]);

  useEffect(() => {
    if (!form.personelId) { setPastKazalar([]); return; }
    const fetchPast = async () => {
      setLoadingPast(true);
      try {
        const { data } = await supabase
          .from('is_kazalari')
          .select('id, kaza_tarihi, kaza_yeri, yarali_vucut_bolgeleri, yaralanma_siddeti, durum')
          .eq('personel_id', form.personelId)
          .order('kaza_tarihi', { ascending: false })
          .limit(5);
        const filtered = (data ?? []).filter(k => k.id !== editData?.id);
        setPastKazalar(filtered);
      } catch {
        setPastKazalar([]);
      } finally {
        setLoadingPast(false);
      }
    };
    fetchPast();
  }, [form.personelId, editData?.id]);

  // ── SGK son bildirim günü hesapla (3 iş günü) ──
  useEffect(() => {
    if (!form.kazaTarihi) { setSgkSonGun(null); return; }
    try {
      const start = new Date(form.kazaTarihi);
      let count = 0;
      const cur = new Date(start);
      cur.setDate(cur.getDate() + 1);
      while (count < 3) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        if (count < 3) cur.setDate(cur.getDate() + 1);
      }
      setSgkSonGun(cur.toISOString().split('T')[0]);
    } catch { setSgkSonGun(null); }
  }, [form.kazaTarihi]);

  // ── Kaza tekrar analizi ──
  const analizTekrar = useCallback(async (personelId: string, firmaId: string, kazaTuru: string) => {
    if (!personelId && !firmaId) { setTekrarUyarilari([]); return; }
    const altıAyOnce = new Date();
    altıAyOnce.setMonth(altıAyOnce.getMonth() - 6);
    const sinir = altıAyOnce.toISOString().split('T')[0];

    try {
      const uyarilar: TekrarUyari[] = [];

      // Aynı personelde tekrar eden kaza türü
      if (personelId) {
        const { data: pRows } = await supabase
          .from('is_kazalari')
          .select('id, kaza_turu, kaza_tarihi')
          .eq('personel_id', personelId)
          .gte('kaza_tarihi', sinir)
          .is('deleted_at', null);

        const pFiltered = (pRows ?? []).filter(r => r.id !== editData?.id);

        // Tüm kaza türlerini say (kaza türü seçiliyse o türü, seçili değilse genel sayım)
        const turSayac: Record<string, { sayi: number; sonTarih: string }> = {};
        pFiltered.forEach(r => {
          const tur = r.kaza_turu || 'Belirtilmemiş';
          if (!turSayac[tur]) turSayac[tur] = { sayi: 0, sonTarih: r.kaza_tarihi };
          turSayac[tur].sayi += 1;
          if (r.kaza_tarihi > turSayac[tur].sonTarih) turSayac[tur].sonTarih = r.kaza_tarihi;
        });

        // Eğer kaza türü seçiliyse o türe bak, yoksa tekrarlayan her türü bul
        if (kazaTuru) {
          const entry = turSayac[kazaTuru];
          if (entry && entry.sayi >= 1) {
            uyarilar.push({
              tip: 'personel',
              kazaTuru,
              sayi: entry.sayi,
              sonTarih: entry.sonTarih,
              etiket: 'Aynı Personel',
            });
          }
        } else {
          // Kaza türü henüz seçilmemişse genel uyarı ver (1+ kaza varsa)
          if (pFiltered.length >= 2) {
            const enYeniTarih = pFiltered.reduce((acc, r) => r.kaza_tarihi > acc ? r.kaza_tarihi : acc, '');
            uyarilar.push({
              tip: 'personel',
              kazaTuru: '',
              sayi: pFiltered.length,
              sonTarih: enYeniTarih,
              etiket: 'Aynı Personel',
            });
          }
        }
      }

      // Aynı firmada tekrar eden kaza türü
      if (firmaId && kazaTuru) {
        const { data: fRows } = await supabase
          .from('is_kazalari')
          .select('id, kaza_turu, kaza_tarihi, personel_id')
          .eq('organization_id', firmaId)
          .eq('kaza_turu', kazaTuru)
          .gte('kaza_tarihi', sinir)
          .is('deleted_at', null);

        const fFiltered = (fRows ?? []).filter(r => r.id !== editData?.id);

        if (fFiltered.length >= 2) {
          const enYeniTarih = fFiltered.reduce((acc, r) => r.kaza_tarihi > acc ? r.kaza_tarihi : acc, '');
          // Personel uyarısıyla zaten kapsanmıyorsa ekle
          const zatenVar = uyarilar.some(u => u.tip === 'personel' && u.kazaTuru === kazaTuru);
          if (!zatenVar || fFiltered.length > 2) {
            uyarilar.push({
              tip: 'firma',
              kazaTuru,
              sayi: fFiltered.length,
              sonTarih: enYeniTarih,
              etiket: 'Aynı Firma',
            });
          }
        }
      }

      setTekrarUyarilari(uyarilar);
      if (uyarilar.length > 0) setUyariGizle(false);
    } catch {
      setTekrarUyarilari([]);
    }
  }, [editData?.id]);

  // Personel, firma veya kaza türü değişince tekrar analizi yap
  useEffect(() => {
    if (!open) return;
    analizTekrar(form.personelId, form.firmaId, form.kazaTuru);
  }, [open, form.personelId, form.firmaId, form.kazaTuru, analizTekrar]);

  const toggleBolge = (id: string) => {
    setForm(prev => ({
      ...prev,
      yaraliVucutBolgeleri: prev.yaraliVucutBolgeleri.includes(id)
        ? prev.yaraliVucutBolgeleri.filter(b => b !== id)
        : [...prev.yaraliVucutBolgeleri, id],
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.personelId) e.personelId = 'Personel zorunludur';
    if (!form.kazaTarihi) e.kazaTarihi = 'Tarih zorunludur';
    if (!form.kazaAciklamasi) e.kazaAciklamasi = 'Açıklama zorunludur';

    // Ramak kala ise yaralanma alanları validate edilmez
    const isRamakKala = form.kazaTipi === 'ramak_kala';

    if (!isRamakKala) {
      if (form.yaralanmaSiddeti === 'Ölüm') {
        // Ölüm durumunda sadece ölüm alanları zorunlu
        if (!form.olumNedeni) e.olumNedeni = 'Ölüm nedeni zorunludur';
        if (!form.olumTarihi) e.olumTarihi = 'Ölüm tarihi zorunludur';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) {
      addToast?.('Lütfen zorunlu alanları doldurun', 'error');
      return;
    }

    if (!form.firmaId) {
      addToast?.('Firma seçilmedi. Lütfen personel veya firma seçin.', 'error');
      return;
    }

    setSaving(true);
    try {
      // undefined alanları temizle, sadece aktif alanları gönder
      const isRamakKala = form.kazaTipi === 'ramak_kala';
      const isOlum = form.yaralanmaSiddeti === 'Ölüm';

      const payload: Record<string, unknown> = {
        organization_id: form.firmaId,
        personel_id: form.personelId,
        kaza_tarihi: form.kazaTarihi,
        kaza_turu: form.kazaTuru || null,
        kaza_aciklamasi: form.kazaAciklamasi,
        durum: form.durum,
        bes_neden: form.besNeden,
      };

      if (form.kazaSaati) payload.kaza_saati = form.kazaSaati;
      if (form.kazaYeri) payload.kaza_yeri = form.kazaYeri;
      if (form.tanikBilgileri) payload.tanik_bilgileri = form.tanikBilgileri;
      if (form.onlemler) payload.onlemler = form.onlemler;
      if (form.fotografPaths.length > 0) payload.fotograf_paths = form.fotografPaths;
      if (form.olayYeriDiagram) payload.olay_yeri_diagram = form.olayYeriDiagram;

      // SGK alanları
      payload.sgk_bildirildi = form.sgkBildirildi;
      if (form.sgkBildirimTarihi) payload.sgk_bildirim_tarihi = form.sgkBildirimTarihi;
      if (form.sgkBildirimNotu) payload.sgk_bildirim_notu = form.sgkBildirimNotu;

      // Kaza tipi ve risk seviyesi — data kolonuna değil direkt kolonlara
      // (tablo yoksa ek alanları yaralanma/durum alanlarıyla birlikte göndereceğiz)
      // Kaza tipini kaza_turu içine ekle veya ayrı bir alan olarak gönder
      // Mevcut tabloda kazaTipi kolonu yok — durum alanına encode edelim ya da kaza_turu'na prefix ekleyelim
      // En temiz yol: yaralanma alanlarını koşula göre gönder
      if (!isRamakKala) {
        payload.yarali_vucut_bolgeleri = form.yaraliVucutBolgeleri;
        payload.yaralanma_turu = form.yaralanmaTuru || null;
        payload.yaralanma_siddeti = form.yaralanmaSiddeti;
        payload.is_gunu_kaybi = form.isGunuKaybi;
        payload.hastaneye_kaldirildi = form.hastaneyeKaldirildi;
        payload.hastane_adi = form.hastaneyeKaldirildi ? form.hastaneAdi : null;

        if (isOlum) {
          // Ölüm durumunda ek bilgileri notlar alanına ekle
          const olumBilgisi = `ÖLÜM VAKASI | Ölüm Nedeni: ${form.olumNedeni} | Ölüm Tarihi: ${form.olumTarihi}`;
          payload.tanik_bilgileri = form.tanikBilgileri
            ? `${form.tanikBilgileri}\n\n${olumBilgisi}`
            : olumBilgisi;
        }
      } else {
        // Ramak kala — yaralanma alanları boş gönder
        payload.yarali_vucut_bolgeleri = [];
        payload.yaralanma_turu = null;
        payload.yaralanma_siddeti = 'Hafif';
        payload.is_gunu_kaybi = 0;
        payload.hastaneye_kaldirildi = false;
        payload.hastane_adi = null;
      }

      console.log('[HekimIsKazasiModal] payload:', payload);

      let error: { message?: string } | null = null;
      if (editData?.id) {
        const res = await supabase.from('is_kazalari').update(payload).eq('id', editData.id);
        error = res.error;
      } else {
        const res = await supabase.from('is_kazalari').insert(payload);
        error = res.error;
      }

      console.log('[HekimIsKazasiModal] supabase error:', error);

      if (error) {
        addToast?.(`Kayıt hatası: ${error.message ?? 'Bilinmeyen hata'}`, 'error');
        return;
      }

      addToast?.(editData ? 'Kayıt güncellendi' : 'Kaza kaydı oluşturuldu', 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      console.error('[HekimIsKazasiModal] save error:', err);
      const msg = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu';
      addToast?.(`Hata: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const filteredPersonel = form.firmaId
    ? personelOptions.filter(p => p.firmaId === form.firmaId)
    : personelOptions;

  const secilenPersonel = personelOptions.find(p => p.id === form.personelId);
  const lastSelected = form.yaraliVucutBolgeleri[form.yaraliVucutBolgeleri.length - 1];
  const lastRisk = lastSelected ? BOLGE_RISK_MAP[lastSelected] : null;
  const lastBolgeLabel = lastSelected ? VUCUT_BOLGELERI.find(b => b.id === lastSelected)?.label : null;
  const siddetCfg = SIDDET_OPTIONS.find(s => s.label === form.yaralanmaSiddeti) ?? SIDDET_OPTIONS[0];

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: isDark ? 'rgba(0,0,0,0.88)' : 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(12px)',
        padding: '10px',
        zIndex: 9999,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxWidth: 1340,
          height: 'calc(100vh - 20px)',
          background: bg,
          border: `1px solid ${border}`,
          boxShadow: isDark
            ? '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(239,68,68,0.12)'
            : '0 24px 64px rgba(15,23,42,0.18)',
        }}
      >
        {/* Top gradient bar */}
        <div className="h-[3px] flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #ef4444 0%, #f97316 40%, #fbbf24 70%, #22d3ee 100%)' }} />

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${borderSubtle}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: textFaint }}>
                İş Kazası Kayıt Sistemi
              </span>
            </div>
            <div className="h-4 w-px" style={{ background: borderSubtle }} />
            <p className="text-sm font-bold" style={{ color: textPrimary, letterSpacing: '-0.02em' }}>
              {editData ? 'Kaydı Düzenle' : 'Yeni Kaza Kaydı'}
            </p>
            {secilenPersonel && (
              <>
                <div className="h-4 w-px" style={{ background: borderSubtle }} />
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)', color: '#fff' }}>
                    {secilenPersonel.adSoyad.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: textMuted }}>{secilenPersonel.adSoyad}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {form.yaraliVucutBolgeleri.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)' }}>
                <i className="ri-body-scan-line text-[11px]" style={{ color: '#ef4444' }} />
                <span className="text-[11px] font-bold" style={{ color: '#ef4444' }}>
                  {form.yaraliVucutBolgeleri.length} bölge işaretlendi
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', border: `1px solid ${border}`, color: textFaint }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'; (e.currentTarget as HTMLElement).style.color = textFaint; }}
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>

        {/* ══ 2 KOLON ══ */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ═══ SOL: 3D MODEL ═══ */}
          <div className="flex flex-col" style={{ flex: '0 0 460px', borderRight: `1px solid ${borderSubtle}`, background: bgPanel }}>
            {/* Model header */}
            <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
              style={{ borderBottom: `1px solid ${borderSubtle}` }}>
              <div className="flex items-center gap-2">
                <i className="ri-body-scan-line text-xs" style={{ color: '#ef4444' }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: textFaint }}>
                  3D Vücut Modeli
                </span>
              </div>
              <div className="flex items-center gap-3 text-[9px]" style={{ color: textFaint }}>
                <span><i className="ri-drag-move-line mr-1" />Döndür</span>
                <span><i className="ri-zoom-in-line mr-1" />Zoom</span>
                <span><i className="ri-cursor-line mr-1" />Tıkla</span>
              </div>
            </div>

            {/* 3D Model */}
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
              <Suspense fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px]" style={{ color: textFaint }}>Model yükleniyor...</span>
                </div>
              }>
                <Human3DModel
                  selected={form.yaraliVucutBolgeleri}
                  onToggle={toggleBolge}
                  isDark={isDark}
                />
              </Suspense>
            </div>

            {/* Seçili bölge klinik notu */}
            {lastRisk && lastBolgeLabel && (
              <div className="flex-shrink-0 px-4 py-3"
                style={{ borderTop: `1px solid ${borderSubtle}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${lastRisk.color}15`, border: `1px solid ${lastRisk.color}28` }}>
                    <i className="ri-stethoscope-line text-xs" style={{ color: lastRisk.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold" style={{ color: textPrimary }}>{lastBolgeLabel}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${lastRisk.color}15`, color: lastRisk.color, border: `1px solid ${lastRisk.color}28` }}>
                        {lastRisk.label} Risk
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: textFaint }}>{lastRisk.note}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Renk kılavuzu */}
            <div className="px-4 py-2.5 flex items-center gap-4 flex-shrink-0"
              style={{ borderTop: `1px solid ${borderSubtle}` }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: isDark ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)' }} />
                <span className="text-[9px] font-medium" style={{ color: textFaint }}>Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
                <span className="text-[9px] font-medium" style={{ color: textFaint }}>Seçili</span>
              </div>
              <span className="ml-auto text-[9px]" style={{ color: textFaint }}>Bölgeye tıkla → işaretle</span>
            </div>
          </div>

          {/* ═══ SAĞ: İstatistik + Form ═══ */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* İstatistik şeridi */}
            <div className="flex-shrink-0 grid grid-cols-4"
              style={{ borderBottom: `1px solid ${borderSubtle}` }}>
              {[
                { icon: 'ri-body-scan-line',     value: form.yaraliVucutBolgeleri.length || '—', label: 'Yaralı Bölge',   color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)' },
                { icon: 'ri-calendar-event-line', value: form.kazaTarihi ? new Date(form.kazaTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—', label: 'Kaza Tarihi', color: '#fbbf24', bg: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.05)' },
                { icon: 'ri-alert-fill',          value: form.yaralanmaSiddeti || '—',           label: 'Şiddet',          color: siddetCfg.color, bg: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)' },
                { icon: 'ri-calendar-close-line', value: form.isGunuKaybi > 0 ? `${form.isGunuKaybi}g` : '—', label: 'İş Günü Kaybı', color: '#22d3ee', bg: isDark ? 'rgba(34,211,238,0.08)' : 'rgba(34,211,238,0.05)' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center gap-3 px-4 py-3"
                  style={{ background: stat.bg, borderRight: `1px solid ${borderSubtle}` }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: `${stat.color}18`, border: `1px solid ${stat.color}25` }}>
                    <i className={`${stat.icon} text-sm`} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold leading-none" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[9px] mt-0.5 font-semibold" style={{ color: textFaint }}>{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 flex items-center gap-0.5 px-3 py-1.5 flex-wrap"
              style={{ borderBottom: `1px solid ${borderSubtle}`, background: isDark ? 'rgba(255,255,255,0.01)' : '#f8fafc' }}>
              {([
                { id: 'kaza',      label: 'Kaza',      icon: 'ri-alert-line',            color: '#ef4444' },
                { id: 'yaralanma', label: 'Yaralanma', icon: 'ri-first-aid-kit-line',    color: '#f97316' },
                { id: 'sgk',       label: 'SGK',       icon: 'ri-government-line',       color: '#6366f1' },
                { id: 'foto',      label: 'Fotoğraf',  icon: 'ri-camera-line',           color: '#0ea5e9' },
                { id: 'analiz',    label: '5 Neden',   icon: 'ri-mind-map',              color: '#10b981' },
                { id: 'onceki',    label: 'Geçmiş',    icon: 'ri-history-line',          color: '#fbbf24' },
              ] as { id: 'kaza' | 'yaralanma' | 'onceki' | 'sgk' | 'foto' | 'analiz'; label: string; icon: string; color: string }[]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: activeTab === tab.id ? `${tab.color}12` : 'transparent',
                    color: activeTab === tab.id ? tab.color : textMuted,
                    border: activeTab === tab.id ? `1px solid ${tab.color}28` : '1px solid transparent',
                  }}
                >
                  <i className={`${tab.icon} text-[10px]`} />
                  {tab.label}
                  {tab.id === 'onceki' && pastKazalar.length > 0 && (
                    <span className="w-3.5 h-3.5 rounded-full text-[8px] font-extrabold flex items-center justify-center"
                      style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24' }}>
                      {pastKazalar.length}
                    </span>
                  )}
                  {tab.id === 'sgk' && !form.sgkBildirildi && form.kazaTarihi && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: '#ef4444', boxShadow: '0 0 4px rgba(239,68,68,0.6)' }} />
                  )}
                  {tab.id === 'foto' && form.fotografPaths.length > 0 && (
                    <span className="w-3.5 h-3.5 rounded-full text-[8px] font-extrabold flex items-center justify-center"
                      style={{ background: 'rgba(14,165,233,0.18)', color: '#0ea5e9' }}>
                      {form.fotografPaths.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── TEKRAR UYARI BANNER'I ── */}
            {tekrarUyarilari.length > 0 && !uyariGizle && (
              <div className="flex-shrink-0 mx-4 mt-3 rounded-xl overflow-hidden"
                style={{ border: '1.5px solid rgba(251,191,36,0.35)', background: isDark ? 'rgba(251,191,36,0.07)' : 'rgba(251,191,36,0.06)' }}>
                {/* Banner header */}
                <div className="flex items-center justify-between px-3.5 py-2.5"
                  style={{ borderBottom: '1px solid rgba(251,191,36,0.18)', background: isDark ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.09)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.35)' }}>
                      <i className="ri-repeat-2-line text-[11px]" style={{ color: '#fbbf24' }} />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: '#fbbf24' }}>
                      Tekrar Kaza Uyarısı
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                      {tekrarUyarilari.length} uyarı
                    </span>
                  </div>
                  <button
                    onClick={() => setUyariGizle(true)}
                    className="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-all"
                    style={{ color: 'rgba(251,191,36,0.6)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fbbf24'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(251,191,36,0.6)'; }}
                  >
                    <i className="ri-close-line text-xs" />
                  </button>
                </div>

                {/* Uyarı listesi */}
                <div className="px-3.5 py-2.5 space-y-2">
                  {tekrarUyarilari.map((u, idx) => {
                    const isPers = u.tip === 'personel';
                    const iconClass = isPers ? 'ri-user-line' : 'ri-building-2-line';
                    const badgeColor = isPers ? '#f97316' : '#ef4444';
                    const badgeBg = isPers ? 'rgba(249,115,22,0.12)' : 'rgba(239,68,68,0.1)';
                    const badgeBorder = isPers ? 'rgba(249,115,22,0.3)' : 'rgba(239,68,68,0.25)';

                    return (
                      <div key={idx} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2"
                        style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)', border: `1px solid rgba(251,191,36,0.12)` }}>
                        <div className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 mt-0.5"
                          style={{ background: badgeBg, border: `1px solid ${badgeBorder}` }}>
                          <i className={`${iconClass} text-[9px]`} style={{ color: badgeColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}>
                              {u.etiket}
                            </span>
                            {u.kazaTuru && (
                              <span className="text-[10px] font-semibold" style={{ color: textPrimary }}>
                                &ldquo;{u.kazaTuru}&rdquo;
                              </span>
                            )}
                            <span className="text-[10px]" style={{ color: textMuted }}>
                              son 6 ayda
                            </span>
                            <span className="text-[10px] font-extrabold"
                              style={{ color: u.sayi >= 3 ? '#ef4444' : '#fbbf24' }}>
                              {u.sayi}x
                            </span>
                            <span className="text-[10px]" style={{ color: textMuted }}>tekrar</span>
                          </div>
                          <p className="text-[9px] mt-0.5" style={{ color: textFaint }}>
                            <i className="ri-calendar-line mr-1" />
                            Son kaza: {u.sonTarih ? new Date(u.sonTarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('onceki')}
                          className="flex-shrink-0 text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap transition-all"
                          style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.18)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.1)'; }}
                        >
                          Geçmişi Gör
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Alt açıklama */}
                <div className="px-3.5 pb-2.5">
                  <p className="text-[9px] leading-relaxed" style={{ color: textFaint }}>
                    <i className="ri-error-warning-line mr-1" />
                    Tekrar eden kaza türleri sistemik bir risk işareti olabilir. İyileştirme önlemleri alındığından emin olun.
                  </p>
                </div>
              </div>
            )}

            {/* Uyarı gizlendiğinde küçük badge */}
            {tekrarUyarilari.length > 0 && uyariGizle && (
              <div className="flex-shrink-0 mx-4 mt-2 flex justify-end">
                <button
                  onClick={() => setUyariGizle(false)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-[10px] font-bold whitespace-nowrap"
                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.18)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.1)'; }}
                >
                  <i className="ri-repeat-2-line text-xs" />
                  {tekrarUyarilari.length} tekrar uyarısı
                </button>
              </div>
            )}

            {/* Form içerik */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

              {/* ── TAB: KAZA BİLGİSİ ── */}
              {activeTab === 'kaza' && (
                <>
                  {/* Kazazede */}
                  <div style={SECTION_STYLE}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5 mb-3" style={{ color: '#ef4444' }}>
                      <i className="ri-user-line" />Kazazede
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Firma</label>
                        <select value={form.firmaId} onChange={e => setForm(p => ({ ...p, firmaId: e.target.value, personelId: '' }))}
                          style={{ ...INPUT_STYLE, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}>
                          <option value="">Tüm Firmalar</option>
                          {Object.entries(firmaAdMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Personel <span style={{ color: '#ef4444' }}>*</span></label>
                        <select
                          value={form.personelId}
                          onChange={e => {
                            const p = personelOptions.find(x => x.id === e.target.value);
                            setForm(prev => ({ ...prev, personelId: e.target.value, firmaId: p?.firmaId ?? prev.firmaId }));
                          }}
                          style={{ ...INPUT_STYLE, borderColor: errors.personelId ? '#ef4444' : inputBorder, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = errors.personelId ? '#ef4444' : inputBorder; }}>
                          <option value="">Personel Seçin</option>
                          {filteredPersonel.map(p => <option key={p.id} value={p.id}>{p.adSoyad}{p.gorev ? ` — ${p.gorev}` : ''}</option>)}
                        </select>
                        {errors.personelId && <p className="text-[9px] mt-1" style={{ color: '#ef4444' }}>{errors.personelId}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Olay Detayları */}
                  <div style={SECTION_STYLE}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5 mb-3" style={{ color: '#fbbf24' }}>
                      <i className="ri-calendar-event-line" />Olay Detayları
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Kaza Tipi</label>
                        <select value={form.kazaTipi} onChange={e => setForm(p => ({ ...p, kazaTipi: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}>
                          {KAZA_TIPI_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Risk Seviyesi</label>
                        <select value={form.riskSeviyesi} onChange={e => setForm(p => ({ ...p, riskSeviyesi: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}>
                          {RISK_SEVIYESI_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Tarih <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="date" value={form.kazaTarihi}
                          onChange={e => setForm(p => ({ ...p, kazaTarihi: e.target.value }))}
                          style={{ ...INPUT_STYLE, borderColor: errors.kazaTarihi ? '#ef4444' : inputBorder, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = errors.kazaTarihi ? '#ef4444' : inputBorder; }} />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Saat</label>
                        <input type="time" value={form.kazaSaati}
                          onChange={e => setForm(p => ({ ...p, kazaSaati: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Kaza Yeri</label>
                        <input type="text" value={form.kazaYeri} placeholder="Üretim bandı, depo..."
                          onChange={e => setForm(p => ({ ...p, kazaYeri: e.target.value }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Kaza Türü</label>
                        <select value={form.kazaTuru} onChange={e => setForm(p => ({ ...p, kazaTuru: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}>
                          <option value="">Seçin</option>
                          {KAZA_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label style={LABEL_STYLE}>Açıklama <span style={{ color: '#ef4444' }}>*</span></label>
                      <textarea
                        value={form.kazaAciklamasi} rows={3} maxLength={500}
                        placeholder="Kazanın nasıl gerçekleştiğini ayrıntılı açıklayın..."
                        onChange={e => setForm(p => ({ ...p, kazaAciklamasi: e.target.value }))}
                        style={{ ...INPUT_STYLE, resize: 'none', borderColor: errors.kazaAciklamasi ? '#ef4444' : inputBorder }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = errors.kazaAciklamasi ? '#ef4444' : inputBorder; }} />
                      <div className="flex justify-between mt-1">
                        {errors.kazaAciklamasi
                          ? <p className="text-[9px]" style={{ color: '#ef4444' }}>{errors.kazaAciklamasi}</p>
                          : <span />}
                        <p className="text-[9px]" style={{ color: textFaint }}>{form.kazaAciklamasi.length}/500</p>
                      </div>
                    </div>
                  </div>

                  {/* Tanık & Önlemler */}
                  <div style={SECTION_STYLE}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5 mb-3" style={{ color: '#22d3ee' }}>
                      <i className="ri-shield-check-line" />Tanık &amp; Önlemler
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Tanık Bilgileri</label>
                        <input type="text" value={form.tanikBilgileri} placeholder="Tanıkların adı..."
                          onChange={e => setForm(p => ({ ...p, tanikBilgileri: e.target.value }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>Durum</label>
                        <div className="flex gap-1.5">
                          {['Açık', 'Soruşturuluyor', 'Kapatıldı'].map(d => {
                            const cols: Record<string, string> = { 'Açık': '#ef4444', 'Soruşturuluyor': '#fbbf24', 'Kapatıldı': '#10b981' };
                            const c = cols[d];
                            return (
                              <button key={d} onClick={() => setForm(p => ({ ...p, durum: d }))}
                                className="flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap"
                                style={{
                                  background: form.durum === d ? `${c}15` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'),
                                  color: form.durum === d ? c : textMuted,
                                  border: `1px solid ${form.durum === d ? `${c}35` : border}`,
                                }}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label style={LABEL_STYLE}>Alınan Önlemler</label>
                      <textarea value={form.onlemler} rows={2} maxLength={500}
                        placeholder="Alınan veya alınacak tedbirler..."
                        onChange={e => setForm(p => ({ ...p, onlemler: e.target.value }))}
                        style={{ ...INPUT_STYLE, resize: 'none' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB: YARALANMA ── */}
              {activeTab === 'yaralanma' && (
                <>
                  {/* Seçili bölgeler */}
                  <div style={SECTION_STYLE}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                        <i className="ri-body-scan-line" />Yaralı Bölgeler
                        <span className="text-[9px] normal-case tracking-normal font-normal ml-1" style={{ color: textFaint }}>
                          (3D modelden seçin)
                        </span>
                      </p>
                      {form.yaraliVucutBolgeleri.length > 0 && (
                        <button onClick={() => setForm(p => ({ ...p, yaraliVucutBolgeleri: [] }))}
                          className="text-[9px] font-semibold cursor-pointer" style={{ color: '#ef4444' }}>
                          Temizle
                        </button>
                      )}
                    </div>
                    {form.yaraliVucutBolgeleri.length === 0 ? (
                      <div className="flex flex-col items-center py-5 text-center">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.2)' }}>
                          <i className="ri-cursor-line text-lg" style={{ color: 'rgba(239,68,68,0.4)' }} />
                        </div>
                        <p className="text-xs font-semibold" style={{ color: textMuted }}>Henüz bölge seçilmedi</p>
                        <p className="text-[10px] mt-0.5" style={{ color: textFaint }}>Sol taraftaki 3D modele tıklayın</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {form.yaraliVucutBolgeleri.map(id => {
                          const info = VUCUT_BOLGELERI.find(b => b.id === id);
                          return (
                            <button key={id} onClick={() => toggleBolge(id)}
                              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-left"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}>
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                              <span className="text-[10px] font-semibold leading-tight" style={{ color: textPrimary }}>
                                {info?.label ?? id}
                              </span>
                              <i className="ri-close-line text-[9px] ml-auto" style={{ color: 'rgba(239,68,68,0.5)' }} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Yaralanma bilgi */}
                  <div style={SECTION_STYLE}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5 mb-3" style={{ color: '#f97316' }}>
                      <i className="ri-first-aid-kit-line" />Yaralanma Bilgisi
                      {form.kazaTipi === 'ramak_kala' && (
                        <span className="normal-case text-[9px] font-normal ml-2 px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}>
                          Ramak kala — yaralanma yok
                        </span>
                      )}
                    </p>

                    {form.kazaTipi === 'ramak_kala' ? (
                      <div className="flex flex-col items-center py-6 gap-2 text-center">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(34,211,238,0.08)', border: '1px dashed rgba(34,211,238,0.25)' }}>
                          <i className="ri-shield-check-line text-xl" style={{ color: '#22d3ee' }} />
                        </div>
                        <p className="text-xs font-semibold" style={{ color: textMuted }}>Ramak kala vakasında yaralanma bilgisi girilmez</p>
                      </div>
                    ) : (
                      <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={LABEL_STYLE}>Yaralanma Türü</label>
                        <select value={form.yaralanmaTuru} onChange={e => setForm(p => ({ ...p, yaralanmaTuru: e.target.value }))}
                          style={{ ...INPUT_STYLE, colorScheme }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}>
                          <option value="">Seçin</option>
                          {YARALANMA_TURLERI.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LABEL_STYLE}>İş Günü Kaybı</label>
                        <input type="number" min={0} value={form.isGunuKaybi}
                          onChange={e => setForm(p => ({ ...p, isGunuKaybi: parseInt(e.target.value) || 0 }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                      </div>
                    </div>

                    {/* Şiddet */}
                    <div className="mt-3">
                      <label style={LABEL_STYLE}>Yaralanma Şiddeti</label>
                      <div className="grid grid-cols-5 gap-2">
                        {SIDDET_OPTIONS.map(opt => {
                          const active = form.yaralanmaSiddeti === opt.value;
                          return (
                            <button key={opt.value} onClick={() => setForm(p => ({ ...p, yaralanmaSiddeti: opt.value }))}
                              className="py-2.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap flex flex-col items-center gap-1"
                              style={{
                                background: active ? opt.bg : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'),
                                color: active ? opt.color : textMuted,
                                border: `1.5px solid ${active ? opt.border : border}`,
                                boxShadow: active ? `0 0 12px ${opt.color}20` : 'none',
                              }}>
                              <div className="w-2 h-2 rounded-full"
                                style={{ background: active ? opt.color : (isDark ? '#1e293b' : '#cbd5e1'), boxShadow: active ? `0 0 6px ${opt.color}` : 'none' }} />
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ölüm alanları */}
                    {form.yaralanmaSiddeti === 'Ölüm' && (
                      <div className="mt-3 rounded-xl p-3 space-y-3"
                        style={{ background: 'rgba(127,29,29,0.08)', border: '1.5px solid rgba(127,29,29,0.3)' }}>
                        <p className="text-[10px] font-bold flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                          <i className="ri-error-warning-fill" />Ölüm Vakası — Ek Bilgiler
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label style={LABEL_STYLE}>Ölüm Nedeni <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="text" value={form.olumNedeni}
                              placeholder="Ölüm nedeni..."
                              onChange={e => setForm(p => ({ ...p, olumNedeni: e.target.value }))}
                              style={{ ...INPUT_STYLE, borderColor: errors.olumNedeni ? '#ef4444' : inputBorder }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#ef4444'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = errors.olumNedeni ? '#ef4444' : inputBorder; }} />
                            {errors.olumNedeni && <p className="text-[9px] mt-1" style={{ color: '#ef4444' }}>{errors.olumNedeni}</p>}
                          </div>
                          <div>
                            <label style={LABEL_STYLE}>Ölüm Tarihi <span style={{ color: '#ef4444' }}>*</span></label>
                            <input type="date" value={form.olumTarihi}
                              onChange={e => setForm(p => ({ ...p, olumTarihi: e.target.value }))}
                              style={{ ...INPUT_STYLE, borderColor: errors.olumTarihi ? '#ef4444' : inputBorder, colorScheme }}
                              onFocus={e => { e.currentTarget.style.borderColor = '#ef4444'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = errors.olumTarihi ? '#ef4444' : inputBorder; }} />
                            {errors.olumTarihi && <p className="text-[9px] mt-1" style={{ color: '#ef4444' }}>{errors.olumTarihi}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hastane */}
                    <div className="mt-3">
                      <button onClick={() => setForm(p => ({ ...p, hastaneyeKaldirildi: !p.hastaneyeKaldirildi }))}
                        className="flex items-center gap-2.5 cursor-pointer mb-2 transition-all">
                        <div className="w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0"
                          style={{
                            background: form.hastaneyeKaldirildi ? '#ef4444' : 'transparent',
                            border: `2px solid ${form.hastaneyeKaldirildi ? '#ef4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.25)')}`,
                          }}>
                          {form.hastaneyeKaldirildi && <i className="ri-check-line text-white text-[9px]" />}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: form.hastaneyeKaldirildi ? textPrimary : textMuted }}>
                          Hastaneye kaldırıldı
                        </span>
                      </button>
                      {form.hastaneyeKaldirildi && (
                        <input type="text" value={form.hastaneAdi} placeholder="Hastane / klinik adı..."
                          onChange={e => setForm(p => ({ ...p, hastaneAdi: e.target.value }))}
                          style={INPUT_STYLE}
                          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                      )}
                    </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* ── TAB: SGK BİLDİRİM ── */}
              {activeTab === 'sgk' && (
                <div className="space-y-3">
                  {/* SGK Bildirimi durumu */}
                  <div style={SECTION_STYLE}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5 mb-3" style={{ color: '#6366f1' }}>
                      <i className="ri-government-line" />SGK Bildirimi
                    </p>

                    {/* Yasal bilgi */}
                    {form.kazaTarihi && sgkSonGun && (
                      <div className="rounded-xl px-3.5 py-3 mb-3 flex items-start gap-3"
                        style={{
                          background: form.sgkBildirildi ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                          border: `1.5px solid ${form.sgkBildirildi ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: form.sgkBildirildi ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
                          <i className={`${form.sgkBildirildi ? 'ri-check-double-line' : 'ri-time-line'} text-sm`}
                            style={{ color: form.sgkBildirildi ? '#10b981' : '#ef4444' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-bold mb-0.5"
                            style={{ color: form.sgkBildirildi ? '#10b981' : '#ef4444' }}>
                            {form.sgkBildirildi ? 'SGK bildirimi yapıldı' : 'SGK bildirimi bekleniyor'}
                          </p>
                          <p className="text-[10px]" style={{ color: textFaint }}>
                            <span>Son bildirim tarihi: </span>
                            <strong style={{ color: textPrimary }}>
                              {new Date(sgkSonGun).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </strong>
                          </p>
                          {!form.sgkBildirildi && (() => {
                            const today = new Date();
                            const son = new Date(sgkSonGun);
                            const kalan = Math.ceil((son.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            return kalan >= 0 ? (
                              <p className="text-[10px] mt-0.5" style={{ color: kalan <= 1 ? '#ef4444' : '#fbbf24' }}>
                                <i className="ri-alarm-warning-line mr-1" />
                                {kalan === 0 ? 'Bugün son gün!' : `${kalan} gün kaldı`}
                              </p>
                            ) : (
                              <p className="text-[10px] mt-0.5 font-bold" style={{ color: '#ef4444' }}>
                                <i className="ri-error-warning-line mr-1" />
                                Bildirim süresi {Math.abs(kalan)} gün geçti!
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Bildirildi toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl mb-3"
                      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)', border: `1px solid ${border}` }}>
                      <div>
                        <p className="text-xs font-bold" style={{ color: textPrimary }}>SGK&apos;ya bildirildi</p>
                        <p className="text-[10px]" style={{ color: textFaint }}>6331 s. İSG Kanunu gereği 3 iş günü içinde</p>
                      </div>
                      <button
                        onClick={() => setForm(p => ({ ...p, sgkBildirildi: !p.sgkBildirildi }))}
                        className="relative flex-shrink-0 cursor-pointer transition-all"
                        style={{ width: 44, height: 24 }}>
                        <div className="absolute inset-0 rounded-full transition-all"
                          style={{ background: form.sgkBildirildi ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)' }} />
                        <div className="absolute top-0.5 rounded-full transition-all"
                          style={{
                            width: 20, height: 20,
                            background: '#fff',
                            left: form.sgkBildirildi ? 22 : 2,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                          }} />
                      </button>
                    </div>

                    {form.sgkBildirildi && (
                      <div className="space-y-3">
                        <div>
                          <label style={LABEL_STYLE}>Bildirim Tarihi</label>
                          <input type="date" value={form.sgkBildirimTarihi}
                            onChange={e => setForm(p => ({ ...p, sgkBildirimTarihi: e.target.value }))}
                            style={{ ...INPUT_STYLE, colorScheme }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                        </div>
                        <div>
                          <label style={LABEL_STYLE}>Bildirim Notu / Referans No</label>
                          <textarea value={form.sgkBildirimNotu} rows={3} maxLength={500}
                            placeholder="SGK referans numarası veya bildirim notu..."
                            onChange={e => setForm(p => ({ ...p, sgkBildirimNotu: e.target.value }))}
                            style={{ ...INPUT_STYLE, resize: 'none' }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Yasal bilgi kutusu */}
                  <div className="rounded-xl px-3.5 py-3"
                    style={{ background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.05)', border: '1.5px solid rgba(251,191,36,0.2)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
                      <i className="ri-scales-3-line" />6331 Sayılı İSG Kanunu
                    </p>
                    <p className="text-[10px] leading-relaxed" style={{ color: textFaint }}>
                      İş kazaları işveren tarafından kazanın gerçekleştiği tarihten itibaren
                      <strong style={{ color: textPrimary }}> en geç 3 iş günü içinde</strong> SGK&apos;ya bildirilmek zorundadır.
                      Meslek hastalıklarının bildirim süresi ise <strong style={{ color: textPrimary }}>3 iş günü</strong>dür.
                    </p>
                  </div>
                </div>
              )}

              {/* ── TAB: FOTOĞRAF / KANIT ── */}
              {activeTab === 'foto' && (
                <div className="space-y-3">
                  <div style={SECTION_STYLE}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex items-center gap-1.5" style={{ color: '#0ea5e9' }}>
                        <i className="ri-camera-line" />Fotoğraf &amp; Kanıt
                      </p>
                      <span className="text-[9px]" style={{ color: textFaint }}>Maks. 5 MB / dosya · JPG, PNG</span>
                    </div>

                    {/* Upload alanı */}
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all"
                      style={{
                        border: `2px dashed ${isDark ? 'rgba(14,165,233,0.25)' : 'rgba(14,165,233,0.3)'}`,
                        background: isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.03)',
                        padding: '20px 12px',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.03)'; }}>
                      <input type="file" multiple accept="image/jpeg,image/png"
                        className="hidden"
                        disabled={fotografYukleniyor}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (!files.length) return;
                          setFotografYukleniyor(true);
                          try {
                            const { uploadFileToStorage, getSignedUrl } = await import('@/utils/fileUpload');
                            const newPaths: string[] = [];
                            const newPreviews: string[] = [];
                            for (const file of files.slice(0, 10)) {
                              if (file.size > 5 * 1024 * 1024) continue;
                              const path = await uploadFileToStorage(file, form.firmaId || 'genel', 'is_kazasi_foto');
                              if (path) {
                                newPaths.push(path);
                                const url = await getSignedUrl(path);
                                if (url) newPreviews.push(url);
                              }
                            }
                            setForm(p => ({ ...p, fotografPaths: [...p.fotografPaths, ...newPaths] }));
                            setFotografOnizleme(p => [...p, ...newPreviews]);
                          } finally {
                            setFotografYukleniyor(false);
                            e.target.value = '';
                          }
                        }} />
                      {fotografYukleniyor ? (
                        <>
                          <i className="ri-loader-4-line animate-spin text-xl" style={{ color: '#0ea5e9' }} />
                          <span className="text-[11px] font-semibold" style={{ color: '#0ea5e9' }}>Yükleniyor...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                            <i className="ri-upload-cloud-2-line text-lg" style={{ color: '#0ea5e9' }} />
                          </div>
                          <span className="text-[11px] font-bold" style={{ color: '#0ea5e9' }}>Fotoğraf ekle</span>
                          <span className="text-[10px]" style={{ color: textFaint }}>Tıkla veya sürükle</span>
                        </>
                      )}
                    </label>

                    {/* Önizleme grid */}
                    {fotografOnizleme.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {fotografOnizleme.map((url, idx) => (
                          <div key={idx} className="relative rounded-xl overflow-hidden"
                            style={{ border: `1px solid ${border}`, aspectRatio: '1' }}>
                            <img src={url} alt={`Kanıt ${idx + 1}`}
                              className="w-full h-full object-cover" />
                            <button
                              onClick={() => {
                                setFotografOnizleme(p => p.filter((_, i) => i !== idx));
                                setForm(p => ({ ...p, fotografPaths: p.fotografPaths.filter((_, i) => i !== idx) }));
                              }}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                              style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}>
                              <i className="ri-close-line text-[10px]" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                              style={{ background: 'rgba(0,0,0,0.55)' }}>
                              <span className="text-[9px] font-bold text-white">Fotoğraf {idx + 1}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {form.fotografPaths.length === 0 && fotografOnizleme.length === 0 && (
                      <p className="text-[10px] text-center mt-2" style={{ color: textFaint }}>
                        Henüz fotoğraf eklenmedi
                      </p>
                    )}
                  </div>


                </div>
              )}

              {/* ── TAB: 5 NEDEN ANALİZİ ── */}
              {activeTab === 'analiz' && (
                <div className="space-y-3">
                  {/* Açıklama */}
                  <div className="rounded-xl px-3.5 py-3"
                    style={{ background: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.05)', border: '1.5px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-[10px] font-bold flex items-center gap-1.5 mb-1" style={{ color: '#10b981' }}>
                      <i className="ri-mind-map" />5 Neden Kök Neden Analizi
                    </p>
                    <p className="text-[10px] leading-relaxed" style={{ color: textFaint }}>
                      Kazanın temel nedenine ulaşmak için &quot;Neden oldu?&quot; sorusunu 5 kez sor.
                      Her cevap bir sonraki soruyu doğurur — köke ulaşınca önlem belirlenir.
                    </p>
                  </div>

                  {/* 5 Neden formu */}
                  <div style={SECTION_STYLE}>
                    <div className="space-y-3">
                      {form.besNeden.map((item, idx) => (
                        <div key={idx} className="rounded-xl p-3"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                            border: `1px solid ${item.neden ? 'rgba(16,185,129,0.25)' : border}`,
                          }}>
                          {/* Numara + başlık */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-extrabold"
                              style={{
                                background: item.neden ? 'rgba(16,185,129,0.15)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'),
                                color: item.neden ? '#10b981' : textMuted,
                                border: `1.5px solid ${item.neden ? 'rgba(16,185,129,0.35)' : border}`,
                              }}>
                              {idx + 1}
                            </div>
                            <span className="text-[10px] font-bold" style={{ color: item.neden ? textPrimary : textMuted }}>
                              {idx === 0 ? 'Neden kaza oldu?' : `Neden? (${idx + 1}. tekrar)`}
                            </span>
                            {idx > 0 && item.neden && (
                              <i className="ri-arrow-left-line text-[10px] ml-auto" style={{ color: 'rgba(16,185,129,0.5)' }} />
                            )}
                          </div>

                          <input
                            type="text"
                            value={item.neden}
                            placeholder={idx === 0 ? 'Kazanın ilk sebebi...' : `${idx + 1}. nedenin nedeni...`}
                            onChange={e => setForm(p => ({
                              ...p,
                              besNeden: p.besNeden.map((n, i) => i === idx ? { ...n, neden: e.target.value } : n),
                            }))}
                            style={INPUT_STYLE}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = item.neden ? 'rgba(16,185,129,0.25)' : inputBorder; }}
                          />

                          {/* Ek açıklama (isteğe bağlı) */}
                          {item.neden && (
                            <textarea
                              value={item.aciklama}
                              placeholder="Detay / kanıt (isteğe bağlı)..."
                              rows={1}
                              maxLength={300}
                              onChange={e => setForm(p => ({
                                ...p,
                                besNeden: p.besNeden.map((n, i) => i === idx ? { ...n, aciklama: e.target.value } : n),
                              }))}
                              style={{ ...INPUT_STYLE, resize: 'none', marginTop: 6, fontSize: 11 }}
                              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = inputBorder; }}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Kök neden özeti */}
                    {form.besNeden.some(n => n.neden) && (
                      <div className="mt-3 rounded-xl p-3"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.25)' }}>
                        <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: '#10b981' }}>
                          <i className="ri-focus-3-line mr-1.5" />Kök Neden Zinciri
                        </p>
                        <div className="flex items-start gap-1.5 flex-wrap">
                          {form.besNeden.filter(n => n.neden).map((n, i, arr) => (
                            <>
                              <span key={`chip-${n.sira}`} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                                {n.neden}
                              </span>
                              {i < arr.length - 1 && (
                                <i key={`arrow-${n.sira}`} className="ri-arrow-right-line text-[10px]" style={{ color: textFaint, marginTop: 3 }} />
                              )}
                            </>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB: GEÇMİŞ ── */}
              {activeTab === 'onceki' && (
                <div className="space-y-3">
                  {!form.personelId && (
                    <div className="rounded-xl p-10 flex flex-col items-center gap-3 text-center"
                      style={{ background: bgCard, border: `1px dashed ${border}` }}>
                      <i className="ri-user-search-line text-2xl" style={{ color: textFaint }} />
                      <p className="text-xs font-semibold" style={{ color: textMuted }}>Önce personel seçin</p>
                    </div>
                  )}
                  {form.personelId && loadingPast && (
                    <div className="flex items-center justify-center py-10 gap-2">
                      <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs" style={{ color: textMuted }}>Yükleniyor...</span>
                    </div>
                  )}
                  {form.personelId && !loadingPast && pastKazalar.length === 0 && (
                    <div className="rounded-xl p-10 flex flex-col items-center gap-3 text-center"
                      style={{ background: bgCard, border: `1px dashed ${border}` }}>
                      <i className="ri-checkbox-circle-line text-2xl" style={{ color: '#10b981' }} />
                      <p className="text-xs font-semibold" style={{ color: textMuted }}>Geçmişte kaza yok</p>
                    </div>
                  )}
                  {form.personelId && !loadingPast && pastKazalar.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
                          <i className="ri-history-line mr-1" />Kayıtlı Kaza Geçmişi
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                          {pastKazalar.length} kayıt
                        </span>
                      </div>
                      {pastKazalar.map(kaza => {
                        const sOpt = SIDDET_OPTIONS.find(s => s.label === kaza.yaralanma_siddeti) ?? SIDDET_OPTIONS[0];
                        const durumColors: Record<string, string> = { 'Açık': '#ef4444', 'Soruşturuluyor': '#fbbf24', 'Kapatıldı': '#10b981' };
                        const dc = durumColors[kaza.durum] ?? '#ef4444';
                        return (
                          <div key={kaza.id} className="rounded-xl p-3.5 space-y-2"
                            style={{ background: bgCard, border: `1px solid ${border}` }}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold" style={{ color: textPrimary }}>
                                <i className="ri-calendar-line mr-1.5" style={{ color: textFaint }} />
                                {kaza.kaza_tarihi ? new Date(kaza.kaza_tarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: sOpt.bg, color: sOpt.color, border: `1px solid ${sOpt.border}` }}>
                                  {kaza.yaralanma_siddeti}
                                </span>
                                <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: dc }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: dc }} />
                                  {kaza.durum}
                                </span>
                              </div>
                            </div>
                            {kaza.kaza_yeri && (
                              <p className="text-[10px] flex items-center gap-1" style={{ color: textMuted }}>
                                <i className="ri-map-pin-line flex-shrink-0" />{kaza.kaza_yeri}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderTop: `1px solid ${borderSubtle}`, background: isDark ? 'rgba(255,255,255,0.01)' : '#f8fafc' }}>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: textFaint }}>
                <i className="ri-information-line" />
                <span>* zorunlu alanlar</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onClose}
                  className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', color: textMuted, border: `1px solid ${border}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.35)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = border; (e.currentTarget as HTMLElement).style.color = textMuted; }}>
                  <i className="ri-close-line" />İptal
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="whitespace-nowrap flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white transition-all"
                  style={{
                    background: saving ? 'rgba(239,68,68,0.5)' : 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
                    opacity: saving ? 0.7 : 1,
                    boxShadow: saving ? 'none' : '0 0 16px rgba(239,68,68,0.25)',
                  }}>
                  {saving
                    ? <><i className="ri-loader-4-line animate-spin" />Kaydediliyor...</>
                    : <><i className={editData ? 'ri-save-3-line' : 'ri-add-circle-line'} />{editData ? 'Güncelle' : 'Kaydet'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
