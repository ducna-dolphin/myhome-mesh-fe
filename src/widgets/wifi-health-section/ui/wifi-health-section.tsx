import { AlertCircle, CircleCheck, History, Pencil, Router, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Trans } from 'react-i18next';
import { useContractDetailQuery } from '@/entities/contract';
import {
  MAX_MEASUREMENT_LOCATIONS,
  sortMeasurementLocations,
  useMeasurementLocationsQuery,
} from '@/entities/measurement-location';
import { useOntDeviceQuery } from '@/entities/ont-device';
import { useWifiNetworksQuery } from '@/entities/wifi-network';
import {
  DeleteLocationDialog,
  LocationNameSheet,
  RenameLocationDialog,
} from '@/features/manage-measurement-location';
import { MeasureSheet, type MeasureMode } from '@/features/measure-wifi-signal';
import { useErrorMessage } from '@/shared/api';
import { MESH_ORDER_DEEPLINK } from '@/shared/config/survey-deeplinks';
import { useTranslation } from '@/shared/i18n';
import { useSuperApp } from '@/shared/super-app';
import {
  BottomSheet,
  Button,
  Dialog,
  Icon,
  ListRow,
  SectionError,
  Skeleton,
  SpecNote,
  cx,
  useAnimatedList,
  useEntranceOnce,
  useToast,
} from '@/shared/ui';
import { findWeakestLocation, pickGuideSsid } from '../model/section-helpers';
import { AddLocationTile, LocationTile } from './location-tile';
import './wifi-health-section.css';

export interface WifiHealthSectionProps {
  contractId: string;
  /** ONT of the contract; used for the BSSID check (DK-02) and the SSID in the iPhone guide. */
  serialNumber: string | null;
}

type SheetState =
  | { kind: 'name' }
  | { kind: 'menu'; locationId: string }
  | { kind: 'measure'; locationId: string; mode: MeasureMode; session: number };

type DialogState =
  | { kind: 'confirm'; locationId: string }
  | { kind: 'rename'; locationId: string }
  | { kind: 'delete'; locationId: string };

const conditionKeys = ['home', 'wifi', 'vpn', 'position'] as const;

/**
 * "Sức khoẻ Wi-fi theo khu vực" block of the Wifi tab (P2-01…P2-06): grid of measurement
 * locations, Mesh advice, create / measure / rename / delete flows. Its errors stay inside the block.
 */
