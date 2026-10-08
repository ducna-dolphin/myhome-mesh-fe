import { useId, useMemo } from 'react';
import {
  applyPendingWifiCommand,
  usePendingWifiCommands,
  useWifiNetworksQuery,
  type WifiNetwork,
} from '@/entities/wifi-network';
import { useErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useSheetParam } from '@/shared/lib';
import { WifiOff } from 'lucide-react';
import { cx, EmptyState, SectionError, Skeleton, StaleNotice, useEntranceOnce } from '@/shared/ui';
import { WifiCommandWatcher } from './wifi-command-watcher';
import { WifiNetworkCard } from './wifi-network-card';
import { WifiOptionsSheet } from './wifi-options-sheet';
import './wifi-network-list.css';

export const WIFI_OPTIONS_SHEET = 'wifi-options';
export const WIFI_INDEX_PARAM = 'wifiIndex';

export interface WifiNetworkListProps {
  serialNumber: string;
}

function matchesPatch(network: WifiNetwork, patch: Partial<Pick<WifiNetwork, 'enabled' | 'ssid'>>) {
  return (
    (patch.enabled === undefined || network.enabled === patch.enabled) &&
    (patch.ssid === undefined || network.ssid === patch.ssid)
  );
}

/**
 * "Danh sách Wi-fi (n)" of the Wifi tab (P3-01): one card per SSID with masked password, and the
 * options sheet (`?sheet=wifi-options&wifiIndex=…`). In-flight write commands are polled here, so
 * the optimistic state and "applying" label survive closing the sheet or returning from edit.
 */
export function WifiNetworkList({ serialNumber }: WifiNetworkListProps) {
  const { t } = useTranslation('wifi');
  const toMessage = useErrorMessage();
  const query = useWifiNetworksQuery(serialNumber);
  const tracker = usePendingWifiCommands(serialNumber);
  const titleId = useId();
  const sheet = useSheetParam(WIFI_OPTIONS_SHEET, { paramKeys: [WIFI_INDEX_PARAM] });

  const serverNetworks = useMemo(() => query.data?.data ?? [], [query.data]);
  const networks = useMemo(
    () =>
      serverNetworks.map((network) =>
        applyPendingWifiCommand(network, tracker.forNetwork(network.wifiIndex)),
      ),
    [serverNetworks, tracker],
  );

  const stagger = useEntranceOnce(`wifi-list:${serialNumber}`, query.isSuccess);
  const selectedIndex = sheet.getParam(WIFI_INDEX_PARAM);
  const selected =
    selectedIndex === null
      ? null
      : (networks.find((item) => String(item.wifiIndex) === selectedIndex) ?? null);

  const watchers = tracker.pending.map((entry) => {
    const server = serverNetworks.find((network) => network.wifiIndex === entry.wifiIndex);
    return (
      <WifiCommandWatcher
        key={entry.commandId}
        serialNumber={serialNumber}
        entry={entry}
        ssid={server?.ssid ?? ''}
        applied={server ? matchesPatch(server, entry.patch) : false}
        tracker={tracker}
      />
    );
  });

  let content;
  if (query.isPending) {
    content = (
      <div className="wifi-list__loading" aria-busy="true">
        <span className="sr-only">{t('list.loading')}</span>
        <Skeleton height={117} className="wifi-list__skeleton" />
        <Skeleton height={117} className="wifi-list__skeleton" />
      </div>
    );
  } else if (query.isError) {
    content = <SectionError message={toMessage(query.error)} onRetry={() => void query.refetch()} />;
  } else if (networks.length === 0) {
    content = <EmptyState icon={WifiOff}>{t('list.empty')}</EmptyState>;
  } else {
    content = (
      <ul className={cx('wifi-list__items', stagger && 'ui-stagger')}>
        {networks.map((network, index) => (
          <WifiNetworkCard
            key={network.wifiIndex}
            index={index}
            serialNumber={serialNumber}
            network={network}
            pending={tracker.forNetwork(network.wifiIndex)}
            onOpen={() => sheet.open({ [WIFI_INDEX_PARAM]: String(network.wifiIndex) })}
          />
        ))}
      </ul>
    );
  }

  return (
    <section className="wifi-list" aria-labelledby={titleId}>
      <div className="wifi-list__header">
        <h3 className="wifi-list__title" id={titleId}>
          {t('list.title', { count: networks.length })}
        </h3>
        <StaleNotice meta={query.data?.meta} />
      </div>
      {content}
      {watchers}
      <WifiOptionsSheet
        serialNumber={serialNumber}
        network={selected}
        pending={selected ? tracker.forNetwork(selected.wifiIndex) : undefined}
        onClose={sheet.close}
      />
    </section>
  );
}
