/**
 * Request/response types shared by the frontend (src/) and Pages Functions (functions/).
 * Keep this file free of runtime code and platform types so both sides can import it.
 */
export interface HealthResponse {
  ok: true
  time: string
  storage: boolean
  database: boolean
}
