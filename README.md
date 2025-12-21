# Cloudflare Manager Skill

> **Attribution**: Based on [qdhenry/Claude-Command-Suite](https://github.com/qdhenry/Claude-Command-Suite/tree/main/.claude/skills/cloudflare-manager)

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

A Claude Code skill for managing Cloudflare services (Workers, KV, R2, Pages, DNS, D1, Zones, Cache, Secrets, Cron Triggers).

**Zero Dependencies** - Only requires Node.js 18+

### Installation

```bash
git clone https://github.com/cheluen/cloudflare-manager ~/.claude/skills/cloudflare-manager
```

### Configuration

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

### Usage

Just ask Claude to manage your Cloudflare resources:

```
"Deploy a Worker named 'api-handler'"
"Create a KV namespace for user sessions"
"Set up a D1 database called 'my-app-db'"
"Purge cache for example.com"
```

### Available Commands

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

---

<a name="中文"></a>
## 中文

一个用于管理 Cloudflare 服务的 Claude Code 技能（Workers、KV、R2、Pages、DNS、D1、Zones、缓存、密钥、定时任务）。

**零依赖** - 仅需 Node.js 18+

### 安装

```bash
git clone https://github.com/cheluen/cloudflare-manager ~/.claude/skills/cloudflare-manager
```

### 配置

在**项目根目录**创建 `.env` 文件：

```bash
CLOUDFLARE_API_KEY=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id  # 可选，会自动检测
```

### API Token 权限

从这里获取 Token：https://dash.cloudflare.com/profile/api-tokens

| 功能 | 权限 | 访问级别 |
|------|------|----------|
| Workers 部署 | Account > Workers Scripts | Edit |
| KV 存储 | Account > Workers KV Storage | Edit |
| R2 存储 | Account > Workers R2 Storage | Edit |
| D1 数据库 | Account > D1 | Edit |
| Pages 部署 | Account > Cloudflare Pages | Edit |
| DNS 管理 | Zone > DNS | Edit |
| Worker 路由 | Zone > Workers Routes | Edit |
| Zone 设置 | Zone > Zone Settings | Read |
| 缓存清除 | Zone > Cache Purge | Purge |

**快速设置**：使用 "Edit Cloudflare Workers" 模板，然后按需添加权限。

### 使用方式

直接让 Claude 管理你的 Cloudflare 资源：

```
"部署一个名为 'api-handler' 的 Worker"
"创建一个用户会话的 KV 命名空间"
"创建一个名为 'my-app-db' 的 D1 数据库"
"清除 example.com 的缓存"
```

### 可用命令

| 脚本 | 用途 |
|------|------|
| `workers.js` | 部署/管理 Workers |
| `kv-storage.js` | KV 命名空间操作 |
| `r2-storage.js` | R2 存储桶管理 |
| `pages.js` | Pages 部署 |
| `dns-routes.js` | DNS 记录与路由 |
| `zones.js` | Zone 管理与缓存 |
| `d1-database.js` | D1 数据库与 SQL |
| `logs.js` | 查看日志 |
| `secrets.js` | 密钥管理 |
| `cron.js` | 定时任务 |
| `validate-api-key.js` | 验证凭据 |

---

## License / 许可证

MIT License
