/* eslint-disable @typescript-eslint/no-empty-object-type */
// OpenNext exposes runtime bindings through CloudflareEnv, while Wrangler
// generates them on Env. Merge the generated bindings into OpenNext's type.
interface CloudflareEnv extends Env {}
