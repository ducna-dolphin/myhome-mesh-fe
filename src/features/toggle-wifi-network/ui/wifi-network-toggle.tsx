import { useState } from 'react';
import {
  usePendingWifiCommands,
  useUpdateWifiNetworkMutation,
  type WifiNetwork,
} from '@/entities/wifi-network';
import { useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Dialog, Switch, useToast } from '@/shared/ui';

export interface WifiNetworkToggleProps {
  serialNumber: string;
  /** Network as displayed (server data with any in-flight command applied). */
  network: WifiNetwork;
  /**
   * A command for this network is still running or awaiting the modem (UNKNOWN): block a second
   * write, which would replace the tracked command before its outcome is known.
   */
  busy?: boolean;
}

/**
 * "Bật / Tắt Wi-Fi" switch (P3-02). Turning off asks for confirmation first, because every device
 * on this network — possibly this phone — loses its connection. The PATCH returns a 202 command
 * that is registered in the pending-command tracker; the Wi-Fi list polls it, shows the new value
 * optimistically and rolls back if the command FAILS.
 */
export function WifiNetworkToggle({ serialNumber, network, busy = false }: WifiNetworkToggleProps) {
  const { t } = useTranslation('wifi');
  const toast = useToast();
  const toMessage = useErrorMessage();
  const keys = useIdempotencyKey();
  const tracker = usePendingWifiCommands(serialNumber);
  const mutation = useUpdateWifiNetworkMutation(serialNumber);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { wifiIndex, ssid } = network;

  const submit = (enabled: boolean) => {
    const patch = { enabled };
    mutation.mutate(
      { wifiIndex, patch, idempotencyKey: keys.forAction({ wifiIndex, patch }) },
      {
        onSuccess: (command) => {
          keys.renew();
          setConfirmOpen(false);
          tracker.track({ wifiIndex, command, patch });
        },
        onError: (error) => {
          setConfirmOpen(false);
          toast.show(toMessage(error), { tone: 'danger' });
        },
      },
    );
  };

  const handleChange = (enabled: boolean) => {
    if (enabled) submit(true);
    else setConfirmOpen(true);
  };

  return (
    <>
      <Switch
        checked={network.enabled}
        onCheckedChange={handleChange}
        label={t('toggle.label', { ssid })}
        pending={mutation.isPending || busy}
      />
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('toggle.confirmTitle', { ssid })}
        description={t('toggle.confirmDescription', { ssid })}
        cancelLabel={t('toggle.cancel')}
        confirmLabel={t('toggle.confirm')}
        destructive
        confirmLoading={mutation.isPending}
        onConfirm={() => submit(false)}
      />
    </>
  );
}
