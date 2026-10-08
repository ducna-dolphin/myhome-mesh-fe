import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCommandPoller, type Command } from '@/entities/command';
import {
  usePendingWifiCommands,
  useUpdateWifiNetworkMutation,
  wifiNetworkKeys,
  type WifiNetwork,
} from '@/entities/wifi-network';
import { getCommandErrorMessageKey, useErrorMessage, useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Button, Dialog, SectionError, TextField, useToast } from '@/shared/ui';
import { useCommandNetworkLost } from '../model/use-command-network-lost';
import { evaluateWifiNetworkForm, type WifiNetworkFormValues } from '../model/wifi-network-form';
import './update-wifi-network-form.css';

export interface UpdateWifiNetworkFormProps {
  serialNumber: string;
  network: WifiNetwork;
  /** Called after the change is confirmed or sent-and-awaiting; the page navigates back. */
  onDone: () => void;
}

/**
 * Rename / change password of one Wi-Fi network (P3-02). Sends a JSON Merge Patch with only the
 * changed fields, keeps the idempotency key across retries of the same input, then polls the 202
 * command. CONFIRMED and UNKNOWN (or the phone losing this Wi-Fi) both end the flow; FAILED shows
 * an inline error so the user can try again.
 */
export function UpdateWifiNetworkForm({ serialNumber, network, onDone }: UpdateWifiNetworkFormProps) {
  const { t } = useTranslation('wifi');
  const { t: tErrors } = useTranslation('errors');
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();
  const tracker = usePendingWifiCommands(serialNumber);
  const mutation = useUpdateWifiNetworkMutation(serialNumber);
  const { wifiIndex } = network;

  const [values, setValues] = useState<WifiNetworkFormValues>({ ssid: network.ssid, password: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [command, setCommand] = useState<Command | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<unknown>(null);
  // Bumped on every password keystroke: the idempotency fingerprint uses it instead of the secret.
  const [passwordEdit, setPasswordEdit] = useState(0);
  const finished = useRef(false);

  const form = useMemo(() => evaluateWifiNetworkForm(network, values), [network, values]);
  const commandId = command?.commandId ?? null;

  const finish = useCallback(
    (message: string) => {
      if (finished.current) return;
      finished.current = true;
      void queryClient.invalidateQueries({ queryKey: wifiNetworkKeys.list(serialNumber) });
      toast.show(message);
      onDone();
    },
    [onDone, queryClient, serialNumber, toast],
  );

  const onSettled = useCallback(
    (settled: Command) => {
      tracker.settle(settled.commandId);
      if (settled.state === 'CONFIRMED') {
        finish(t('edit.saved'));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: wifiNetworkKeys.list(serialNumber) });
      setCommand(null);
      setCommandError(t('edit.failed', { reason: tErrors(getCommandErrorMessageKey(settled.errorCode)) }));
    },
    [finish, queryClient, serialNumber, t, tErrors, tracker],
  );

  const poller = useCommandPoller(commandId, { type: 'WIFI_UPDATE', initialCommand: command, onSettled });
  const networkLost = useCommandNetworkLost(commandId);
  const awaitingConfirmation =
    commandId !== null && (poller.command?.state === 'UNKNOWN' || poller.isTimedOut || networkLost);

  useEffect(() => {
    if (!awaitingConfirmation || commandId === null) return;
    tracker.markAwaitingConfirmation(commandId);
    finish(t('command.sent'));
  }, [awaitingConfirmation, commandId, finish, t, tracker]);

  const busy = mutation.isPending || commandId !== null;

  const submit = () => {
    const patch = form.patch;
    if (!patch || !form.isValid) return;
    setCommandError(null);
    setRequestError(null);
    const fingerprint = {
      wifiIndex,
      ssid: patch.ssid ?? null,
      password: patch.password === undefined ? null : { length: patch.password.length, edit: passwordEdit },
    };
    mutation.mutate(
      { wifiIndex, patch, idempotencyKey: keys.forAction(fingerprint) },
      {
        onSuccess: (created) => {
          keys.renew();
          // Drop the variables (new password) from the MutationCache right away.
          mutation.reset();
          setConfirmOpen(false);
          tracker.track({
            wifiIndex,
            command: created,
            patch: patch.ssid !== undefined ? { ssid: patch.ssid } : {},
          });
          setCommand(created);
        },
        onError: (error) => {
          setConfirmOpen(false);
          setRequestError(error);
          mutation.reset();
        },
      },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.patch && form.isValid && !busy) setConfirmOpen(true);
  };

  const ssidError = values.ssid !== network.ssid && form.errors.ssid ? t(form.errors.ssid) : undefined;
  const passwordError = values.password !== '' && form.errors.password ? t(form.errors.password) : undefined;
  const inlineError = commandError ?? (requestError ? toMessage(requestError) : null);

  return (
    <form className="wifi-edit-form" onSubmit={handleSubmit} noValidate>
      <div className="wifi-edit-form__card">
        <TextField
          label={t('edit.ssid')}
          name="ssid"
          value={values.ssid}
          maxLength={32}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          error={ssidError}
          onChange={(event) => setValues((current) => ({ ...current, ssid: event.target.value }))}
        />
        <TextField
          label={t('edit.password')}
          name="password"
          type="password"
          value={values.password}
          maxLength={63}
          autoComplete="new-password"
          placeholder={t('edit.passwordPlaceholder')}
          helper={t('edit.passwordHelper')}
          disabled={busy}
          error={passwordError}
          passwordToggleLabels={{ show: t('password.show'), hide: t('password.hide') }}
          onChange={(event) => {
            setPasswordEdit((edit) => edit + 1);
            setValues((current) => ({ ...current, password: event.target.value }));
          }}
        />
      </div>

      {inlineError && <SectionError message={inlineError} />}

      <div className="wifi-edit-form__footer">
        <Button type="submit" fullWidth loading={busy} disabled={!form.patch || !form.isValid || busy}>
          {commandId !== null ? t('edit.applying') : t('edit.save')}
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('edit.confirmTitle')}
        description={t('edit.confirmDescription')}
        cancelLabel={t('edit.cancel')}
        confirmLabel={t('edit.confirm')}
        confirmLoading={mutation.isPending}
        onConfirm={submit}
      />
    </form>
  );
}
