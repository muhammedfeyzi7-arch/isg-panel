import PremiumLoadingScreen from './PremiumLoadingScreen';

const STEPS = [
  { label: 'Bağlantı kuruluyor...', icon: 'ri-wifi-line', duration: 600 },
  { label: 'Organizasyon yükleniyor...', icon: 'ri-building-2-line', duration: 700 },
  { label: 'Veriler hazırlanıyor...', icon: 'ri-database-2-line', duration: 900 },
  { label: 'Hazır!', icon: 'ri-check-double-line', duration: 400 },
];

interface AppLoadingScreenProps {
  onDone?: () => void;
}

export default function AppLoadingScreen({ onDone }: AppLoadingScreenProps) {
  return (
    <PremiumLoadingScreen
      panelName="ISG Denetim"
      panelSubtitle="Yönetim Paneli"
      steps={STEPS}
      onDone={onDone}
    />
  );
}
