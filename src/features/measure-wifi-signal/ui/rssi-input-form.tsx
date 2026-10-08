import { useState, type FormEvent } from 'react';
import { Trans } from 'react-i18next';
import { classifyRssiLevel, type RssiThresholds } from '@/entities/measurement-location';
import { useTranslation } from '@/shared/i18n';
import { Button, cx, SignalBars, TextField } from '@/shared/ui';
import { MANUAL_RSSI_MAX, MANUAL_RSSI_MIN, parseManualRssi } from '../model/meters';

export interface RssiInputFormProps {
  thresholds: RssiThresholds;
  ssid: string | null;
  /** iPhone shows the AirPort Utility links; Android manual input does not. */
  airPortUtility: boolean;
  saving: boolean;
  onSubmit: (absoluteRssi: number) => void;
  onShowGuide: () => void;
  onOpenApp: () => void;
}

/**
 * RSSI typed by the user (QD-04): fixed "−" prefix, "dBm" suffix, digits only, valid 30…100.
 * The only place where dBm is shown (QD-06 exception).
 */
export function RssiInputForm({
  thresholds,
  ssid,
  airPortUtility,
  saving,
  onSubmit,
  onShowGuide,
  onOpenApp,
}: RssiInputFormProps) {
  const { t } = useTranslation('survey');
  const [raw, setRaw] = useState('');
  const value = parseManualRssi(raw);
  const level = value === null ? null : classifyRssiLevel(-value, thresholds);
  const showRangeError = raw.length >= 2 && value === null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value !== null && !saving) onSubmit(value);
  };

  let helper;
  if (!airPortUtility) helper = t('manual.input.helperAndroid');
  else if (ssid)
    helper = <Trans t={t} i18nKey="manual.input.helper" values={{ ssid }} components={{ b: <strong /> }} />;
  else helper = t('manual.input.helperGeneric');

  return (
    <form className="rssi-form" onSubmit={handleSubmit} noValidate>
      <TextField
        label={t('manual.input.label')}
        prefix="−"
        suffix="dBm"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        autoFocus
        clearable={false}
        placeholder={t('manual.input.placeholder')}
        value={raw}
        maxLength={3}
        showCounter={false}
        onChange={(event) => setRaw(event.target.value.replace(/\D/g, '').slice(0, 3))}
        helper={helper}
        error={
          showRangeError ? t('manual.input.range', { min: MANUAL_RSSI_MIN, max: MANUAL_RSSI_MAX }) : undefined
        }
      />
      {level && (
        <p
          className={cx('rssi-form__preview', `rssi-form__preview--${level.toLowerCase()}`)}
          aria-live="polite"
        >
          <SignalBars level={level} />
          <span>{t('manual.input.preview', { level: t(`level.${level}`) })}</span>
        </p>
      )}
      {airPortUtility && (
        <div className="rssi-form__links">
          <button type="button" className="manual-link" onClick={onShowGuide}>
            {t('manual.input.showGuide')}
          </button>
          <button type="button" className="manual-link" onClick={onOpenApp}>
            {t('manual.input.openApp')}
          </button>
        </div>
      )}
      <Button type="submit" fullWidth disabled={value === null} loading={saving}>
        {t('manual.input.save')}
      </Button>
    </form>
  );
}
