import { MonitorSmartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CONNECTED_DEVICE_ERROR_TARGETS,
  CONNECTED_DEVICES_POLL_MS,
  countConnectedDevices,
  DeviceIcon,
  DeviceStatusLabel,
  deviceFilterFromParam,
  deviceFilterParams,
  filterConnectedDevices,
  normalizeMac,
  parseDeviceFilterParam,
  resolveDeviceIcon,
  sortConnectedDevices,
  useConnectedDevicesQuery,
  type ConnectedDevice,
  type DeviceFilterParam,
} from '@/entities/connected-device';
import { useErrorMessage, type PartialError } from '@/shared/api';
import { paths } from '@/shared/config/routes';
import { useTranslation } from '@/shared/i18n';
import {
  Button,
  cx,
  EmptyState,
  FilterChip,
  ListRow,
  SectionError,
  Skeleton,
  StaleNotice,
  useAnimatedList,
  useEntranceOnce,
} from '@/shared/ui';
import './connected-device-list.css';

export interface ConnectedDeviceListProps {
  serialNumber: string;
}

type KnownTarget = (typeof CONNECTED_DEVICE_ERROR_TARGETS)[number];

function partialErrorKey(error: PartialError) {
  return (CONNECTED_DEVICE_ERROR_TARGETS as readonly string[]).includes(error.target)
    ? (`list.partialError.${error.target as KnownTarget}` as const)
    : ('list.partialError.other' as const);
}

/**
 * Device list with filter chips (XD s03). One list request; filtering and sorting are client-side
 * (LLD §8.2). `?filter=` keeps the chip across back navigation; `?sort=traffic&focus=<mac>` comes
 * from the Quality tab's HOGGED action.
 */
export function ConnectedDeviceList({ serialNumber }: ConnectedDeviceListProps) {
  const { t } = useTranslation('devices');
  const toMessage = useErrorMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseDeviceFilterParam(searchParams.get('filter'));
  const byTraffic = searchParams.get('sort') === 'traffic';
  const focusParam = searchParams.get('focus');
  const focusMac = focusParam ? normalizeMac(focusParam) : null;

  const query = useConnectedDevicesQuery(serialNumber, undefined, {
    refetchInterval: CONNECTED_DEVICES_POLL_MS,
  });
  const result = query.data;
  const devices = useMemo(() => result?.data ?? [], [result]);
  const counts = useMemo(() => countConnectedDevices(devices), [devices]);
  const visible = useMemo(
    () => sortConnectedDevices(filterConnectedDevices(devices, deviceFilterFromParam(filter)), { byTraffic }),
    [devices, filter, byTraffic],
  );

  const { entries: rows, containerRef: listRef } = useAnimatedList(visible, (device) => device.macAddress);
  const stagger = useEntranceOnce(`devices:${serialNumber}`, query.isSuccess);

  const focusRef = useRef<HTMLLIElement>(null);
  const hasFocusRow = visible.some((device) => normalizeMac(device.macAddress) === focusMac);
  useEffect(() => {
    if (hasFocusRow) focusRef.current?.scrollIntoView?.({ block: 'center' });
  }, [hasFocusRow]);

  const selectFilter = (next: DeviceFilterParam) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === 'all') params.delete('filter');
        else params.set('filter', next);
        return params;
      },
      { replace: true },
    );
  };

  const partialErrors = result?.errors ?? [];
  const uniquePartialKeys = [...new Set(partialErrors.map(partialErrorKey))];

  return (
    <div className="device-list">
      <div className="device-list__filters" role="group" aria-label={t('filter.label')}>
        {deviceFilterParams.map((param) => (
          <FilterChip
            key={param}
            label={t(`filter.${param}`)}
            pressed={filter === param}
            count={result ? counts[deviceFilterFromParam(param)] : undefined}
            countTone={param === 'blocked' ? 'danger' : 'brand'}
            onClick={() => selectFilter(param)}
          />
        ))}
      </div>

      <StaleNotice meta={result?.meta} />
      {uniquePartialKeys.map((key) => (
        <SectionError key={key} message={t(key)} />
      ))}
      {query.isError && (
        <SectionError message={toMessage(query.error)} onRetry={() => void query.refetch()} />
      )}
      {byTraffic && result && <p className="device-list__note">{t('list.sortedByTraffic')}</p>}

      {query.isPending && (
        <div className="device-list__loading" role="status" aria-busy="true" aria-label={t('list.loading')}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={72} />
          ))}
        </div>
      )}

      {result &&
        (visible.length === 0 ? (
          <EmptyState
            icon={MonitorSmartphone}
            action={
              filter !== 'all' ? (
                <Button size="sm" variant="secondary" onClick={() => selectFilter('all')}>
                  {t('list.showAll')}
                </Button>
              ) : undefined
            }
          >
            {t(`list.empty.${filter}`)}
          </EmptyState>
        ) : (
          <ul
            ref={(node) => {
              listRef.current = node;
            }}
            className={cx('device-list__items', stagger && 'ui-stagger')}
          >
            {rows.map(({ key, item: device, state }, index) => {
              const focused = normalizeMac(device.macAddress) === focusMac;
              return (
                <li
                  key={key}
                  ref={focused ? focusRef : undefined}
                  data-flip-key={key}
                  className={cx(state === 'enter' && 'ui-enter', state === 'leave' && 'ui-leave')}
                  style={{ '--i': index } as CSSProperties}
                >
                  <DeviceRow device={device} focused={focused} showTraffic={byTraffic} />
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

interface DeviceRowProps {
  device: ConnectedDevice;
  focused: boolean;
  showTraffic: boolean;
}

function DeviceRow({ device, focused, showTraffic }: DeviceRowProps) {
  const { t } = useTranslation('devices');
  const blocked = device.status === 'BLOCKED';
  const share = device.trafficSharePercent;

  return (
    <ListRow
      variant="card"
      className="device-list__row"
      data-focused={focused || undefined}
      icon={<DeviceIcon icon={resolveDeviceIcon(device)} />}
      iconTone={blocked ? 'danger' : 'brand'}
      tone={blocked ? 'danger' : 'default'}
      title={device.name ?? t('unnamed')}
      subtitle={device.macAddress}
      meta={<DeviceStatusLabel status={device.status} />}
      trailing={
        showTraffic && share !== null && share !== undefined ? (
          <span className="device-list__share">{t('list.trafficShare', { percent: share })}</span>
        ) : undefined
      }
      to={paths.deviceDetail(device.macAddress)}
    />
  );
}
