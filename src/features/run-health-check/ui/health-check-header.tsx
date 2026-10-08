import type { CSSProperties } from 'react';
import { Check, Globe, MonitorSmartphone, Router, X, type LucideIcon } from 'lucide-react';
import { HEALTH_CHECK_ITEM_ORDER, isTerminalHealthCheck, type HealthCheck } from '@/entities/health-check';
import { useErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { formatDateTime } from '@/shared/lib';
import { Button, cx, Icon, SpecNote } from '@/shared/ui';
import { progressPercent, stepStates, type StepState } from '../lib/health-check-presentation';
import './health-check-header.css';

const stepIcons = {
  INTERNET_LINE: Globe,
  WIFI_SIGNAL: Router,
  CONNECTED_DEVICES: MonitorSmartphone,
} as const satisfies Record<(typeof HEALTH_CHECK_ITEM_ORDER)[number], LucideIcon>;

const stepStateKey = {
  PENDING: 'step.statePending',
  RUNNING: 'step.stateRunning',
  DONE: 'step.stateDone',
  FAILED: 'step.stateFailed',
} as const satisfies Record<StepState, string>;

export interface HealthCheckHeaderProps {
  check: HealthCheck | null;
  isRunning: boolean;
  isTimedOut: boolean;
  startError: unknown;
  onRecheck: () => void;
  /** Blocks "Kiểm tra lại" (e.g. while the modem reboots). */
  recheckDisabled?: boolean;
}

/**
 * Header card of the Quality tab (XD Chatluong 5–7): 3-step stepper Đường truyền → Sóng Wi-fi →
 * Thiết bị kết nối, title, progress bar from the item states and "Đo lần gần nhất".
 */
export function HealthCheckHeader({
  check,
  isRunning,
  isTimedOut,
  startError,
  onRecheck,
  recheckDisabled = false,
}: HealthCheckHeaderProps) {
  const { t } = useTranslation('quality');
  const toMessage = useErrorMessage();
  const finished = !isRunning && check !== null && isTerminalHealthCheck(check);
  const steps = stepStates(check, HEALTH_CHECK_ITEM_ORDER);
  const percent = progressPercent(steps, finished);
  const lastChecked = finished ? formatDateTime(check.finishedAt ?? check.createdAt) : null;
  const showStartError = !isRunning && startError !== null && startError !== undefined;

  let overall: string | null = null;
  if (finished && check.overallStatus === 'ISSUES_FOUND') {
    overall = t('overall.ISSUES_FOUND', { n: check.issueCount ?? 0 });
  } else if (finished && check.overallStatus) {
    overall = t(`overall.${check.overallStatus}`);
  }

  return (
    <section className="health-header" aria-label={t('title')}>
      <ol className="health-header__steps">
        {steps.map(({ itemType, state }) => (
          <li
            key={itemType}
            className={cx('health-step', `health-step--${state.toLowerCase()}`)}
            aria-label={t('step.a11y', { name: t(`step.${itemType}`), state: t(stepStateKey[state]) })}
          >
            <span className="health-step__circle" aria-hidden="true">
              <Icon icon={stepIcons[itemType]} size={22} />
              {state === 'DONE' && (
                <span className="health-step__badge">
                  <Icon icon={Check} size={10} strokeWidth={3} />
                </span>
              )}
              {state === 'FAILED' && (
                <span className="health-step__badge health-step__badge--failed">
                  <Icon icon={X} size={10} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="health-step__label" aria-hidden="true">
              {t(`step.${itemType}`)}
            </span>
          </li>
        ))}
      </ol>

      <div className="health-header__status" aria-live="polite">
        {finished && (
          <>
            <h3 className="health-header__title">{t('header.done')}</h3>
            {overall && <p className="health-header__overall">{overall}</p>}
          </>
        )}
        {!finished && !showStartError && (
          <>
            <h3 className="health-header__title">{t('header.running')}</h3>
            <p className="health-header__hint">{t('header.runningHint')}</p>
          </>
        )}
        {!finished && showStartError && <h3 className="health-header__title">{t('header.startError')}</h3>}
        {finished && isTimedOut && <p className="health-header__error">{t('header.timeout')}</p>}
        {showStartError && (
          <p className="health-header__error" role="alert">
            {toMessage(startError)}
          </p>
        )}
      </div>

      <div
        className="health-header__progress"
        role="progressbar"
        aria-label={t('header.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span
          className="health-header__progress-fill"
          style={{ '--progress': percent / 100 } as CSSProperties}
        />
      </div>

      {(finished || showStartError) && (
        <div className="health-header__footer">
          {lastChecked && (
            <p className="health-header__last">{t('header.lastChecked', { time: lastChecked })}</p>
          )}
          <span className="health-header__recheck">
            <Button variant="secondary" size="sm" onClick={onRecheck} disabled={recheckDisabled}>
              {t('header.recheck')}
            </Button>
            <SpecNote id="healthRecheckButton" />
          </span>
        </div>
      )}
    </section>
  );
}
