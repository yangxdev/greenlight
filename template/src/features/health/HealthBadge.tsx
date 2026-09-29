import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts'
import { checkHealth, selectHealth } from './healthSlice.ts'

const styles = {
  idle: 'bg-slate-100 text-slate-600',
  loading: 'bg-slate-100 text-slate-600',
  ok: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
} as const

export function HealthBadge() {
  const dispatch = useAppDispatch()
  const { status } = useAppSelector(selectHealth)

  useEffect(() => {
    void dispatch(checkHealth())
  }, [dispatch])

  const label = status === 'ok' ? 'API online' : status === 'error' ? 'API offline' : 'Checking API…'

  return (
    <span role="status" className={`rounded-full px-3 py-1 text-sm font-medium ${styles[status]}`}>
      {label}
    </span>
  )
}
