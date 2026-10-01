import type { InputHTMLAttributes } from 'react';
import { LuCheck } from 'react-icons/lu';
import { cn } from '../../lib/cn.ts';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * A square checkbox that matches the house style in every browser (the native one is rounded on most platforms).
 * It is still a real <input type="checkbox">: label it with <label htmlFor> or wrap it in a <label>.
 */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <span className={cn('relative inline-grid size-5 shrink-0 place-items-center', className)}>
      <input
        type="checkbox"
        className={
          'peer size-5 cursor-pointer appearance-none border border-line-strong bg-canvas ' +
          'transition-colors duration-(--duration-hover) ease-out-soft hover:border-ink ' +
          'checked:border-ink checked:bg-ink disabled:cursor-not-allowed disabled:opacity-40'
        }
        {...props}
      />
      <LuCheck
        aria-hidden
        className="pointer-events-none absolute hidden size-3.5 text-on-ink peer-checked:block"
        strokeWidth={3}
      />
    </span>
  );
}
