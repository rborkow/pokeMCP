# Deployment Guide

## Cloudflare Pages (Recommended)

Production docs are served by the Git-connected Cloudflare Pages project that owns
`docs.pokemcp.com`. Keep production ownership in that project so pushes to `main`
and preview branches stay visible in the Cloudflare Pages UI.

### Method 1: GitHub Integration

1. **Push to GitHub**

   ```bash
   git add apps/docs
   git commit -m "Add documentation site"
   git push
   ```

2. **Connect to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
   - Click "Create a project"
   - Select "Connect to Git"
   - Authorize GitHub and select your repository

3. **Configure Build**
   - **Project name**: Use the Git-connected Pages project that owns `docs.pokemcp.com`
   - **Production branch**: `main`
   - **Build command**: `bun run build`
   - **Build output directory**: `out`
   - **Root directory**: `apps/docs`

4. **Set Environment Variables**
   - **NODE_VERSION**: `22`
   - Cloudflare Pages auto-detects bun from the `packageManager` field in `apps/docs/package.json`.

5. **Deploy**
   - Click "Save and Deploy"
   - First build takes ~2 minutes
   - Production docs will be live at: `https://docs.pokemcp.com`

### Method 2: Direct Upload via Wrangler (Non-Production / Ad Hoc)

```bash
# From apps/docs directory
bun run build
bunx wrangler pages deploy out --project-name=<non-production-pages-project>
```

## Custom Domain

1. In Cloudflare Pages → Your Project → Custom domains
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `docs.pokemcp.dev`)
4. Add DNS records as instructed
5. Wait for SSL certificate (< 15 minutes)

## Automatic Deployments

With GitHub integration:

- Push to `main` → automatic production deployment
- Push to other branches → preview deployment
- Pull requests → automatic preview links

GitHub Actions in this repo do not own docs production deployments.

## Build Time

- **Initial build**: ~2 minutes
- **Incremental builds**: ~1 minute
- **Cache**: Cloudflare caches assets globally

## Monitoring

View build logs and analytics:

- Cloudflare Dashboard → Pages → the Git-connected project that owns `docs.pokemcp.com`
- Build history
- Analytics (visits, bandwidth)
- Real-time logs

## Troubleshooting

### Build Fails

Check build logs in Cloudflare Pages dashboard. Common issues:

- Node version mismatch (ensure NODE_VERSION=22)
- Bun not detected (ensure `packageManager` is set in `package.json`)
- Missing dependencies (check package.json)
- TypeScript errors (run `bun run build` locally first)

### 404 Errors

Nextra generates trailing slashes. Ensure:

- `trailingSlash: true` in next.config.mjs
- Links use `/page/` not `/page`

### Slow Builds

- Enable caching in Cloudflare settings
- Consider reducing page count
- Optimize images

## Costs

Cloudflare Pages free tier:

- **500 builds/month**
- **Unlimited requests**
- **Unlimited bandwidth**

More than sufficient for documentation sites.

## Next Steps

After deployment:

- Set up custom domain
- Enable Web Analytics
- Configure redirects (if needed)
- Add to main pokeMCP README
