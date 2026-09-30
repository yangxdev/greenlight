import { useState } from 'react';
import { LuMoon, LuSun } from 'react-icons/lu';
import { applyTheme, readTheme, type Theme } from '../../lib/theme.ts';
import { IconButton } from './Button.tsx';

/**
 * Two states, one button. The icon shows what you will GET (a sun while dark means "go light"), and the label
 * spells it out for screen readers.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const Icon = next === 'light' ? LuSun : LuMoon;

  return (
    <IconButton
      label={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      <Icon className="size-4" aria-hidden />
    </IconButton>
  );
}
