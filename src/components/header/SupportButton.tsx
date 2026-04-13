import { useSupportStore } from '@/store/useSupportStore';
import SupportModal from '@/components/feature/SupportModal';

interface SupportButtonProps {
  isDark: boolean;
  iconBtnBg: string;
  iconBtnBorder: string;
}

export default function SupportButton({ isDark, iconBtnBg, iconBtnBorder }: SupportButtonProps) {
  const { supportOpen, viewTicketId, openSupport, closeSupport } = useSupportStore();

  return (
    <>
      <button
        onClick={() => openSupport()}
        className="whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 cursor-pointer font-semibold transition-all duration-150"
        style={{
          padding: '6px 14px',
          fontSize: '12px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 2px 10px rgba(14,165,233,0.35)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(14,165,233,0.5)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(14,165,233,0.35)';
          (e.currentTarget as HTMLElement).style.transform = 'none';
        }}
        title="Destek"
      >
        <i className="ri-customer-service-2-line text-sm" />
        <span className="hidden lg:inline">Destek</span>
      </button>

      <SupportModal
        open={supportOpen}
        onClose={closeSupport}
        viewTicketId={viewTicketId}
      />
    </>
  );
}
