import { useTranslation } from '@/shared/i18n';
import { RequireSerialNumber } from '@/widgets/contract-scope';
import { ConnectedDeviceList } from './connected-device-list';

/** Tab "Thiết bị kết nối" of the Internet screen (XD s03, P4-01). */
export function DevicesTabPage() {
  const { t } = useTranslation('internet');

  return (
    <section className="stack">
      <h2 className="sr-only">{t('tabs.devices')}</h2>
      <RequireSerialNumber>
        {({ serialNumber }) => <ConnectedDeviceList key={serialNumber} serialNumber={serialNumber} />}
      </RequireSerialNumber>
    </section>
  );
}
