# 自动触发、编辑反馈与实际约束

核验日期 2026-11-06。采用原生 Codex 技能发现与 hook schema；机制设计参考 Impeccable，代码独立编写，不依赖 `npx impeccable` 或修改其文件。

## 三层约束

1. **技能自动匹配**：`description` 描述固件/驱动任务，`agents/openai.yaml` 明确 `allow_implicit_invocation: true`。Codex 可以按请求选择技能；这不是确定触发的全局拦截器，技能过多时描述可能被缩短/省略。
2. **行为底线**：选中技能后运行只读 context、按 profile/MCU 系列路由、编辑前读 reliability-floor；这是 agent 指令约束，不是编译器验证。
3. **机械反馈**：可选 UserPromptSubmit hook 为匹配的嵌入式请求提醒加载技能；PostToolUse 对直接 C/C++ 文件编辑提供少量风险线索。检测器不执行工程命令、不访问网络、不刷设备、不自动改源码。

来源：[OpenAI Skills](https://learn.chatgpt.com/docs/build-skills)、[OpenAI Hooks](https://learn.chatgpt.com/docs/hooks)。信任配置与产品支持以实际宿主为准。

## 本地命令

保持 cwd 为被处理工程，`<skill-base-dir>` 使用当前载入技能的实际目录：

```sh
node "<skill-base-dir>/scripts/context.mjs" --target src/sensor.c
node "<skill-base-dir>/scripts/doctor.mjs"
node "<skill-base-dir>/scripts/detect.mjs" src/sensor.c src/protocol.c
node "<skill-base-dir>/scripts/detect.mjs" --strict src/protocol.c
node "<skill-base-dir>/scripts/hook-admin.mjs" status
node "<skill-base-dir>/scripts/hook-admin.mjs" on
node "<skill-base-dir>/scripts/hook-admin.mjs" off
```

`--root <directory>` 可显式指定工程，所有目标必须在该真实根目录内。`context --target` 选择临近构建组件，避免混合仓库的不同 MCU 自动合并；目录目标只扫描其子树。候选不是已确认的 part。

无 Node 时人工完成发现与检查，不能为一次代码修复安装 Node。脚本只用 Node 标准库，建议 Node 22+。

## Hook 安装与状态

仅在用户要求启用时执行 `on`；当前工程注册到 `.codex/hooks.json`，加 `--user` 才注册到个人 CODEX_HOME。脚本保留其他 provider/hook、备份已有清单，仅管理自己标记的两个 handler；`off` 只移除自己的 handler，不删除其他配置或历史备份。不是 Impeccable 自己的 hook，也不与它共用忽略规则。

注册后在 Codex 桌面设置的 **Hooks / Review hooks** 或 CLI `/hooks` 审阅并信任。脚本不编辑信任记录、不使用绕过开关；`status` 只证明配置存在，不能证明宿主已加载、已信任或曾运行。脚本/安装路径变化可能需要重新注册/审阅。

UserPromptSubmit 在脚本内按任务内容筛选，非嵌入式请求静默；该事件的 matcher 不负责筛选提示词。PostToolUse matcher 为 apply_patch/Edit/Write，读取工具提供的直接文件路径或 patch 路径；Bash、MCP、脚本间接改写和无法提取路径的写入不在自动扫描覆盖内。没有 Stop 强制循环或假装全面拦截。编辑后 hook 无法撤销已发生的写入。

未观察到 hook 生效或改变经 Bash/MCP 发生时，任务结束前对实际改动 C/C++ 文件手动 `detect` 一次，再完成项目原有构建/分析/测试。不能把 `NO_PATTERN_MATCHES` 写成“内存安全”或“硬件通过”。

## 检测规则和结果

| ID | 分类 | 信号与处置 |
| --- | --- | --- |
| DET-GETS | error | 不受限 gets；移除，不能 suppress 真实危险 |
| DET-UNBOUNDED-COPY | review | strcpy/strcat/sprintf/vsprintf 无目的容量；已有完整边界证明时可说明无需改动 |
| DET-ALLOCATION-SIZE | review | 分配表达式含乘 sizeof；核对是否已有溢出上界检查 |
| DET-TYPED-BYTE-LOAD | review | typed pointer 强转解引用；查长度、对齐、别名与字节序 |
| DET-PACKED | review | packed/pragma pack；核对 ABI 依据与未对齐成员地址 |

输出定位不回显源码内容。注释/字面量遮罩只减少误报，不是完整 C/C++ parser；宏、条件编译、raw string 与控制流可能产生误报/漏报。普通手动 detect 提供线索，`--strict` 对 error 返回 1；覆盖缺口/无效参数返回 2；其他正常扫描返回 0（不等于规范通过）。

扫描有目录深度、条目、文件大小和 finding 上限，跳过常见构建/第三方目录及递归符号链接；覆盖受限时输出 gaps。显式目标文件可以检查被默认忽略目录里的文件，但禁止逃出 root。context/doctor 不自动修复旧配置，检测不写忽略清单；不确定 finding 保留待核实，不能为绿灯加全局 suppress。

## 维护和分发

同步本地个人技能后保留安装路径，不能强行复制 Impeccable 的 `allowed-tools: Bash(npx impeccable *)`、未被 Codex 元数据验证支持的字段，或照搬视觉检测器的规则。默认无遥测、网络更新检查、自动依赖安装与更新远端仓库；GitHub 发布由当前用户任务明确授权。
