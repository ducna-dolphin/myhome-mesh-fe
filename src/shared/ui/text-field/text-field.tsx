import { Eye, EyeOff, X } from 'lucide-react';
import {
  useCallback,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslation } from '@/shared/i18n';
import { cx } from '../class-names';
import { Icon } from '../icon/icon';
import '../motion';
import './text-field.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> {
  label: string;
  helper?: ReactNode;
  /** Error message; also sets `aria-invalid`. */
  error?: ReactNode;
  /** Shows an `n/max` counter when `maxLength` is set (default true). */
  showCounter?: boolean;
  /** Fixed adornment before the input, e.g. `−` for RSSI. */
  prefix?: ReactNode;
  /** Fixed adornment after the input, e.g. `dBm`. */
  suffix?: ReactNode;
  /** Accessible names for the reveal button; required to render it for `type="password"`. */
  passwordToggleLabels?: { show: string; hide: string };
  /**
   * Clear (×) button at the end while the field has a value. Defaults to true for editable text
   * fields without a suffix; never shown on password fields (they have the reveal button).
   */
  clearable?: boolean;
  /** Removes leading/trailing spaces when the field loses focus (names). */
  trimOnBlur?: boolean;
  /** Extra class on the field wrapper. */
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Remaining characters at which the counter turns to the warning colour. */
function counterWarningThreshold(maxLength: number): number {
  return Math.max(2, Math.ceil(maxLength * 0.1));
}

const valueSetter =
  typeof HTMLInputElement === 'function'
    ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    : undefined;

/**
 * Sets the input value the way typing does, so React's `onChange` fires for controlled and
 * uncontrolled fields alike.
 */
function setNativeValue(input: HTMLInputElement, next: string) {
  if (valueSetter) valueSetter.call(input, next);
  else input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export function TextField({
  label,
  helper,
  error,
  showCounter = true,
  prefix,
  suffix,
  passwordToggleLabels,
  clearable,
  trimOnBlur = false,
  className,
  id,
  type = 'text',
  maxLength,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  readOnly,
  ref,
  ...rest
}: TextFieldProps) {
  const { t } = useTranslation('common');
  const autoId = useId();
  const inputId = id ?? `text-field-${autoId}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const counterId = `${inputId}-counter`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uncontrolledLength, setUncontrolledLength] = useState(String(defaultValue ?? '').length);
  const [revealed, setRevealed] = useState(false);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  const length = value !== undefined && value !== null ? String(value).length : uncontrolledLength;
  const counterVisible = showCounter && maxLength !== undefined;
  const nearLimit = counterVisible && maxLength - length <= counterWarningThreshold(maxLength);
  const isPassword = type === 'password';
  const canReveal = isPassword && passwordToggleLabels !== undefined;
  const canClear = (clearable ?? suffix === undefined) && !isPassword && !disabled && !readOnly;
  const showClear = canClear && length > 0;
  const describedBy =
    [error ? errorId : helper ? helperId : null, counterVisible ? counterId : null, rest['aria-describedby']]
      .filter(Boolean)
      .join(' ') || undefined;

  const clear = () => {
    const input = inputRef.current;
    if (!input) return;
    setNativeValue(input, '');
    input.focus();
  };

  return (
    <div
      className={cx('ui-text-field', Boolean(error) && 'is-invalid', disabled && 'is-disabled', className)}
    >
      <div className="ui-text-field__header">
        <label className="ui-text-field__label" htmlFor={inputId}>
          {label}
        </label>
        {counterVisible && (
          <span className={cx('ui-text-field__counter', nearLimit && 'is-near-limit')} id={counterId}>
            {length}/{maxLength}
          </span>
        )}
      </div>
      <div className="ui-text-field__control">
        {prefix !== undefined && (
          <span className="ui-text-field__affix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          {...rest}
          ref={setRefs}
          id={inputId}
          className="ui-text-field__input"
          type={canReveal && revealed ? 'text' : type}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : rest['aria-invalid']}
          aria-describedby={describedBy}
          onChange={(event) => {
            if (value === undefined) setUncontrolledLength(event.target.value.length);
            onChange?.(event);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            const input = event.currentTarget;
            if (trimOnBlur && input.value !== input.value.trim()) setNativeValue(input, input.value.trim());
          }}
        />
        {showClear && (
          <button
            type="button"
            className="ui-text-field__clear"
            aria-label={t('action.clearField', { label })}
            aria-controls={inputId}
            // Keep the focus (and the on-screen keyboard) in the input.
            onPointerDown={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
          >
            <span className="ui-text-field__clear-dot" aria-hidden="true">
              <Icon icon={X} size={12} strokeWidth={2.5} />
            </span>
          </button>
        )}
        {suffix !== undefined && (
          <span className="ui-text-field__affix" aria-hidden="true">
            {suffix}
          </span>
        )}
        {canReveal && (
          <button
            type="button"
            className="ui-text-field__reveal"
            aria-label={revealed ? passwordToggleLabels.hide : passwordToggleLabels.show}
            aria-pressed={revealed}
            aria-controls={inputId}
            disabled={disabled}
            onClick={() => setRevealed((current) => !current)}
          >
            <Icon key={revealed ? 'hide' : 'show'} icon={revealed ? EyeOff : Eye} className="ui-icon-swap" />
          </button>
        )}
      </div>
      {error ? (
        <p className="ui-text-field__message ui-text-field__message--error" id={errorId}>
          {error}
        </p>
      ) : (
        helper && (
          <p className="ui-text-field__message" id={helperId}>
            {helper}
          </p>
        )
      )}
    </div>
  );
}
