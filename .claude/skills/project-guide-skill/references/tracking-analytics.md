# 埋点与追踪分析

用于识别、记录和评估项目中的数据埋点（Tracking/Analytics），帮助新人理解项目的用户行为采集体系。

## 什么是埋点

埋点是代码中用于采集用户行为数据的探针，通常以事件上报的形式将数据发送到分析平台。分为：

- **前端埋点**：页面浏览、按钮点击、表单提交、曝光、滚动、停留时长等
- **后端埋点**：API 调用、业务事件、错误日志、性能指标等
- **全链路埋点**：从前端到后端的 trace 链路追踪

## 常见埋点 SDK 识别

### 前端埋点库特征

| SDK/平台 | 识别特征（搜索关键词） |
| --- | --- |
| Google Analytics (GA4) | `gtag`, `ga()`, `dataLayer`, `google-analytics` |
| Mixpanel | `mixpanel`, `mixpanel.track()` |
| 百度统计 | `_hmt`, `_bdhm`, `hm.baidu.com` |
| 神策 (Sensors) | `sensors`, `sa.track()`, `sensorsdata` |
| 友盟 (Umeng) | `umeng`, `UMAnalytics` |
| GrowingIO | `gio`, `growingio`, `gio.track()` |
| 火山引擎 / 字节 | `bytedance`, `ttq`, `toutiao` |
| Sentry（错误追踪） | `Sentry`, `@sentry/`, `Raven` |
| 自定义埋点 SDK | `track`, `report`, `logEvent`, `analytics` |
| Aegis（腾讯） | `aegis`, `Aegis` |
| 阿里 ARMS | `arms`, `__bl` |

### 搜索命令

```bash
# 搜索埋点 SDK 引用
rg -i "gtag|mixpanel|sensors|sentry|aegis|analytics|_hmt|growingio"

# 搜索自定义埋点函数调用
rg -i "track\(|trackEvent|logEvent|reportEvent|sendEvent|pageView\("

# 搜索埋点入口初始化
rg -i "init.*track|init.*analytics|init.*monitor"
```

## 埋点调用模式

### 前端常见模式

```javascript
// 1. 直接函数调用
track('button_click', { page: 'home', button: 'search' });

// 2. 指令/装饰器
<button v-track="'submit_form'">提交</button>
@trackEvent('page_view')

// 3. Hook 封装
useTracker('page_name');
const { track } = useAnalytics();

// 4. 路由钩子自动上报
router.afterEach((to) => { trackPageView(to.path); });

// 5. 全局点击/曝光监听
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-track]');
  if (target) reportClick(target.dataset.track);
});
```

### 后端常见模式

```java
// 1. AOP 切面
@TrackEvent(name = "order_create", params = {"orderId", "amount"})

// 2. 中间件/Middleware
app.use(trackingMiddleware);

// 3. 日志结构化字段
logger.info("payment_success", { orderId, amount, method });
```

## 埋点清单模板

### 埋点事件登记

```markdown
## 埋点事件清单

### 页面浏览事件

| 事件名 | 触发时机 | 所在文件 | 参数 | 状态 |
| --- | --- | --- | --- | --- |
| `page_view` | 每次路由切换 | `src/router/index.ts:45` | page_name, referrer | ✅ 已验证 |
| `home_page_view` | 首页加载 | `src/hooks/useTracker.ts:12` | user_id, timestamp | ✅ 已验证 |

### 用户行为事件

| 事件名 | 触发时机 | 所在文件 | 参数 | 状态 |
| --- | --- | --- | --- | --- |
| `search_query` | 搜索提交 | `src/pages/Search.tsx:89` | keyword, category, result_count | ⚠ 缺少空搜索上报 |
| `add_to_cart` | 加入购物车 | `src/components/AddToCart.tsx:34` | product_id, quantity, price | ✅ 已验证 |
| `checkout_begin` | 开始结算 | `src/pages/Cart.tsx:156` | cart_items, total_amount | ✅ 已验证 |
| `payment_complete` | 支付成功 | `src/pages/Payment.tsx:203` | order_id, amount, method | ⚠ 失败未上报 |

### 错误事件

| 事件名 | 触发时机 | 所在文件 | 参数 | 状态 |
| --- | --- | --- | --- | --- |
| `api_error` | API 请求失败 | `src/utils/request.ts:67` | url, status, message | ✅ 已验证 |
| `render_error` | React Error Boundary | `src/components/ErrorBoundary.tsx:23` | component, error, stack | ✅ 已验证 |

### 埋点覆盖缺口

| 流程/功能 | 应有埋点 | 现状 | 建议 |
| --- | --- | --- | --- |
| 注册流程 | 每步转化率 | 仅有最终成功上报 | 增加中间步骤埋点 |
| 商品详情 | 停留时长、图片浏览 | 仅有页面浏览 | 增加时长和交互埋点 |
| 搜索无结果 | 空结果事件 | 缺失 | 增加空搜索上报 |
```

## 埋点覆盖检查清单

### 用户生命周期
- [ ] 首次访问 / 新用户识别
- [ ] 注册流程各步骤（开始、验证、完成）
- [ ] 登录（成功、失败、第三方登录）
- [ ] 账号设置变更
- [ ] 退出登录

### 核心业务流程
- [ ] 搜索（输入、结果、无结果、筛选、排序）
- [ ] 内容浏览（列表、详情、评论、分享）
- [ ] 交易流程（加购、结算、支付、退款）
- [ ] 表单提交（各步骤、校验失败、提交成功）
- [ ] 文件操作（上传、下载、预览）

### 技术质量
- [ ] API 调用（成功率、耗时、错误码分布）
- [ ] 页面性能（FCP、LCP、CLS、TTI）
- [ ] 异常捕获（JS 错误、Promise 拒绝、组件崩溃）
- [ ] 资源加载（图片、字体、CDN 失败）

### 业务自定义
- [ ] 运营活动曝光与点击
- [ ] 推荐/广告曝光与点击
- [ ] 推送通知（到达、点击、关闭）
- [ ] 客服/反馈入口使用

## 前后端埋点搜索策略

### 前端项目额外搜索

```bash
# React/Vue 埋点 Hook/指令
rg -i "useTrack|useAnalytics|v-track|data-track"

# 路由埋点
rg -i "afterEach|beforeEach|pageview|routeChange"

# A/B 测试标记
rg -i "experiment|ab_test|feature_flag|variant"
```

### 后端项目额外搜索

```bash
# 日志中的结构化埋点
rg -i "logger\.(info|warn|error).*event|logger\.(info|warn|error).*track"

# 数据库埋点表
rg -i "analytics|event_log|tracking|user_behavior"

# 消息队列中的事件
rg -i "topic.*event|queue.*event|kafka.*track"
```

## 风险评估

- [ ] 埋点数据是否包含敏感信息（手机号、密码、身份证）？
- [ ] 埋点 SDK 是否在无网环境阻塞页面加载？
- [ ] 埋点上报失败是否有重试和降级策略？
- [ ] 是否区分了测试/生产环境的埋点目标？
- [ ] 埋点采样率是否合理（100% 上报可能导致成本过高）？
- [ ] 用户是否可以选择退出埋点（GDPR/个保法合规）？
