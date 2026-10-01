import { describe, expect, it } from 'vitest';
import { findViolations } from './check-style.ts';

const found = (source: string) => findViolations(source, 'x.tsx').map((v) => v.found);

describe('house-style guard', () => {
  it('flags the generated-site habits in class names, with or without variants', () => {
    const source = [
      `<div className="rounded-xl shadow-lg backdrop-blur bg-canvas/80">`,
      `<p className="bg-linear-to-r from-brand to-ink bg-clip-text text-transparent">`,
      `const x = cn('hover:md:!rounded-2xl', 'animate-spin', 'text-[#6366f1]');`,
    ].join('\n');
    expect(found(source)).toEqual([
      'rounded-xl',
      'shadow-lg',
      'backdrop-blur',
      'bg-linear-to-r',
      'from-brand',
      'bg-clip-text',
      'text-transparent',
      'hover:md:!rounded-2xl',
      'animate-spin',
      'text-[#6366f1]',
    ]);
  });

  it('allows what the house style uses', () => {
    const source = [
      `<span className="size-2 rounded-full bg-success" />`,
      `<div className="shadow-(--shadow-panel) animate-pulse border border-line rounded-none" />`,
      `<a className="text-brand">See it ↗</a> © 2026`,
    ].join('\n');
    expect(found(source)).toEqual([]);
  });

  it('leaves prose alone, flags bare words only inside class lists', () => {
    expect(found(`const copy = 'Totals are rounded down, with a shadow of doubt';`)).toEqual([]);
    expect(found(`<div className="rounded border-line p-4" />`)).toEqual(['rounded']);
  });

  it('flags colour literals and emoji, but not in comments', () => {
    const source = [
      `const style = { color: '#fff' };`,
      `<p>Done 🎉</p>`,
      `// 🎉 rounded-xl '#fff' in a comment is fine`,
    ].join('\n');
    expect(findViolations(source, 'x.tsx').map((v) => [v.line, v.found])).toEqual([
      [1, '#fff'],
      [2, '🎉'],
    ]);
  });

  it('skips a line marked as an exception', () => {
    const source = [
      `// style-guard-ignore: the browser chrome colour must be a literal`,
      `const THEME_COLOR = { light: '#ffffff' };`,
    ].join('\n');
    expect(found(source)).toEqual([]);
  });

  it('ignores template expressions but checks the static parts', () => {
    expect(found('const c = `rounded-lg ${open ? "a" : "b"} p-4`;')).toEqual(['rounded-lg']);
  });
});
