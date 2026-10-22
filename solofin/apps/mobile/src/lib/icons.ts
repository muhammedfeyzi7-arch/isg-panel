import {
  BookOpen,
  Briefcase,
  Building2,
  Car,
  CircleDollarSign,
  Code,
  FileSignature,
  HandCoins,
  Laptop,
  Megaphone,
  PiggyBank,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wifi,
} from "lucide-react-native";
import type { ComponentType } from "react";

type Icon = ComponentType<{ size?: number; color?: string }>;

const MAP: Record<string, Icon> = {
  "Proje Geliri": Code,
  Danışmanlık: Briefcase,
  "Aylık Hizmet (Retainer)": HandCoins,
  "Lisans / Telif": FileSignature,
  "İçerik / Sponsorluk": Sparkles,
  "Diğer Gelir": CircleDollarSign,
  Ekipman: Laptop,
  "Yazılım / Abonelik": Code,
  "Ofis / Kira": Building2,
  İletişim: Wifi,
  "Ulaşım / Seyahat": Car,
  "Muhasebe / Hukuk": Receipt,
  Eğitim: BookOpen,
  Pazarlama: Megaphone,
  "Sosyal Güvenlik (Bağ-Kur)": ShieldCheck,
  Kişisel: ShoppingBag,
  "Diğer Gider": PiggyBank,
};

export function categoryIcon(category: string): Icon {
  return MAP[category] ?? CircleDollarSign;
}
