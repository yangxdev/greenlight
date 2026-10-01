import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.ts';
import { inputClass, labelClass } from './styles.ts';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Help text under the field. */
  hint?: string;
  /** Validation message; also marks the input invalid for assistive tech. */
  error?: string;
}

/** A labelled text input. The label, hint and error are wired to the input by id. */
export function Field({ label, hint, error, className, ...props }: FieldProps) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={cn(labelClass, 'block')}>
        {label}
      </label>
      <input
        id={id}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-note text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-note text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
