import {
  ShieldCheck,
  Truck,
  MessageCircle,
  WalletCards,
  Upload,
  Settings2,
  PackageCheck,
  Palette,
  type LucideIcon,
} from "lucide-react";

export const LANDING_ICON_MAP: Record<string, LucideIcon> = {
  quality: ShieldCheck,
  delivery: Truck,
  support: MessageCircle,
  payment: WalletCards,
  upload: Upload,
  settings: Settings2,
  package: PackageCheck,
  palette: Palette,
};

export type LandingIconKey = keyof typeof LANDING_ICON_MAP;

export const ICON_KEYS = Object.keys(LANDING_ICON_MAP) as LandingIconKey[];

export const ICON_LABELS: Record<LandingIconKey, string> = {
  quality: "Qualidade",
  delivery: "Entrega",
  support: "Suporte",
  payment: "Pagamento",
  upload: "Upload",
  settings: "Configurações",
  package: "Pacote",
  palette: "Paleta",
};
