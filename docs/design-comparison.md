# 与 Impeccable 的设计对照

参考对象是用户本地提供的 Impeccable 4.1.3 技能入口、context 脚本、hooks 和 doctor 参考。仅学习工作流机制；没有复制其脚本、检测器、视觉规则或资源。主流程为 skill-creator，Impeccable 提供结构参照，Codex 原生配置依据 OpenAI 文档。

| Impeccable 机制 | 本技能实现 | 嵌入式适配理由 |
| --- | --- | --- |
| 描述覆盖相关工作意图 | description 同时覆盖开发、审阅、排障、迁移与主流 MCU 名称；显式 implicit policy | 固件实现本身就需可靠性约束，不只“审计”才用 |
| context 发现项目事实 | 只读 context：构建/源码型号候选、profile、组件目标、覆盖缺口 | part/revision/SDK/ABI 不可由家族名猜测 |
| 按命令/意图路由 | design/build/audit/harden/port/verify 等自然语言参数 | 保持只读审阅与实施权限边界；明确任务不先问菜单 |
| craft-floor 编辑前读取 | reliability-floor：硬件证据、异步寿命、同步/cache/顺序、失败路径 | 这些问题无法靠文本检测完全发现 |
| 按需加载 native/领域参考 | 9 个系列路由指向 8 份 MCU 专项参考，再叠加领域规则 | 防止每次全量灌入 MCU 手册，也防止平台规则混用 |
| 检测与人工判断分开 | DET-* 词法线索 + agent 手册/源码分析 + 工程构建/运行验证 | 告警不等于 bug，无告警不等于安全 |
| hooks 自动反馈 | 原生 UserPromptSubmit + PostToolUse，保留已有清单 | 不依赖前端 npx 命令或其他宿主事件格式 |
| doctor 报告漂移 | 只报告缺少型号证据、候选冲突、配置/信任未知 | 普通开发不顺手修配置/覆盖规范 |

没有采用的机制：视觉体验模式、图片/浏览器流程、全局独立斜杠快捷键、审美检测忽略值、自动网络更新、Stop 反复阻止结束、未经核验的跨平台 hook 兼容声明。

2.1 的取舍：上下文发现只在当前任务需要时运行，编辑前底线按批复用；不把“可靠性”解释为每层重复防御或默认添加复杂恢复系统。外部边界正确性保留，内部契约复用，额外有成本的保护先由用户选择。注释以调用契约和设计原因为主，不设任意注释覆盖率指标。

原生技能可被隐式选择；hook 必须单独由宿主审阅/信任。配置文件存在与测试模拟事件成功都不能证明真实 Codex 会话已经运行了 hook。有关发现和信任以 [官方 Skills](https://learn.chatgpt.com/docs/build-skills) 与 [Hooks](https://learn.chatgpt.com/docs/hooks) 为准。
