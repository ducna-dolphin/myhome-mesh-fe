import { useId, useRef, type KeyboardEvent } from 'react';
import { DeviceIcon, deviceIconSchema, type DeviceIconCode } from '@/entities/connected-device';
import { useTranslation } from '@/shared/i18n';
import { cx } from '@/shared/ui';

const ICONS = deviceIconSchema.options;

export interface DeviceIconPickerProps {
  value: DeviceIconCode;
  onChange: (icon: DeviceIconCode) => void;
  disabled?: boolean;
}

const KEY_STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * 4×2 icon grid (XD s28) as a WAI-ARIA radio group: one tab stop on the checked icon; arrow keys
 * move and select (wrapping), Home/End jump to the first/last icon.
 */
export function DeviceIconPicker({ value, onChange, disabled = false }: DeviceIconPickerProps) {
  const { t } = useTranslation('devices');
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const icon = ICONS[(index + ICONS.length) % ICONS.length]!;
    onChange(icon);
    refs.current[ICONS.indexOf(icon)]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key in KEY_STEP) next = index + KEY_STEP[event.key]!;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ICONS.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div className="device-icon-picker">
      <span className="device-icon-picker__label" id={labelId}>
        {t('edit.iconLabel')}
      </span>
      <div className="device-icon-picker__grid" role="radiogroup" aria-labelledby={labelId}>
        {ICONS.map((icon, index) => {
          const checked = icon === value;
          return (
            <button
              key={icon}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={t(`edit.icon.${icon}`)}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              className={cx('device-icon-picker__option', checked && 'is-checked')}
              onClick={() => onChange(icon)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <DeviceIcon icon={icon} size={24} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
