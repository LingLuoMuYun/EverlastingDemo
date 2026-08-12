# EverlastingDemo 工具箱 TodoList 优化计划

> **版本**:v0.2(规划稿)｜**日期**:2026-08-13
> **状态**:仅规划,未修改任何代码
> **一句话目标**:在不破坏现有 localStorage 数据的前提下,围绕「数据安全 → 交互体验 → 番茄钟联动 → 工程化」四层对 TodoList 做一轮可分批落地的优化。
> **v0.2 变更**:补充 P1/P2 功能优化项(添加提速、键盘快捷键、到期提醒、番茄一键完成、统计增强、多标签)、实施前准备、验收/风险条目,并新增全量技术要点汇总。

---

## 一、现状盘点(2026-08-13 对照代码)

### 1.1 已实现能力

| 能力 | 实现位置 |
|---|---|
| 增删改查:添加(标题+优先级)、行内编辑(标题/备注/优先级/标签/截止日期)、勾选完成、删除、清空已完成 | `components/toolbox/TodoPanel.tsx` |
| 筛选:全部/进行中/已完成;搜索:标题+备注 | `components/toolbox/useTodos.ts` |
| 排序:创建时间/优先级/截止日期/手动拖拽 | `useTodos.ts` + `TodoPanel.tsx` |
| 进度条、计数、逾期标红、完成时间展示 | `TodoPanel.tsx` |
| localStorage 持久化 + 跨天归档(仅页面加载时) | `components/toolbox/storage.ts`、`useToolboxData.ts` |
| 与统计联动:今日完成任务数、饼图 | `components/toolbox/StatsPanel.tsx` |
| 与番茄钟弱联动:可选择一个"当前任务"显示在计时器上 | `components/toolbox/usePomodoro.ts`(`currentTodoId`) |
| 数据导出 JSON | `app/toolbox/pomodoro/PomodoroClient.tsx` |

### 1.2 当前架构

```
useToolboxData(单一数据源:读 localStorage → data)
   └─ useTodos(data.todos, onChange)   ← 内部再 copy 一份 todos 状态
        └─ TodoPanel(展示 + 交互)
```

数据流总体清晰,但有双份状态、无版本迁移、删除不可逆等问题,详见下文。

---

## 二、问题与优化点清单(按优先级)

> 优先级:**P0 可靠性** → **P1 交互体验** → **P2 联动扩展** → **P3 工程化**。
> 工作量标记:S(≤0.5 天)/ M(1 天左右)/ L(≥2 天)。

### P0 · 数据与可靠性

#### 1. 删除/清空已完成不可逆,无确认无撤销 —— S

- **现状**:单条删除与「清空已完成」均为即时永久删除,无二次确认、无撤销。误触即丢数据。
- **方案**:引入 Toast 内嵌「撤销」按钮(推荐,改动小):
  - 删除时把任务移入内存 `recycleBin`(不写 localStorage),弹出「已删除 · 撤销」,5 秒后或再次操作后真正丢弃;
  - 清空已完成同理,支持一键恢复;
  - 若嫌 Toast 方案复杂,退而求其次:删除/清空前弹确认气泡(`<dialog>` 或自绘确认层),二选一必须落地。
- **涉及**:`useTodos.ts`、`TodoPanel.tsx`(复用 `ToastProvider`)。
- **验证**:删除后点撤销数据完整恢复;刷新页面不出现已撤销数据;5 秒后自动清理。

#### 2. 无数据版本迁移机制,字段演进会破坏旧数据 —— M

- **现状**:`STORAGE_KEY` 固定 `everlasting:toolbox:v1`,`loadToolboxData()` 只做浅合并;后续给 `TodoItem` 加字段(如番茄数、归档标记)时,旧数据缺字段且无补默认值的统一入口(目前靠 `...base` 兜底,但列表内逐项不补)。
- **方案**:在 `storage.ts` 增加 `migrate(raw)` 迁移管线:
  - 按 `data.version` 逐版本升级(`1 → 2 → ...`),每版本只做一件事;
  - 升级后原地写回 localStorage;
  - 迁移失败保持旧数据并静默降级,不阻塞页面。
