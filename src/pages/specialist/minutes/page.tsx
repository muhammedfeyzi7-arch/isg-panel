import PageHeader from '@/components/base/PageHeader';
import EmptyState from '@/components/base/EmptyState';

export default function SpecialistMinutesPage() {
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Tutanaklar"
        description="Saha denetim ve toplantı tutanakları"
        action={
          <button
            className="btn-primary flex items-center gap-2 cursor-pointer whitespace-nowrap"
            onClick={() => {}}
          >
            <i className="ri-add-line text-sm" />
            Tutanak Ekle
          </button>
        }
      />
      <div className="rounded-xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <EmptyState
          icon="ri-file-text-line"
          title="Henüz tutanak yok"
          description="Saha denetim ve toplantı tutanaklarınız burada listelenecek."
        />
      </div>
    </div>
  );
}
