# Adding Pokémon MCP Server to Claude.ai

This guide explains how to add the Pokémon MCP Server as a **Custom Connector** in Claude.ai's web interface.

## 🎯 What You Get

Once configured, you can use all Pokémon tools **directly in Claude.ai** without installing anything locally:
- Look up Pokémon stats
- Validate movesets and teams
- Get Smogon usage statistics
- Analyze team coverage
- Find checks, counters, and teammates

## ✅ Requirements

- **Claude Pro, Max, Team, or Enterprise** account ([Custom Connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp) are available on paid plans)
- Deployed Remote MCP server (instructions below)

## 🚀 Step 1: Deploy the Server

### Option A: Deploy to Vercel (Recommended)

**1. Install Vercel CLI:**
```bash
npm install -g vercel
```

**2. Build and deploy:**
```bash
npm run build
vercel --prod
```

**3. Note your deployment URL:**
```
https://your-pokemon-mcp.vercel.app
```

### Option B: Deploy to Railway

**1. Install Railway CLI:**
```bash
npm install -g @railway/cli
```

**2. Deploy:**
```bash
railway login
railway init
railway up
```

**3. Get your Railway URL from the dashboard**

### Option C: Deploy to Render

1. Connect your GitHub repo to Render
2. Create new "Web Service"
3. Build command: `npm run build`
4. Start command: `npm run start:remote`
5. Note your Render URL

---

## 🔗 Step 2: Add to Claude.ai

### Method 1: Via Claude.ai Settings (Recommended)

1. Go to https://claude.ai
2. Click your **profile picture** (bottom left)
3. Select **Settings** → **Connectors**
4. Click **+ Add Connector**
5. Choose **Create Custom Connector**
6. Fill in the details:

   ```
   Name: Pokémon Team Builder

   Description: Pokémon team building and validation with Smogon usage stats

   Server URL: https://your-deployment-url.vercel.app

   Authentication: None (for now)
   ```

7. Click **Save**

### Method 2: Direct URL

Visit this URL (replace with your deployment):
```
https://claude.ai/settings/connectors/create?url=https://your-deployment-url.vercel.app
```

---

## 🧪 Step 3: Test It Out

Once connected, try these commands in Claude.ai:

**Basic Lookups:**
```
Look up Garchomp's stats and abilities
```

**Usage Statistics:**
```
What are the most popular sets for Kingambit in Gen 9 OU?
```

**Team Building:**
```
I'm building a team with Garchomp and Ferrothorn.
What are their common teammates?
```

**Team Validation:**
```
Validate this team:
- Garchomp with Earthquake, Dragon Claw, Swords Dance, Fire Fang
- Great Tusk with Earthquake, Ice Spinner, Rapid Spin, Knock Off
```

**Meta Analysis:**
```
What are the top 10 threats in gen9ou right now?
```

---

## 🔐 Optional: Add OAuth Authentication

For production use, you can add OAuth to secure your connector:

**1. Set up OAuth provider** (Auth0, Supabase, etc.)

**2. Configure OAuth callback URL:**
```
https://claude.ai/api/mcp/auth_callback
```

**3. Update your remote-mcp.ts** to verify tokens

**4. Add OAuth details** when creating connector in Claude.ai

---

## 🛠️ Troubleshooting

### "Unable to connect to server"

**Check:**
1. Is your deployment URL correct and accessible?
2. Try visiting `https://your-url.vercel.app/` in a browser
3. Check HEAD request works: `curl -I https://your-url.vercel.app/`

### "Server not responding"

**Verify:**
1. Check your deployment logs (Vercel/Railway dashboard)
2. Ensure PORT environment variable is set correctly
3. CORS is configured for `https://claude.ai`

### "Tools not showing up"

**Debug:**
1. Check server logs for errors
2. Verify `/sse` endpoint is accessible
3. Try disconnecting and reconnecting the connector

---

## 📊 Monitoring Usage

### Vercel Analytics

View your deployment stats at:
```
https://vercel.com/dashboard
```

### Railway Metrics

Check resource usage:
```
railway logs
```

### Custom Logging

Add to `remote-mcp.ts`:
```typescript
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});
```

---

## 🔄 Updating Your Connector

**1. Pull latest code:**
```bash
git pull
```

**2. Rebuild:**
```bash
npm run build
```

**3. Redeploy:**
```bash
vercel --prod
# or
railway up
```

**4. Reconnect in Claude.ai** (if URL changed)

---

## 💰 Cost Estimate

### Vercel Free Tier
- ✅ 100GB bandwidth/month
- ✅ Unlimited requests
- ✅ Serverless functions
- **Cost:** FREE for most use cases

### Railway Free Tier
- ✅ $5 free credit/month
- ✅ ~500 hours uptime
- **Cost:** FREE for light usage, ~$5-10/month for moderate use

### Render Free Tier
- ✅ 750 hours/month
- ⚠️ Spins down after inactivity
- **Cost:** FREE (with cold starts)

---

## 🎓 Resources

- [Remote MCP Documentation](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Claude Custom Connectors Guide](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [Vercel Deployment Docs](https://vercel.com/docs)
- [Railway Deployment Docs](https://docs.railway.app/)

---

## 🌟 Next Steps

Once your connector is working:

1. **Share it!** Give the URL to friends with Claude Pro
2. **Add OAuth** for production security
3. **Monitor usage** and optimize for performance
4. **Add caching** for Smogon stats to reduce load
5. **Contribute** improvements back to the repo

---

## ⚡ Quick Deploy Command

**All-in-one deployment:**
```bash
npm run build && vercel --prod && echo "Add this URL to Claude.ai:"
```

That's it! Your Pokémon MCP Server is now accessible in Claude.ai 🎉
