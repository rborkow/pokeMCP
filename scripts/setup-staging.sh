#!/bin/bash
# Set up the staging Cloudflare resources (KV namespaces + Vectorize index).
#
# Wrangler v4 no longer prints `id = "..."` TOML from `kv namespace create`,
# so namespace IDs are resolved from `wrangler kv namespace list` (JSON) by
# title. Safe to re-run: existing resources are detected and reused.
set -euo pipefail

# Create a staging KV namespace if needed and print its 32-char hex id on
# stdout (progress goes to stderr so callers can capture the id).
create_or_get_kv_namespace() {
    local binding="$1"
    # `wrangler kv namespace create <name> --env staging` titles it "staging-<name>".
    local title="staging-${binding}"

    local create_output
    if create_output=$(npx wrangler kv namespace create "$binding" --env staging 2>&1); then
        echo "  ${binding}: created namespace \"${title}\"" >&2
    elif grep -qi "already exists" <<<"$create_output"; then
        echo "  ${binding}: namespace \"${title}\" already exists — reusing it" >&2
    else
        echo "ERROR: failed to create KV namespace ${binding} (title \"${title}\"):" >&2
        echo "$create_output" >&2
        exit 1
    fi

    # `wrangler kv namespace list` prints a JSON array of {id, title, ...}.
    local id
    id=$(npx wrangler kv namespace list | node -e '
        let data = "";
        process.stdin.on("data", (chunk) => { data += chunk; });
        process.stdin.on("end", () => {
            const start = data.indexOf("[");
            const namespaces = start === -1 ? [] : JSON.parse(data.slice(start));
            const match = namespaces.find((ns) => ns.title === process.argv[1]);
            if (match && match.id) process.stdout.write(match.id);
        });
    ' "$title")

    if [[ ! "$id" =~ ^[0-9a-f]{32}$ ]]; then
        echo "ERROR: could not resolve a valid namespace id for \"${title}\" (got: \"${id:-<empty>}\")." >&2
        echo "Inspect \`npx wrangler kv namespace list\` and check your Cloudflare auth." >&2
        exit 1
    fi

    echo "$id"
}

# Run a create command, tolerating "already exists" so the script is re-runnable.
run_create() {
    local description="$1"
    shift

    local output
    if output=$("$@" 2>&1); then
        echo "  ${description}: created"
    elif grep -qi "already exists" <<<"$output"; then
        echo "  ${description}: already exists — skipping"
    else
        echo "ERROR: ${description} failed:" >&2
        echo "$output" >&2
        exit 1
    fi
}

echo "🚀 Setting up staging environment..."

# Create staging KV namespaces
echo "📦 Creating staging KV namespaces..."
STATS_KV=$(create_or_get_kv_namespace POKEMON_STATS)
DOCS_KV=$(create_or_get_kv_namespace STRATEGY_DOCS)

echo "✅ Staging KV namespaces:"
echo "  POKEMON_STATS (staging-POKEMON_STATS): $STATS_KV"
echo "  STRATEGY_DOCS (staging-STRATEGY_DOCS): $DOCS_KV"

# Create staging Vectorize index
echo "🔢 Creating staging Vectorize index..."
run_create "Vectorize index pokemon-strategy-index-staging" \
    npx wrangler vectorize create pokemon-strategy-index-staging \
    --dimensions=768 \
    --metric=cosine

# Create metadata indexes
echo "📊 Creating metadata indexes..."
run_create "metadata index 'pokemon'" \
    npx wrangler vectorize create-metadata-index pokemon-strategy-index-staging \
    --property-name=pokemon --type=string

run_create "metadata index 'format'" \
    npx wrangler vectorize create-metadata-index pokemon-strategy-index-staging \
    --property-name=format --type=string

run_create "metadata index 'section_type'" \
    npx wrangler vectorize create-metadata-index pokemon-strategy-index-staging \
    --property-name=section_type --type=string

echo ""
echo "✅ Staging environment created!"
echo ""
echo "📝 Next steps:"
echo "1. Update wrangler.jsonc (env.staging) with these KV IDs:"
echo "   POKEMON_STATS (staging): $STATS_KV"
echo "   STRATEGY_DOCS (staging): $DOCS_KV"
echo ""
echo "2. Set the staging worker secrets — /admin/* auth FAILS OPEN until"
echo "   CF_ACCESS_TEAM_DOMAIN is set (see the known gap in CLAUDE.md):"
echo "   npx wrangler secret put CF_ACCESS_TEAM_DOMAIN --env staging"
echo "   npx wrangler secret put CLOUDFLARE_API_TOKEN --env staging"
echo "   npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --env staging"
echo ""
echo "3. Deploy to staging:"
echo "   bun run deploy:staging"
echo ""
echo "4. Run test ingestion on staging:"
echo "   curl https://pokemon-mcp-staging.rborkows.workers.dev/test-ingestion"
