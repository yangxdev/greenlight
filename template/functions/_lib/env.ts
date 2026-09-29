/**
 * Bindings and secrets available to Pages Functions.
 * Add a field here whenever wrangler.toml gains a binding or a secret is set.
 */
export interface Env {
  /** R2 bucket, declared in wrangler.toml as binding "BUCKET" (optional until the blueprint needs it). */
  BUCKET?: R2Bucket
  /** MongoDB Atlas connection string, set with `wrangler pages secret put MONGODB_URI`. */
  MONGODB_URI?: string
  MONGODB_DB?: string
}