- **涉及**:`storage.ts`、`types.ts`(版本号提升)。
- **验证**:构造 v1 旧数据 → 加载后自动升级为 v2 且字段完整;坏数据仍回退默认值。

#### 3. 双份任务状态 + 在 setState updater 内写副作用 —— M

- **现状**:
  1. `useToolboxData` 持有一份 `data`,`useTodos` 又把 `todos` copy 进内部 `useState`。当前页面内只由 `useTodos` 改任务,不会漂移;但一旦番茄钟/导入功能直接改 `data.todos`,列表不会刷新。
  2. `commit` 在 `setTodos` 的 updater 里调用 `persistRef.current?.(next)`,React StrictMode 下 updater 可能执行两次(写入值相同,暂时无害,但是反模式)。
- **方案**:`useTodos` 改受控:外部传 `todos` 与 `onChange`,`useTodos` 只做派生计算(筛选/排序/计数),不再持有内部状态;持久化收口到 `useToolboxData.updateData` 一个地方。
- **可选增强**:跨标签页同步——监听 `window.addEventListener("storage")`,其他标签页写入时本地实时刷新,避免双开页面数据不同步。
- **涉及**:`useTodos.ts`、`TodosClient.tsx`、`TodoPanel.tsx`(props 不变则改动很小)。
- **验证**:`npm run dev` 下无 StrictMode 双写告警;在番茄钟页完成任务后 TodoList 数据同步刷新。

### P1 · 交互体验

#### 4. 标签体系太弱:单标签、无管理、无筛选、搜索不含标签 —— M

- **现状**:`TodoItem.tag` 是单个字符串;编辑时手填;列表仅展示徽章;搜索只匹配标题+备注;无法按标签归类查看。
- **方案**(先做轻量版):
  - 新增全局标签库(`tags: string[]` 存于 `ToolboxData`),添加/编辑时从已有标签选择或新建,避免手打错字;
  - 列表上方增加标签筛选条(与状态 Tab 组合使用);
  - 搜索范围扩展到 `tag`;
  - 标签支持重命名/删除(删除时从任务上摘除)。
- **涉及**:`types.ts`(v2 迁移)、`storage.ts`、`useTodos.ts`、`TodoPanel.tsx`。
- **验证**:建 3 个标签 → 按标签筛选正确;重命名标签后所有任务同步更新;删除标签后任务不受污染。

#### 5. 截止日期体验单薄:只有逾期红,无「今天到期」、无快捷设置 —— S

- **现状**:逾期判断 `t.dueDate < today` 只分「逾期/正常」;日期徽章直接显示 `YYYY-MM-DD`;添加时不能顺手选截止日期。
- **方案**:
  - 到期状态三态:逾期(红)/ 今天到期(琥珀色高亮)/ 正常;
  - 徽章格式化为 `M月D日 周X`(tooltip 保留完整日期);
  - 添加栏/编辑表单提供「今天」「明天」快捷按钮;
  - 顶部计数区可加「今日到期 n 项」小提示。
- **涉及**:`TodoPanel.tsx`。
- **验证**:设置今天/明天/昨天三个任务,视觉三态正确;跨天后自动从「今天」变为「逾期」。

#### 6. 手动排序在移动端不可用 —— M

- **现状**:manual 排序用 HTML5 Drag & Drop,触屏设备基本无法触发,也没有替代方案。
- **方案**:manual 排序模式下每行补充「上移/下移」按钮(移动端主要入口,桌面端与拖拽共存);可选「置顶/置底」快捷操作。排序操作沿用 `moveBefore` 语义,改动集中在 `useTodos` + 行操作区。
- **涉及**:`useTodos.ts`(新增 `moveUp/moveDown` 或复用 `moveBefore`)、`TodoPanel.tsx`。
- **验证**:手机视口下可完成整组排序;桌面拖拽与按钮排序结果一致且可持久化。

#### 7. 编辑与键盘/无障碍细节 —— S

