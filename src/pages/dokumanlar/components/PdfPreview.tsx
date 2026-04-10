import { forwardRef } from 'react';

interface Section {
  baslik: string;
  icerik: string[];
}

interface PdfPreviewProps {
  title: string;
  subtitle?: string;
  ozet?: string;
  sections: Section[];
  meta?: { label: string; value: string }[];
  accentColor?: string;
}

const PdfPreview = forwardRef<HTMLDivElement, PdfPreviewProps>(
  ({ title, subtitle, ozet, sections, meta = [], accentColor = '#1e293b' }, ref) => {
    const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
      <div
        ref={ref}
        id="pdf-preview-content"
        style={{
          background: '#ffffff',
          color: '#1e293b',
          fontFamily: 'Arial, sans-serif',
          padding: '40px 48px',
          minWidth: '700px',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: `3px solid ${accentColor}`, paddingBottom: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: accentColor, margin: 0, lineHeight: 1.2 }}>{title}</h1>
              {subtitle && <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', margin: '4px 0 0' }}>{subtitle}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Oluşturma Tarihi</p>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: '2px 0 0' }}>{today}</p>
            </div>
          </div>

          {/* Meta bilgiler */}
          {meta.length > 0 && (
            <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
              {meta.map((m, i) => (
                <div key={i}>
                  <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '2px 0 0' }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Özet */}
        {ozet && (
          <div style={{ background: '#f8fafc', border: `1px solid #e2e8f0`, borderLeft: `4px solid ${accentColor}`, borderRadius: '6px', padding: '14px 16px', marginBottom: '24px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>ÖZET</p>
            <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, margin: 0 }}>{ozet}</p>
          </div>
        )}

        {/* Bölümler */}
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{si + 1}</span>
              </div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{section.baslik}</h2>
            </div>
            <div style={{ paddingLeft: '32px' }}>
              {section.icerik.map((item, ii) => (
                <div key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: accentColor, marginTop: '6px', flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6, margin: 0 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '32px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Bu belge ISG Denetim Yönetim Sistemi tarafından oluşturulmuştur.</p>
          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>{today}</p>
        </div>
      </div>
    );
  }
);

PdfPreview.displayName = 'PdfPreview';
export default PdfPreview;
