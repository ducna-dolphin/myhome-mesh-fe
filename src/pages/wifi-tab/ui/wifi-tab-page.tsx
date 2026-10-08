import { useTranslation } from '@/shared/i18n';
import { RequireSerialNumber } from '@/widgets/contract-scope';
import { WifiHealthSection } from '@/widgets/wifi-health-section';
import { WifiNetworkList } from '@/widgets/wifi-network-list';

/** Tab "wifi" of the Internet screen: Wi-Fi health by location above the network list (XD "Mesh - Wifi – 1"). */
export function WifiTabPage() {
  const { t } = useTranslation('internet');

  return (
    <section className="stack">
      <h2 className="sr-only">{t('tabs.wifi')}</h2>
      <RequireSerialNumber>
        {({ serialNumber, contract }) => (
          <>
            <WifiHealthSection contractId={contract.contractId} serialNumber={serialNumber} />
            <WifiNetworkList serialNumber={serialNumber} />
          </>
        )}
      </RequireSerialNumber>
    </section>
  );
}
