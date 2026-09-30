/**
 * Bindings and secrets available to the Worker.
 * Add a field here whenever wrangler.jsonc gains a binding or a secret is set with `wrangler secret put`.
 */
export interface Env {
  /** The built SPA (wrangler.jsonc "assets.binding"). */
  ASSETS: Fetcher;
  /** R2 bucket, binding "BUCKET" in wrangler.jsonc (optional until the blueprint needs it). */
  BUCKET?: R2Bucket;
  /** MongoDB Atlas connection string, set with `npx wrangler secret put MONGODB_URI`. */
  MONGODB_URI?: string;
  MONGODB_DB?: string;
}
