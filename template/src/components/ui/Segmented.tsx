import { optionClass } from './styles.ts';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Shown after the label in small mono, e.g. how many items the option holds. */
  count?: number;
}

interface SegmentedProps<T extends string> {
  /** Names the group for assistive tech, e.g. "Filter by platform". */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of mutually exclusive filters: mono words over a hairline, the selected one underlined in the accent. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-x-6 border-b border-line pointer-coarse:gap-x-5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`-mb-px ${optionClass(selected)}`}
          >
            {option.label}
            {/* A space so the accessible name reads "Web 1", not "Web1"; flex layout ignores it. */}
            {option.count === undefined ? null : ' '}
            {option.count === undefined ? null : (
              <span className="tnum text-subtle">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
