import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  applyPendingWifiCommand,
  usePendingWifiCommands,
  useWifiNetworksQuery,
} from '@/entities/wifi-network';
import { UpdateWifiNetworkForm } from '@/features/update-wifi-network';
import { useErrorMessage } from '@/shared/api';
import { paths } from '@/shared/config/routes';
import { useTranslation } from '@/shared/i18n';
import { EmptyState, SectionError, Skeleton } from '@/shared/ui';
import { RequireSerialNumber } from '@/widgets/contract-scope';

interface EditContentProps {
  serialNumber: string;
  wifiIndex: string | undefined;
}

function EditContent({ serialNumber, wifiIndex }: EditContentProps) {
  const { t } = useTranslation('wifi');
  const toMessage = useErrorMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useWifiNetworksQuery(serialNumber);
  const tracker = usePendingWifiCommands(serialNumber);

  // Back to where the user came from (list or options sheet); a deep link goes to the Wifi tab.
  const goBack = useCallback(() => {
    if (location.key === 'default') void navigate(paths.wifi, { replace: true, viewTransition: true });
    else void navigate(-1);
  }, [location.key, navigate]);

  if (query.isPending) {
    return (
      <div className="stack" aria-busy="true">
        <Skeleton height={160} />
      </div>
    );
  }
  if (query.isError) {
    return <SectionError message={toMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const server = query.data.data.find((item) => String(item.wifiIndex) === wifiIndex);
  if (!server) return <EmptyState>{t('edit.notFound')}</EmptyState>;
  const network = applyPendingWifiCommand(server, tracker.forNetwork(server.wifiIndex));

  return (
    <UpdateWifiNetworkForm
      key={network.wifiIndex}
      serialNumber={serialNumber}
      network={network}
      onDone={goBack}
    />
  );
}

/** "Đổi tên / mật khẩu Wi-Fi" sub-page (P3-02, XD Edit Wifi 2). */
export function WifiNetworkEditPage() {
  const { wifiIndex } = useParams<'wifiIndex'>();

  return (
    <section className="stack">
      <RequireSerialNumber>
        {({ serialNumber }) => <EditContent serialNumber={serialNumber} wifiIndex={wifiIndex} />}
      </RequireSerialNumber>
    </section>
  );
}
