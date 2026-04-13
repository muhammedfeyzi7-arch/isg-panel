import type { Uygunsuzluk, UygunsuzlukStatus } from '../../../types';

export function computeStatus(u: Pick<Uygunsuzluk, 'kapatmaFotoMevcut'>): UygunsuzlukStatus {
  return u.kapatmaFotoMevcut ? 'Kapandı' : 'Açık';
}

export const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  'Açık': {
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.20)',
    icon: 'ri-error-warning-line',
    label: 'Açık Uygunsuzluk',
  },
  'Kapandı': {
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.20)',
    icon: 'ri-checkbox-circle-line',
    label: 'Kapandı',
  },
  // Eski kayıtlarda farklı durum değerleri için fallback'ler
  'Kapatıldı': {
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.20)',
    icon: 'ri-checkbox-circle-line',
    label: 'Kapatıldı',
  },
  'Devam Ediyor': {
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.20)',
    icon: 'ri-time-line',
    label: 'Devam Ediyor',
  },
  'Beklemede': {
    color: '#64748B',
    bg: 'rgba(100,116,139,0.10)',
    border: 'rgba(100,116,139,0.20)',
    icon: 'ri-pause-circle-line',
    label: 'Beklemede',
  },
};

/** Güvenli STATUS_CONFIG erişimi — undefined döndürmez */
export const FALLBACK_STATUS = {
  color: '#94A3B8',
  bg: 'rgba(148,163,184,0.10)',
  border: 'rgba(148,163,184,0.20)',
  icon: 'ri-question-line',
  label: '—',
};

export const SEV_CONFIG: Record<string, { color: string; bg: string }> = {
  'Düşük':  { color: '#22C55E', bg: 'rgba(34,197,94,0.10)' },
  'Orta':   { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
  'Yüksek': { color: '#F97316', bg: 'rgba(249,115,22,0.10)' },
  'Kritik': { color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
};
