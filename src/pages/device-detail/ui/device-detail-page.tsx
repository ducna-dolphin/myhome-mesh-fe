import { useParams } from 'react-router-dom';
import { RequireSerialNumber } from '@/widgets/contract-scope';
import { DeviceDetail } from './device-detail';

/** Sub-page "Chi tiết thiết bị" (XD s27); header title comes from the route handle. */
export function DeviceDetailPage() {
  const { macAddress = '' } = useParams<'macAddress'>();

  return (
    <section className="stack">
      <RequireSerialNumber>
        {({ serialNumber }) => (
          <DeviceDetail
            key={`${serialNumber}/${macAddress}`}
            serialNumber={serialNumber}
            macAddress={macAddress}
          />
        )}
      </RequireSerialNumber>
    </section>
  );
}
