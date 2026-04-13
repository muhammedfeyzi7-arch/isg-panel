import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  id: string;
  type: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  module: string;
}

interface SearchData {
  firmalar: { id: string; ad: string; yetkiliKisi: string; tehlikeSinifi: string }[];
  personeller: { id: string; adSoyad: string; gorev: string; firmaId: string }[];
  evraklar: { id: string; ad: string; tur: string; firmaId: string }[];
  tutanaklar: { id: string; baslik: string; tutanakNo: string; firmaId: string }[];
}

interface SearchBoxProps {
  data: SearchData;
  isDark: boolean;
  inputBg: string;
  inputBorder: string;
  dropdownBg: string;
  dropdownBorder: string;
  dropdownItemHover: string;
  onNavigate: (module: string) => void;
}

export default function SearchBox({
  data,
  isDark,
  inputBg,
  inputBorder,
  dropdownBg,
  dropdownBorder,
  dropdownItemHover,
  onNavigate,
}: SearchBoxProps) {
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const query = q.toLowerCase();
    const results: SearchResult[] = [];

    data.firmalar
      .filter(f => f.ad.toLowerCase().includes(query) || f.yetkiliKisi.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach(f =>
        results.push({ id: f.id, type: 'Firma', label: f.ad, sub: f.yetkiliKisi || f.tehlikeSinifi, icon: 'ri-building-2-line', color: '#3B82F6', module: 'firmalar' })
      );

    data.personeller
      .filter(p => p.adSoyad.toLowerCase().includes(query) || p.gorev.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach(p => {
        const firma = data.firmalar.find(f => f.id === p.firmaId);
        results.push({ id: p.id, type: 'Personel', label: p.adSoyad, sub: `${p.gorev || '—'} · ${firma?.ad || '—'}`, icon: 'ri-user-line', color: '#10B981', module: 'personeller' });
      });

    data.evraklar
      .filter(e => e.ad.toLowerCase().includes(query) || e.tur.toLowerCase().includes(query))
      .slice(0, 2)
      .forEach(e => {
        const firma = data.firmalar.find(f => f.id === e.firmaId);
        results.push({ id: e.id, type: 'Evrak', label: e.ad, sub: `${e.tur} · ${firma?.ad || '—'}`, icon: 'ri-file-text-line', color: '#F59E0B', module: 'evraklar' });
      });

    data.tutanaklar
      .filter(t => t.baslik.toLowerCase().includes(query) || t.tutanakNo.toLowerCase().includes(query))
      .slice(0, 2)
      .forEach(t => {
        const firma = data.firmalar.find(f => f.id === t.firmaId);
        results.push({ id: t.id, type: 'Tutanak', label: t.baslik, sub: `${t.tutanakNo} · ${firma?.ad || '—'}`, icon: 'ri-article-line', color: '#14B8A6', module: 'tutanaklar' });
      });

    setSearchResults(results.slice(0, 8));
  }, [data]);

  useEffect(() => { runSearch(search); }, [search, runSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocus(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = searchFocus && (searchResults.length > 0 || search.trim().length > 0);

  return (
    <div className="relative hidden md:flex items-center flex-shrink-0" ref={searchRef}>
      <i className="ri-search-line absolute left-2.5 text-[11px] z-10" style={{ color: '#475569' }} />
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={e => {
          setSearchFocus(true);
          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(59,130,246,0.04)';
          e.currentTarget.style.borderColor = '#3b82f6';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)';
          e.currentTarget.style.width = '200px';
        }}
        onBlur={e => {
          e.currentTarget.style.background = inputBg;
          e.currentTarget.style.borderColor = inputBorder;
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.width = '';
        }}
        placeholder="Ara..."
        className="w-36 pl-7 pr-2.5 py-1.5 text-[11.5px] rounded-lg outline-none transition-all duration-200"
        style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: isDark ? '#e5e7eb' : '#334155' }}
      />

      {showDropdown && (
        <div
          className="absolute right-0 top-11 w-80 py-1 z-50 animate-slide-up"
          style={{
            background: dropdownBg,
            border: `1px solid ${dropdownBorder}`,
            borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {searchResults.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <i className="ri-search-line text-2xl" style={{ color: '#475569' }} />
              <p className="text-sm mt-2" style={{ color: '#64748B' }}>Sonuç bulunamadı</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2" style={{ borderBottom: `1px solid ${dropdownBorder}` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
                  {searchResults.length} sonuç
                </p>
              </div>
              {searchResults.map(result => (
                <button
                  key={result.id}
                  onClick={() => { onNavigate(result.module); setSearch(''); setSearchFocus(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-150 text-left"
                  onMouseEnter={e => { e.currentTarget.style.background = dropdownItemHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div
                    className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ background: `${result.color}18` }}
                  >
                    <i className={`${result.icon} text-xs`} style={{ color: result.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${result.color}18`, color: result.color }}
                    >
                      {result.type}
                    </span>
                    <p className="text-[12.5px] font-medium truncate mt-0.5" style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>
                      {result.label}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{result.sub}</p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
