import PremiumLoadingScreen from '@/components/feature/PremiumLoadingScreen';

const OSGB_STEPS = [
  { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 500 },
  { label: 'OSGB bilgileri yükleniyor...', icon: 'ri-building-3-line', duration: 700 },
  { label: 'Firmalar hazırlanıyor...', icon: 'ri-community-line', duration: 700 },
  { label: 'Uzman verileri alınıyor...', icon: 'ri-user-star-line', duration: 600 },
  { label: 'Hazır!', icon: 'ri-check-double-line', duration: 300 },
];

interface OsgbLoadingScreenProps {
  onDone: () => void;
  isDark?: boolean;
}

export default function OsgbLoadingScreen({ onDone, isDark = false }: OsgbLoadingScreenProps) {
  return (
    <PremiumLoadingScreen
      isDark={isDark}
      panelName="ISG Denetim"
      panelSubtitle="OSGB Yönetim Paneli"
      steps={OSGB_STEPS}
      onDone={onDone}
    />
  );
}
