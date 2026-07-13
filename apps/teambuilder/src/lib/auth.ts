import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";

interface AuthSecrets {
    BETTER_AUTH_SECRET?: string;
    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
}

export type PrepCloudflareEnv = CloudflareEnv & AuthSecrets;

export class AuthUnavailableError extends Error {}

export function getPrepCloudflareEnv(): PrepCloudflareEnv {
    return getCloudflareContext().env as PrepCloudflareEnv;
}

export function isAuthConfigured(env: PrepCloudflareEnv) {
    return Boolean(
        env.PREP_DB &&
            env.BETTER_AUTH_SECRET &&
            env.DISCORD_CLIENT_ID &&
            env.DISCORD_CLIENT_SECRET &&
            env.GOOGLE_CLIENT_ID &&
            env.GOOGLE_CLIENT_SECRET,
    );
}

export function getAuth() {
    const env = getPrepCloudflareEnv();
    if (
        !env.PREP_DB ||
        !env.BETTER_AUTH_SECRET ||
        !env.DISCORD_CLIENT_ID ||
        !env.DISCORD_CLIENT_SECRET ||
        !env.GOOGLE_CLIENT_ID ||
        !env.GOOGLE_CLIENT_SECRET
    ) {
        throw new AuthUnavailableError("Optional account sync has not been configured.");
    }
    return betterAuth({
        database: env.PREP_DB,
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [env.BETTER_AUTH_URL],
        advanced: {
            database: { generateId: "uuid" },
            ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
        },
        // The route handler applies the shared Cloudflare limiter with a
        // secret-keyed IP hash. Better Auth's in-memory limiter is not shared
        // across Worker isolates, so leave it disabled here.
        rateLimit: { enabled: false },
        account: { encryptOAuthTokens: true },
        user: { deleteUser: { enabled: true } },
        socialProviders: {
            discord: {
                clientId: env.DISCORD_CLIENT_ID,
                clientSecret: env.DISCORD_CLIENT_SECRET,
                mapProfileToUser: (profile) => ({
                    email: profile.email ?? `${profile.id}@discord.placeholder.local`,
                }),
            },
            google: {
                clientId: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
        },
    });
}
