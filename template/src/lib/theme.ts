export type Theme = 'light' | 'dark';

/** Same key as the boot script in index.html. */
export const THEME_STORAGE_KEY = 'theme';

const THEME_COLOR: Record<Theme, string> = { light: '#ffffff', dark: '#0f100f' };

/**
 * The stored choice, or light. Light is the default even on a dark system: a decision, not an omission.
 * localStorage THROWS (rather than returning null) when storage is denied, e.g. Safari private browsing,
 * so both accessors swallow errors: losing the preference is fine, losing the page is not.
 */
export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR[theme];
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this session; it just won't survive a reload.
  }
}
