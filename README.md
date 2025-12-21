# Cloudflare Manager Skill

> **Attribution / 来源声明**: This skill is based on and modified from [qdhenry/Claude-Command-Suite](https://github.com/qdhenry/Claude-Command-Suite/tree/main/.claude/skills/cloudflare-manager). Special thanks to the original author for their excellent work.
>
> **归属声明**: 本技能基于 [qdhenry/Claude-Command-Suite](https://github.com/qdhenry/Claude-Command-Suite/tree/main/.claude/skills/cloudflare-manager) 修改而来。特别感谢原作者的出色工作。

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

A Claude Code skill for managing Cloudflare services including Workers, KV Storage, R2 buckets, Pages, DNS, D1 Database, Zone management, and cache purging.

**Zero Dependencies** - Only requires Node.js 18+, no npm install needed!

### Features

- **Workers Deployment**: Deploy and manage Cloudflare Workers with automatic URL extraction
- **KV Storage**: Create namespaces, read/write data, bulk operations
- **R2 Storage**: Manage buckets and objects (S3-compatible storage)
- **Pages Deployment**: Deploy static sites and configure environment variables
- **DNS & Routing**: Configure DNS records and worker routes
- **D1 Database**: Create, query, and manage D1 SQL databases
- **Zone Management**: List zones, view settings, and manage domains
- **Cache Purge**: Purge CDN cache by URL, tags, prefixes, or hostname
- **Secrets Management**: Securely manage Worker environment secrets
- **Cron Triggers**: Schedule Workers to run on cron schedules
- **API Validation**: Validate credentials and check permissions
- **Error Handling**: Automatic retries with exponential backoff
- **URL Auto-Extraction**: Automatically captures and returns deployment URLs

### Quick Start

#### 1. Configure API Key

Create a `.env` file in your project root (not in the skill directory):

```bash
CLOUDFLARE_API_KEY=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id  # Optional, auto-detected
```

**Getting your API Token**:
1. Visit https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template or create custom token
4. Required permissions:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > Workers R2 Storage > Edit
   - Account > Cloudflare Pages > Edit
   - Zone > DNS > Edit (if using custom domains)

#### 2. Validate Configuration

Verify your setup:

```bash
cd ~/.claude/skills/cloudflare-manager
node scripts/validate-api-key.js
```

Expected output:
```
✅ API key is valid!
ℹ️  Token Status: active
ℹ️  Account: Your Account Name (abc123...)

🔑 Granted Permissions:
  ✅ Workers Scripts: Edit
  ✅ Workers KV Storage: Edit
  ✅ Workers R2 Storage: Edit
```

### Usage Examples

#### Deploy a Worker

```bash
# Create worker script
cat > hello-worker.js << 'EOF'
addEventListener('fetch', event => {
  event.respondWith(new Response('Hello World!'));
});
EOF

# Deploy
node scripts/workers.js deploy hello-worker ./hello-worker.js

# Returns: https://hello-worker.username.workers.dev
```

#### Using with Claude Code

```
User: "Deploy a new Cloudflare worker named 'api-handler' and return the URL"

Claude: [Uses cloudflare-manager skill]
        Deployed worker: https://api-handler.username.workers.dev
```

#### Create KV Storage

```bash
# Create namespace
node scripts/kv-storage.js create-namespace user-sessions
# Returns: Namespace ID (save this!)

# Write data
node scripts/kv-storage.js write <namespace-id> "user:123" '{"name":"John"}'

# Read data
node scripts/kv-storage.js read <namespace-id> "user:123"
```

#### Manage R2 Buckets

```bash
# Create bucket
node scripts/r2-storage.js create-bucket my-files

# Upload file
node scripts/r2-storage.js upload my-files ./photo.jpg images/photo.jpg

# List objects
node scripts/r2-storage.js list-objects my-files
```

#### Deploy Pages

```bash
# Create/deploy Pages project
node scripts/pages.js deploy my-app ./dist

# Set environment variable
node scripts/pages.js set-env my-app API_URL https://api.example.com

# Get project URL
node scripts/pages.js get-url my-app
```

#### Configure DNS and Routes

```bash
# Create DNS record
node scripts/dns-routes.js create-dns example.com A api 192.168.1.1

# Create worker route
node scripts/dns-routes.js create-route example.com "example.com/api/*" api-handler

# List all zones
node scripts/dns-routes.js list-zones
```

### Command Reference

| Command | Description |
|---------|-------------|
| `node scripts/validate-api-key.js` | Validate API credentials |
| `node scripts/workers.js <cmd>` | Manage Workers (deploy/update/list/delete) |
| `node scripts/kv-storage.js <cmd>` | Manage KV namespaces and keys |
| `node scripts/r2-storage.js <cmd>` | Manage R2 buckets and objects |
| `node scripts/pages.js <cmd>` | Manage Pages projects |
| `node scripts/dns-routes.js <cmd>` | Manage DNS records and routes |
| `node scripts/zones.js <cmd>` | Manage zones and purge cache |
| `node scripts/d1-database.js <cmd>` | Manage D1 databases and run SQL |
| `node scripts/logs.js <cmd>` | View Workers and Pages logs |
| `node scripts/secrets.js <cmd>` | Manage Workers secrets |
| `node scripts/cron.js <cmd>` | Manage Cron Triggers (scheduled tasks) |

#### Zone Management & Cache Purge

```bash
# List all zones
node scripts/zones.js list

# Get zone details
node scripts/zones.js get example.com

# View zone settings
node scripts/zones.js settings example.com

# Purge all cache
node scripts/zones.js purge-cache example.com --all

# Purge specific URLs
node scripts/zones.js purge-cache example.com --urls https://example.com/page1,https://example.com/page2
```

#### D1 Database

```bash
# List all databases
node scripts/d1-database.js list

# Create a new database
node scripts/d1-database.js create my-app-db

# Execute SQL query
node scripts/d1-database.js query <db-id> "SELECT * FROM users LIMIT 10"

# Execute SQL statement
node scripts/d1-database.js execute <db-id> "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"
```

#### Logs (Workers & Pages)

```bash
# Real-time Workers logs (requires wrangler)
node scripts/logs.js workers my-worker --tail

# Query Workers historical logs (last hour)
node scripts/logs.js workers my-worker

# Query last 24 hours, errors only
node scripts/logs.js workers my-worker --from 24h --status error

# Pages deployment logs
node scripts/logs.js pages my-site

# Show dashboard links
node scripts/logs.js workers my-worker --dashboard
```

**Note**: Real-time logs require wrangler CLI:
```bash
npm install -g wrangler
npx wrangler login
```

### Requirements

- **Node.js 18+**: Runtime with built-in fetch API
- **Cloudflare Account**: Free or paid account
- **API Token**: With appropriate permissions
- **Internet Connection**: For API calls

### Troubleshooting

#### "CLOUDFLARE_API_KEY not found in environment"

**Solution**: Create `.env` file in your project root:
```bash
echo "CLOUDFLARE_API_KEY=your_token_here" > .env
```

#### "Worker deployment failed"

**Solutions**:
1. Check script syntax: `node --check ./worker.js`
2. Verify file exists: `ls -lh ./worker.js`
3. Re-validate API key: `node scripts/validate-api-key.js --no-cache`

#### "API rate limit exceeded (429)"

**Solution**: Scripts automatically retry with exponential backoff. Wait 1-2 minutes before manual retry.

---

<a name="中文"></a>
## 中文

一个用于管理 Cloudflare 服务的 Claude Code 技能，支持 Workers、KV 存储、R2 存储、Pages、DNS、D1 数据库、Zone 管理和缓存清除。

**零依赖** - 仅需 Node.js 18+，无需任何 npm install！

### 功能特性

- **Workers 部署**: 部署和管理 Cloudflare Workers，自动提取部署 URL
- **KV 存储**: 创建命名空间、读写数据、批量操作
- **R2 存储**: 管理存储桶和对象（S3 兼容存储）
- **Pages 部署**: 部署静态站点并配置环境变量
- **DNS 与路由**: 配置 DNS 记录和 Worker 路由
- **D1 数据库**: 创建、查询和管理 D1 SQL 数据库
- **Zone 管理**: 列出域名、查看设置、管理域名
- **缓存清除**: 按 URL、标签、前缀或主机名清除 CDN 缓存
- **API 验证**: 验证凭据并检查权限
- **错误处理**: 自动重试与指数退避
- **URL 自动提取**: 自动捕获并返回部署 URL

### 快速开始

#### 1. 配置 API 密钥

在你的项目根目录（不是技能目录）创建 `.env` 文件：

```bash
CLOUDFLARE_API_KEY=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id  # 可选，会自动检测
```

**获取 API Token**:
1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 "Create Token"
3. 使用 "Edit Cloudflare Workers" 模板或创建自定义 Token
4. 所需权限：
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > Workers R2 Storage > Edit
   - Account > Cloudflare Pages > Edit
   - Zone > DNS > Edit（如需自定义域名）

#### 2. 验证配置

验证你的设置：

```bash
cd ~/.claude/skills/cloudflare-manager
node scripts/validate-api-key.js
```

预期输出：
```
✅ API key is valid!
ℹ️  Token Status: active
ℹ️  Account: Your Account Name (abc123...)

🔑 Granted Permissions:
  ✅ Workers Scripts: Edit
  ✅ Workers KV Storage: Edit
  ✅ Workers R2 Storage: Edit
```

### 使用示例

#### 部署 Worker

```bash
# 创建 Worker 脚本
cat > hello-worker.js << 'EOF'
addEventListener('fetch', event => {
  event.respondWith(new Response('Hello World!'));
});
EOF

# 部署
node scripts/workers.js deploy hello-worker ./hello-worker.js

# 返回: https://hello-worker.username.workers.dev
```

#### 与 Claude Code 配合使用

```
用户: "部署一个名为 'api-handler' 的 Cloudflare Worker 并返回 URL"

Claude: [使用 cloudflare-manager 技能]
        已部署 Worker: https://api-handler.username.workers.dev
```

#### 创建 KV 存储

```bash
# 创建命名空间
node scripts/kv-storage.js create-namespace user-sessions
# 返回: Namespace ID（请保存！）

# 写入数据
node scripts/kv-storage.js write <namespace-id> "user:123" '{"name":"John"}'

# 读取数据
node scripts/kv-storage.js read <namespace-id> "user:123"
```

#### 管理 R2 存储桶

```bash
# 创建存储桶
node scripts/r2-storage.js create-bucket my-files

# 上传文件
node scripts/r2-storage.js upload my-files ./photo.jpg images/photo.jpg

# 列出对象
node scripts/r2-storage.js list-objects my-files
```

#### 部署 Pages

```bash
# 创建/部署 Pages 项目
node scripts/pages.js deploy my-app ./dist

# 设置环境变量
node scripts/pages.js set-env my-app API_URL https://api.example.com

# 获取项目 URL
node scripts/pages.js get-url my-app
```

#### 配置 DNS 和路由

```bash
# 创建 DNS 记录
node scripts/dns-routes.js create-dns example.com A api 192.168.1.1

# 创建 Worker 路由
node scripts/dns-routes.js create-route example.com "example.com/api/*" api-handler

# 列出所有 Zone
node scripts/dns-routes.js list-zones
```

### 命令参考

| 命令 | 说明 |
|------|------|
| `node scripts/validate-api-key.js` | 验证 API 凭据 |
| `node scripts/workers.js <cmd>` | 管理 Workers（deploy/update/list/delete）|
| `node scripts/kv-storage.js <cmd>` | 管理 KV 命名空间和键值 |
| `node scripts/r2-storage.js <cmd>` | 管理 R2 存储桶和对象 |
| `node scripts/pages.js <cmd>` | 管理 Pages 项目 |
| `node scripts/dns-routes.js <cmd>` | 管理 DNS 记录和路由 |
| `node scripts/zones.js <cmd>` | 管理域名和清除缓存 |
| `node scripts/d1-database.js <cmd>` | 管理 D1 数据库和执行 SQL |
| `node scripts/logs.js <cmd>` | 查看 Workers 和 Pages 日志 |

#### Zone 管理与缓存清除

```bash
# 列出所有域名
node scripts/zones.js list

# 获取域名详情
node scripts/zones.js get example.com

# 查看域名设置
node scripts/zones.js settings example.com

# 清除所有缓存
node scripts/zones.js purge-cache example.com --all

# 清除指定 URL
node scripts/zones.js purge-cache example.com --urls https://example.com/page1,https://example.com/page2
```

#### D1 数据库

```bash
# 列出所有数据库
node scripts/d1-database.js list

# 创建新数据库
node scripts/d1-database.js create my-app-db

# 执行 SQL 查询
node scripts/d1-database.js query <db-id> "SELECT * FROM users LIMIT 10"

# 执行 SQL 语句
node scripts/d1-database.js execute <db-id> "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"
```

#### 日志查看 (Workers & Pages)

```bash
# 实时 Workers 日志（需要 wrangler）
node scripts/logs.js workers my-worker --tail

# 查询 Workers 历史日志（最近1小时）
node scripts/logs.js workers my-worker

# 查询最近24小时的错误日志
node scripts/logs.js workers my-worker --from 24h --status error

# Pages 部署日志
node scripts/logs.js pages my-site

# 显示 Dashboard 链接
node scripts/logs.js workers my-worker --dashboard
```

**注意**: 实时日志需要安装 wrangler CLI：
```bash
npm install -g wrangler
npx wrangler login
```

#### 密钥管理 (Secrets)

```bash
# 列出 Worker 的所有密钥
node scripts/secrets.js list my-worker

# 创建或更新密钥
node scripts/secrets.js put my-worker API_KEY sk-123456
node scripts/secrets.js put my-worker DATABASE_URL "postgres://user:pass@host/db"

# 删除密钥
node scripts/secrets.js delete my-worker OLD_SECRET
```

**注意**: 密钥值永远不会通过 API 暴露，只有 Worker 运行时可以访问。

#### 定时任务 (Cron Triggers)

```bash
# 列出当前调度
node scripts/cron.js list my-worker

# 每 5 分钟运行一次
node scripts/cron.js update my-worker "*/5 * * * *"

# 设置多个调度（最多 3 个）
node scripts/cron.js update my-worker "0 * * * *" "0 0 * * *"

# 工作日 9 点运行（UTC 时间）
node scripts/cron.js update my-worker "0 9 * * 1-5"

# 删除所有调度
node scripts/cron.js delete my-worker

# 本地测试说明
node scripts/cron.js test my-worker
```

**注意**: Cloudflare 使用 UTC 时间处理所有 cron 调度。

### 系统要求

- **Node.js 18+**: 脚本运行时（内置 fetch API）
- **Cloudflare 账户**: 免费或付费账户
- **API Token**: 具有相应权限
- **网络连接**: 用于 API 调用

### 故障排除

#### "CLOUDFLARE_API_KEY not found in environment"

**解决方案**: 在项目根目录创建 `.env` 文件：
```bash
echo "CLOUDFLARE_API_KEY=your_token_here" > .env
```

#### "Worker deployment failed"

**解决方案**:
1. 检查脚本语法：`node --check ./worker.js`
2. 验证文件存在：`ls -lh ./worker.js`
3. 重新验证 API 密钥：`node scripts/validate-api-key.js --no-cache`

#### "API rate limit exceeded (429)"

**解决方案**: 脚本会自动进行指数退避重试。手动重试前等待 1-2 分钟。

---

## Project Structure / 项目结构

```
cloudflare-manager/
├── SKILL.md              # Main skill documentation / 主要技能文档
├── README.md             # This file / 本文件
├── .env.example          # Environment config template / 环境配置模板
├── examples.md           # Advanced examples / 高级示例
├── package.json          # Project config (zero deps) / 项目配置（零依赖）
├── scripts/              # Deployment scripts / 部署脚本
│   ├── validate-api-key.js  # API key validation / API 密钥验证
│   ├── workers.js           # Worker management / Worker 管理
│   ├── kv-storage.js        # KV operations / KV 操作
│   ├── r2-storage.js        # R2 operations / R2 操作
│   ├── pages.js             # Pages deployment / Pages 部署
│   ├── dns-routes.js        # DNS and routing / DNS 和路由
│   ├── zones.js             # Zone management & cache purge / 域名管理与缓存清除
│   ├── d1-database.js       # D1 database management / D1 数据库管理
│   ├── logs.js              # Workers & Pages logs / 日志查看
│   ├── secrets.js           # Workers secrets / 密钥管理
│   ├── cron.js              # Cron Triggers / 定时任务
│   └── utils.js             # Shared utilities / 共享工具
└── templates/            # Starter templates / 起始模板
    ├── worker-template.js
    └── wrangler.toml.template
```

## Resources / 资源链接

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [KV Storage Guide](https://developers.cloudflare.com/kv/)
- [R2 Storage Documentation](https://developers.cloudflare.com/r2/)
- [Pages Documentation](https://developers.cloudflare.com/pages/)
- [API Reference](https://developers.cloudflare.com/api/)

## License / 许可证

MIT License

---

**Version / 版本**: 1.0.0
**Last Updated / 最后更新**: 2025-12-21
**Features / 特性**: Zero Dependencies, Node.js 18+, ES Modules, D1 Database, Zone Management, Cache Purge, Logs Viewing, Secrets Management, Cron Triggers / 零依赖、Node.js 18+、ES Modules、D1 数据库、Zone 管理、缓存清除、日志查看、密钥管理、定时任务
