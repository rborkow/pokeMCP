#!/bin/bash
# Upload cached stats to Cloudflare KV
# Run this after fetch-stats.ts to push stats to production
#
# Usage:
#   npm run upload-stats                    # Uses production KV
#   KV_NAMESPACE_ID=xxx npm run upload-stats  # Custom namespace

set -e

# Default to production KV namespace (from wrangler.jsonc)
# This can be overridden via environment variable for different environments
KV_NAMESPACE_ID="${KV_NAMESPACE_ID:-58525ad4ec5c454eb3e1ae7586414483}"
CACHE_DIR="src/cached-stats"

echo "Uploading stats to POKEMON_STATS KV (namespace: $KV_NAMESPACE_ID)..."
echo ""

# Get list of JSON files with actual data (more than 300 bytes = has real Pokemon data)
for file in "$CACHE_DIR"/*.json; do
    format=$(basename "$file" .json)
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")

    # Skip files that are too small (empty stats with just metadata)
    if [ "$size" -lt 300 ]; then
        echo "⏭️  Skipping $format (no data - $size bytes)"
        continue
    fi

    echo "📤 Uploading $format ($size bytes)..."
    npx wrangler kv key put --remote --namespace-id="$KV_NAMESPACE_ID" "$format" --path="$file"

    # Small delay to avoid rate limiting
    sleep 0.5
done

echo ""
echo "✅ Upload complete!"
echo ""
echo "Verify with: curl https://api.pokemcp.com/test-kv"
