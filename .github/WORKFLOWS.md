# GitHub Actions CI/CD Setup Guide

This repository includes automated deployment workflows using GitHub Actions.

## 🚀 Available Workflows

### 1. **Build and Test** (Automatic)
- **Trigger**: Every push to `main` or `claude/**` branches
- **What it does**: Builds the project and verifies all files
- **No setup required!**

### 2. **Deploy to Vercel** (Recommended)
- **Trigger**: Push to `main` or manual dispatch
- **What it does**: Automatically deploys to Vercel on every push
- **Setup required** (see below)

### 3. **Deploy to Railway**
- **Trigger**: Push to `main` or manual dispatch
- **What it does**: Deploys to Railway automatically
- **Setup required** (see below)

### 4. **Docker Image**
- **Trigger**: Push to `main` or version tags
- **What it does**: Builds and publishes Docker image to GitHub Container Registry
- **Setup required** (minimal)

---

## ⚙️ Setup Instructions

### **Vercel Deployment** (Recommended)

**1. Get Vercel credentials:**

```bash
# Install Vercel CLI locally (one time)
npm install -g vercel

# Login to Vercel
vercel login

# Link project (in your local repo)
cd /path/to/pokeMCP
vercel link

# Get your credentials
cat .vercel/project.json
```

This gives you:
- `VERCEL_ORG_ID` (from `orgId` field)
- `VERCEL_PROJECT_ID` (from `projectId` field)

**2. Get Vercel token:**
- Go to https://vercel.com/account/tokens
- Create new token: "GitHub Actions Deployment"
- Copy the token

**3. Add secrets to GitHub:**
- Go to your repo: `Settings` → `Secrets and variables` → `Actions`
- Click `New repository secret`
- Add these three secrets:
  - `VERCEL_TOKEN` = your token
  - `VERCEL_ORG_ID` = from project.json
  - `VERCEL_PROJECT_ID` = from project.json

**4. Push to main:**
```bash
git push origin main
```

**5. Done!** Every push to `main` automatically deploys to Vercel

---

### **Railway Deployment**

**1. Get Railway token:**
- Go to https://railway.app/account/tokens
- Generate new token
- Copy it

**2. Add to GitHub secrets:**
- Add secret: `RAILWAY_TOKEN` = your token

**3. Create Railway service:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Note your service name (used in workflow)
```

**4. Update workflow** if service name is different:
Edit `.github/workflows/deploy-railway.yml`:
```yaml
railway up --service pokemon-mcp-server  # Change this if needed
```

---

### **Docker Image** (Minimal Setup)

**1. Enable GitHub Packages:**
- Go to your repo: `Settings` → `Actions` → `General`
- Under "Workflow permissions", select:
  - ✅ Read and write permissions
  - ✅ Allow GitHub Actions to create and approve pull requests

**2. Push to main:**
```bash
git push origin main
```

Docker images automatically publish to:
```
ghcr.io/your-username/pokemcp:latest
```

---

## 🎯 Quick Setup (Just Vercel)

**5-minute setup for auto-deployment:**

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login and link project
vercel login
cd pokeMCP
vercel link

# 3. Get credentials
cat .vercel/project.json

# 4. Get token from vercel.com/account/tokens

# 5. Add all 3 secrets to GitHub repo settings

# 6. Push and watch it deploy!
git push origin main
```

---

## 📊 Monitoring Deployments

### **View Workflow Status**

Go to your repo → `Actions` tab

You'll see:
- ✅ Build and Test
- 🚀 Deploy to Vercel
- 🐳 Publish Docker Image

### **Get Deployment URL**

After deployment completes:
1. Check the workflow run
2. Look for the comment on your commit
3. Copy the deployment URL

Or check directly:
- **Vercel**: https://vercel.com/dashboard
- **Railway**: https://railway.app/dashboard

---

## 🔧 Manual Deployment

If you prefer manual deployment, you can still trigger workflows:

**Via GitHub UI:**
1. Go to `Actions` tab
2. Select a workflow
3. Click `Run workflow`

**Via GitHub CLI:**
```bash
gh workflow run deploy-vercel.yml
gh workflow run deploy-railway.yml
gh workflow run docker.yml
```

---

## 🎨 Customizing Workflows

### **Change deployment branch:**

Edit the workflow file:
```yaml
on:
  push:
    branches:
      - main        # Change to your preferred branch
      - production  # Add more branches
```

### **Add notifications:**

Add to the end of any workflow:
```yaml
- name: Notify on success
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### **Deploy only on tags:**

```yaml
on:
  push:
    tags:
      - 'v*'  # Only deploy on version tags
```

---

## 🐛 Troubleshooting

### **"Vercel token invalid"**
- Regenerate token at https://vercel.com/account/tokens
- Update `VERCEL_TOKEN` secret in GitHub

### **"Railway project not found"**
- Verify service name in workflow matches Railway
- Check `RAILWAY_TOKEN` is correct

### **"Build failed"**
- Check the Actions tab for error details
- Common issues:
  - Missing dependencies
  - TypeScript errors
  - Wrong Node version (needs 18+)

### **"Docker push permission denied"**
- Verify workflow permissions in repo settings
- Check `GITHUB_TOKEN` has package write access

---

## 📖 Resources

- [Vercel GitHub Actions](https://vercel.com/docs/deployments/git/vercel-for-github)
- [Railway GitHub Integration](https://docs.railway.app/guides/github-integration)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker GitHub Actions](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

---

## ✨ Benefits of CI/CD

✅ **No local deployment** - Push to GitHub and it deploys automatically
✅ **Consistent builds** - Same environment every time
✅ **Fast iteration** - Push, wait 2 minutes, live
✅ **No manual steps** - Set it up once, forget it
✅ **Multiple environments** - Easy to add staging/production
✅ **Rollback easy** - Revert commit, auto-redeploys previous version

---

## 🎯 Recommended Setup

For most users:
1. ✅ **Build and Test** - Already works, no setup
2. ✅ **Deploy to Vercel** - 5 minutes to set up
3. ⏸️ Skip Railway/Docker for now (unless you need them)

**Result:** Every push to `main` automatically deploys to Vercel!
