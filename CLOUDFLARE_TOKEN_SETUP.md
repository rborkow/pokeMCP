# Cloudflare API Token Setup Guide

## Required Permissions for GitHub Actions

Your API token needs these permissions to deploy and manage the MCP server.

---

## Quick Setup (Recommended)

### Option 1: Use the "Edit Cloudflare Workers" Template

This is the easiest approach:

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Click **"Create Token"**
3. Find **"Edit Cloudflare Workers"** template
4. Click **"Use template"**
5. Configure the token:
   - **Token name:** `GitHub Actions - Pokemon MCP`
   - **Account Resources:** Select your account
   - **Zone Resources:** Not needed (leave as "All zones" or skip)
6. Click **"Continue to summary"**
7. Review and click **"Create Token"**
8. **IMPORTANT:** Copy the token immediately (you won't see it again!)

**This template includes:**
✅ Workers Scripts - Edit
✅ Workers KV Storage - Edit
✅ Workers AI - Read
✅ Account Settings - Read

---

## Option 2: Custom Token (More Control)

If you want more granular control, create a custom token:

### Step 1: Create Custom API Token

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Click **"Create Token"**
3. Click **"Create Custom Token"**

### Step 2: Set Permissions

Add these permissions:

#### **Account Permissions:**
- ✅ **Workers Scripts** → **Edit**
  - Required for: Deploying Workers
- ✅ **Workers KV Storage** → **Edit**
  - Required for: Managing KV namespaces, reading/writing data
- ✅ **Workers AI** → **Read**
  - Required for: Using Workers AI for embeddings
- ✅ **Account Settings** → **Read**
  - Required for: Wrangler to function properly
- ✅ **D1** → **Edit** (optional)
  - Only if using D1 databases
- ✅ **Durable Objects** → **Edit**
  - Required for: MCP Durable Objects

#### **Zone Permissions (Optional):**
- If you're using a custom domain, add:
  - **Zone** → **Read**
  - **DNS** → **Edit**

### Step 3: Set Account Resources

- **Account:** Select your specific account (recommended)
- **Zone Resources:**
  - "All zones" OR
  - "Specific zone" (if using custom domain)

### Step 4: IP Filtering (Optional but Recommended)

For additional security, restrict to GitHub Actions IP ranges:
- Click **"Client IP Address Filtering"**
- Add GitHub's IP ranges (see below)

### Step 5: TTL (Time to Live)

- **Recommended:** Set expiration date (e.g., 1 year)
- You'll get notified before expiration
- Never set "Never expires" for production tokens

---

## GitHub Actions IP Ranges (Optional Security)

If you want to restrict the token to GitHub Actions only:

**GitHub Meta API:**
```bash
curl https://api.github.com/meta | jq -r '.actions[]'
```

Example ranges (check current ones above):
```
13.64.0.0/16
13.65.0.0/16
13.66.0.0/16
... (many more)
```

⚠️ **Note:** GitHub's IPs change frequently, so this requires maintenance.

---

## Complete Permissions Checklist

Use this checklist when creating your token:

### Minimum Required:
- [ ] **Workers Scripts** - Edit
- [ ] **Workers KV Storage** - Edit
- [ ] **Account Settings** - Read
- [ ] **Durable Objects** - Edit

### Recommended:
- [ ] **Workers AI** - Read
- [ ] **D1** (if using databases) - Edit
- [ ] **User Details** - Read (for `wrangler whoami`)

### Optional (for advanced features):
- [ ] **Workers Routes** - Edit (custom domains)
- [ ] **Zone** - Read (custom domains)
- [ ] **DNS** - Edit (custom domains)
- [ ] **Analytics** - Read (detailed analytics)

---

## Testing Your Token

After creating the token, test it locally:

```bash
# Set token as environment variable
export CLOUDFLARE_API_TOKEN="your-token-here"

# Test wrangler commands
npx wrangler whoami

# Should output:
# Getting User settings...
# 👋 You are logged in with an API Token, associated with the email '...'!
# ┌──────────────────┬──────────────────────────────────┐
# │ Account Name     │ Account ID                       │
# ├──────────────────┼──────────────────────────────────┤
# │ Your Account     │ abc123...                        │
# └──────────────────┴──────────────────────────────────┘

# Test deployment (staging)
npx wrangler deploy --env staging --dry-run

# Should show deployment plan without actually deploying
```

If these work, the token has correct permissions!

---

## Adding Token to GitHub

### Step 1: Get Your Account ID

```bash
npx wrangler whoami
```

Copy the **Account ID** from the output.

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**

Add two secrets:

**Secret 1:**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: `<paste your API token>`

**Secret 2:**
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: `<paste your account ID>`

### Step 3: Verify in GitHub Actions

Push a commit to test:

```bash
git add .
git commit -m "test: verify CI/CD setup"
git push origin main
```

Check Actions tab - should see workflows running successfully.

---

## Security Best Practices

### DO:
✅ Use separate tokens for CI/CD and local development
✅ Set expiration dates (review annually)
✅ Use descriptive names ("GitHub Actions - Pokemon MCP")
✅ Store in GitHub Secrets (never commit to git)
✅ Rotate tokens periodically
✅ Use minimum required permissions

### DON'T:
❌ Use your Global API Key (too powerful)
❌ Share tokens between projects
❌ Commit tokens to git
❌ Use "Never expires" for production
❌ Give "Edit" when "Read" is sufficient
❌ Share tokens via insecure channels (email, Slack, etc.)

---

## Troubleshooting

### Error: "Authentication error"
- **Cause:** Invalid or expired token
- **Fix:** Regenerate token and update GitHub secret

### Error: "Insufficient permissions"
- **Cause:** Missing required permissions
- **Fix:** Add missing permissions (see checklist above)

### Error: "Account not found"
- **Cause:** Wrong account ID or token not associated with account
- **Fix:** Run `wrangler whoami` and verify account ID

### Error: "Rate limit exceeded"
- **Cause:** Too many API requests
- **Fix:** Wait 1 hour or upgrade Cloudflare plan

### Workflow fails but local works
- **Cause:** Token permissions different from local auth
- **Fix:** Ensure GitHub secret token has same permissions

---

## Token Rotation

When rotating tokens (recommended annually):

1. **Create new token** with same permissions
2. **Update GitHub secret** with new token
3. **Test deployment** on staging
4. **Revoke old token** after successful test
5. **Document** rotation date

---

## Example Token Configuration

Here's a screenshot-style representation of the recommended settings:

```
Token name: GitHub Actions - Pokemon MCP
───────────────────────────────────────────

Permissions:
  Account
    ✓ Workers Scripts            → Edit
    ✓ Workers KV Storage         → Edit
    ✓ Account Settings           → Read
    ✓ Durable Objects            → Edit
    ✓ Workers AI                 → Read

Account Resources:
  Include → Specific account → [Your Account Name]

Zone Resources:
  Include → All zones (or skip)

IP Filtering:
  [Optional] Add GitHub Actions IPs

TTL:
  Start: Now
  End: [1 year from now]
```

---

## Quick Reference

**Minimum command to test token:**
```bash
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler whoami
```

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**Where to get Account ID:**
```bash
npx wrangler whoami
```

**Where to create token:**
Dashboard → Profile → API Tokens → Create Token

---

## Need Help?

**Cloudflare Documentation:**
- API Tokens: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- Permissions: https://developers.cloudflare.com/fundamentals/api/reference/permissions/

**Support:**
- Community: https://community.cloudflare.com/
- Discord: https://discord.gg/cloudflaredev