- **现状**:编辑表单 Enter 不保存、Esc 不取消;新增输入框挂载后不聚焦;图标按钮只有 `title` 无 `aria-label`;列表用 `div` 而非语义化 `ul/li`;checkbox 是自绘 `button`,屏幕阅读器无法识别选中态。
- **方案**:
  - 编辑表单 Enter 保存、Esc 取消;进入编辑时自动聚焦标题输入框;
  - 添加输入框挂载后自动聚焦;
  - 图标按钮补 `aria-label`,完成按钮补 `aria-pressed`(或改用真实 `checkbox` + 样式化);
  - 列表容器改 `ul/li`。
- **涉及**:`TodoPanel.tsx`。
- **验证**:键盘走查(仅键盘可完成添加/编辑/删除);axe/手动检查无无障碍告警。

#### 8. 批量操作(可选) —— M

- **现状**:逐条勾选/删除,任务多时低效。
- **方案**:筛选结果提供「全选当前视图」→ 批量完成/批量删除(删除必须走 P0-1 的撤销)。若个人使用频率不高,可降级为「全部完成」单按钮。
- **涉及**:`useTodos.ts`、`TodoPanel.tsx`。
- **验证**:全选后批量完成状态正确;批量删除可整体撤销。

#### 9. 空状态与反馈 —— S

- **现状**:空输入按回车无任何反馈;搜索无结果文案已有但无「清除筛选」入口;清空已完成后无确认反馈。
- **方案**:空输入回车时输入框轻微抖动或 Toast 提示「先输入任务内容」;搜索/筛选无结果时展示「清除搜索/筛选」按钮;清空已完成、导入成功等操作统一 Toast。
- **涉及**:`TodoPanel.tsx`。
- **验证**:各空状态与反馈文案在暗/亮主题下均正常显示。

#### 10. 添加流程提速:新增时直接选日期/标签 —— M

- **现状**:添加栏只有标题+优先级;截止日期与标签必须添加后再进入编辑,多一步操作。
- **方案**:添加栏扩展为「标题 + 优先级 + 日期(今天/明天/自定义) + 标签选择」,回车即带全字段创建;标签选择复用 #4 的全局标签库。
- **技术点**:
  - 受控组件收集表单值,`handleAdd` 一次提交;
  - 日期快捷项用 `dateKeyOffset(0/1)` 生成 `YYYY-MM-DD`;
  - 标签下拉用自绘 Popover(支持从标签库选择/新建/清空,比 `<datalist>` 更贴合标签库管理);
  - 移动端输入行允许换行堆叠,按钮触控区 ≥ 40px。
- **涉及**:`TodoPanel.tsx`、`useTodos.ts`(`add` 已支持 `extra` 字段,基本不动)。
- **验证**:创建即带日期/标签;快捷日期与自定义日期互斥;移动端布局不溢出。

#### 11. 键盘快捷键 —— S

- **现状**:全部操作靠鼠标,高频操作(切筛选、新增、保存编辑)路径长。
- **方案**:定义全局快捷键:`N` 聚焦新增输入框、`1/2/3` 切全部/进行中/已完成、`Esc` 退出编辑或关闭弹层、`?` 显示快捷键面板(仅桌面端启用)。
- **技术点**:
  - `useEffect` 挂载 `window.addEventListener("keydown")`,卸载时清理,避免重复绑定;
  - 焦点守卫:输入框/文本域聚焦时不触发全局快捷键(检查 `e.target` 的 tagName 与 `isContentEditable`),避免打字被拦截;
  - 面板用 `aria-keyshortcuts` 标注 + 帮助弹层,文案随暗/亮主题;
  - 只监听一次,配合 ref 读取最新状态。
- **涉及**:`TodoPanel.tsx` 或新增 `useKeyboardShortcuts` hook(`components/toolbox/` 下)。
- **验证**:输入框中打字不受干扰;各快捷键桌面端生效;面板提示与实际行为一致。

### P2 · 联动与扩展

#### 12. 与番茄钟深度联动:完成番茄不落到任务上 —— M

