# Final Dashboard Steps for pokemcp.com

You've successfully deployed via CLI! Now just need to add custom domains through the Cloudflare dashboard.

**Time needed:** 5 minutes + 10-15 min wait for SSL

---

## Current Status ✅

- **Docs deployed**: https://79d71dbf.pokemcp-docs.pages.dev
- **Worker deployed**: https://pokemon-mcp-production.rborkows.workers.dev

Both are live and working!

---

## Step 1: Add pokemcp.com to Pages Project

### Navigate to Pages Project

1. Go to: https://dash.cloudflare.com
2. Left sidebar → Click **"Workers & Pages"**
3. Find **pokemcp-docs** in the list (has 📄 icon)
4. Click on **pokemcp-docs**

### Add Custom Domain

5. Click the **"Custom domains"** tab at the top
   - (You'll see other tabs: Deployments, Settings, Functions, Analytics)

6. Click **"Set up a custom domain"** button

7. Enter domain:
   ```
   pokemcp.com
   ```

8. Click **"Continue"**

9. Cloudflare will auto-detect the domain and configure DNS
   - Click **"Activate domain"**

10. Wait for SSL certificate (5-15 minutes)
    - Status will show "Provisioning certificate"
    - Refresh page to check status
    - Will change to **"Active"** with green checkmark when ready

**✅ Test**: Visit https://pokemcp.com (wait for SSL to provision first)

---

## Step 2: Add api.pokemcp.com to Worker

### Navigate to Worker

1. Still in **Workers & Pages** section
2. Find **pokemon-mcp-production** in the list (has ⚡ icon)
3. Click on **pokemon-mcp-production**

### Add Custom Domain

4. Click **"Settings"** tab at the top

5. Left sidebar → Click **"Domains & Routes"**

6. Under **"Custom Domains"** section:
   - Click **"Add"** or **"Add Custom Domain"** button

7. Enter domain:
   ```
   api.pokemcp.com
   ```

8. Click **"Add Custom Domain"**

9. Cloudflare will auto-configure DNS
   - Click **"Continue"** or **"Activate"**

10. Wait for SSL certificate (5-15 minutes)
    - Status will show in Custom Domains list
    - Will change to "Active" when ready

**✅ Test**:
```bash
curl https://api.pokemcp.com/
```

Should return JSON with server info.

---

## Step 3: Test MCP Endpoint

Once SSL is active on api.pokemcp.com:

```bash
curl -X POST https://api.pokemcp.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

Should return JSON with 11 tools.

---

## Step 4: Update Claude.ai Connector

1. Go to: https://claude.ai
2. Click your profile (bottom left)
3. Click **"Settings"**
4. Sidebar → Click **"Integrations"**
5. Find **"Custom Connectors"** section

**If you have an existing PokéMCP connector:**
- Click **"Edit"** or settings icon
- Update URL to: `https://api.pokemcp.com/mcp`
- Click **"Save"**

**If creating new:**
- Click **"Add connector"** or **"+"**
- Name: `PokéMCP`
- URL: `https://api.pokemcp.com/mcp`
- Authentication: Leave blank
- Click **"Add"** or **"Save"**

### Test in Claude

Start a new conversation and ask:
```
What tools do you have access to?
```

You should see all 11 PokéMCP tools listed!

---

## Troubleshooting

### Can't Find "Workers & Pages"

- **Location**: Left sidebar in Cloudflare Dashboard
- **Look for**: ⚡ icon or 📄 icon
- **Alternative**: Use search bar at top, type "Workers"

### Can't Find "Domains & Routes"

If you don't see "Domains & Routes" in the Settings sidebar:

**Try Alternative Location:**
1. Click **"Triggers"** tab (instead of Settings)
2. Look for "Custom Domains" section there
3. Some Cloudflare accounts show it in Triggers instead

### SSL Taking Too Long

- Usually takes 5-15 minutes
- Can take up to 24 hours in rare cases
- Keep refreshing the custom domains page
- If stuck after 30 min, try removing and re-adding the domain

### Domain Already Exists Error

If you get "domain already exists":
- You may have added it before
- Check the Custom Domains list - it might already be there
- If showing as "Failed", remove it and re-add

### MCP Not Working in Claude

1. Verify endpoint works first:
   ```bash
   curl -X POST https://api.pokemcp.com/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```

2. Check Claude connector settings:
   - URL must be exactly: `https://api.pokemcp.com/mcp`
   - No trailing slash
   - No authentication

3. Try removing and re-adding the connector in Claude

---

## Visual Guide: Where to Click

### Pages Project → Custom Domains
```
Dashboard
└─ Workers & Pages (sidebar)
   └─ pokemcp-docs (📄 icon)
      └─ Custom domains (top tab)
         └─ "Set up a custom domain" button
```

### Worker → Custom Domains
```
Dashboard
└─ Workers & Pages (sidebar)
   └─ pokemon-mcp-production (⚡ icon)
      └─ Settings (top tab)
         └─ Domains & Routes (left sidebar)
            └─ "Add Custom Domain" button
```

---

## Final Checklist

Once everything is set up:

- [ ] https://pokemcp.com shows documentation
- [ ] https://pokemcp.com/getting-started works
- [ ] https://pokemcp.com/tools works
- [ ] https://api.pokemcp.com/ returns JSON
- [ ] https://api.pokemcp.com/mcp responds to tools/list
- [ ] Claude.ai connector updated
- [ ] Can ask Claude about Pokémon and it uses MCP tools

---

## 🎉 Success!

When everything is working:

✅ **Documentation**: https://pokemcp.com
✅ **MCP Endpoint**: https://api.pokemcp.com/mcp
✅ **SSL**: Valid certificates
✅ **Claude.ai**: Integration working

Ask Claude: "What are the base stats for Garchomp?" and it should use your MCP server!

---

## Quick URLs Reference

**Cloudflare Dashboard Sections:**
- Main dashboard: https://dash.cloudflare.com
- Workers & Pages: https://dash.cloudflare.com/?to=/:account/workers-and-pages
- DNS settings: https://dash.cloudflare.com/?to=/:account/:zone/dns

**Your Deployments:**
- Pages (temporary URL): https://79d71dbf.pokemcp-docs.pages.dev
- Worker (temporary URL): https://pokemon-mcp-production.rborkows.workers.dev
- Pages (final URL): https://pokemcp.com ← Add this in dashboard
- Worker (final URL): https://api.pokemcp.com ← Add this in dashboard

**Claude.ai:**
- Settings → Integrations: https://claude.ai/settings/integrations

---

**Need help?** Take a screenshot of where you're stuck and I can guide you!
