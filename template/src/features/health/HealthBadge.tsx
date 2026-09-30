import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { checkHealth, selectHealth } from './healthSlice.ts';

// Status dots are the one sanctioned round element.
const dot = {
  idle: 'bg-subtle',
  loading: 'bg-subtle animate-pulse',
  ok: 'bg-success',
  error: 'bg-danger',
} as const;

export function HealthBadge() {
  const dispatch = useAppDispatch();
  const { status } = useAppSelector(selectHealth);

  useEffect(() => {
    void dispatch(checkHealth());
  }, [dispatch]);

  const label =
    status === 'ok' ? 'API online' : status === 'error' ? 'API offline' : 'Checking API…';

  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-ink">
      <span aria-hidden className={`size-2 rounded-full ${dot[status]}`} />
      {label}
    </span>
  );
}