- **现状**:`PomodoroState.currentTodoId` 仅用于在计时器上显示任务名;`onFocusCompleted` 只更新全局 `stats`,不更新任务。`TodoItem` 无番茄计数字段。V1 规划里「给当前任务 +1 番茄」至今未实现。
- **方案**:
  - `TodoItem` 增加 `pomodoroCount?: number`、`lastFocusAt?: number`(v2 迁移补默认 0);
  - 专注完成回调中,若 `currentTodoId` 指向未完成任务,则 `pomodoroCount + 1`,并同步 `lastFocusAt`;
  - `TodoPanel` 行内展示番茄计数图标(如 🍅 xN),排序项可加「按番茄数」;
  - 任务完成时记录 `completedAt`(已有),统计口径不变。
- **涉及**:`types.ts`、`storage.ts`、`app/toolbox/pomodoro/PomodoroClient.tsx`、`TodoPanel.tsx`、`useTodos.ts`。
- **验证**:番茄钟选择任务 A → 完成一轮 → 任务 A 番茄数 +1;无关联任务时全局统计不受影响;旧数据迁移后番茄数为 0。

#### 13. 数据导入:只有导出,没有恢复路径 —— S

- **现状**:仅「导出 JSON」,无导入;浏览器清缓存/换设备后数据即失。
- **方案**:统计面板旁新增「导入」,文件选择 → 校验(版本/结构)→ 提供「合并」与「覆盖」两种模式;非法文件 Toast 报错不落盘。与 P0-2 迁移管线复用同一套校验。
- **涉及**:`PomodoroClient.tsx`(或抽 `exportImport.ts` 工具)、`storage.ts`。
- **验证**:导出 → 清空 → 导入恢复;合并模式不丢现有任务;损坏文件被拦截。

#### 14. 已完成任务归档视图 —— M

- **现状**:已完成任务长期堆积在主列表;「清空已完成」是永久删除。
- **方案**:增加 `archived?: boolean` 字段;勾选完成默认进入「已完成」Tab(不消失),可选「归档」将其移出日常视图;新增「已归档」视图,支持恢复/彻底删除。与 P0-1 撤销机制配合,删除永远可反悔。
- **涉及**:`types.ts`、`useTodos.ts`(filter 增加 archived)、`TodoPanel.tsx`。
- **验证**:归档后不出现在全部/进行中/已完成;恢复后状态正确;彻底删除走撤销。

#### 15. 截止日期到期提醒与「今日到期」指标 —— M

- **现状**:逾期只靠列表内标红,用户不打开列表就看不到;工具箱首页也没有到期信息。
- **方案**:
  - TodoList 页加载后与运行中每分钟检查一次:今天到期/已逾期的未完成任务 → Toast 汇总提示 + 页面标题闪烁(复用 `feedback.flashTitle`);
  - 可选系统通知:首次提醒时引导授权 Notification(复用番茄钟 `maybeNotify` 与引导逻辑);
  - 工具箱首页卡片新增「今日到期 n 项」统计。
- **技术点**:
  - 时间比较统一用 `YYYY-MM-DD` 字符串(与现有 `todayKey()`/`dateKeyOfTs` 一致),避免时区偏差;
  - `setInterval(60_000)` 检查 + 监听 `visibilitychange` 切回时立即补查;
  - Notification API:`Notification.requestPermission()` 必须在用户手势(点击按钮)中调用;未授权一律静默降级为站内 Toast;
  - 首页指标由 `ToolboxHub` 读取 `data.todos` 派生,与现有 `activeCount` 写法一致,不新增存储。
- **涉及**:`TodoPanel.tsx` 或新 `useDueReminder.ts`、`feedback.ts`(扩展授权引导)、`app/toolbox/ToolboxHub.tsx`。
- **验证**:造一个今天到期任务 → 打开页面出现提醒;授权引导只出现一次;切后台再切回立即补查;首页指标正确。

#### 16. 番茄钟「一键完成当前任务」 —— S

