'use client';

import { useEffect, useRef, type ChangeEvent, type ReactNode } from 'react';
import { StatusIcon } from './icons';
import { Alert } from './ui';

interface BaseProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | undefined;
}

function Label({ id, label, required }: Pick<BaseProps, 'id' | 'label' | 'required'>) {
  return (
    <label htmlFor={id}>
      {label}
      {required ? (
        <>
          {' '}
          <span className="req" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </label>
  );
}

function Messages({ id, hint, error }: Pick<BaseProps, 'id' | 'hint' | 'error'>) {
  return (
    <>
      {hint ? (
        <span className="hint" id={`${id}-h`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="err" id={`${id}-e`}>
          <StatusIcon name="warn" />
          <span>{error}</span>
        </span>
      ) : null}
    </>
  );
}

function describedBy(id: string, hint: ReactNode, error: string | undefined): string | undefined {
  const ids = [error ? `${id}-e` : '', hint ? `${id}-h` : ''].filter(Boolean).join(' ');
  return ids || undefined;
}

export function TextField({
  id,
  label,
  required,
  hint,
  error,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
  placeholder,
  maxWidth,
  disabled,
  min,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'tel'
    | 'number'
    | 'date'
    | 'time'
    | 'search'
    | 'datetime-local';
  inputMode?: 'numeric' | 'tel' | 'text' | 'search';
  autoComplete?: string;
  placeholder?: string;
  maxWidth?: string;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div className="field">
      <Label id={id} label={label} required={required} />
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        style={maxWidth ? { maxWidth } : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  required,
  hint,
  error,
  value,
  onChange,
  rows = 2,
  disabled,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <Label id={id} label={label} required={required} />
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(e) => onChange(e.target.value)}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  required,
  hint,
  error,
  value,
  onChange,
  options,
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="field">
      <Label id={id} label={label} required={required} />
      <select
        id={id}
        name={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

export function CheckField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label className="choice" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          name={id}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
    </div>
  );
}

/** Radio group shown as pill buttons (customer type, term, method). */
export function RadioGroup<T extends string>({
  name,
  label,
  value,
  onChange,
  options,
  error,
}: {
  name: string;
  label: string;
  value: T | '';
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  error?: string | undefined;
}) {
  const labelId = `${name}-l`;
  return (
    <div
      className="field"
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={error ? `${name}-e` : undefined}
    >
      <span className="lbl" id={labelId}>
        {label}
      </span>
      <div className="seg">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />{' '}
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <span className="err" id={`${name}-e`}>
          <StatusIcon name="warn" />
          <span>{error}</span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Form-level summary shown after a failed submit. It takes focus, so keyboard and screen-reader users
 * land on it, and links to each field with a problem.
 */
export function ErrorSummary({
  errors,
  labels,
  serverError,
}: {
  errors: Record<string, string | undefined>;
  /** field key -> element id to focus and a short label */
  labels: Record<string, { id: string; label: string }>;
  serverError?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const keys = Object.keys(errors).filter((k) => errors[k]);
  const count = keys.length;
  const signature = `${keys.join(',')}|${serverError ?? ''}`;

  useEffect(() => {
    if (signature !== '|') ref.current?.focus();
  }, [signature]);

  if (count === 0 && !serverError) return null;
  return (
    <div ref={ref} tabIndex={-1} data-testid="error-summary">
      <Alert
        tone="err"
        title={
          serverError
            ? 'This could not be saved.'
            : `${count} ${count === 1 ? 'field needs' : 'fields need'} fixing`
        }
      >
        {serverError ? <span>{serverError}</span> : null}
        {count > 0 ? (
          <ul style={{ margin: 'var(--sp-1) 0 0', paddingLeft: '1.1rem' }}>
            {keys.map((key) => {
              const target = labels[key];
              return (
                <li key={key}>
                  <a
                    href={`#${target?.id ?? key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(target?.id ?? key)?.focus();
                    }}
                  >
                    {target?.label ?? key}
                  </a>
                  : {errors[key]}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Alert>
    </div>
  );
}
