# Zeitgeist — 项目交接与固定版本

更新时间：2026-10-04（America/Chicago）。本文是下一次打开项目时的首要入口。

### 当前增量：第三个 fork 的预测模型 v3

第三个 fork 是 `crestpointmarketing/Stock-Prediction-Models`。当前新增来自其 notebook 的 Gradient Boosting，使用 32 个只依赖当时及之前行情的价格、波动和成交量特征；固定参数、30 个相同历史窗口，独立执行原有 5% 基线改善门槛。协议为 `fork-comparison-v3`，保留 v1/v2 读取兼容。
六只股票中，新模型相对原主模型 3 只改善、3 只变差，全部未达到发布门槛，不能宣称已得到可靠价格预测。详见 `zeitgeist-app/integrations/prediction/BOOSTING-VERIFICATION.md`。
本轮验证：85 Node + 9 DSA + 10 预测测试，共 104 项通过；lint、生产构建通过。浏览器验证取消等待、重新运行、模型切换、历史窗口键盘选择及 320px 无横向溢出。加入 55 秒请求期限、保留上次结果和明确错误提示。
历史固定点 `v2026.10.04-stable` 与 `v2026.10.04-model-lab-v2` 不移动；本轮发布使用新提交，并在上线验证后固定 `v2026.10.04-model-lab-v3`。生产部署状态必须从 Vercel 与正式域名核对，不能仅根据本文判断。

### 历史记录：预测功能第二阶段

`v2026.10.04-stable` 已推送，固定提交为 `3ce616600f047943eab3518a2a8520de677d2feb`。
后续在 `codex/prediction-validation-v2` 开发，不移动固定标签。
新增协议 `fork-comparison-v2`：单独比较两种树模型和固定参数 Ridge；逐窗口校验候选指标；解释发布门槛、展示三个时间区段及预测/实际图表；导出 CSV/JSON；加入可重复运行的多股票验证脚本。
主模型和发布门槛保持不变，比较结果不自动替换主模型；尚未证明提高预测准确率。
模型来源、边界和验证命令见 `zeitgeist-app/integrations/prediction/PROVENANCE.md`。
第二阶段验证：82 Node + 9 DSA + 8 预测测试（99 项），lint 与生产构建通过；四只真实股票每只 754 条历史记录、30 个窗口，运行约 14–17 秒，均未通过主模型预测门槛，未宣称准确率提升。可移植结果见 `zeitgeist-app/integrations/prediction/COMPARISON-VERIFICATION.md`。

## 1. 固定版本与当前结论

- 固定标签：`v2026.10.04-stable`（annotated Git tag；应与远程同名标签一致）。
- 本次收尾包含：此前所有功能修复、首页 Product tour 入口、60 秒英文配音字幕视频及本交接文档。
- 前一个已部署且回归通过的功能基线：`6f741024bb2c8d232ade5eb8bd13b70b6e7310c0`。
- 仓库：`https://github.com/crestpointmarketing/Zeitgeist`。
- 生产站点：`https://zeitgeiststocks.com`。
- 本地工作分支：`codex/prediction-lab`；生产部署跟踪远程 `main`。
- Vercel：team `crestpointmarketings-projects`，project `zeitgeist`。
- 标签是恢复源码的依据，不是数据库、密钥或上游服务状态的快照。不要移动或覆盖此标签；后续修改使用新分支、新提交和新标签。
- 当前已验证范围无已知阻断问题。未验证项及外部限制见第 9 节；不能解释为绝对零缺陷。

## 2. 下次开始时先做什么

1. 阅读本文，执行 `git status --short`、`git log -5 --oneline`、`git fetch origin --tags`。
2. 用 `git rev-parse v2026.10.04-stable^{commit}` 定位固定提交，并与 `origin/main` 比较；若已有后续提交，不要直接覆盖。
3. 核对 Vercel 最新 Production 的 source commit 和域名归属。Git push 成功不代表部署成功。
4. 检查本地配置文件是否存在，只检查键名/是否配置，禁止输出值。不要把文档里的模型默认值当作当前账户一定可访问的模型。
5. 应用命令从 `zeitgeist-app` 执行；需要本地联调时启动 web 和 Python bridge 两个服务。
6. 新改动先做定向测试，再跑回归与构建。保留已存在的用户改动，不要强制 reset/clean。

