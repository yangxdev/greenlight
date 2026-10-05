import { cn } from '../../lib/cn.ts';

export type StatusTone = 'success' | 'warning' | 'danger' | 'idle' | 'attention';

const TONES: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  idle: 'bg-line-strong',
  // The accent: "a person is needed here". Rationed like every other appearance of it.
  attention: 'bg-brand',
};

interface StatusDotProps {
  tone: StatusTone;
  /** Read by screen readers in place of the dot: "Up", "Failed", "Waiting for you". */
  label: string;
  className?: string;
}

/** The one round element in the house style. Colour means status only; the label carries the same meaning in words. */
export function StatusDot({ tone, label, className }: StatusDotProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-block size-2 shrink-0 rounded-full', TONES[tone], className)}
    />
  );
}
