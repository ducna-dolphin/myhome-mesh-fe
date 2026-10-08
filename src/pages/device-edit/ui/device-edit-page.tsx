import { useParams } from 'react-router-dom';
import { RequireSerialNumber } from '@/widgets/contract-scope';
import { DeviceEdit } from './device-edit';

/** Sub-page "Đổi tên/Icon thiết bị" (XD s28); header title comes from the route handle. */
export function DeviceEditPage() {
  const { macAddress = '' } = useParams<'macAddress'>();

  return (
    <section className="stack">
      <RequireSerialNumber>
        {({ serialNumber }) => (
          <DeviceEdit
            key={`${serialNumber}/${macAddress}`}
            serialNumber={serialNumber}
            macAddress={macAddress}
          />
        )}
      </RequireSerialNumber>
    </section>
  );
}
