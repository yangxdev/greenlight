import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.ts';
import { inputClass, labelClass } from './styles.ts';

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  /** Help text under the field. */
  hint?: string;
  /** Validation message; also marks the field invalid for assistive tech. */
  error?: string;
}

/** A labelled multi-line field, wired like `Field`: mono label above, hint below, error as an alert. */
export function TextArea({ label, hint, error, className, rows = 4, ...props }: TextAreaProps) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={cn(labelClass, 'block')}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className={cn(inputClass, 'resize-y')}
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
