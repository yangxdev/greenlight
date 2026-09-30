/**
 * Join class names, dropping anything falsy. Deliberately not clsx + tailwind-merge: components here don't
 * compose conflicting utilities, so the merge step would be a dependency earning nothing.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
