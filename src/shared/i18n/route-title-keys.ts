/** Header titles of routes (`common` namespace), referenced from route `handle.titleKey`. */
export const routeTitleKeys = {
  internet: 'route.internet',
  wifiNetworkEdit: 'route.wifiNetworkEdit',
  wifiNetworkShare: 'route.wifiNetworkShare',
  deviceDetail: 'route.deviceDetail',
  deviceEdit: 'route.deviceEdit',
} as const;

export type RouteTitleKey = (typeof routeTitleKeys)[keyof typeof routeTitleKeys];

const routeTitleKeySet = new Set<string>(Object.values(routeTitleKeys));

export function isRouteTitleKey(value: unknown): value is RouteTitleKey {
  return typeof value === 'string' && routeTitleKeySet.has(value);
}
