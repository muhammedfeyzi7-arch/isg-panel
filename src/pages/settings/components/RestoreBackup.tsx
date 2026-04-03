import { useState, useRef, useCallback } from 'react';
import { useApp } from '../../../store/AppContext';
import { supabase } from '../../../lib/supabase';

type RestoreMode = 'replace' | 'merge';

interface RestoreStep {
  table: string;
  label: string;
  count: number;
  done: boolean;
  error?: string;
}

interface ParsedBackup {
  firmalar: unknown[];
  personeller: unknown[];
  ekipmanlar: unknown[];
  evraklar: unknown[];
  egitimler: unknown[];
  muayeneler: unknown[];
  tutanaklar: unknown[];
}

const TABLE_ORDER: { key: keyof ParsedBackup; table: string; label: string }[] = [
  { key: 'firmalar',    table: 'firmalar',    label: 'Firmalar'    },
  { key: 'personeller', table: 'personeller', label: 'Personeller' },
  { key: 'ekipmanlar',  table: 'ekipmanlar',  label: 'Ekipmanlar'  },
  { key: 'evraklar',    table: 'evraklar',    label: 'Evraklar'    },
  { key: 'egitimler',   table: 'egitimler',   label: 'Eğitimler'   },
  { key: 'muayeneler',  table: 'muayeneler',  label: 'Muayeneler'  },
  { key: 'tutanaklar',  table: 'tutanaklar',  label: 'Tutanaklar'  },
];

const BATCH_SIZE = 50;

