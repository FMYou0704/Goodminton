# 羽毛球双打排阵 PWA

一个移动端优先的羽毛球双打活动管理网页应用。项目使用 React、TypeScript、Vite、Tailwind CSS 和 PWA，支持无后端运行。赛事数据优先保存在 IndexedDB，失败时自动降级到 localStorage；排名和统计均从比赛历史实时派生，不作为持久化源数据。

## 环境要求

- Node.js `>=20.19.0`
- npm `>=10`

Vite 7 需要较新的 Node.js。项目已在 `package.json` 中声明 `engines.node`，Vercel 会据此选择兼容的 Node 版本。

## 安装与运行

```bash
npm install
npm run dev
```

手机调试时，让手机和电脑处在同一网络下，访问 Vite 终端显示的局域网地址。

## 测试、打包、预览

```bash
npm test
npm run build
npm run preview
```

`npm run build` 会先执行 TypeScript 编译检查，再输出静态产物到 `dist/`。

## 部署到 Vercel

这是纯前端静态应用，不需要后端、Serverless Function 或数据库。Vercel 可以直接识别 Vite 项目并部署 `dist/` 静态产物。

### 从 GitHub 部署

1. 将项目推送到 GitHub。
2. 在 Vercel 新建 Project，选择该仓库。
3. Framework Preset 选择 `Vite`，通常会自动识别。
4. Build Command 使用 `npm run build`。
5. Output Directory 使用 `dist`。
6. Install Command 保持默认，或使用 `npm install`。
7. 部署完成后，用 Vercel 提供的 HTTPS URL 访问。

本项目不需要 `vercel.json`。原因是它没有自定义路由、后端函数或重写规则；Vite 构建输出的静态文件可以由 Vercel 直接托管。

### 使用 Vercel CLI 部署

```bash
npm install
npm run build
npm install -g vercel
vercel
vercel --prod
```

首次运行 `vercel` 时按提示绑定项目。预览部署使用 `vercel`，生产部署使用 `vercel --prod`。

### 手机上测试

1. 部署完成后，用手机浏览器打开 Vercel HTTPS URL。
2. 创建一组测试选手并生成对阵。
3. 开始比赛、记录比分、刷新页面，确认数据仍在。
4. 在浏览器菜单中选择“添加到主屏幕”或“安装应用”。
5. 从主屏幕打开，确认以独立窗口方式运行。

赛事数据是本地优先存储：默认保存在当前浏览器/设备的 IndexedDB 中，IndexedDB 不可用时降级到 localStorage。不同手机、不同浏览器之间不会自动同步；需要迁移数据时，请使用 JSON 导出/导入。

PWA service worker 只预缓存 app shell 和静态资源，不配置运行时赛事数据缓存。赛事状态只保存在 IndexedDB/localStorage，不会被复制到 service worker response cache。

## 核心功能

- 报名信息：赛事名称、总时长、场地数量、单场时长、选手姓名和性别。
- 官方候选池：生成符合硬约束的官方比赛候选。
- 动态调度：场地空闲时基于当前空闲选手推荐下一场，而不是强制固定执行顺序。
- 机动补位赛：当官方公平锁无法开赛但还有空闲选手时，推荐补位赛提高场地利用率。
- 对局计分：开始比赛、撤销开始、记录合法羽毛球比分。
- 双榜单排名：总等级分榜和官方战绩榜分开展示。
- 数据管理：重置赛事、导出 JSON、导入 JSON。
- 设置：动态公平模式/严格官方模式、榜单显示、解释指标显示、深浅色主题。

## 官方比赛与机动补位赛

系统支持两种比赛类型：

- `official` 官方比赛
- `filler` 机动补位赛

官方比赛计入：

- 官方战绩
- 官方胜场/负场
- 官方净胜分
- 总等级分 Elo

机动补位赛计入：

- 总参与次数
- 总胜负
- 总净胜分
- 总等级分 Elo

机动补位赛不计入：

- 官方战绩
- 官方胜场/负场
- 官方净胜分

这样设计的目的，是同时满足两个现场目标：官方排名可信，场地也尽量不空置。

## 动态调度与官方公平锁

调度核心在 `src/scheduler/dynamicScheduler.ts`。

应用会先预生成官方候选池，但不会强制用户按固定顺序执行。当场地空闲时，系统从当前未占用选手中推荐比赛。

官方公平锁：

```text
开始一场新的官方比赛后：
max(officialMatchCount) - min(officialMatchCount) <= 1
```

含义：

- 官方赛中，任何人不能通过开赛领先最少官方场次选手 2 场或更多。
- 不满足该条件的官方比赛会显示阻止原因。
- 如果没有公平官方赛可开，动态公平模式会推荐机动补位赛。

调度模式：

- 动态公平模式：优先推荐官方赛；没有公平官方赛时推荐补位赛。
- 严格官方模式：总体推荐只推荐官方赛；补位赛仍可单独查看和手动开始。

推荐评分考虑：

