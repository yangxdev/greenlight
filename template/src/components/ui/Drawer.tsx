import { useEffect, useId, useRef, type ReactNode } from 'react';
import { LuX } from 'react-icons/lu';
import { IconButton } from './Button.tsx';
import { labelClass } from './styles.ts';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** The dialog's name, shown at the top. */
  title: ReactNode;
  /** A mono line above the title: "#12", "New". */
  eyebrow?: ReactNode;
  children: ReactNode;
  /** Pinned under the content: the form's buttons. */
  footer?: ReactNode;
}

/**
 * A panel that slides over the right edge for a detail or a form, without leaving the view. One of the two places
 * a shadow is allowed. Escape and the backdrop close it; focus moves in on open and back out on close.
 */
export function Drawer({ open, onClose, title, eyebrow, children, footer }: DrawerProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-(--spacing-drawer) flex-col border-l border-line bg-canvas shadow-(--shadow-panel) outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            {eyebrow ? <p className={labelClass}>{eyebrow}</p> : null}
            <h2
              id={titleId}
              className={`text-h3 font-semibold text-balance text-ink ${eyebrow ? 'mt-1.5' : ''}`}
            >
              {title}
            </h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <LuX aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4 pb-[calc(1rem+var(--safe-b))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
