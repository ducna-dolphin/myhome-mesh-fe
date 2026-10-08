const enc = encodeURIComponent;

/** Route literals of the Internet redesign (hash router). Build URLs only through these helpers. */
export const paths = {
  root: '/',
  wifi: '/wifi',
  devices: '/devices',
  modem: '/modem',
  quality: '/quality',
  wifiNetworkEditPattern: '/wifi/:wifiIndex/edit',
  wifiNetworkEdit: (wifiIndex: number | string) => `/wifi/${enc(String(wifiIndex))}/edit`,
  wifiNetworkSharePattern: '/wifi/:wifiIndex/share',
  wifiNetworkShare: (wifiIndex: number | string) => `/wifi/${enc(String(wifiIndex))}/share`,
  deviceDetailPattern: '/devices/:macAddress',
  deviceDetail: (macAddress: string) => `/devices/${enc(macAddress)}`,
  deviceEditPattern: '/devices/:macAddress/edit',
  deviceEdit: (macAddress: string) => `/devices/${enc(macAddress)}/edit`,
} as const;

/** The four pill tabs of the Internet screen, in display order. */
export const internetTabs = ['wifi', 'devices', 'modem', 'quality'] as const;
export type InternetTab = (typeof internetTabs)[number];

export const tabPaths: Record<InternetTab, string> = {
  wifi: paths.wifi,
  devices: paths.devices,
  modem: paths.modem,
  quality: paths.quality,
};

const tabPathSet = new Set<string>(Object.values(tabPaths));

export function isTabPath(value: unknown): value is string {
  return typeof value === 'string' && tabPathSet.has(value);
}

/** Pre-redesign deep links the host may have stored → new destination (always `replace`). */
export const legacyRedirects: ReadonlyArray<{ from: string; to: string }> = [
  { from: '/clients', to: paths.devices },
  { from: '/clients/:clientId', to: paths.devices },
  { from: '/health', to: paths.wifi },
  { from: '/diagnostics', to: paths.quality },
  { from: '/mesh', to: paths.modem },
];
