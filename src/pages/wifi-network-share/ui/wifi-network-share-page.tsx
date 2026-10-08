import { useParams } from 'react-router-dom';
import { useWifiNetworksQuery } from '@/entities/wifi-network';
import { WifiQrShare } from '@/features/share-wifi-qr';
import { useErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { EmptyState, SectionError, Skeleton } from '@/shared/ui';
import { RequireSerialNumber } from '@/widgets/contract-scope';

interface ShareContentProps {
  serialNumber: string;
  wifiIndex: string | undefined;
}

function ShareContent({ serialNumber, wifiIndex }: ShareContentProps) {
  const { t } = useTranslation('wifi');
  const toMessage = useErrorMessage();
  const query = useWifiNetworksQuery(serialNumber);

  if (query.isPending) {
    return (
      <div className="stack" aria-busy="true">
        <Skeleton height={200} />
      </div>
    );
  }
  if (query.isError) {
    return <SectionError message={toMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const network = query.data.data.find((item) => String(item.wifiIndex) === wifiIndex);
  if (!network) return <EmptyState>{t('qr.notFound')}</EmptyState>;

  // Keyed so switching networks re-reveals instead of showing the previous QR.
  return <WifiQrShare key={network.wifiIndex} serialNumber={serialNumber} network={network} />;
}

/** "Chia sẻ Wi-Fi" sub-page (P3-01, XD Edit Wifi 3). */
export function WifiNetworkSharePage() {
  const { wifiIndex } = useParams<'wifiIndex'>();

  return (
    <section className="stack">
      <RequireSerialNumber>
        {({ serialNumber }) => <ShareContent serialNumber={serialNumber} wifiIndex={wifiIndex} />}
      </RequireSerialNumber>
    </section>
  );
}
