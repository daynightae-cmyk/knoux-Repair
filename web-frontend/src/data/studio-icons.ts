/**
 * KNOUX Repair — Studio Icon Registry
 *
 * One shared icon map for the whole application. The studio shell, the
 * navigation spine, the command palette and the services navigator all
 * resolve icons from here, so the product never shows the same glyph for
 * two different destinations.
 *
 * Icons are presentation only — the canonical information architecture
 * lives in `src/data/family-map.ts` and is never duplicated here.
 */

import {
  Activity,
  AppWindow,
  Code2,
  Compass,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  Gauge,
  HardDrive,
  HeartPulse,
  House,
  Layers,
  Lock,
  Monitor,
  Package,
  Radar,
  RotateCcw,
  ScanSearch,
  Search,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Trash2,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { FamilyId, ServiceId } from './family-map';

export type IconComponent = React.ElementType;

/** Every navigable destination in the product, including the shell views. */
export type DestinationId = FamilyId | ServiceId | 'home' | 'ai-scan' | 'action-center' | 'settings' | 'navigator';

export const FAMILY_ICONS: Record<FamilyId, IconComponent> = {
  'ai-scan': Sparkles,
  vitality: HeartPulse,
  recovery: Database,
  assurance: Shield,
  software: Package,
  workbench: Code2,
  investigation: ScanSearch,
  navigator: Compass,
};

export const SERVICE_ICONS: Record<ServiceId, IconComponent> = {
  '01-System-Maintenance': Wrench,
  '02-System-Cleanup': Trash2,
  '03-Network-Internet': Wifi,
  '04-Programs-Applications': AppWindow,
  '05-Duplicate-Files': Copy,
  '06-Disk-Space': HardDrive,
  '07-Services-Processes': Monitor,
  '08-Performance': Gauge,
  '09-Security': Lock,
  '10-Diagnostics-Reports': Search,
  '11-Backup-Recovery': RotateCcw,
  '12-Developer-Tools': Terminal,
  '13-Privacy': Eye,
  '14-Driver-Management': Cpu,
  '15-System-Monitoring': Activity,
  '16-Software-Environment': Layers,
  '17-PostInstall-Setup': Download,
  '18-Project-Sonar': Radar,
};

export const CROSS_CUTTING_ICONS: Record<'home' | 'ai-scan' | 'action-center' | 'settings' | 'navigator', IconComponent> = {
  home: House,
  'ai-scan': Sparkles,
  'action-center': Zap,
  settings: Settings,
  navigator: Compass,
};

export function iconForDestination(id: DestinationId): IconComponent {
  if (id in CROSS_CUTTING_ICONS) return CROSS_CUTTING_ICONS[id as keyof typeof CROSS_CUTTING_ICONS];
  if (id in SERVICE_ICONS) return SERVICE_ICONS[id as ServiceId];
  if (id in FAMILY_ICONS) return FAMILY_ICONS[id as FamilyId];
  return Compass;
}
