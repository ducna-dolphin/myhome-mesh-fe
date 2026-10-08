import { useCallback } from 'react';
import { useRevealWifiPasswordMutation } from '@/entities/wifi-network';
import { useErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useSuperApp, type SuperAppClient } from '@/shared/super-app';
import { useToast } from '@/shared/ui';

/** Bridge `copyText` when the host supports it (WebView clipboard may be blocked, S-07), else the Clipboard API. */
async function writeClipboard(superApp: SuperAppClient, text: string): Promise<void> {
  if (superApp.supports('copyText')) {
    await superApp.copyText(text);
    return;
  }
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
  await navigator.clipboard.writeText(text);
}

/**
 * "Sao chép mật khẩu" (P3-01, purpose COPY): reveals, copies, toasts. The password is never stored:
 * the mutation is reset as soon as the text is handed to the clipboard.
 */
export function useCopyWifiPassword(serialNumber: string) {
  const { t } = useTranslation('wifi');
  const toast = useToast();
  const toMessage = useErrorMessage();
  const superApp = useSuperApp();
  const { mutateAsync, reset, isPending } = useRevealWifiPasswordMutation(serialNumber);

  const copy = useCallback(
    /** Resolves true once the password is on the clipboard (for an inline "copied" state). */
    async (wifiIndex: number): Promise<boolean> => {
      let password: string;
      try {
        password = (await mutateAsync({ wifiIndex, purpose: 'COPY' })).password;
      } catch (error) {
        reset();
        toast.show(toMessage(error), { tone: 'danger' });
        return false;
      }
      reset();
      try {
        await writeClipboard(superApp, password);
        toast.show(t('password.copied'));
        return true;
      } catch {
        toast.show(t('password.copyFailed'), { tone: 'danger' });
        return false;
      }
    },
    [mutateAsync, reset, superApp, t, toMessage, toast],
  );

  return { copy, isPending };
}
