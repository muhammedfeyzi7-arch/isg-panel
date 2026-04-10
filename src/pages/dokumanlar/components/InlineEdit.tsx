import { useState, useRef, useEffect } from 'react';

interface InlineEditProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
}

export default function InlineEdit({ value, onChange, className = '', style = {}, multiline = false, placeholder = 'Düzenlemek için tıklayın...' }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      if (ref.current instanceof HTMLTextAreaElement) {
        ref.current.selectionStart = ref.current.value.length;
      }
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft.trim() || value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
  };

  if (editing) {
    const sharedProps = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      className: `w-full outline-none resize-none rounded-lg px-2 py-1 text-xs leading-relaxed ${className}`,
      style: {
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.35)',
        color: 'var(--text-primary)',
        minHeight: multiline ? '60px' : undefined,
        ...style,
      },
      placeholder,
    };

    return multiline
      ? <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} {...sharedProps} rows={3} />
      : <input ref={ref as React.RefObject<HTMLInputElement>} {...sharedProps} />;
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text rounded px-1 py-0.5 transition-all group relative inline-block w-full ${className}`}
      style={{
        ...style,
        borderBottom: '1px dashed transparent',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = 'rgba(99,102,241,0.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.04)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      title="Düzenlemek için tıklayın"
    >
      {value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{placeholder}</span>}
      <i className="ri-edit-line text-[9px] ml-1 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: '#818CF8' }} />
    </span>
  );
}
