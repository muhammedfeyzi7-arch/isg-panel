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
import type { TileColor } from "@/theme";

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

const TILE: Record<string, TileColor> = {
  "Proje Geliri": "green",
  Danışmanlık: "teal",
  "Aylık Hizmet (Retainer)": "green",
  "Lisans / Telif": "teal",
  "İçerik / Sponsorluk": "violet",
  "Diğer Gelir": "green",
  Ekipman: "blue",
  "Yazılım / Abonelik": "violet",
  "Ofis / Kira": "amber",
  İletişim: "teal",
  "Ulaşım / Seyahat": "blue",
  "Muhasebe / Hukuk": "slate",
  Eğitim: "amber",
  Pazarlama: "rose",
  "Sosyal Güvenlik (Bağ-Kur)": "slate",
  Kişisel: "rose",
};

/** Kategori karosunun rengi (kimlik; durum/önem anlamı taşımaz) */
export function categoryTile(category: string): TileColor {
  return TILE[category] ?? "slate";
}
