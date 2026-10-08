import type { MeasurementLocation } from '@/entities/measurement-location';
import type { WifiNetwork } from '@/entities/wifi-network';

/** First WEAK location of the (WEAK-first) grid, named in the Mesh advice (§IV.2.8). */
export function findWeakestLocation(sorted: readonly MeasurementLocation[]): MeasurementLocation | null {
  return sorted.find((location) => location.latestLevel === 'WEAK') ?? null;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Tile date "dd/MM/yy" in the device time zone (XD "Đo ngày 29/09/26"). */
export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${pad(date.getFullYear() % 100)}`;
}

/** SSID named in the iPhone guide: the enabled 5 GHz network, else the first enabled one (Q10). */
export function pickGuideSsid(networks: readonly WifiNetwork[] | undefined): string | null {
  if (!networks) return null;
  const enabled = networks.filter((network) => network.enabled);
  return (enabled.find((network) => network.band === 'BAND_5GHZ') ?? enabled[0])?.ssid ?? null;
}