- **现状**:专注结束只给任务 +1 番茄计数,想完成任务还要切到 Todo 页手动勾选。
- **方案**:`PomodoroSettings` 增加 `autoCompleteTodo?: boolean`(默认关);开启后,专注自然结束/手动结束时,若 `currentTodoId` 指向未完成任务,自动 `toggle` 完成并 Toast「已完成:任务名 · 撤销」。
- **技术点**:
  - 在 `onFocusCompleted` 回调内通过 `updateData` 同时改 `todos` 与 `pomodoro.state`,保持单一数据源;
  - 自动完成走 P0-1 的撤销机制,避免误伤;
  - 边界处理:`currentTodoId` 找不到任务时静默跳过,不抛错;
  - 自然结束与手动结束共用 `finishCurrent`,在此统一挂接,避免双触发。
- **涉及**:`types.ts`、`usePomodoro.ts`、`app/toolbox/pomodoro/PomodoroClient.tsx`、`PomodoroPanel.tsx`(开关 UI)。
- **验证**:开启后专注结束任务自动完成且可撤销;任务被删时无报错;关闭开关行为不变。

#### 17. 统计增强:优先级/标签分布与番茄数排序 —— M

- **现状**:统计只有「已完成/进行中」饼图;TodoList 排序无番茄维度。
- **方案**:
  - 饼图区改为可切换:完成状态 / 优先级分布 / 标签分布(标签过多时取 Top 5 + 其他);
  - TodoList 排序新增「按番茄数」;
  - 周报视图(近 7 日完成率)放在后续迭代。
- **技术点**:
  - 复用 `EChart.tsx` 与 `chartOptions.ts`,新增 `buildPriorityPieOption` / `buildTagPieOption` option 构建函数;
  - 数据聚合用 `useMemo` 单次计算,避免每次渲染重算;
  - 分布数据全部从 `data.todos` 派生,不新增存储字段;
  - 图表切换用受控 tab 状态,`EChart.setOption(option, true)` 全量替换。
- **涉及**:`chartOptions.ts`、`StatsPanel.tsx`、`useTodos.ts`(排序项)、`TodoPanel.tsx`(排序下拉)。
- **验证**:三种分布与现有饼图数据一致;标签 Top5+其他聚合正确;按番茄数排序稳定(同数回落创建时间)。

#### 18. 多标签升级(单标签 → `tags: string[]`) —— L(独立一期)

- **现状**:#4 方案是「单标签 + 全局标签库」,一个任务只能挂一个标签;若实际使用中一个任务跨多个分类,需要多标签。
- **方案**(确认需求后再排期):`TodoItem.tags?: string[]` 取代 `tag`;编辑表单支持多选;筛选支持多标签 AND/OR。
- **技术点**:
  - 数据迁移:读取 v1/v2 的单 `tag` 字段 → 写入 `tags: [tag]`,新老字段短期双写兼容;
  - 多选 UI:标签 chip 多选 + 已选高亮,点击空白清除;
  - 筛选语义:多标签选择后支持「包含任一」(OR)与「同时包含」(AND)切换;
  - 任务量小,筛选直接用 `filter` 实现,不引入搜索引擎。
- **涉及**:`types.ts`(v3 迁移)、`storage.ts`、`useTodos.ts`、`TodoPanel.tsx`。
- **验证**:旧单标签任务迁移后出现在对应多标签筛选;多选组合筛选正确;标签库管理不破坏多选状态。

### P3 · 工程化与可维护性

#### 19. TodoPanel 单文件过大,拆分为可维护组件 —— M

- **现状**:`TodoPanel.tsx` 约 470 行,包含输入栏、筛选条、进度条、行渲染、行内编辑、拖拽逻辑,修改一处需通读全文件。
- **方案**:拆为 `AddTodoBar` / `FilterBar` / `TodoItemRow` / `TodoEditForm` / `ProgressBar` / `EmptyState`,均放在 `components/toolbox/` 下;拖拽逻辑收敛到列表容器。UI 类名与样式不变,纯重构,不改变行为。
- **涉及**:`TodoPanel.tsx` 拆分为新文件(原文件保留为组装层)。
- **验证**:拆分前后视觉/交互逐项一致;`npm run lint` 通过。

#### 20. 补充单元测试(useTodos / storage) —— M

