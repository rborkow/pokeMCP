# PokéMCP Documentation

Documentation site for the PokéMCP server, built with [Nextra](https://nextra.site/).

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3001

## Building

```bash
npm run build
```

Creates static export in `out/` directory.

## Deployment to Cloudflare Pages

### Via GitHub (Recommended)

1. Push code to GitHub
2. Go to Cloudflare Dashboard → Pages
3. Create new project → Connect to Git
4. Select your repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Root directory**: `apps/docs`
   - **Node version**: 20
6. Deploy!

### Via Wrangler CLI

```bash
npx wrangler pages deploy out --project-name=pokemcp-docs
```

## Structure

```
pages/
├── index.mdx              # Home
├── getting-started.mdx    # Getting started guide
├── tools.mdx              # Tools reference
├── formats.mdx            # Supported formats
└── _meta.ts              # Navigation config
```

## Adding Content

1. Create `pages/your-page.mdx`
2. Add to `pages/_meta.ts`:
   ```ts
   export default {
       index: "Home",
       "your-page": "Your Page Title"
   }
   ```

## Tech Stack

- Next.js 14
- Nextra 3 (docs theme)
- Tailwind CSS 3
- TypeScript

## License

MIT
