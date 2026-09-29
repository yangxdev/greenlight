import { HealthBadge } from './features/health/HealthBadge.tsx'

export default function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6 font-sans">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">greenlight-product</h1>
      <p className="text-lg text-slate-600">
        Scaffolded by Greenlight. The Factory replaces this page by implementing <code>blueprint.md</code>.
      </p>
      <HealthBadge />
    </main>
  )
}