- **现状**:项目无任何测试脚本与框架;筛选/排序/拖拽/迁移逻辑全凭手测。
- **方案**:引入 `vitest`(仅 devDependency),优先覆盖:
  - `useTodos`:`filter`/`keyword`/`sort`/`moveBefore` 纯逻辑(建议先把这些逻辑抽成纯函数 `filterTodos/sortTodos`);
  - `storage`:`migrate` v1→v2、坏 JSON 回退、缺字段补默认。
- **涉及**:`package.json`(新增 devDependency + `test` script)、新增 `*.test.ts`。
- **验证**:`npm test` 全绿;`npm run lint`、`npx tsc --noEmit`、`npm run build` 均通过。

#### 21. 性能与细节(轻量) —— S

- **现状**:搜索即时过滤;任务量小,当前无明显卡顿,但无防护。
- **方案**:搜索值用 `useDeferredValue` 延迟过滤;`visible`/`counts` 已 `useMemo`,保持;若未来任务上千再评估虚拟滚动(本期不做)。
- **涉及**:`useTodos.ts` 或 `TodoPanel.tsx`。
- **验证**:输入搜索时输入框无卡顿;结果列表正确。

---

## 三、数据模型演进(v1 → v2)

```ts
// v2 扩展后的 TodoItem(仅列出新增/变化字段)
export interface TodoItem {
  // ...v1 既有字段保持不变
  pomodoroCount?: number;   // 累计关联番茄数,迁移默认 0
  lastFocusAt?: number;     // 最近一次被番茄钟关联的时间戳
  archived?: boolean;       // 归档标记,默认 false
  deletedAt?: number;       // 软删除时间戳(配合撤销),默认无
}

// ToolboxData 新增
export interface ToolboxData {
  version: 2;
  tags: string[];           // 全局标签库
  todos: TodoItem[];
  // ...其余不变
}
```

迁移管线示意(`storage.ts` 内新增):

```ts
export function migrate(raw: unknown): ToolboxData {
  let data = raw as ToolboxData;
  // 1 → 2:任务补默认字段 + 标签库初始化 + 版本号提升
  if (!data.version || data.version < 2) {
    data = {
      ...data,
      version: 2,
      tags: collectTags(data.todos),
      todos: (data.todos ?? []).map((t) => ({
        pomodoroCount: 0,
        archived: false,
        ...t,
      })),
    };
  }
  return data;
}
```

> 注意:升级后原地写回 localStorage;`loadToolboxData()` 的入口顺序改为 `parse → migrate → 校验 → 返回`,任何一步失败都回退默认值且不抛错。

---

## 四、实施前准备与分阶段实施路线

### 4.1 实施前准备(每轮改动都先做)

