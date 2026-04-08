import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width, height, borderRadius = '8px', className = '', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            height: '12px',
            borderRadius: '6px',
            width: i === lines - 1 && lines > 1 ? '65%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="skeleton-shimmer w-10 h-10 rounded-xl" />
        <div className="skeleton-shimmer w-16 h-5 rounded-full" />
      </div>
      <div className="skeleton-shimmer w-16 h-8 rounded-lg mb-2" />
      <div className="skeleton-shimmer w-28 h-3.5 rounded-md" />
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: 'var(--bg-item)', border: '1px solid var(--bg-item-border)' }}
    >
      <div className="skeleton-shimmer w-7 h-7 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton-shimmer h-3 rounded-md" style={{ width: '55%' }} />
        <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: '35%' }} />
      </div>
      <div className="skeleton-shimmer w-10 h-5 rounded-full" />
    </div>
  );
}

export function SkeletonCard({ height = 200 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', height }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="skeleton-shimmer w-1 h-5 rounded-full" />
        <div className="skeleton-shimmer w-32 h-4 rounded-md" />
      </div>
      <div className="space-y-2.5">
        <div className="skeleton-shimmer h-3 rounded-md w-full" />
        <div className="skeleton-shimmer h-3 rounded-md" style={{ width: '80%' }} />
        <div className="skeleton-shimmer h-3 rounded-md" style={{ width: '60%' }} />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="space-y-2">
          <div className="skeleton-shimmer w-44 h-6 rounded-lg" />
          <div className="skeleton-shimmer w-56 h-3.5 rounded-md" />
        </div>
        <div className="skeleton-shimmer w-24 h-7 rounded-full" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard height={220} />
        <div className="lg:col-span-2">
          <SkeletonCard height={220} />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SkeletonCard height={260} />
        </div>
        <SkeletonCard height={260} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="skeleton-shimmer w-1 h-5 rounded-full" />
            <div className="skeleton-shimmer w-36 h-4 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonListItem key={i} />)}
          </div>
        </div>
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="skeleton-shimmer w-1 h-5 rounded-full" />
            <div className="skeleton-shimmer w-36 h-4 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonListItem key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Personel listesi tablo skeleton — masaüstü + mobil
 */
export function PersonelListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer w-36 h-6 rounded-lg" />
          <div className="skeleton-shimmer w-52 h-3.5 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer w-20 h-9 rounded-lg hidden sm:block" />
          <div className="skeleton-shimmer w-28 h-9 rounded-lg hidden sm:block" />
          <div className="skeleton-shimmer w-32 h-9 rounded-lg" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl p-3 flex gap-2.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="skeleton-shimmer flex-1 h-9 rounded-lg" />
        <div className="skeleton-shimmer w-36 h-9 rounded-lg hidden sm:block" />
        <div className="skeleton-shimmer w-32 h-9 rounded-lg hidden sm:block" />
      </div>

      {/* Desktop table */}
      <div className="rounded-xl overflow-hidden hidden md:block"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="px-4 py-3 border-b flex gap-6"
          style={{ borderColor: 'var(--border-main)' }}>
          {[100, 80, 90, 70, 60].map((w, i) => (
            <div key={i} className="skeleton-shimmer h-3 rounded-md" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
            style={{ borderColor: 'var(--border-main)' }}>
            <div className="skeleton-shimmer w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${110 + (i % 4) * 25}px` }} />
              <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: `${60 + (i % 3) * 15}px` }} />
            </div>
            <div className="skeleton-shimmer w-28 h-3 rounded-md hidden md:block" />
            <div className="skeleton-shimmer w-24 h-3 rounded-md hidden lg:block" />
            <div className="skeleton-shimmer w-16 h-5 rounded-full" />
            <div className="flex gap-1.5">
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div key={i} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${120 + (i % 3) * 20}px` }} />
                <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: '80px' }} />
              </div>
              <div className="skeleton-shimmer w-14 h-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Firma listesi tablo skeleton
 */
export function FirmaListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer w-28 h-6 rounded-lg" />
          <div className="skeleton-shimmer w-48 h-3.5 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer w-20 h-9 rounded-lg hidden sm:block" />
          <div className="skeleton-shimmer w-36 h-9 rounded-lg" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl p-3 flex gap-2.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="skeleton-shimmer flex-1 h-9 rounded-lg" />
        <div className="skeleton-shimmer w-36 h-9 rounded-lg hidden sm:block" />
        <div className="skeleton-shimmer w-40 h-9 rounded-lg hidden sm:block" />
      </div>

      {/* Desktop table */}
      <div className="rounded-xl overflow-hidden hidden md:block"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="px-4 py-3 border-b flex gap-6"
          style={{ borderColor: 'var(--border-main)' }}>
          {[110, 90, 80, 90, 70, 60].map((w, i) => (
            <div key={i} className="skeleton-shimmer h-3 rounded-md" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
            style={{ borderColor: 'var(--border-main)' }}>
            <div className="skeleton-shimmer w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${100 + (i % 3) * 30}px` }} />
              <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: `${50 + (i % 2) * 15}px` }} />
            </div>
            <div className="skeleton-shimmer w-24 h-3 rounded-md hidden md:block" />
            <div className="skeleton-shimmer w-20 h-3 rounded-md hidden lg:block" />
            <div className="skeleton-shimmer w-20 h-5 rounded-full hidden md:block" />
            <div className="skeleton-shimmer w-16 h-5 rounded-full" />
            <div className="flex gap-1.5">
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div key={i} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${100 + (i % 3) * 25}px` }} />
                <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: '70px' }} />
              </div>
              <div className="skeleton-shimmer w-14 h-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Evrak / Belge listesi skeleton
 */
export function EvrakListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer w-40 h-6 rounded-lg" />
          <div className="skeleton-shimmer w-60 h-3.5 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-shimmer w-20 h-9 rounded-lg hidden sm:block" />
          <div className="skeleton-shimmer w-28 h-9 rounded-lg" />
          <div className="skeleton-shimmer w-28 h-9 rounded-lg" />
        </div>
      </div>

      {/* Status stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-3.5 flex items-center gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
            <div className="skeleton-shimmer w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="skeleton-shimmer w-8 h-6 rounded-md" />
              <div className="skeleton-shimmer w-20 h-2.5 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl p-3 flex gap-2.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="skeleton-shimmer flex-1 h-9 rounded-lg" />
        <div className="skeleton-shimmer w-36 h-9 rounded-lg hidden sm:block" />
        <div className="skeleton-shimmer w-36 h-9 rounded-lg hidden sm:block" />
      </div>

      {/* Desktop table */}
      <div className="rounded-xl overflow-hidden hidden md:block"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="px-4 py-3 border-b flex gap-6"
          style={{ borderColor: 'var(--border-main)' }}>
          {[120, 90, 80, 70, 80, 60].map((w, i) => (
            <div key={i} className="skeleton-shimmer h-3 rounded-md" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
            style={{ borderColor: 'var(--border-main)' }}>
            <div className="skeleton-shimmer w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${120 + (i % 4) * 20}px` }} />
              <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: `${55 + (i % 3) * 12}px` }} />
            </div>
            <div className="skeleton-shimmer w-24 h-3 rounded-md hidden md:block" />
            <div className="skeleton-shimmer w-20 h-3 rounded-md hidden lg:block" />
            <div className="skeleton-shimmer w-20 h-5 rounded-full" />
            <div className="skeleton-shimmer w-20 h-3 rounded-md hidden lg:block" />
            <div className="flex gap-1.5">
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div key={i} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-9 h-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${110 + (i % 3) * 20}px` }} />
                <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: '90px' }} />
              </div>
              <div className="skeleton-shimmer w-16 h-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton-shimmer w-48 h-7 rounded-lg" />
          <div className="skeleton-shimmer w-64 h-3.5 rounded-md" />
        </div>
        <div className="skeleton-shimmer w-32 h-9 rounded-lg" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
            <div className="skeleton-shimmer w-11 h-11 rounded-xl flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="skeleton-shimmer h-6 w-10 rounded-md" />
              <div className="skeleton-shimmer h-3 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl p-4 flex gap-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="skeleton-shimmer flex-1 h-9 rounded-lg" />
        <div className="skeleton-shimmer w-40 h-9 rounded-lg" />
        <div className="skeleton-shimmer w-36 h-9 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-main)' }}>
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${[120, 80, 100, 90, 70][i]}px` }} />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0"
            style={{ borderColor: 'var(--border-main)' }}>
            <div className="skeleton-shimmer w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton-shimmer h-3.5 rounded-md" style={{ width: `${140 + (i % 3) * 30}px` }} />
              <div className="skeleton-shimmer h-2.5 rounded-md" style={{ width: `${80 + (i % 2) * 20}px` }} />
            </div>
            <div className="skeleton-shimmer w-20 h-6 rounded-full" />
            <div className="skeleton-shimmer w-24 h-3.5 rounded-md" />
            <div className="flex gap-2">
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