export default function RestoreBackup() {
  const { org, theme, addToast, logAction } = useApp();
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<RestoreMode>('replace');
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [steps, setSteps] = useState<RestoreStep[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);

  const nameColor = isDark ? '#E2E8F0' : '#0F172A';
  const subColor = isDark ? '#64748B' : '#94A3B8';
  const sectionTitleColor = isDark ? '#CBD5E1' : '#334155';

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.1)',
    borderRadius: '16px',
  };

  const inputStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(15,23,42,0.12)',
    borderRadius: '10px',
    color: isDark ? '#E2E8F0' : '#0F172A',
    outline: 'none',
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
  };

  const reset = useCallback(() => {
    setParsed(null);
    setFileName('');
    setParseError(null);
    setSteps([]);
    setDone(false);
    setShowConfirm(false);
    setCurrentStep(-1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setParsed(null);
    setDone(false);
    setSteps([]);
    setFileName(file.name);

    if (!file.name.endsWith('.zip')) {
      setParseError('Sadece .zip dosyası kabul edilir.');
      return;
    }

    try {
      const JSZip = (await import('jszip')).default;
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // ZIP içinde isg_veriler.json ara
      const jsonFile = zip.file('isg_veriler.json');
      if (!jsonFile) {
        setParseError('ZIP içinde "isg_veriler.json" bulunamadı. Geçerli bir ISG yedek dosyası yükleyin.');
        return;
      }

      const jsonText = await jsonFile.async('string');
      if (!jsonText || jsonText.trim().length === 0) {
        setParseError('Yedek dosyası boş veya okunamıyor.');
        return;
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(jsonText);
      } catch {
        setParseError('JSON formatı geçersiz. Dosya bozulmuş olabilir.');
        return;
      }

      // Validate structure
      const backup: ParsedBackup = {
        firmalar:    Array.isArray(data.firmalar)    ? data.firmalar    : [],
        personeller: Array.isArray(data.personeller) ? data.personeller : [],
        ekipmanlar:  Array.isArray(data.ekipmanlar)  ? data.ekipmanlar  : [],
        evraklar:    Array.isArray(data.evraklar)    ? data.evraklar    : [],
        egitimler:   Array.isArray(data.egitimler)   ? data.egitimler   : [],
        muayeneler:  Array.isArray(data.muayeneler)  ? data.muayeneler  : [],
        tutanaklar:  Array.isArray(data.tutanaklar)  ? data.tutanaklar  : [],
      };

      const totalRecords = Object.values(backup).reduce((s, arr) => s + arr.length, 0);
      if (totalRecords === 0) {
        setParseError('Yedek dosyasında hiç kayıt bulunamadı.');
        return;
      }

      setParsed(backup);
    } catch (err) {
      setParseError('Dosya okunurken hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  }, []);

  const handleRestore = useCallback(async () => {
    if (!parsed || !org?.id) return;
    setShowConfirm(false);
    setRestoring(true);
    setDone(false);

    const orgId = org.id;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      addToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
      setRestoring(false);
      return;
    }

    // Initialize steps
    const initialSteps: RestoreStep[] = TABLE_ORDER.map(({ key, label }) => ({
      table: key,
      label,
      count: parsed[key].length,
      done: false,
    }));
    setSteps(initialSteps);

    try {
      // Step 1: If replace mode, delete existing data for this org
      if (mode === 'replace') {
        for (let i = 0; i < TABLE_ORDER.length; i++) {
          const { table } = TABLE_ORDER[i];
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('organization_id', orgId);
          if (error) {
            console.error(`[RESTORE] Delete error for ${table}:`, error);
            // Non-fatal: continue
          }
        }
      }

      // Step 2: Insert data in order
      for (let i = 0; i < TABLE_ORDER.length; i++) {
        const { key, table } = TABLE_ORDER[i];
        setCurrentStep(i);

        const records = parsed[key];
        if (records.length === 0) {
          setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s));
          continue;
        }

        // Build upsert payloads — FORCE organization_id to current org
        const payloads = records.map((record) => {
          const rec = record as Record<string, unknown>;
          // Strip any incoming organization_id — use current org only
          const { organization_id: _stripped, ...cleanRec } = rec as { organization_id?: unknown } & Record<string, unknown>;
          void _stripped;

          // Ensure record has an id
          const id = (cleanRec.id as string) || crypto.randomUUID();

          return {
            id,
            user_id: userId,
            organization_id: orgId,  // ALWAYS current org — never from backup
            data: { ...cleanRec, id },
            updated_at: new Date().toISOString(),
          };
        });

        // Batch insert
        let hasError = false;
        for (let b = 0; b < payloads.length; b += BATCH_SIZE) {
          const batch = payloads.slice(b, b + BATCH_SIZE);
          const { error } = await supabase.from(table).upsert(batch);
          if (error) {
            console.error(`[RESTORE] Upsert error for ${table} batch ${b}:`, error);
            setSteps(prev => prev.map((s, idx) =>
              idx === i ? { ...s, done: true, error: error.message } : s,
            ));
            hasError = true;
            break;
          }
        }

        if (!hasError) {
          setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s));
        }
      }

      setDone(true);
      setCurrentStep(-1);

      // Log activity
      logAction(
        'backup_restored',
        'Ayarlar',
        orgId,
        fileName,
        `${totalRecords} kayıt içeren yedek geri yüklendi. Mod: ${mode === 'replace' ? 'Sil ve Yükle' : 'Birleştir'}`
      );

      addToast('Yedek başarıyla geri yüklendi! Sayfa yenilenecek...', 'success');

      // Reload page after 2s to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('[RESTORE] Fatal error:', err);
      addToast('Geri yükleme sırasında hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'), 'error');
    } finally {
      setRestoring(false);
    }
  }, [parsed, org?.id, mode, addToast, logAction, fileName]);

  const totalRecords = parsed
    ? Object.values(parsed).reduce((s, arr) => s + arr.length, 0)
    : 0;

  const completedSteps = steps.filter(s => s.done).length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  return (
    <>
      <div style={cardStyle} className="p-6 space-y-5">
        {/* Header */}
        <div
          className="flex items-center gap-3 pb-4"
          style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)' }}
        >
          <div
            className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)' }}
          >
            <i className="ri-upload-cloud-2-line text-base" style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: sectionTitleColor }}>Yedekten Geri Yükle</h4>
            <p className="text-xs mt-0.5" style={{ color: subColor }}>ZIP yedek dosyasını yükleyerek verilerinizi geri getirin</p>
          </div>
        </div>

        {/* Warning */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <i className="ri-alert-line text-sm flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#F59E0B' }}>
            <strong>Dikkat:</strong> Bu işlem mevcut verilerin üzerine yazabilir. Devam etmeden önce güncel bir yedek aldığınızdan emin olun.
          </p>
        </div>

        {/* File Upload */}
        {!restoring && !done && (
          <div className="space-y-4">
            {/* File picker */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: isDark ? '#94A3B8' : '#475569' }}>
                ZIP Yedek Dosyası
              </label>
              <div
                className="relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                  border: isDark ? '2px dashed rgba(255,255,255,0.1)' : '2px dashed rgba(15,23,42,0.15)',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: fileName ? 'rgba(245,158,11,0.1)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}
                >
                  <i
                    className={`${fileName ? 'ri-file-zip-line' : 'ri-upload-2-line'} text-base`}
                    style={{ color: fileName ? '#F59E0B' : subColor }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {fileName ? (
                    <>
                      <p className="text-sm font-semibold truncate" style={{ color: nameColor }}>{fileName}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#F59E0B' }}>
                        {totalRecords} kayıt bulundu
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium" style={{ color: nameColor }}>Dosya seçmek için tıklayın</p>
                      <p className="text-xs mt-0.5" style={{ color: subColor }}>Sadece .zip formatı kabul edilir</p>
                    </>
                  )}
                </div>
                {fileName && (
                  <button
                    onClick={e => { e.stopPropagation(); reset(); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 cursor-pointer"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', color: subColor }}
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Parse error */}
            {parseError && (
              <div
                className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171' }}
              >
                <i className="ri-error-warning-line flex-shrink-0 mt-0.5" />
                {parseError}
              </div>
            )}

            {/* Parsed summary */}
            {parsed && (
              <div className="space-y-3">
                <p className="text-xs font-semibold" style={{ color: sectionTitleColor }}>Yedek İçeriği</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TABLE_ORDER.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex flex-col items-center p-2.5 rounded-xl"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)',
                        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15,23,42,0.07)',
                      }}
                    >
                      <p className="text-base font-bold" style={{ color: nameColor }}>{parsed[key].length}</p>
                      <p className="text-[10px] mt-0.5 text-center" style={{ color: subColor }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode selector */}
            {parsed && (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: sectionTitleColor }}>Yükleme Modu</p>
                <div className="space-y-2">
                  {[
                    {
                      value: 'replace' as RestoreMode,
                      icon: 'ri-refresh-line',
                      title: 'Mevcut verileri sil ve yedekten yükle',
                      desc: 'Tüm mevcut veriler silinir, yedekteki veriler yüklenir',
                      color: '#EF4444',
                      bg: 'rgba(239,68,68,0.08)',
                      border: 'rgba(239,68,68,0.2)',
                    },
                    {
                      value: 'merge' as RestoreMode,
                      icon: 'ri-merge-cells-horizontal',
                      title: 'Mevcut veriye ekle (birleştir)',
                      desc: 'Mevcut veriler korunur, yedekteki kayıtlar eklenir',
                      color: '#10B981',
                      bg: 'rgba(16,185,129,0.08)',
                      border: 'rgba(16,185,129,0.2)',
                    },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      onClick={() => setMode(opt.value)}
                      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: mode === opt.value ? opt.bg : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                        border: `1px solid ${mode === opt.value ? opt.border : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'}`,
                      }}
                    >
                      <div
                        className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                        style={{ background: mode === opt.value ? opt.bg : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}
                      >
                        <i className={`${opt.icon} text-sm`} style={{ color: mode === opt.value ? opt.color : subColor }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: mode === opt.value ? opt.color : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)',
                              background: mode === opt.value ? opt.color : 'transparent',
                            }}
                          >
                            {mode === opt.value && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>
                          <p className="text-xs font-semibold" style={{ color: mode === opt.value ? opt.color : nameColor }}>
                            {opt.title}
                          </p>
                        </div>
                        <p className="text-[11px] mt-1 ml-5" style={{ color: subColor }}>{opt.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action button */}
            {parsed && (
              <div className="pt-1">
                <button
                  onClick={() => setShowConfirm(true)}
                  className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all"
                  style={{
                    background: mode === 'replace'
                      ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                      : 'linear-gradient(135deg, #10B981, #059669)',
                    boxShadow: mode === 'replace'
                      ? '0 4px 12px rgba(239,68,68,0.3)'
                      : '0 4px 12px rgba(16,185,129,0.3)',
                  }}
                >
                  <i className="ri-upload-cloud-2-line" />
                  Geri Yüklemeyi Başlat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {(restoring || done) && steps.length > 0 && (
          <div className="space-y-4">
            {/* Overall progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: sectionTitleColor }}>
                  {done ? 'Geri yükleme tamamlandı!' : 'Geri yükleniyor...'}
                </p>
                <p className="text-xs font-bold" style={{ color: done ? '#10B981' : '#F59E0B' }}>
                  {progress}%
                </p>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: done
                      ? 'linear-gradient(90deg, #10B981, #059669)'
                      : 'linear-gradient(90deg, #F59E0B, #EA580C)',
                  }}
                />
              </div>
            </div>

            {/* Step list */}
            <div className="space-y-1.5">
              {steps.map((step, idx) => (
                <div
                  key={step.table}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{
                    background: step.done
                      ? step.error
                        ? 'rgba(239,68,68,0.06)'
                        : 'rgba(16,185,129,0.06)'
                      : idx === currentStep
                      ? isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)'
                      : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
                    border: `1px solid ${
                      step.done
                        ? step.error ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'
                        : idx === currentStep
                        ? 'rgba(245,158,11,0.2)'
                        : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'
                    }`,
                  }}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {step.done ? (
                      step.error ? (
                        <i className="ri-close-circle-line text-sm" style={{ color: '#EF4444' }} />
                      ) : (
                        <i className="ri-checkbox-circle-line text-sm" style={{ color: '#10B981' }} />
                      )
                    ) : idx === currentStep ? (
                      <i className="ri-loader-4-line animate-spin text-sm" style={{ color: '#F59E0B' }} />
                    ) : (
                      <i className="ri-time-line text-sm" style={{ color: subColor }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{
                      color: step.done
                        ? step.error ? '#EF4444' : '#10B981'
                        : idx === currentStep ? '#F59E0B' : subColor,
                    }}>
                      {step.label}
                    </p>
                    {step.error && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: '#F87171' }}>{step.error}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-medium flex-shrink-0" style={{ color: subColor }}>
                    {step.count} kayıt
                  </span>
                </div>
              ))}
            </div>

            {done && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                <i className="ri-checkbox-circle-line text-base flex-shrink-0" style={{ color: '#10B981' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#10B981' }}>Yedek başarıyla geri yüklendi!</p>
                  <p className="text-xs mt-0.5" style={{ color: subColor }}>Sayfa yenileniyor...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{
              background: isDark ? '#0D1526' : '#fff',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15,23,42,0.15)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <i className="ri-alert-line text-lg" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: nameColor }}>Geri Yüklemeyi Onayla</h3>
                <p className="text-xs mt-0.5" style={{ color: subColor }}>Bu işlem geri alınamaz</p>
              </div>
            </div>

            <div
              className="px-4 py-3 rounded-xl space-y-2"
              style={{ background: isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <p className="text-sm" style={{ color: nameColor }}>
                <strong>{totalRecords}</strong> kayıt geri yüklenecek.
              </p>
              {mode === 'replace' && (
                <p className="text-xs" style={{ color: '#F87171' }}>
                  <i className="ri-error-warning-line mr-1" />
                  Mevcut tüm veriler silinecek ve yerine yedekteki veriler yüklenecek.
                </p>
              )}
              {mode === 'merge' && (
                <p className="text-xs" style={{ color: '#10B981' }}>
                  <i className="ri-information-line mr-1" />
                  Mevcut veriler korunacak, yedekteki kayıtlar eklenecek.
                </p>
              )}
              <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                <i className="ri-shield-check-line mr-1" />
                Tüm veriler yalnızca kendi organizasyonunuza yüklenecek.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 whitespace-nowrap py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.1)',
                  color: subColor,
                }}
              >
                İptal
              </button>
              <button
                onClick={handleRestore}
                className="flex-1 whitespace-nowrap flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{
                  background: mode === 'replace'
                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                    : 'linear-gradient(135deg, #10B981, #059669)',
                }}
              >
                <i className="ri-upload-cloud-2-line" />
                Evet, Geri Yükle
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