export function WifiHealthSection({ contractId, serialNumber }: WifiHealthSectionProps) {
  const { t } = useTranslation('survey');
  const bridge = useSuperApp();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const locationsQuery = useMeasurementLocationsQuery(contractId);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [sessionSerial, setSessionSerial] = useState(0);

  // Measurement inputs are loaded lazily, only while a measure sheet is open.
  const measuring = sheet?.kind === 'measure';
  const contractDetail = useContractDetailQuery(contractId);
  const ont = useOntDeviceQuery(measuring ? serialNumber : null);
  const wifiNetworks = useWifiNetworksQuery(measuring ? serialNumber : null);

  const locations = useMemo(() => sortMeasurementLocations(locationsQuery.data ?? []), [locationsQuery.data]);
  const { entries: tiles, containerRef: gridRef } = useAnimatedList(locations, (item) => item.locationId);
  const stagger = useEntranceOnce(`wifi-health:${contractId}`, locationsQuery.isSuccess);
  const findLocation = (locationId: string) =>
    locations.find((item) => item.locationId === locationId) ?? null;

  const openMeasure = (locationId: string, mode: MeasureMode) => {
    const session = sessionSerial + 1;
    setSessionSerial(session);
    setSheet({ kind: 'measure', locationId, mode, session });
  };

  const openMeshOrder = () => {
    bridge.openDeeplink(MESH_ORDER_DEEPLINK).catch((error: unknown) => {
      toast.show(toMessage(error), { tone: 'danger' });
    });
  };

  const header = (count: number | null) => (
    <div className="wifi-health__header">
      <h3 className="wifi-health__title" id="wifi-health-title">
        {t('title')}
      </h3>
      {count !== null && (
        <span className="wifi-health__counter">
          {t('counter', { used: count, max: MAX_MEASUREMENT_LOCATIONS })}
        </span>
      )}
    </div>
  );

  let content;
  if (locationsQuery.isPending) {
    content = (
      <>
        {header(null)}
        <div className="wifi-health__card" role="status" aria-busy="true" aria-label={t('grid.loading')}>
          <div className="wifi-health__grid">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} height={96} className="wifi-health__skeleton" />
            ))}
          </div>
        </div>
      </>
    );
  } else if (locationsQuery.isError) {
    content = (
      <>
        {header(null)}
        <SectionError message={t('grid.error')} onRetry={() => void locationsQuery.refetch()} />
      </>
    );
  } else if (locations.length === 0) {
    content = (
      <div className="wifi-health__card wifi-health-empty">
        <div className="wifi-health-empty__head">
          <span className="wifi-health-empty__icon" aria-hidden="true">
            <Icon icon={Router} />
          </span>
          <span>
            <h3 className="wifi-health-empty__title" id="wifi-health-title">
              {t('empty.title')}
            </h3>
            <span className="wifi-health-empty__subtitle">{t('empty.subtitle')}</span>
          </span>
        </div>
        <div className="wifi-health-empty__conditions">
          <p className="wifi-health-empty__caps" id="wifi-health-conditions">
            {t('empty.conditionsTitle')}
          </p>
          <ul aria-labelledby="wifi-health-conditions">
            {conditionKeys.map((key) => (
              <li key={key}>
                <Icon icon={CircleCheck} size={18} />
                {t(`empty.conditions.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <Button fullWidth onClick={() => setSheet({ kind: 'name' })}>
          {t('empty.start')}
        </Button>
      </div>
    );
  } else {
    const weakest = findWeakestLocation(locations);
    const full = locations.length >= MAX_MEASUREMENT_LOCATIONS;
    content = (
      <>
        {header(locations.length)}
        <div className="wifi-health__card">
          <ul
            ref={(node) => {
              gridRef.current = node;
            }}
            className={cx('wifi-health__grid', stagger && 'ui-stagger')}
            aria-label={t('grid.label')}
          >
            {tiles.map(({ key, item: location, state }, index) => (
              <LocationTile
                key={key}
                flipKey={key}
                index={index}
                className={cx(state === 'enter' && 'ui-enter', state === 'leave' && 'ui-leave')}
                location={location}
                onMeasure={(item) => setDialog({ kind: 'confirm', locationId: item.locationId })}
                onMenu={(item) => setSheet({ kind: 'menu', locationId: item.locationId })}
              />
            ))}
            {!full && <AddLocationTile index={tiles.length} onAdd={() => setSheet({ kind: 'name' })} />}
          </ul>
          {full && (
            <p className="wifi-health__limit">
              {t('grid.limitReached', { max: MAX_MEASUREMENT_LOCATIONS })}
              <SpecNote id="measurementLocationLimit" />
            </p>
          )}
          {weakest && (
            <div className="wifi-health__alert">
              <Icon icon={AlertCircle} size={20} />
              <p>
                <Trans
                  t={t}
                  i18nKey="weakAlert"
                  values={{ name: weakest.name }}
                  components={{ b: <strong /> }}
                />
              </p>
            </div>
          )}
        </div>
        {weakest && (
          <button type="button" className="wifi-health__mesh" onClick={openMeshOrder}>
            <strong>{t('mesh.title')}</strong>
            <span>{t('mesh.subtitle')}</span>
          </button>
        )}
      </>
    );
  }

  const menuLocation = sheet?.kind === 'menu' ? findLocation(sheet.locationId) : null;
  const measureLocation = sheet?.kind === 'measure' ? findLocation(sheet.locationId) : null;
  const dialogLocation = dialog ? findLocation(dialog.locationId) : null;

  return (
    <section className="wifi-health" aria-labelledby="wifi-health-title">
      {content}

      {sheet?.kind === 'name' && (
        <LocationNameSheet
          contractId={contractId}
          locations={locations}
          onClose={() => setSheet(null)}
          onCreatedAndMeasure={(created) => openMeasure(created.locationId, 'measure')}
        />
      )}

      {menuLocation && (
        <BottomSheet
          open
          onClose={() => setSheet(null)}
          title={menuLocation.name}
          closeLabel={t('menu.close')}
        >
          <div className="wifi-health__menu">
            <ListRow
              icon={<Icon icon={Pencil} />}
              title={t('menu.rename')}
              chevron={false}
              onClick={() => {
                setSheet(null);
                setDialog({ kind: 'rename', locationId: menuLocation.locationId });
              }}
            />
            <ListRow
              icon={<Icon icon={History} />}
              title={t('menu.remeasure')}
              chevron={false}
              onClick={() => openMeasure(menuLocation.locationId, 'view')}
            />
            <ListRow
              icon={<Icon icon={Trash2} />}
              iconTone="danger"
              tone="danger"
              title={t('menu.delete')}
              chevron={false}
              onClick={() => {
                setSheet(null);
                setDialog({ kind: 'delete', locationId: menuLocation.locationId });
              }}
            />
          </div>
        </BottomSheet>
      )}

      {sheet?.kind === 'measure' && measureLocation && (
        <MeasureSheet
          key={sheet.session}
          contractId={contractId}
          location={measureLocation}
          mode={sheet.mode}
          planDownloadMbps={contractDetail.data?.data.planDownloadMbps}
          modemMac={ont.data?.data.macAddress}
          ssid={pickGuideSsid(wifiNetworks.data?.data)}
          onClose={() => setSheet(null)}
          onRename={(item) => setDialog({ kind: 'rename', locationId: item.locationId })}
          onDelete={(item) => setDialog({ kind: 'delete', locationId: item.locationId })}
        />
      )}

      {dialog?.kind === 'confirm' && dialogLocation && (
        <Dialog
          open
          onClose={() => setDialog(null)}
          title={t('confirm.title', { name: dialogLocation.name })}
          description={t('confirm.description')}
          confirmLabel={t('confirm.confirm')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => {
            setDialog(null);
            openMeasure(dialogLocation.locationId, 'measure');
          }}
        />
      )}

      {dialog?.kind === 'rename' && dialogLocation && (
        <RenameLocationDialog
          contractId={contractId}
          location={dialogLocation}
          locations={locations}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'delete' && dialogLocation && (
        <DeleteLocationDialog
          contractId={contractId}
          location={dialogLocation}
          onClose={() => setDialog(null)}
          onDeleted={(item) => {
            if (sheet && 'locationId' in sheet && sheet.locationId === item.locationId) setSheet(null);
          }}
        />
      )}
    </section>
  );
}
