import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/app/layout/app-shell';
import { InternetLayout } from '@/app/layout/internet-layout';
import { RootRedirect } from '@/app/layout/root-redirect';
import type { SubPageHandle } from '@/app/layout/route-handle';
import { SubPageLayout } from '@/app/layout/sub-page-layout';
import { legacyRedirects, paths } from '@/shared/config/routes';
import { routeTitleKeys } from '@/shared/i18n';
import { LoadingState } from '@/shared/ui';

const fallback = <LoadingState />;

const subPage = (titleKey: SubPageHandle['titleKey'], backTo: string): SubPageHandle => ({
  titleKey,
  backTo,
});

/** Route tree (shared by the hash router and the routing tests). Every page is lazy-loaded. */
export const routes: RouteObject[] = [
  {
    path: paths.root,
    element: <AppShell />,
    children: [
      { index: true, element: <RootRedirect /> },
      {
        element: <InternetLayout />,
        children: [
          {
            path: paths.wifi,
            lazy: () => import('@/pages/wifi-tab').then(({ WifiTabPage }) => ({ Component: WifiTabPage })),
            hydrateFallbackElement: fallback,
          },
          {
            path: paths.devices,
            lazy: () =>
              import('@/pages/devices-tab').then(({ DevicesTabPage }) => ({ Component: DevicesTabPage })),
            hydrateFallbackElement: fallback,
          },
          {
            path: paths.modem,
            lazy: () => import('@/pages/modem-tab').then(({ ModemTabPage }) => ({ Component: ModemTabPage })),
            hydrateFallbackElement: fallback,
          },
          {
            path: paths.quality,
            lazy: () =>
              import('@/pages/quality-tab').then(({ QualityTabPage }) => ({ Component: QualityTabPage })),
            hydrateFallbackElement: fallback,
          },
        ],
      },
      {
        element: <SubPageLayout />,
        children: [
          {
            path: paths.wifiNetworkEditPattern,
            lazy: () =>
              import('@/pages/wifi-network-edit').then(({ WifiNetworkEditPage }) => ({
                Component: WifiNetworkEditPage,
              })),
            hydrateFallbackElement: fallback,
            handle: subPage(routeTitleKeys.wifiNetworkEdit, paths.wifi),
          },
          {
            path: paths.wifiNetworkSharePattern,
            lazy: () =>
              import('@/pages/wifi-network-share').then(({ WifiNetworkSharePage }) => ({
                Component: WifiNetworkSharePage,
              })),
            hydrateFallbackElement: fallback,
            handle: subPage(routeTitleKeys.wifiNetworkShare, paths.wifi),
          },
          {
            path: paths.deviceDetailPattern,
            lazy: () =>
              import('@/pages/device-detail').then(({ DeviceDetailPage }) => ({
                Component: DeviceDetailPage,
              })),
            hydrateFallbackElement: fallback,
            handle: subPage(routeTitleKeys.deviceDetail, paths.devices),
          },
          {
            path: paths.deviceEditPattern,
            lazy: () =>
              import('@/pages/device-edit').then(({ DeviceEditPage }) => ({ Component: DeviceEditPage })),
            hydrateFallbackElement: fallback,
            handle: subPage(routeTitleKeys.deviceEdit, paths.devices),
          },
        ],
      },
      ...legacyRedirects.map(({ from, to }) => ({ path: from, element: <Navigate to={to} replace /> })),
      { path: '*', element: <RootRedirect /> },
    ],
  },
];
