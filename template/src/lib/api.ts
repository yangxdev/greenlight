/** Thin fetch wrapper for the same-origin Worker API under /api. */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { accept: 'application/json', ...init?.headers } })
  if (!res.ok) {
    throw new Error(`GET /api${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}
