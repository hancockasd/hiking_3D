# Hiking 3D — Project Rules

## 红线 (Do NOT)

- **wrangler.toml 绝对不能进 git** — Cloudflare Pages 检测到任何 wrangler.toml 都会触发 `npx wrangler deploy`（Worker 模式），导致部署失败。已在 `.gitignore`
- **不要用 Cloudflare Dashboard UI 的 "Add binding" 按钮** — 已知 bug，点击无响应。用 `wrangler pages deploy` 或 REST API
- **不要删除 `functions/` 目录** — 这是 Pages Functions 的 API 路由，删除后整个后端不可用

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + Vite + Pinia + TypeScript + MapLibre GL |
| 后端 API | Cloudflare Pages Functions (`functions/api/*`) |
| 数据库 | Cloudflare D1 (SQLite，binding 名 `DB`) |
| 本地存储 | IndexedDB (idb-keyval) |
| 部署 | `npx wrangler pages deploy dist --project-name hiking3d` |

## 项目结构

```
hiking/
├── functions/              # Pages Functions (API routes)
│   ├── _utils/auth.ts      # hashPassword, generateToken, requireAuth
│   ├── _utils/response.ts  # json(), handleOptions()
│   ├── api/auth/           # register, login, logout
│   ├── api/tracks.ts       # GET list + POST save
│   └── api/tracks/[id].ts  # GET one + DELETE
├── src/
│   ├── lib/api.ts          # fetch() calls to /api/*, token in Authorization header
│   ├── lib/auth.ts         # Token-based auth composable (useAuth)
│   ├── lib/storage.ts      # IndexedDB + cloud sync, saveTrack/deleteTrack/listTracks/syncFromCloud
│   ├── components/         # Vue components
│   └── state/              # Pinia stores (trackStore)
├── schema.sql              # D1 table definitions
├── wrangler.toml.example   # 参考文件，不要复制为 wrangler.toml 后提交
├── dist/                   # 构建产物
└── index.html
```

## API 路由速查

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | `/api/auth/register` | No | 注册，返回 `{ok, token, user}` |
| POST | `/api/auth/login` | No | 登录，返回 `{ok, token, user}` |
| POST | `/api/auth/logout` | Bearer | 登出 |
| POST | `/api/auth/change-password` | Bearer | 修改密码（oldPassword, newPassword） |
| POST | `/api/auth/update-avatar` | Bearer | 更新头像（base64 data URL） |
| GET | `/api/tracks` | Bearer | 列出用户轨迹 |
| POST | `/api/tracks` | Bearer | 保存/更新轨迹 |
| GET | `/api/tracks/:id` | Bearer | 单条轨迹 |
| DELETE | `/api/tracks/:id` | Bearer | 删除轨迹 |

## 数据库

- **D1 database name**: `hiking_db`（下划线，不是 `hiking-db`）
- **database_id**: `28eb9efc-bb96-4051-b5bd-401cdbf56ff5`
- **Binding variable**: `DB`（在 wrangler.toml 中配置）
- **三张表**: `users`, `sessions`, `tracks` — schema 见 `schema.sql`
- **执行 schema**: `npx wrangler d1 execute hiking_db --file=schema.sql --remote`

## 认证机制

- 密码 SHA-256 哈希（Web Crypto API），token 用 `crypto.randomUUID()`
- Token 存在 `localStorage` key `cf_token`，请求带 `Authorization: Bearer <token>`
- `requireAuth()` 从 D1 `sessions` 表验证 token，返回 `user_id`
- 刷新页面后 `currentUser` 恢复为 `{ id: 'restored' }`（无 email/username），UI 显示 "用户" 占位

## 部署

```bash
# 构建
npm run build

# 部署（读本地 wrangler.toml 获取 D1 binding）
npx wrangler pages deploy dist --project-name hiking3d
```

**不要用 git push 部署** — wrangler.toml 不在 git 里，git push 触发 Cloudflare 自动构建时没有 D1 binding。

**Account ID**: `948421c1be755bf5863ec6efdeb9f74f`
**Production URL**: https://hiking3d.pages.dev

## 踩坑记录

- **Browser `type="email"` 拦截**：HTML5 email 校验在表单提交前拦截，不匹配时抛出 "The string did not match the expected pattern"，前端无法捕获。改用 `type="text" inputmode="email"`
- **UserMenu 不响应**：`computed()` vs `ref()` — 用 `ref()` 初始化一次后再也不会变，auth 状态变化后 UI 不更新
- **wrangler.toml → Worker deploy**：Cloudflare Pages 只要检测到仓库里有 `wrangler.toml` 就走 `npx wrangler deploy`，必须放在 `.gitignore` 里
- **D1 binding UI bug**：Dashboard 的 Bindings → Add binding 按钮点击无响应（Cloudflare 已知 bug），用 `wrangler pages deploy` 或 REST API 配置
- **云同步双向**：`syncFromCloud`（`storage.ts`）单次 API 调用拉取全量云端列表，然后：① 本地独有 → 上传；② 本地有云端无 → 删本地；③ 云端有本地无 → 下载。修复前只做了 ③，导致跨设备删除不同步
- **头像不同步**：头像存为 base64 存 `localStorage['user_avatar']`，同时 POST `/api/auth/update-avatar` 写入 D1；登录时从 D1 拉回写 localStorage。UserMenu 监听 `avatar-updated` window event 刷新

## UI 主题

侧边栏使用深色 **Slate Navy** 配色，地图区域保持白色：

```
--sb:        #1e2535   sidebar 背景
--sb-header: #161c2d   header 深底色
--sb-border: rgba(255,255,255,0.08)
--sb-hover:  rgba(255,255,255,0.06)
--sb-active: rgba(255,255,255,0.12)
--sb-ink:    #e8ecf4   主文字
--sb-ink2:   #a8b4cc   次文字
--sb-ink3:   #6b7a96   弱文字
--sb-blue:   #4d8ffa   accent
```

**所有侧边栏组件**（`TrackListSidebar`, `StatsPanel`, `FileDropzone`, `ElevationChart`, `FlyoverControls`, `BasemapSwitcher`, `UserMenu`）使用 `var(--sb-*)` 变量，不用 `var(--ink/--border)`。地图相关组件（MapCanvas）及 Dialog 弹窗继续使用浅色 `var(--border/--ink)` 系列。
