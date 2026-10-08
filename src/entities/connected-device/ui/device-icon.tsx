import { Icon } from '@/shared/ui';
import type { DeviceIcon as DeviceIconCode } from '../model/connected-device-schema';
import { deviceIconGlyphs } from './device-icon-glyphs';

export interface DeviceIconProps {
  icon: DeviceIconCode;
  size?: number;
}

/** Decorative glyph of a device icon code. */
export function DeviceIcon({ icon, size = 20 }: DeviceIconProps) {
  return <Icon icon={deviceIconGlyphs[icon]} size={size} />;
}
