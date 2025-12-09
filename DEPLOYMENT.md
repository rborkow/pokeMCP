# Deployment Guide

This guide covers different ways to deploy and distribute the Pokémon MCP Server.

## 📦 Option 1: NPM Package (Recommended)

### Publishing to NPM

**Pros:**
- Easy installation: `npm install -g pokemon-mcp-server`
- Automatic dependency management
- Version control and updates
- Standard MCP server distribution

**Steps:**

1. **Create an NPM account** (if you don't have one):
   ```bash
   npm adduser
   ```

2. **Test the package locally**:
   ```bash
   npm pack
   npm install -g pokemon-mcp-server-0.2.0.tgz
   ```

3. **Publish to NPM**:
   ```bash
   npm publish
   ```

4. **Users install with**:
   ```bash
   npm install -g pokemon-mcp-server
   ```

5. **Configure in Claude Desktop** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "pokemon": {
         "command": "pokemon-mcp"
       }
     }
   }
   ```

### NPM Package Naming

If `pokemon-mcp-server` is taken, alternative names:
- `@yourusername/pokemon-mcp`
- `mcp-pokemon-team-builder`
- `smogon-mcp-server`

---

## 🐳 Option 2: Docker Container

**Pros:**
- Consistent environment
- Easy to run anywhere
- No Node.js installation required

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy built files and data
COPY build/ ./build/
COPY src/data/ ./src/data/

# Run the server
CMD ["node", "build/index.js"]
```

**Build and publish:**

```bash
# Build image
docker build -t pokemon-mcp-server .

# Tag for Docker Hub
docker tag pokemon-mcp-server yourusername/pokemon-mcp-server:0.2.0
docker tag pokemon-mcp-server yourusername/pokemon-mcp-server:latest

# Push to Docker Hub
docker push yourusername/pokemon-mcp-server:0.2.0
docker push yourusername/pokemon-mcp-server:latest
```

**Users configure in Claude Desktop:**

```json
{
  "mcpServers": {
    "pokemon": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "yourusername/pokemon-mcp-server"]
    }
  }
}
```

---

## 📁 Option 3: GitHub Releases (Binary Distribution)

Use **pkg** to create standalone executables:

**Install pkg:**
```bash
npm install -g pkg
```

**Add to package.json:**
```json
{
  "scripts": {
    "package": "pkg . --out-path dist"
  },
  "pkg": {
    "targets": ["node18-macos-x64", "node18-linux-x64", "node18-win-x64"],
    "assets": ["src/data/**/*"]
  }
}
```

**Build binaries:**
```bash
npm run package
```

**Create GitHub Release:**
1. Tag a version: `git tag v0.2.0`
2. Push tag: `git push origin v0.2.0`
3. Create release on GitHub with binaries attached
4. Users download binary for their platform

**Users configure:**
```json
{
  "mcpServers": {
    "pokemon": {
      "command": "/path/to/pokemon-mcp-server"
    }
  }
}
```

---

## 🌐 Option 4: HTTP Bridge (Advanced)

For web-based or remote access, you can create an HTTP bridge:

**Why:** MCP servers use stdio by default, but you might want HTTP access for:
- Web dashboards
- REST API access
- Remote server deployment

**Implementation:**
Create a separate HTTP server that wraps your MCP server using SSE (Server-Sent Events) or WebSockets.

**Not recommended for initial deployment** - stick with stdio for now.

---

## 📊 Option 5: MCP Server Registry

Submit your server to the [MCP Servers Registry](https://github.com/modelcontextprotocol/servers):

1. Fork the repository
2. Add your server to the list
3. Submit a pull request
4. Users can discover your server through the official registry

---

## 🔐 Best Practices

### Security
- ✅ Don't include sensitive data in the package
- ✅ Use `.npmignore` to exclude unnecessary files
- ✅ Set appropriate file permissions
- ✅ Keep dependencies updated

### Performance
- ✅ Cache Smogon data where possible
- ✅ Implement rate limiting for API calls
- ✅ Use appropriate timeouts

### Versioning
- ✅ Follow semantic versioning (MAJOR.MINOR.PATCH)
- ✅ Document breaking changes in CHANGELOG.md
- ✅ Tag releases in Git

### Documentation
- ✅ Keep README.md updated
- ✅ Provide clear installation instructions
- ✅ Include usage examples
- ✅ Document all available tools

---

## 📝 Recommended Workflow

**For public distribution:**

1. **Publish to NPM** - Primary distribution method
2. **Create GitHub Releases** - For users who prefer binaries
3. **Submit to MCP Registry** - Increase discoverability
4. **Optional: Docker Hub** - For containerized deployments

**Start with:**
```bash
# Test locally
npm pack
npm install -g ./pokemon-mcp-server-0.2.0.tgz

# Publish to NPM
npm publish

# Create GitHub release
git tag v0.2.0
git push origin v0.2.0
```

---

## 🚀 Next Steps

After deploying:

1. **Monitor usage** - Track downloads and issues
2. **Gather feedback** - Engage with users on GitHub
3. **Update regularly** - Keep Pokémon data fresh
4. **Add features** - Based on user requests
5. **Write tests** - Ensure reliability

## 📖 Resources

- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [MCP Server Documentation](https://modelcontextprotocol.io/)
- [Docker Hub](https://hub.docker.com/)
- [pkg - Node.js binary compiler](https://github.com/vercel/pkg)
