import { Laptop, Monitor, Router, Server, Smartphone, Tablet, Webcam, Wifi } from 'lucide-react';
import type { LucideIcon } from '@/shared/ui';
import type { DeviceIcon } from '../model/connected-device-schema';

/** The 8 device icons of XD s28 / LLD §8.4, in grid order. */
export const deviceIconGlyphs: Record<DeviceIcon, LucideIcon> = {
  PHONE: Smartphone,
  TABLET: Tablet,
  LAPTOP: Laptop,
  TV: Monitor,
  ROUTER: Router,
  STORAGE: Server,
  MESH: Wifi,
  CAMERA: Webcam,
};