| 准备项 | 说明 |
|---|---|
| 数据备份 | 用现有「导出数据」导出一份 JSON 存档;迁移/撤销/清空测试时作为恢复依据 |
| 基线验证 | 改动前跑 `npm run lint`、`npx tsc --noEmit`、`npm run build`,确认项目干净,并记录当前页面手测基线 |
| 范围分批 | 每轮只做一组(如 P0 全部,或 P1 的标签+日期),不跨组混改 |
| 独立 commit | 每项功能一个 commit;纯重构(如 #19)单独标注提交,便于二分定位回归 |
| 测试先行 | 迁移函数、筛选/排序纯逻辑先写单测(见 #20),再改 UI |
| 双页面回归 | 番茄钟页与 Todo 页共用同一份 localStorage,联动改动必须两个页面都手测 |
| 分支策略 | 新建 `codex/todolist-optimize` 分支,不在 main 上直接改 |

### 4.2 分阶段实施路线

| 阶段 | 内容 | 验证 | 建议顺序 |
|---|---|---|---|
| A. 数据与可靠性 | P0 #1 撤销、#2 迁移框架、#3 状态收口 | `npx tsc --noEmit` + 手测删除/刷新/迁移 | 先行,后续改动都依赖它 |
| B. 交互体验 | P1 #4 标签、#5 日期、#6 移动端排序、#7 编辑/无障碍、#8 批量(可选)、#9 空状态、#10 添加提速、#11 快捷键 | `npm run lint` + 手机/桌面手测 | 每项独立提交,可挑高价值先做 |
| C. 联动与扩展 | P2 #12 番茄联动、#13 导入、#14 归档视图、#15 到期提醒、#16 一键完成、#17 统计增强 | `npm run lint` + `npm run build` + 番茄钟手测 | 依赖阶段 A 的数据字段;#18 多标签独立一期 |
| D. 工程化 | P3 #19 拆分、#20 测试、#21 性能 | `npm test` + `npm run lint` + `npm run build` | 可穿插在 A/B 之间做 |

建议每个阶段独立 commit,便于回滚与 review;全部完成后跑一遍完整验收清单。

---

## 五、验收清单

- [ ] 删除与清空已完成均可撤销;撤销后数据完整,刷新不残留
- [ ] 旧 localStorage 数据(v1)加载后自动升级且字段完整;坏数据不阻塞页面
- [ ] `useTodos` 无内部双份状态;番茄钟页完成任务后 TodoList 同步刷新
- [ ] 标签可新建/选择/重命名/删除;按标签筛选与搜索(含标签)正确
- [ ] 截止日期三态(逾期/今天/正常)视觉正确;可快捷设置今天/明天
- [ ] 手动排序在移动端可操作(上移/下移),与桌面拖拽结果一致
- [ ] 编辑 Enter 保存、Esc 取消;新增自动聚焦;无障碍语义达标
- [ ] 番茄钟完成一轮后,关联任务番茄数 +1;无关联任务时全局统计不变
- [ ] 支持导入(合并/覆盖),非法文件被拦截;导出导入往返数据一致
- [ ] 归档视图可归档/恢复/彻底删除
- [ ] 添加时可一次设置日期/标签;回车即带全字段创建
- [ ] 键盘快捷键(聚焦新增/切筛选/Esc)桌面端生效,输入框中打字不受干扰
- [ ] 今天到期/逾期任务有站内提醒,可选系统通知;首页显示「今日到期 n 项」
- [ ] 番茄钟「一键完成」开关生效且可撤销;任务被删时无报错
- [ ] 统计支持状态/优先级/标签三种分布切换;按番茄数排序正确
- [ ] `npm test`、`npm run lint`、`npx tsc --noEmit`、`npm run build` 全部通过

---

## 六、风险与权衡

| 风险/权衡 | 说明与对策 |
|---|---|
| 撤销机制与「刷新即丢」的预期 | 撤销只保证本次会话内可反悔;若需要跨刷新回收站,需把 `recycleBin` 持久化(成本上升),本期默认不做 |
| 标签单选 vs 多选 | 本期先做「单标签 + 全局标签库」,多标签需要 `tags: string[]` 与既有单 tag 数据的双写兼容,列为后续 |
| 番茄联动对统计口径的影响 | `pomodoroCount` 是任务级计数,与全局 `stats.completedFocus` 独立;两者分别展示,避免口径混淆 |
| 迁移框架复杂度 | 只做「逐版本升级 + 原地写回」,不引入 schema 校验库;每版本一个函数,保持可控 |
| 组件拆分引入回归 | 纯重构不改样式与逻辑;拆分阶段用「手测对照 + 截图」双重验证 |
| 测试框架引入 | 只加 `vitest` devDependency,不触碰生产依赖与构建产物 |
| 通知打扰 | 通知仅在用户授权后发送;未授权降级为站内 Toast;提醒检查每分钟一次,频率可控 |
| 快捷键冲突 | 全局快捷键全部加焦点守卫;不占用浏览器/系统保留键位(`Ctrl` 组合一律不碰) |
| 多标签迁移 | 单标签→多标签是破坏性数据变更,采用新字段双写兼容 + v3 迁移,独立一期灰度 |
| 提醒与番茄通知叠加 | 到期提醒与番茄结束通知共用 Notification 通道,文案区分,避免混淆 |

---

## 七、后续迭代方向(不在本期)

1. **多标签**(#18):`tags: string[]` + v3 迁移,独立一期灰度。
2. **子任务 / 重复任务**:
   - 子任务:`TodoItem` 增加 `children?: TodoItem[]`(或平铺 `parentId` 扁平结构,便于筛选/排序),行内展开折叠;
   - 重复任务:`recurrence?: { freq: "daily" | "weekdays" | "weekly"; ... }` 规则 + 完成后按规则生成下一实例(复制模板、重置完成态、推后 dueDate),依赖迁移框架与纯函数测试。
3. **跨设备同步**(GitHub Gist / WebDAV):复用导入导出管线,做成「云同步」入口。
4. **PWA / 离线**:需评估全站改造成本,超出 TodoList 范围。
5. **周报视图**:任务完成率、番茄分布按周聚合,复用 `EChart` 与 `stats` 数据。

---

## 八、技术要点汇总

| 功能/能力 | 使用的技术点 | 主要落点 |
|---|---|---|
| 本地持久化 | `localStorage` 单 key + 版本迁移管线(`migrate` 逐版本升级、坏数据回退默认值、升级后原地写回) | `storage.ts` |
| 撤销删除 | 内存 `recycleBin` + Toast 内嵌撤销按钮,5 秒后真正清理 | `useTodos.ts`、`ToastProvider` |
| 统一状态 | 受控 props 单向数据流,持久化收口到 `updateData`;避免 setState updater 内写副作用;可选 `storage` 事件做跨标签页同步 | `useToolboxData.ts`、`useTodos.ts` |
| 标签库 | 全局 `tags: string[]` + 自绘 Popover 选择器;搜索范围含 `tag`;多标签为 v3 演进 | `types.ts`、`TodoPanel.tsx` |
| 截止日期 | `YYYY-MM-DD` 字符串比较(与 `todayKey`/`dateKeyOfTs` 一致,避免时区偏差);快捷项用 `dateKeyOffset` | `storage.ts`、`TodoPanel.tsx` |
| 到期提醒 | `setInterval` 分钟级检查 + `visibilitychange` 补查;`Notification.requestPermission()` 在用户手势中调用,失败降级 Toast;`flashTitle` 标题闪烁 | 新 `useDueReminder.ts`、`feedback.ts` |
| 番茄联动 | `currentTodoId` + 完成回调 `onFocusCompleted` 内统一更新任务与统计;任务已删时静默跳过;`finishCurrent` 统一挂接防双触发 | `usePomodoro.ts`、`PomodoroClient.tsx` |
| 键盘快捷键 | `keydown` 全局监听 + 输入框焦点守卫 + `aria-keyshortcuts`;`useEffect` 卸载清理 | 新 `useKeyboardShortcuts.ts` |
| 搜索性能 | `useDeferredValue` 延迟过滤;`visible`/`counts` 用 `useMemo` 缓存 | `useTodos.ts`、`TodoPanel.tsx` |
| 统计图表 | `echarts/core` 按需注册 + 自封装 `EChart` + `chartOptions` option 构建;`useMemo` 聚合分布数据 | `EChart.tsx`、`chartOptions.ts`、`StatsPanel.tsx` |
| 移动端排序 | 桌面 HTML5 DnD + 触屏「上移/下移」按钮兜底;排序统一走 `moveBefore` | `TodoPanel.tsx`、`useTodos.ts` |
| 无障碍 | 语义化 `ul/li`、`aria-label`/`aria-pressed`、Enter 保存/Esc 取消、焦点管理 | `TodoPanel.tsx` |
| 测试 | `vitest`(仅 devDependency)覆盖筛选/排序/迁移纯逻辑;先把逻辑抽成 `filterTodos`/`sortTodos` 纯函数 | 新增 `*.test.ts`、`package.json` |
| 数据导入 | `FileReader` 读文件 + 复用 `migrate` 校验 + 合并/覆盖两种策略 | 新 `exportImport.ts`、`PomodoroClient.tsx` |
| 音效/通知 | `AudioContext` 合成蜂鸣(已有)、Notification API、页面标题闪烁,全部失败静默 | `feedback.ts` |
