# Cloudflare Manager Skill

> **Attribution**: Based on [qdhenry/Claude-Command-Suite](https://github.com/qdhenry/Claude-Command-Suite/tree/main/.claude/skills/cloudflare-manager)

A Claude Code skill for managing Cloudflare services (Workers, KV, R2, Pages, DNS, D1, Zones, Cache, Secrets, Cron Triggers).

**Zero Dependencies** - Only requires Node.js 18+

## Installation

```bash
# Clone to your Claude skills directory
git clone https://github.com/your-username/cloudflare-manager ~/.claude/skills/cloudflare-manager
```

## Configuration

Create `.env` file in your **project root**:

```bash
CLOUDFLARE_API_KEY=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id  # Optional, auto-detected
```

### API Token Permissions

Get your token from: https://dash.cloudflare.com/profile/api-tokens

| Feature | Permission | Access Level |
|---------|------------|--------------|
| Workers deployment | Account > Workers Scripts | Edit |
| KV Storage | Account > Workers KV Storage | Edit |
| R2 Storage | Account > Workers R2 Storage | Edit |
| D1 Database | Account > D1 | Edit |
| Pages deployment | Account > Cloudflare Pages | Edit |
| DNS management | Zone > DNS | Edit |
| Worker Routes | Zone > Workers Routes | Edit |
| Zone settings | Zone > Zone Settings | Read |
| Cache purge | Zone > Cache Purge | Purge |

**Quick Setup**: Use "Edit Cloudflare Workers" template, then add permissions as needed.

**Security Best Practices**:
- Use least privilege principle
- Set token expiration (90 days recommended)
- Restrict to specific IP addresses if possible

## Usage

Just ask Claude to manage your Cloudflare resources:

```
"Deploy a Worker named 'api-handler'"
"Create a KV namespace for user sessions"
"Set up a D1 database called 'my-app-db'"
"Purge cache for example.com"
```

## Available Commands

| Script | Purpose |
|--------|---------|
| `workers.js` | Deploy/manage Workers |
| `kv-storage.js` | KV namespace operations |
| `r2-storage.js` | R2 bucket management |
| `pages.js` | Pages deployment |
| `dns-routes.js` | DNS records & routes |
| `zones.js` | Zone management & cache |
| `d1-database.js` | D1 database & SQL |
| `logs.js` | View logs |
| `secrets.js` | Manage secrets |
| `cron.js` | Cron triggers |
| `validate-api-key.js` | Validate credentials |

## License

MIT License
