/**
 * The house style as class strings, so any element can wear it (a link styled as a button stays an <a>, a row can
 * be an <li> or an <article>). Components in this folder use these; feature code should too, instead of re-typing
 * utilities. All colours come from tokens in src/index.css. Corners are square everywhere.
 */

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const buttonBase =
  'inline-flex cursor-pointer items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-colors duration-(--duration-hover) ease-out-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40';

/**
 * One primary per view: a solid ink block, like sakana.ai's "Start Building". The accent is NOT a button colour;
 * a vermilion call-to-action is the template look this house style avoids. Everything else is ghost.
 */
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'border border-ink bg-ink text-on-ink hover:border-ink-soft hover:bg-ink-soft',
  ghost: 'border border-line-strong bg-canvas text-ink hover:border-ink',
  danger:
    'border border-line-strong bg-canvas text-danger hover:border-danger hover:bg-danger-soft',
};

/** 36px under a mouse, 44px under a finger: `pointer-coarse:` asks about the input, not the window width. */
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-small pointer-coarse:py-2.5',
  md: 'px-6 py-3 text-small pointer-coarse:py-3.5',
};

export function buttonClass(variant: ButtonVariant = 'ghost', size: ButtonSize = 'md'): string {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

/** A square icon-only control: 32px drawn, 44px on touch. Always give it an aria-label. */
export const iconButtonClass =
  'inline-flex size-8 cursor-pointer items-center justify-center text-muted ' +
  'transition-colors duration-(--duration-hover) ease-out-soft hover:bg-sunken hover:text-ink pointer-coarse:size-11';

/**
 * One option in a row of filters or tabs: an uppercase mono word over a 2px rule. The selected option gets the
 * accent rule and ink text, like the lit item in sakana.ai's navigation. Use with aria-pressed or aria-selected.
 */
export function optionClass(selected: boolean): string {
  return (
    'inline-flex cursor-pointer items-baseline gap-1.5 border-b-2 pt-2 pb-2.5 font-mono text-label uppercase ' +
    'transition-colors duration-(--duration-hover) ease-out-soft pointer-coarse:pt-3.5 pointer-coarse:pb-3 ' +
    (selected ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink')
  );
}

/** A hairline box with square corners and no shadow. Grids of cells share borders: see `CellGrid`. */
export const cellClass = 'border border-line bg-canvas';

/** Kept for code written against the old card style: now the same flat cell. */
export const cardClass = cellClass;

export const inputClass =
  'block w-full min-w-0 border border-line-strong bg-canvas px-3.5 py-2.5 text-body text-ink ' +
  'placeholder:text-subtle transition-colors duration-(--duration-hover) ease-out-soft hover:border-ink ' +
  'aria-invalid:border-danger pointer-coarse:py-3';

/** The uppercase mono caption: field labels, column heads, metadata. 11px, 0.12em tracking. */
export const labelClass = 'font-mono text-label uppercase text-muted';

/** A section or item index ("01"): the accent's most common, and most legitimate, appearance. */
export const indexClass = 'font-mono text-label text-brand tnum';

/** A small tag in a hairline box: a category, a platform, a stack name. Never a pill. */
export const chipClass =
  'inline-flex items-center border border-line px-2 py-1 font-mono text-[0.625rem] leading-none uppercase tracking-[0.12em] text-muted';

/** For codes, IDs, paths, money and times: things people transcribe or compare. */
export const monoClass = 'font-mono tnum';

/** Inline text links: ink with a quiet underline that takes the accent on hover. */
export const linkClass =
  'text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-(--duration-hover) ' +
  'ease-out-soft hover:text-brand hover:decoration-brand';

/** Header, hero, sections and footer share one container, so their left edges line up at every width. */
export const containerClass = 'mx-auto w-full max-w-measure';
