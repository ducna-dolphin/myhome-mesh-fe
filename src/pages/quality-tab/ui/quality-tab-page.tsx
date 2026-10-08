import { useNavigate } from 'react-router-dom';
import { HEALTH_CHECK_ITEM_ORDER, type HealthCheckItem } from '@/entities/health-check';
import { RebootOntBanner, RebootOntDialog, useRebootOnt } from '@/features/reboot-ont';
import { ReportFaultButton } from '@/features/report-fault';
import {
  devicesTabUrl,
  HealthCheckHeader,
  HealthCheckItemCard,
  useEnableWifi,
  useHealthCheckRun,
} from '@/features/run-health-check';
import { MESH_ORDER_DEEPLINK } from '@/shared/config/quality-deeplinks';
import { useTranslation } from '@/shared/i18n';
import { isBridgeError, useSuperApp } from '@/shared/super-app';
import { Button, useToast } from '@/shared/ui';
import { RequireSerialNumber } from '@/widgets/contract-scope';
import './quality-tab-page.css';

/** Tab "Chất lượng" of the Internet screen (P6-01, XD Chatluong 5–7). */
export function QualityTabPage() {
  const { t } = useTranslation('internet');

  return (
    <section className="stack">
      <h2 className="sr-only">{t('tabs.quality')}</h2>
      <RequireSerialNumber>
        {({ serialNumber, contract }) => (
          <QualityCheck key={serialNumber} serialNumber={serialNumber} contractId={contract.contractId} />
        )}
      </RequireSerialNumber>
    </section>
  );
}

interface QualityCheckProps {
  serialNumber: string;
  contractId: string;
}

function QualityCheck({ serialNumber, contractId }: QualityCheckProps) {
  const { t } = useTranslation('quality');
  const navigate = useNavigate();
  const superApp = useSuperApp();
  const toast = useToast();
  const run = useHealthCheckRun(serialNumber);
  const reboot = useRebootOnt(serialNumber, { onConfirmed: run.recheck });
  const enableWifi = useEnableWifi(serialNumber, { onDone: run.recheck });
  const busy = reboot.isRebooting || reboot.isSending || enableWifi.isRunning;

  const items: HealthCheckItem[] = HEALTH_CHECK_ITEM_ORDER.map(
    (itemType) =>
      run.check?.items.find((item) => item.itemType === itemType) ?? { itemType, state: 'PENDING' },
  );

  async function orderMesh() {
    if (!superApp.supports('openDeeplink')) {
      toast.show(t('orderMesh.unsupported'), { tone: 'danger' });
      return;
    }
    try {
      await superApp.openDeeplink(MESH_ORDER_DEEPLINK);
    } catch (error) {
      const unsupported = isBridgeError(error) && error.code === 'BRIDGE_UNSUPPORTED';
      toast.show(unsupported ? t('orderMesh.unsupported') : t('orderMesh.openFailed'), { tone: 'danger' });
    }
  }

  function renderAction(item: HealthCheckItem) {
    if (item.state !== 'DONE' || run.isRunning) return null;
    switch (item.action) {
      case 'RESET_MODEM':
        return (
          <Button fullWidth onClick={reboot.openDialog} disabled={busy}>
            {t('action.RESET_MODEM')}
          </Button>
        );
      case 'REPORT_FAULT':
        return <ReportFaultButton contractId={contractId} checkId={run.check?.checkId ?? null} />;
      case 'ENABLE_WIFI':
        return (
          <Button fullWidth onClick={enableWifi.run} loading={enableWifi.isRunning} disabled={busy}>
            {enableWifi.isRunning ? t('enableWifi.running') : t('action.ENABLE_WIFI')}
          </Button>
        );
      case 'ORDER_MESH':
        return (
          <Button fullWidth onClick={() => void orderMesh()}>
            {t('action.ORDER_MESH')}
          </Button>
        );
      default:
        return null;
    }
  }

  return (
    <div className="quality-tab">
      <HealthCheckHeader
        check={run.check}
        isRunning={run.isRunning}
        isTimedOut={run.isTimedOut}
        startError={run.startError}
        onRecheck={run.recheck}
        recheckDisabled={busy}
      />
      <RebootOntBanner controller={reboot} />

      <section className="quality-tab__results" aria-labelledby="quality-results-title">
        <h3 className="quality-tab__results-title" id="quality-results-title">
          {t('resultsTitle')}
        </h3>
        {items.map((item) => (
          <HealthCheckItemCard
            key={item.itemType}
            item={item}
            action={renderAction(item)}
            onOpen={
              item.itemType === 'CONNECTED_DEVICES' && item.state === 'DONE'
                ? () => navigate(devicesTabUrl(item))
                : undefined
            }
          />
        ))}
      </section>

      <RebootOntDialog
        controller={reboot}
        title={t('resetModem.title')}
        description={t('resetModem.description')}
      />
    </div>
  );
}