建议新任务从固定版创建分支：

```powershell
git switch -c codex/next-change v2026.10.04-stable
```

若工作区有改动，先审查并保存，不能直接照抄切换/回退命令。

## 3. 产品与已实现界面

- `/`：项目介绍、动画、登录/注册入口、Product tour 视频。
- `/signup`、`/login`、`/auth/callback`、`/reset-password`：Supabase 认证及恢复流程。
- `/stock-analysis`：未选股票时仅一个居中搜索框及四只快捷股票；选中后单一顶部搜索、紧凑股票栏、图表和 AI Brief。
- 主标签：Overview / Financials / News & Sources / More；More 中包含 Model lab 和 Full AI analysis。
- `/cfo`：持久化 AI CFO 对话、会话切换/重命名/删除、股票上下文追问。
- `/watchlist`：账户关注列表；`/data`：数据来源与覆盖说明。
- 保留深蓝配色、Z Logo、favicon；侧栏可折叠，窄屏 AI 面板下移。不要重新推翻设计或恢复重复欢迎卡/空图表/空 AI 面板。
- 字体对比、输入控件、移动菜单、窄屏财报表格已经处理。图表是日收盘数据，禁止包装成实时价格。

## 4. 架构和三个 fork 的实际用途

项目涉及 **三个 fork：一个主项目、两个外部集成来源**。2026-10-04 已通过 GitHub 仓库元数据核对 fork 关系：

| 用户仓库 | 原始上游 | 当前作用 |
| --- | --- | --- |
| `crestpointmarketing/Zeitgeist` | `3than777/Zeitgeist` | 主应用；当前工作区、UI、认证、数据库接入、API 编排、发布入口 |
| `crestpointmarketing/daily_stock_analysis` | `ZhuLinsen/daily_stock_analysis` | 行情和数据集成来源，运行于私有 Python bridge |
| `crestpointmarketing/Stock-Prediction-Models` | `huseinzol05/Stock-Prediction-Models` | Model lab 模型与回测改写来源 |

“两个集成 fork”只指后两项，不能写成项目只有两个 fork。主项目的固定版本由本交接的 Git 标签定位；两个外部来源的固定提交分别列在下文。

### Web 和数据流程

Next.js 15 / React 19 / TypeScript / Tailwind；Supabase Auth + Postgres；Anthropic 提供分析和聊天。

1. 浏览器调用认证后的 `GET /api/stock?ticker=...`。
2. 服务端并行取得行情、可选新闻、公司信息和财报，将可信快照保存到 Supabase，返回 `snapshot_id`。
3. UI 先展示价格，再 `POST /api/analyze` 传快照 ID。不得信任浏览器提交的价格作为分析事实。
4. 相同证据、模型及 prompt 版本共享 AI 分析缓存；pending 状态轮询，不重复扣 AI 额度。
5. AI 失败保留价格，允许单独重试；切换股票取消过期客户端请求。

### Fork 1：Zeitgeist 主项目

- 本地正在开发并发布的就是 `crestpointmarketing/Zeitgeist`，上游为 `3than777/Zeitgeist`。
- 原项目不是第三方运行时依赖，而是本产品的代码基础；界面、数据链路、认证和持久化等改造均在此 fork 中维护。
- 本次固定整个主项目源码和锁文件，不自动合并上游的新改动。

### Fork 2：daily_stock_analysis 数据集成

- 仓库 `https://github.com/crestpointmarketing/daily_stock_analysis`。
- 固定上游提交 `be148f39ce3be8bc7f9c2d5b0ad77cd31655e78f`，Dockerfile 中固定引用。
- 复用 `YfinanceFetcher`，通过私有 Python/FastAPI bridge 获取已完成交易日 OHLCV。
- Yahoo 季度利润表、资产负债表、现金流表通过独立 worker 提供。
- 新闻及可用公司资料由 Polygon 提供；未启用 DSA 的通知、调度、后台管理或全局组合功能。
- 缓存命中优先于 worker 锁，避免其他股票请求阻塞已有缓存。