- 官方场次更少的选手优先。
- 等待时间更久的选手优先。
- 总参与次数更少的选手优先。
- 新搭档奖励。
- 新对手奖励。
- 重复搭档/重复对手惩罚。
- 任意对手组合最多交手 3 次。
- 尽量保留后续可行组合。

## 榜单系统

成绩页有两个榜单。

### 总等级分榜

主榜单，使用团队双打 Elo 排序。官方比赛和机动补位赛都会影响总等级分。

排序规则：

1. overall Elo rating 降序
2. strengthOfSchedule 降序
3. 总胜率降序
4. 场均净胜分降序
5. 总场数降序
6. 姓名字母序

### 官方战绩榜

副榜单，只统计官方比赛。

排序规则：

1. 官方胜场降序
2. 官方净胜分降序
3. 官方胜率降序
4. 官方已赛场数降序
5. 姓名字母序

## 团队双打 Elo

每名选手初始 Elo 为 `1500`。每场已结束比赛按赛前等级分更新。

队伍等级分：

```text
teamRatingA = average(Elo of teamA players)
teamRatingB = average(Elo of teamB players)
```

预期胜率：

```text
EA = 1 / (1 + 10 ^ ((teamRatingB - teamRatingA) / 400))
EB = 1 - EA
```

实际结果：

- 胜队 `S = 1`
- 负队 `S = 0`

轻量分差倍率：

```text
margin = abs(scoreA - scoreB)
M = min(1.25, 1 + 0.08 * ln(1 + margin))
```

K 值：

- 选手前 5 场总比赛：`K = 32`
- 之后：`K = 20`

更新公式：

```text
delta = K * M * (S - E)
```

同队两名队友获得相同 delta。该模型是团队感知的，不做不可靠的个人球内贡献拆分。

## 解释指标

总等级分榜可以显示额外解释指标。

- `averagePartnerRating`：该选手所有比赛中，赛前搭档 Elo 的平均值。
- `averageOpponentRating`：该选手所有比赛中，赛前对手 Elo 的平均值。
- `strengthOfSchedule`：当前等于 `averageOpponentRating`，用于表示赛程强度。
- `carryIndex`：`leagueAveragePartnerRating - averagePartnerRating`。

Carry 指标只用于解释，不影响 Elo。数值越高，表示该选手通常搭档更弱；数值较低或为负，表示通常搭档更强。

## 样本较少标识

所有比赛都会影响 Elo，因此低样本选手不会被排除，但会标注“样本较少”。

规则：

```text
provisional = totalPlayed < max(4, floor(medianTotalPlayedOfAllPlayers * 0.6))
```

## 比分规则

合法示例：

- `21:18`
- `18:21`
- `22:20`
- `20:22`
- `30:29`
- `29:30`

非法示例：

- `20:18`
- `21:20`
- `31:29`
- `30:28`
- 平分
- 负数
- 非数字

## JSON 导入导出

导出结构包含元数据：

```ts
type TournamentExport = {
  schemaVersion: 2;
  exportedAt: string;
  appName: "badminton-doubles-scheduler";
  data: TournamentState;
};
```

导入时校验：

- `schemaVersion`
- `appName`
- `exportedAt`
- 选手结构
- 比赛引用的选手是否存在
- `matchType` 是否为 `official` 或 `filler`
- 已结束比赛比分是否合法

导入后所有排名都会从比赛历史重新计算。

## 项目目录

```text
.
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  tailwind.config.js
  postcss.config.js
  public/
    manifest.webmanifest
    pwa-192.png
    pwa-512.png
    pwa-icon.svg
  src/
    main.tsx
    App.tsx
    styles.css
    types/
    store/
    storage/
    scheduler/
      dynamicScheduler.ts
      generator.ts
      scoring.ts
      seededRandom.ts
      stats.ts
      validation.ts
    hooks/
    pages/
    components/
    utils/
    test/
```

## 测试覆盖

测试位于 `src/test/`，覆盖：

- 官方公平锁。
- 官方赛被阻止时推荐补位赛。
- 严格官方模式不把补位赛作为总体推荐。
- 多场地同时推荐不重复选手。
- 官方赛影响官方战绩和 Elo。
- 补位赛影响 Elo 但不影响官方战绩。
- 团队双打 Elo 的强弱搭配收益差异。
- 样本较少标识。
- carryIndex 计算。
- 总等级分榜和官方战绩榜排序规则。
- 羽毛球比分校验。
- 预生成官方候选池的硬约束。

## 已知边界情况

- 少于 4 名选手时禁止生成官方候选。
- 人数不是 4 的倍数时允许轮空，并通过评分尽量公平。
- 总时长不足时会提示无法安排官方候选。
- “没有人连续两轮休息”是软约束，无法满足时返回 warning。
- 当硬约束互相限制导致无法填满全部理论容量时，系统返回尽力优化结果，不死循环。

## 后续优化建议

- 增加按性别混双优先、强弱分组、固定搭档等高级策略。
- 增加赛后成绩海报导出。
- 增加多赛事历史列表。
- 增加评分权重面板，方便现场调参。
