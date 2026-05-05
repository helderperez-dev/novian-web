import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  Building2,
  CarFront,
  DoorOpen,
  Flag,
  Hash,
  HelpCircle,
  Landmark,
  Mail,
  Map,
  MapPin,
  MapPinned,
  Ruler,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

export const PROPERTY_FIELD_ICON_OPTIONS = [
  { value: "building-2", label: "Building" },
  { value: "ruler", label: "Ruler" },
  { value: "bed-double", label: "Bed" },
  { value: "car-front", label: "Car" },
  { value: "map", label: "Map" },
  { value: "hash", label: "Hash" },
  { value: "door-open", label: "Door" },
  { value: "map-pinned", label: "Pin Area" },
  { value: "map-pin", label: "Pin" },
  { value: "landmark", label: "Landmark" },
  { value: "mail", label: "Mail" },
  { value: "flag", label: "Flag" },
  { value: "sliders-horizontal", label: "Features" },
  { value: "sparkles", label: "Sparkles" },
] as const;

const PROPERTY_FIELD_ICON_MAP: Record<string, LucideIcon> = {
  "building-2": Building2,
  ruler: Ruler,
  "bed-double": BedDouble,
  "car-front": CarFront,
  map: Map,
  hash: Hash,
  "door-open": DoorOpen,
  "map-pinned": MapPinned,
  "map-pin": MapPin,
  landmark: Landmark,
  mail: Mail,
  flag: Flag,
  "sliders-horizontal": SlidersHorizontal,
  sparkles: Sparkles,
};

export function getPropertyFieldIcon(iconName?: string | null) {
  if (!iconName) {
    return HelpCircle;
  }

  return PROPERTY_FIELD_ICON_MAP[iconName] || HelpCircle;
}
