/**
 * The house style as class strings, so any element can wear it (a link styled as a button stays an <a>, a card can
 * be an article or a Link). Components in this folder use these; feature code should too, instead of re-typing
 * utilities. All colours come from tokens in src/index.css.
 */

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const buttonBase =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium ' +
  'transition-colors duration-(--duration-hover) ease-out-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40';

/** One primary (filled, brand) per view; everything else ghost. Danger is outlined, never brand. */
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand shadow-(--shadow-card) hover:bg-brand-hover',
  ghost: 'border border-line-strong bg-surface text-ink hover:border-ink hover:bg-sunken',
  danger:
    'border border-line-strong bg-surface text-danger hover:border-danger hover:bg-danger-soft',
};

/** 36px under a mouse, 44px under a finger: `pointer-coarse:` asks about the input, not the window width. */
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm pointer-coarse:py-3',
};

export function buttonClass(variant: ButtonVariant = 'ghost', size: ButtonSize = 'md'): string {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

/** A square icon-only control: 32px drawn, 44px on touch. Always give it an aria-label. */
export const iconButtonClass =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted ' +
  'transition-colors duration-(--duration-hover) ease-out-soft hover:bg-sunken hover:text-ink pointer-coarse:size-11';

/** Softly rounded, hairline, barely lifted; lifts a little more on hover. */
export const cardClass =
  'rounded-md border border-line bg-surface shadow-(--shadow-card) transition-shadow ' +
  'duration-(--duration-hover) ease-out-soft hover:border-line-strong hover:shadow-(--shadow-lift)';

export const inputClass =
  'block w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-subtle transition-colors duration-(--duration-hover) ease-out-soft hover:border-ink ' +
  'aria-invalid:border-danger pointer-coarse:py-3';

/** The small uppercase caption above a value or a field. */
export const labelClass = 'text-label font-medium uppercase text-muted';

/** For codes, IDs, money and times: things people transcribe. Not for captions. */
export const monoClass = 'font-mono tnum';
