# Hosting Guide for Non-Technical Users

This guide explains how to host the Pokémon MCP server so users can access it via a web browser, without needing to install anything locally.

## 🎯 The Challenge

**MCP servers are designed to run locally** on a user's machine to connect with Claude Desktop. You can't host a traditional MCP server that Claude Desktop connects to remotely.

## ✨ Solutions for Non-Technical Users

### **Option 1: Web API + Simple Frontend** ⭐ (Recommended)

Deploy a web version with a simple UI. Users visit a website instead of using Claude Desktop.

**Perfect for:** Users who just want to check movesets, see meta threats, validate teams via a web interface.

#### **Deploy to Vercel/Railway/Render**

**Vercel:**
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "build/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "build/server.js"
    }
  ]
}
```

**Deploy:**
```bash
npm install -g vercel
vercel
```

**Pros:**
- ✅ Zero configuration needed by users
- ✅ Just visit a URL
- ✅ Works on mobile, tablet, desktop
- ✅ Free tier available

**Cons:**
- ❌ Not integrated with Claude Desktop
- ❌ Separate interface from Claude

---

### **Option 2: Desktop App (Electron)** 🖥️

Package everything into a downloadable desktop app.

**Perfect for:** Users who want Claude Desktop integration but don't want to mess with npm/docker.

**Steps:**
1. Create Electron wrapper around MCP server
2. Build installers for Mac/Windows/Linux
3. Users download `.dmg`, `.exe`, or `.AppImage`
4. App auto-configures Claude Desktop

**Pros:**
- ✅ One-click install
- ✅ Works with Claude Desktop
- ✅ No terminal needed
- ✅ Auto-updates possible

**Cons:**
- ❌ Large download size (~100MB)
- ❌ Need to build for each platform
- ❌ Code signing costs for Mac/Windows

---

### **Option 3: One-Click Installers** 📦

Create simple installers that handle everything.

**For Mac/Linux:**
```bash
#!/bin/bash
# install.sh

echo "Installing Pokémon MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    # Use nvm or brew to install Node
fi

# Install globally
npm install -g pokemon-mcp-server

# Configure Claude Desktop
CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
# Append MCP server config...

echo "✅ Installation complete! Restart Claude Desktop."
```

**For Windows:**
Create a PowerShell script or `.exe` installer.

**Pros:**
- ✅ Works with Claude Desktop
- ✅ Relatively simple for users
- ✅ One command to run

**Cons:**
- ❌ Still requires terminal access
- ❌ Node.js installation needed

---

### **Option 4: Chrome Extension** 🔌

Build a browser extension that uses the API.

**Perfect for:** Browser-based workflow, quick lookups.

**Pros:**
- ✅ Install from Chrome Web Store
- ✅ Works everywhere
- ✅ No backend hosting needed (uses API)

**Cons:**
- ❌ Not Claude Desktop integration
- ❌ Limited to browser

---

### **Option 5: Discord Bot** 🤖

Create a Discord bot that exposes all the tools.

```typescript
// Example Discord bot command
!pokemon lookup Garchomp
!team-validate [team here]
!meta-threats gen9ou
```

**Pros:**
- ✅ Familiar interface (Discord)
- ✅ Social/community aspect
- ✅ Easy to use (just type commands)
- ✅ Can host on free tier (Railway/Render)

**Cons:**
- ❌ Not Claude Desktop
- ❌ Discord-only

---

## 🚀 Recommended Approach: Multi-Channel

**1. Web API (Vercel)** - For quick access
- Deploy Express API to Vercel
- Create simple Next.js frontend
- Free tier supports 100GB bandwidth/month

**2. NPM Package** - For technical users
- `npm install -g pokemon-mcp-server`
- Full Claude Desktop integration

**3. Optional: Desktop App** - For maximum ease
- Build with Electron
- One-click install for everyone

---

## 📋 Deployment Comparison

| Platform | Cost | Ease | Scalability | Claude Desktop |
|----------|------|------|-------------|----------------|
| **Vercel** | Free-$20/mo | ⭐⭐⭐ | High | ❌ No |
| **Railway** | $5/mo | ⭐⭐⭐ | High | ❌ No |
| **Render** | Free-$7/mo | ⭐⭐⭐ | High | ❌ No |
| **Fly.io** | Free-$2/mo | ⭐⭐ | High | ❌ No |
| **NPM** | Free | ⭐⭐ | N/A | ✅ Yes |
| **Electron** | Free | ⭐⭐⭐ | N/A | ✅ Yes |
| **Discord Bot** | Free | ⭐⭐⭐ | Medium | ❌ No |

---

## 💻 Quick Start: Deploy Web Version to Vercel

**1. Add server script to package.json:**
```json
{
  "scripts": {
    "start": "node build/server.js",
    "build:server": "tsc && cp -r src/data build/"
  }
}
```

**2. Create `vercel.json`:**
```json
{
  "version": 2,
  "builds": [{ "src": "build/server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "build/server.js" }]
}
```

**3. Deploy:**
```bash
npm run build:server
vercel --prod
```

**4. Your API is live!**
- `https://your-app.vercel.app/api/lookup`
- `https://your-app.vercel.app/api/meta-threats`

---

## 🌐 Example: Railway Deployment

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

**3. Configure:**
- Add `PORT` environment variable
- Set start command: `node build/server.js`

---

## 🎨 Next Steps: Add a Frontend

**Option A: Simple HTML/JS** (Vercel Static)
```html
<!DOCTYPE html>
<html>
<head>
  <title>Pokémon Team Builder</title>
</head>
<body>
  <h1>Pokémon Team Builder</h1>
  <input id="pokemon" placeholder="Enter Pokémon name">
  <button onclick="lookup()">Lookup</button>
  <div id="result"></div>

  <script>
    async function lookup() {
      const pokemon = document.getElementById('pokemon').value;
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pokemon })
      });
      const data = await res.json();
      document.getElementById('result').innerText = data.result;
    }
  </script>
</body>
</html>
```

**Option B: Next.js** (Full web app)
```bash
npx create-next-app@latest pokemon-web
# Build full team builder UI
```

**Option C: React + Vite** (Modern SPA)
```bash
npm create vite@latest pokemon-ui -- --template react-ts
# Connect to API
```

---

## 🔑 Key Takeaway

**For non-technical users, you have 2 main paths:**

1. **Web Interface** (Vercel/Railway)
   - No Claude Desktop integration
   - Easy to use, just visit URL
   - Best for quick lookups

2. **Desktop App** (Electron)
   - Full Claude Desktop integration
   - One-click install
   - Best for power users

**Most realistic for broad adoption:** Deploy web version to Vercel, then later add Electron app for those who want Claude Desktop integration.
