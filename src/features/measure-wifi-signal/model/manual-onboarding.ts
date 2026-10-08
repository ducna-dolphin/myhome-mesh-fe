import { useSyncExternalStore } from 'react';

export type AuStatus = 'unknown' | 'installed';
export type ManualIntroVariant = 'need-app' | 'guide-full' | 'guide-short';

export interface ManualOnboardingState {
  /** The user confirmed AirPort Utility is installed (it cannot be detected: no URL scheme). */
  auStatus: AuStatus;
  /** The full 4-step guide was already shown on this device in this session. */
  iosGuideSeen: boolean;
}

/**
 * Session-only memory. Deliberate deviation from the old Phase 6 plan (localStorage per user):
 * LLD §11.5 allows only `lastTab` in device storage, so this resets when the mini app closes.
 */
const initialState: ManualOnboardingState = { auStatus: 'unknown', iosGuideSeen: false };
let state: ManualOnboardingState = initialState;
const listeners = new Set<() => void>();

function emit(next: ManualOnboardingState) {
  state = next;
  for (const listener of listeners) listener();
}

export const manualOnboarding = {
  get: (): ManualOnboardingState => state,
  markAppInstalled: () => {
    if (state.auStatus !== 'installed') emit({ ...state, auStatus: 'installed' });
  },
  markGuideSeen: () => {
    if (!state.iosGuideSeen) emit({ ...state, iosGuideSeen: true });
  },
  /** Tests only. */
  reset: () => emit(initialState),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function introVariantFor({ auStatus, iosGuideSeen }: ManualOnboardingState): ManualIntroVariant {
  if (auStatus !== 'installed') return 'need-app';
  return iosGuideSeen ? 'guide-short' : 'guide-full';
}

export function useManualOnboarding(): ManualOnboardingState {
  return useSyncExternalStore(manualOnboarding.subscribe, manualOnboarding.get, manualOnboarding.get);
}
