import { Check, Copy, PencilLine, QrCode, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PendingWifiCommand, WifiNetwork } from '@/entities/wifi-network';
import { useCopyWifiPassword } from '@/features/reveal-wifi-password';
import { WifiNetworkToggle } from '@/features/toggle-wifi-network';
import { paths } from '@/shared/config/routes';
import { useTranslation } from '@/shared/i18n';
import { BottomSheet, Icon, ListRow } from '@/shared/ui';

interface WifiOptionsSheetProps {
  serialNumber: string;
  /** `null` keeps the sheet closed (no `?sheet=wifi-options` or unknown index). */
  network: WifiNetwork | null;
  pending: PendingWifiCommand | undefined;
  onClose: () => void;
}

/** How long the copy row shows its check mark after a successful copy. */
export const COPIED_FEEDBACK_MS = 1500;

/** XD "Edit Wifi 1": options of one SSID. Wi-Fi schedules are out of M1 scope (LLD §7). */
export function WifiOptionsSheet({ serialNumber, network, pending, onClose }: WifiOptionsSheetProps) {
  const { t } = useTranslation('wifi');
  const { copy, isPending: copying } = useCopyWifiPassword(serialNumber);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  let toggleSubtitle: string | undefined;
  if (pending) {
    toggleSubtitle = pending.awaitingConfirmation ? t('list.awaitingConfirmation') : t('list.applying');
  } else if (network) {
    toggleSubtitle = network.enabled ? t('enabled') : t('disabled');
  }

  return (
    <BottomSheet
      open={network !== null}
      onClose={onClose}
      title={network ? <span translate="no">{network.ssid}</span> : undefined}
      closeLabel={t('options.close')}
      className="wifi-options"
    >
      {network && (
        <div className="wifi-options__rows">
          <ListRow
            icon={<Icon icon={Wifi} />}
            title={t('options.toggle')}
            subtitle={toggleSubtitle}
            trailing={
              <WifiNetworkToggle serialNumber={serialNumber} network={network} busy={pending !== undefined} />
            }
          />
          <ListRow
            icon={<Icon icon={PencilLine} />}
            title={t('options.edit')}
            to={paths.wifiNetworkEdit(network.wifiIndex)}
          />
          <ListRow
            icon={
              // Keyed so the glyph cross-fades when it morphs into the check and back.
              <Icon key={copied ? 'copied' : 'copy'} icon={copied ? Check : Copy} className="ui-icon-swap" />
            }
            title={t('options.copy')}
            subtitle={copied ? t('password.copiedInline') : undefined}
            chevron={false}
            disabled={copying}
            onClick={() => {
              void copy(network.wifiIndex).then((ok) => {
                if (ok) setCopied(true);
              });
            }}
          />
          <ListRow
            icon={<Icon icon={QrCode} />}
            title={t('options.share')}
            to={paths.wifiNetworkShare(network.wifiIndex)}
          />
        </div>
      )}
    </BottomSheet>
  );
}
