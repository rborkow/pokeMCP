/**
 * Cloudflare GraphQL Analytics source — compute, storage, and visitor (RUM) metrics.
 *
 * The exact field names in Cloudflare's GraphQL analytics schema occasionally
 * differ by account/plan, so every query is isolated: a failure returns null and
 * records a warning rather than failing the whole report. Confirm field
 * availability during verification via GraphQL introspection on your account.
 *
 * Endpoint: POST https://api.cloudflare.com/client/v4/graphql (Bearer token).
 */

import type {
    ComputeAnalytics,
    DateWindow,
    StorageUsage,
    VisitorAnalytics,
    WorkerCompute,
} from "../types";

const GQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

async function graphql<T>(env: Env, query: string, variables: Record<string, unknown>): Promise<T> {
    if (!env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN not set");
    const res = await fetch(GQL_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors?.length) {
        throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join("; ")}`);
    }
    if (!body.data) throw new Error("GraphQL returned no data");
    return body.data;
}

// --- Compute (per Worker script) ---

const WORKERS_QUERY = `
query Workers($accountTag: String!, $script: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        limit: 1
        filter: { scriptName: $script, datetime_geq: $start, datetime_lt: $end }
      ) {
        sum { requests errors subrequests }
        quantiles { cpuTimeP50 cpuTimeP99 }
      }
    }
  }
}`;

async function getWorkerCompute(
    env: Env,
    script: string,
    window: DateWindow,
    warnings: string[],
): Promise<WorkerCompute | null> {
    try {
        const data = await graphql<{
            viewer: {
                accounts: Array<{
                    workersInvocationsAdaptive: Array<{
                        sum: { requests: number; errors: number; subrequests: number };
                        quantiles: { cpuTimeP50: number; cpuTimeP99: number };
                    }>;
                }>;
            };
        }>(env, WORKERS_QUERY, {
            accountTag: env.CLOUDFLARE_ACCOUNT_ID,
            script,
            start: window.startIso,
            end: window.endIso,
        });

        const row = data.viewer.accounts[0]?.workersInvocationsAdaptive[0];
        if (!row)
            return {
                script,
                requests: 0,
                errors: 0,
                subrequests: 0,
                cpuTimeP50Us: null,
                cpuTimeP99Us: null,
            };
        return {
            script,
            requests: row.sum.requests ?? 0,
            errors: row.sum.errors ?? 0,
            subrequests: row.sum.subrequests ?? 0,
            cpuTimeP50Us: row.quantiles?.cpuTimeP50 ?? null,
            cpuTimeP99Us: row.quantiles?.cpuTimeP99 ?? null,
        };
    } catch (error) {
        warnings.push(`compute(${script}): ${(error as Error).message}`);
        return null;
    }
}

// --- Storage (R2 object count + bytes) ---

// Storage rows are a per-bucket time series. Order newest-first and keep the
// latest row per bucket, then sum across buckets for account-wide totals.
const R2_QUERY = `
query R2($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2StorageAdaptiveGroups(
        limit: 100
        orderBy: [datetime_DESC]
        filter: { datetime_geq: $start, datetime_lt: $end }
      ) {
        max { objectCount payloadSize }
        dimensions { bucketName datetime }
      }
    }
  }
}`;

async function getR2Storage(
    env: Env,
    window: DateWindow,
    warnings: string[],
): Promise<StorageUsage["r2"]> {
    try {
        const data = await graphql<{
            viewer: {
                accounts: Array<{
                    r2StorageAdaptiveGroups: Array<{
                        max: { objectCount: number; payloadSize: number };
                        dimensions: { bucketName: string; datetime: string };
                    }>;
                }>;
            };
        }>(env, R2_QUERY, {
            accountTag: env.CLOUDFLARE_ACCOUNT_ID,
            start: window.startIso,
            end: window.endIso,
        });
        const rows = data.viewer.accounts[0]?.r2StorageAdaptiveGroups ?? [];
        if (rows.length === 0) return null;

        // Newest-first: the first row seen per bucket is its latest snapshot.
        const latestPerBucket = new Map<string, { objectCount: number; payloadSize: number }>();
        for (const r of rows) {
            if (!latestPerBucket.has(r.dimensions.bucketName)) {
                latestPerBucket.set(r.dimensions.bucketName, r.max);
            }
        }
        let objects = 0;
        let bytes = 0;
        for (const m of latestPerBucket.values()) {
            objects += m.objectCount ?? 0;
            bytes += m.payloadSize ?? 0;
        }
        return { objects, bytes };
    } catch (error) {
        warnings.push(`r2Storage: ${(error as Error).message}`);
        return null;
    }
}

export async function getComputeAnalytics(
    env: Env,
    window: DateWindow,
    warnings: string[],
): Promise<ComputeAnalytics> {
    const scripts = env.WORKER_SCRIPTS.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const workers = (
        await Promise.all(scripts.map((s) => getWorkerCompute(env, s, window, warnings)))
    ).filter((w): w is WorkerCompute => w !== null);

    const r2 = await getR2Storage(env, window, warnings);
    return { workers, storage: { r2, kvKeys: null } };
}

// --- Visitors (Web Analytics / RUM) ---

const RUM_TOTALS_QUERY = `
query RumTotals($accountTag: String!, $siteTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(
        limit: 1
        filter: { siteTag: $siteTag, datetime_geq: $start, datetime_lt: $end }
      ) {
        count
        sum { visits }
      }
    }
  }
}`;

const RUM_DIM_QUERY = `
query RumDim($accountTag: String!, $siteTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      byPath: rumPageloadEventsAdaptiveGroups(
        limit: 10, orderBy: [count_DESC]
        filter: { siteTag: $siteTag, datetime_geq: $start, datetime_lt: $end }
      ) { count dimensions { metric: requestPath } }
      byCountry: rumPageloadEventsAdaptiveGroups(
        limit: 10, orderBy: [sum_visits_DESC]
        filter: { siteTag: $siteTag, datetime_geq: $start, datetime_lt: $end }
      ) { sum { visits } dimensions { metric: countryName } }
      byReferer: rumPageloadEventsAdaptiveGroups(
        limit: 10, orderBy: [sum_visits_DESC]
        filter: { siteTag: $siteTag, datetime_geq: $start, datetime_lt: $end }
      ) { sum { visits } dimensions { metric: refererHost } }
    }
  }
}`;

export async function getVisitorAnalytics(
    env: Env,
    window: DateWindow,
    warnings: string[],
): Promise<VisitorAnalytics> {
    if (!env.CF_ANALYTICS_SITE_TAG) {
        return {
            enabled: false,
            visits: null,
            pageViews: null,
            topPages: [],
            topCountries: [],
            topReferrers: [],
        };
    }

    const vars = {
        accountTag: env.CLOUDFLARE_ACCOUNT_ID,
        siteTag: env.CF_ANALYTICS_SITE_TAG,
        start: window.startIso,
        end: window.endIso,
    };

    let visits: number | null = null;
    let pageViews: number | null = null;
    try {
        const data = await graphql<{
            viewer: {
                accounts: Array<{
                    rumPageloadEventsAdaptiveGroups: Array<{
                        count: number;
                        sum: { visits: number };
                    }>;
                }>;
            };
        }>(env, RUM_TOTALS_QUERY, vars);
        const row = data.viewer.accounts[0]?.rumPageloadEventsAdaptiveGroups[0];
        pageViews = row?.count ?? 0;
        visits = row?.sum.visits ?? 0;
    } catch (error) {
        warnings.push(`rumTotals: ${(error as Error).message}`);
    }

    let topPages: VisitorAnalytics["topPages"] = [];
    let topCountries: VisitorAnalytics["topCountries"] = [];
    let topReferrers: VisitorAnalytics["topReferrers"] = [];
    try {
        const data = await graphql<{
            viewer: {
                accounts: Array<{
                    byPath: Array<{ count: number; dimensions: { metric: string } }>;
                    byCountry: Array<{ sum: { visits: number }; dimensions: { metric: string } }>;
                    byReferer: Array<{ sum: { visits: number }; dimensions: { metric: string } }>;
                }>;
            };
        }>(env, RUM_DIM_QUERY, vars);
        const acc = data.viewer.accounts[0];
        if (acc) {
            topPages = acc.byPath.map((r) => ({ path: r.dimensions.metric, views: r.count }));
            topCountries = acc.byCountry.map((r) => ({
                country: r.dimensions.metric,
                visits: r.sum.visits,
            }));
            topReferrers = acc.byReferer.map((r) => ({
                referrer: r.dimensions.metric,
                visits: r.sum.visits,
            }));
        }
    } catch (error) {
        warnings.push(`rumDimensions: ${(error as Error).message}`);
    }

    return { enabled: true, visits, pageViews, topPages, topCountries, topReferrers };
}