### Fork 3：Stock-Prediction-Models 模型集成

- 仓库 `https://github.com/crestpointmarketing/Stock-Prediction-Models`。
- 来源提交 `33266732b0b16188b565e0aeb6b24efa71161f6a`。
- 本项目 `integrations/prediction` 已包含改写后的 Random Forest + Extra Trees 集成，以及单独的 Monte Carlo 情景。
- 不是直接运行原始 TensorFlow notebook，也不沿用其准确率宣传。
- 30 个按时间顺序、互不重叠的五交易日回测窗口；训练不得看到未来标签。
- 只有 MAE 严格低于两个基线各自 MAE 的 95% 才发布树模型预测。未达标显示 Model not yet validated，并保留回测结果，属于正常行为。
- 许可、来源和精确协议：`zeitgeist-app/integrations/prediction/PROVENANCE.md`、`LICENSE`、`SOURCE_MANIFEST.json`。DSA MIT 许可保留于容器的上游 checkout。

#### 模型开发成熟度（2026-10-04）

已完成到“上线可运行的实验模型 + 真实数据 + 回测 + 质量门槛 + UI”阶段，尚不是经过充分验证的预测产品。最近 AAPL 实测成功返回 30 个回测窗口，但未达到发布预测的门槛，因此没有树模型预测值；这不是 API 失败。

未完成/未承诺：原仓库全部模型移植、TensorFlow/深度学习训练管线、广泛股票与市场阶段验证、实盘或含成本/滑点的收益验证、预测区间校准。Monte Carlo 情景不代表已验证的置信区间。不要将当前阶段描述成“全部原模型完成”或“稳定准确预测股价”。

## 5. 关键代码地图

以下路径相对于 `zeitgeist-app/`：

| 位置 | 职责 |
| --- | --- |
| `src/components/stock-analysis-container.tsx` | 搜索状态、取消、价格先展示、分析重试 |
| `src/components/research-dashboard.tsx` | 研究标签、股票信息、AI Brief 布局 |
| `src/components/stock-input.tsx` | 搜索建议、点击/Enter、输入法处理 |
| `src/components/workspace-shell.tsx` | 主导航、侧栏和响应式框架 |
| `src/components/landing-page.tsx` / `landing-navigation.tsx` | 介绍首页和视频入口 |
| `src/lib/stock-flow.ts` | 行情 45 秒/AI 60 秒前端期限、错误与轮询 |
| `src/lib/stock-service.ts` | 可信快照、分析身份、额度和缓存 |
| `src/lib/market-provider.ts` | DSA/Polygon 选择；DSA 429 最多两次重试，共享 30 秒期限 |
| `src/lib/financial-provider.ts` / `news-provider.ts` | 可选证据获取与降级 |
| `src/lib/analysis-schema.ts` / `anthropic.ts` | AI schema、prompt 和结果校验 |
| `src/lib/research-brief.ts` | 股票追问上下文、引用优先、隐藏内部 JSON 显示 |
| `src/lib/api-access.ts` | 身份、请求大小、额度、demo 豁免 |
| `src/lib/generation-cache.ts` | 数据库 generation lease 和重试去重 |
| `src/app/api/cfo/chat/route.ts` | 流式聊天、持久化、重放、失败释放 |
| `src/middleware.ts` | 会话刷新、登录跳转及 Cookie 清理保留 |
| `integrations/dsa/bridge.py` | 私有 bearer 校验、缓存、worker 锁和硬超时 |
| `integrations/prediction/` | 模型与回测 |
| `tests/safety.test.mjs` | 使用真实 TS 源码、模拟外部边界的回归测试 |

## 6. 配置与数据库（不记录秘密）

