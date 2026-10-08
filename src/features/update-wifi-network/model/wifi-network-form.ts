import { z } from 'zod';
import type { WifiNetwork, WifiNetworkPatch } from '@/entities/wifi-network';

/** Message keys inside the `wifi` namespace. */
export type WifiFormErrorKey =
  | 'edit.errors.ssidRequired'
  | 'edit.errors.ssidTooLong'
  | 'edit.errors.ssidInvalid'
  | 'edit.errors.passwordLength'
  | 'edit.errors.passwordInvalid';

const SSID_MAX_BYTES = 32;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

/** SSID: 1–32 bytes (802.11 limit; ASCII = 32 characters), no control characters (WF-05). */
export const wifiSsidInputSchema = z
  .string()
  .min(1, 'edit.errors.ssidRequired' satisfies WifiFormErrorKey)
  .refine((value) => value.trim().length > 0, 'edit.errors.ssidRequired' satisfies WifiFormErrorKey)
  .refine((value) => !CONTROL_CHARS.test(value), 'edit.errors.ssidInvalid' satisfies WifiFormErrorKey)
  .refine(
    (value) => utf8Length(value) <= SSID_MAX_BYTES,
    'edit.errors.ssidTooLong' satisfies WifiFormErrorKey,
  );

/** Password: empty = unchanged; otherwise 8–63 printable ASCII characters (WPA2-PSK, WF-05 / M-09). */
export const wifiPasswordInputSchema = z
  .string()
  .refine((value) => PRINTABLE_ASCII.test(value), 'edit.errors.passwordInvalid' satisfies WifiFormErrorKey)
  .refine(
    (value) => value === '' || (value.length >= 8 && value.length <= 63),
    'edit.errors.passwordLength' satisfies WifiFormErrorKey,
  );

export interface WifiNetworkFormValues {
  ssid: string;
  password: string;
}

export interface WifiNetworkFormState {
  errors: { ssid?: WifiFormErrorKey; password?: WifiFormErrorKey };
  /** Merge patch with only the changed fields; `null` when nothing changed. */
  patch: WifiNetworkPatch | null;
  isValid: boolean;
}

const firstError = (result: z.SafeParseReturnType<string, string>) =>
  result.success ? undefined : (result.error.issues[0]?.message as WifiFormErrorKey | undefined);

/** Validates the form and builds the diff-only merge patch (never resends unchanged fields). */
export function evaluateWifiNetworkForm(
  network: Pick<WifiNetwork, 'ssid'>,
  values: WifiNetworkFormValues,
): WifiNetworkFormState {
  const errors = {
    ssid: firstError(wifiSsidInputSchema.safeParse(values.ssid)),
    password: firstError(wifiPasswordInputSchema.safeParse(values.password)),
  };
  const patch: WifiNetworkPatch = {};
  if (values.ssid !== network.ssid) patch.ssid = values.ssid;
  if (values.password !== '') patch.password = values.password;
  const hasChanges = Object.keys(patch).length > 0;
  return {
    errors,
    patch: hasChanges ? patch : null,
    isValid: !errors.ssid && !errors.password,
  };
}
