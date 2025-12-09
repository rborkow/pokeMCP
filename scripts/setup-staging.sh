#!/bin/bash
set -e

echo "🚀 Setting up staging environment..."

# Create staging KV namespaces
echo "📦 Creating staging KV namespaces..."
STATS_KV=$(npx wrangler kv namespace create POKEMON_STATS --env staging | grep "id =" | cut -d'"' -f2)
DOCS_KV=$(npx wrangler kv namespace create STRATEGY_DOCS --env staging | grep "id =" | cut -d'"' -f2)

echo "✅ Created KV namespaces:"
echo "  POKEMON_STATS: $STATS_KV"
echo "  STRATEGY_DOCS: $DOCS_KV"

# Create staging Vectorize index
echo "🔢 Creating staging Vectorize index..."
npx wrangler vectorize create pokemon-strategy-index-staging \
  --dimensions=768 \
  --metric=cosine

# Create metadata indexes
echo "📊 Creating metadata indexes..."
npx wrangler vectorize create-metadata-index pokemon-strategy-index-staging \
  --property-name=pokemon --type=string

npx wrangler vectorize create-metadata-index pokemon-strategy-index-staging \
  --property-name=format --type=string

npx wrangler vectorize create-metadata-index pokemon-strategy-index-staging \
  --property-name=section_type --type=string

echo ""
echo "✅ Staging environment created!"
echo ""
echo "📝 Next steps:"
echo "1. Update wrangler.jsonc with these KV IDs:"
echo "   POKEMON_STATS (staging): $STATS_KV"
echo "   STRATEGY_DOCS (staging): $DOCS_KV"
echo ""
echo "2. Deploy to staging:"
echo "   npm run deploy:staging"
echo ""
echo "3. Run test ingestion on staging:"
echo "   curl https://pokemon-mcp-staging.rborkows.workers.dev/test-ingestion"
