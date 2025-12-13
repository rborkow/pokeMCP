# Deployment Guide

## Cloudflare Pages (Recommended)

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
   - **Project name**: `pokemcp-docs`
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Root directory**: `apps/docs`

4. **Set Environment Variables** (if needed)
   - **NODE_VERSION**: `20`

5. **Deploy**
   - Click "Save and Deploy"
   - First build takes ~2 minutes
   - Site will be live at: `https://pokemcp-docs.pages.dev`

### Method 2: Direct Upload via Wrangler

```bash
# From apps/docs directory
npm run build
npx wrangler pages deploy out --project-name=pokemcp-docs
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

## Build Time

- **Initial build**: ~2 minutes
- **Incremental builds**: ~1 minute
- **Cache**: Cloudflare caches assets globally

## Monitoring

View build logs and analytics:
- Cloudflare Dashboard → Pages → pokemcp-docs
- Build history
- Analytics (visits, bandwidth)
- Real-time logs

## Troubleshooting

### Build Fails

Check build logs in Cloudflare Pages dashboard. Common issues:
- Node version mismatch (ensure Node 20)
- Missing dependencies (check package.json)
- TypeScript errors (run `npm run build` locally first)

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