- 本机仓库：`C:/Users/Vivian/Documents/ChatGPT/Zeitgeist`。
- Web 本地配置：`zeitgeist-app/.env.local`；模板 `.env.example`。
- Bridge 本地配置：`zeitgeist-app/integrations/dsa/.env`；模板同目录 `.env.example`。
- 所需键：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`、`ANTHROPIC_CHAT_MODEL`、`POLYGON_API_KEY`、`MARKET_DATA_PROVIDER`、`DSA_BASE_URL`、`DSA_SERVICE_TOKEN`；本地另有 `DSA_REPO_PATH`、可选 `DSA_PYTHON`。
- 当前部署使用 DSA；未配置 provider 时源码默认 Polygon。模型模板默认 `claude-sonnet-5-5`，实际以部署环境变量和服务端可用性为准。
- Supabase 项目 `lgjlwpklmtmtrudmtjpq`。demo 登录标识 `demo@gmail.com`；密码不写入仓库或本文，需从已有授权凭据获取。
- demo 的服务端 `app_metadata.quota_exempt=true`；由 `getUser()` 实时确认，不能相信客户端可修改 metadata。此豁免不解除第三方限额。
- 新数据库依次应用 `supabase/schema.sql`、`supabase/migrations/20261002_api_usage.sql`、`20261003_generation_cache.sql`。当前生产已配置；这些文件含非幂等 DDL，不要重复全量执行。
- 表：`conversations`、`messages`、`api_usage`、`api_leases`、`market_snapshots`、`generation_jobs`。
- 会话和消息有 RLS；内部快照和生成表只允许服务端。聊天重试使用相同 message ID，已完成回答重放，不重新调用模型。
- Watchlist 最多 30 个代码，存在用户 metadata；仅为偏好，不是权限；多设备并发最后写入者覆盖。
- 普通账号每天 analysis/chat/stock 分别 10/50/60 次，每分钟 3/6/20 次，全局每天 200/1000/2000 次；UTC 零点重置，普通账号最多两个在途 reservation。
- 同时核对 Supabase Site URL 和 redirect allowlist，覆盖正式域名、所需 localhost，以及 `/auth/callback?next=/reset-password`。确认邮件/恢复邮件需要配置邮件服务。

## 7. 本地启动、测试与发布

```powershell
cd C:/Users/Vivian/Documents/ChatGPT/Zeitgeist/zeitgeist-app
npm ci
npm run dev:all
# 或生产模式：npm run build，然后 npm run start:all
```

默认 web `http://localhost:3001`，bridge `127.0.0.1:8001`。端口被占用时先识别进程，不要盲目杀进程。
`start-all.mjs` 会启动/关闭自己的两个子进程；未安装为开机服务，终端退出后需重新启动。

本机 DSA checkout：`C:/Users/Vivian/Documents/ChatGPT/daily_stock_analysis`；Python：
`C:/Users/Vivian/Documents/ChatGPT/daily_stock_analysis/.venv-zeitgeist/Scripts/python.exe`。
新机器按 `integrations/dsa/requirements.txt` 建 Python 3.13 虚拟环境，并配置 checkout 路径。

```powershell
npm test
npm run lint
npm run build
npm audit --omit=dev
& 'C:/Users/Vivian/Documents/ChatGPT/daily_stock_analysis/.venv-zeitgeist/Scripts/python.exe' -m unittest discover -s integrations/dsa -p test_bridge.py
& 'C:/Users/Vivian/Documents/ChatGPT/daily_stock_analysis/.venv-zeitgeist/Scripts/python.exe' -m unittest discover -s integrations/prediction -p test_forecast.py
```

`tests/usage.sql`、`tests/generation.sql` 只能在可丢弃的测试数据库执行，不要在生产运行。

Vercel 使用仓库根 `vercel.json` 的 **Services** 配置，不能只导入旧的 Next.js 子目录方案：
web = `zeitgeist-app` Next.js；dsa = 同目录 `Dockerfile.vercel` 容器；仅 web 有公共 rewrite。
service binding 自动注入 `DSA_BASE_URL`，云端不要手填 localhost；两服务使用同一个秘密 token。
容器单 worker、非 root，包含两个 fork 的运行代码；health 仅确认进程就绪。

发布：先检查 staged diff 无密钥，再提交并推送远程 main，等待 Vercel success，核对正式域名后用 demo 做回归。
旧流程 `git push origin HEAD:main` 仅在明确授权且与远程无冲突时使用；不能 force push。

## 8. 验证记录和视频资产

- 最近功能回归：78 项 Node + 9 项 DSA + 6 项预测 = **93 项通过**；lint、生产 build 通过。
- 17 项真实数据库验证：demo/临时第二账号登录、跨账号读/改/删/插入隔离、内部 RPC/表访问拒绝、删除级联；临时数据和账号已清理。
- `6f74102` 部署后 14 项接口回归通过；AAPL/MSFT/NVDA/TSLA 都返回 200 和 20 条日线。
- 浏览器已测登录退出、关注列表持久化/移除、CFO 回答/保存/重命名、股票追问、三张财报、模型实验室、320/390px 窄屏和标签一致性。
- 冻结前重新运行 Node 测试、lint、build；检查首页视频为 H.264 + AAC、1920×1080、60 秒。
- 视频发布资产：`public/video/zeitgeist-product-intro-en.mp4`（约 8.8 MB）和 poster JPG；真实产品画面，英文字幕嵌入视频，英文自然配音版。不是实时行情演示。
- 视频源制作脚本及 v2 原片在本机 `reports/product-video/en/`，未放入 Git。线上文件与原片有少量容器字节差异，不能仅凭文件名认为逐字节相同。
- 本机报告：`reports/release-regression-2026-10-03.html`、`project-audit-2026-10-03.html`、`audit-live-results.json`、`security-live-results.json`、`release-verified-live.png`；冻结记录 `freeze-tests.txt`、`freeze-audit.json`。
- `reports/` 被忽略，可能含账户标识/机器路径。不能依赖它在新 checkout 自动存在；本文保存可移植结论。
- 本地 `review-source/` 和 `review-source.zip` 是历史审查副本，已忽略但未删除，不是待上线项目代码。

## 9. 已知限制、未验证范围与排错

- 生产依赖审计为 0 项已知漏洞；**全量 npm audit 仍有 5 项 high，位于开发工具 Next ESLint / fast-glob / micromatch / braces 链**。冻结检查仍存在，不能写“全项目无漏洞”。后续评估兼容修复，不用 `npm audit fix --force` 盲目降级 Next。
- 未验证真实新用户确认邮件/恢复邮件投递；未做大流量压力测试、灾备恢复演练或长期稳定性认证。
- 外部 Yahoo/Polygon/Anthropic 仍可能超时、限流或缺数据。TSLA 新闻曾为 0；不能伪造新闻、财务值或模型预测来填充 UI。
- Model not yet validated 是模型质量门槛，不能降低阈值以获得更好看的结果。
- 财务日期是季度 period end，不是 filing date；Yahoo 当前调整后数据不是历史时点数据库。
- 价格请求前端 45 秒、AI 60 秒；DSA history 传输含重试共 30 秒。bridge history/financial/forecast worker 硬期限分别 25/10/45 秒。
- DSA 忙：先看 bridge 锁、缓存和容器日志；warm cache 应不受正在运行的 worker 阻塞。两次重试后仍忙应明确失败，不无限重试。
- AI 空白：区分价格已到、AI 正在生成、schema 错误、供应商权限/超时、应用配额。不要把 AI 失败当行情失败。
- 登录/权限失败：核对 Supabase env、getUser、redirect URL、RLS、迁移。不要临时去掉鉴权排错。
- 本地可用云端不可用：核对 Vercel Services 根目录、service binding、共享 token、容器日志和 source commit。
- 不输出 `.env`、service role、provider token 或 demo 密码到日志、文档、截图和提交中。

## 10. 回退与后续工作规则

- 需要回退时，在 Vercel 选择已验证的历史 Production deployment，并重新检查正式域名；也可在新分支从固定标签重建。不要对正在使用的工作区执行破坏性 reset。
- `6f74102` 是视频入口加入前的已验证回退点；此固定标签是完整收尾源码。
- 本次冻结没有数据库 schema 变更。源码回退不等于数据库回退，不删除会话/用户/迁移记录。
- 后续工作必须有明确需求；默认不继续重做 UI、不替换数据商、不更改模型阈值、不扩展付费服务。
- 完成新任务后更新本文的版本、验证、限制和运行步骤，并创建新的 release tag；历史验证数据保留日期，不能冒充新一轮测试。
