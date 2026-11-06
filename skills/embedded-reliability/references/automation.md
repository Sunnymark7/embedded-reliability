# 自动触发、编辑反馈与实际约束

核验日期 2026-11-06。采用原生 Codex 技能发现与 hook schema；机制设计参考 Impeccable，代码独立编写，不依赖 `npx impeccable` 或修改其文件。

## 三层约束

1. **技能自动匹配**：`description` 描述固件/驱动任务，`agents/openai.yaml` 明确 `allow_implicit_invocation: true`。Codex 可以按请求选择技能；这不是确定触发的全局拦截器，技能过多时描述可能被缩短/省略。
2. **行为底线**：需要工程发现时运行只读 context，按 profile/任务加载参考，一批行为编辑前读一次底线；简单等价整理复用现有上下文。按适度设计保留必要正确性，额外保护先说明取舍。
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

未传 `--root` 时从 cwd 向上发现 Git 根；没有 Git 时使用最近工程边界。显式 `--root <directory>` 是硬边界，目标不可逃出。`--target` 相对于调用 cwd；文件目标只扫描相邻源码和适用的祖先配置，不递归扫描其他产品。输出 `scope` 为适用组件，`scanScope` 为实际源码扫描目录；目录目标明确扫描其子树。

型号证据保留完整 token、来源和等级：profile 声明 100、目标编译定义 95、`.ioc`/`sdkconfig` 90、其他构建配置 70、源码线索 30。等级帮助定位依据，不证明硬件；高等级目标互不兼容时输出 `identityConflicts`，不能简单取最高分消除冲突。同系列不同 part 分别保留；注释不参与识别。尚不解释 CMake 条件或完整 C 预处理，`#if` 中非激活代码仍可能是弱线索。

`compile_commands.json` 只读取对应文件/子树的 `-D` 或 `/D` 定义，不执行命令。编译器 wrapper、复杂引号/响应文件、缺失/过大数据库不保证识别，真实目标构建仍需核对。源码 clue 不能压过项目已明确的 linux-user/portable-core 组件范围。

## 可选项目声明

机器配置统一为项目或组件目录的 [embedded-profile.json](../assets/embedded-profile.json)，可不用；人类说明保留 EMBEDDED.md。旧 `project-profile.yaml` 不再作为机器模板，既有 YAML 资料不自动删除/迁移，可按需人工提取为此小配置。

```json
{
  "schemaVersion": 1,
  "components": [
    { "path": "firmware", "profile": "mcu-rtos", "part": "STM32H743VIT6", "sdk": null },
    { "path": "tools", "profile": "linux-user" }
  ]
}
```

组件 `path` 相对于声明文件，使用 `/`，必须留在已选工程根内；最具体路径优先，profile 为四类之一。可选字符串字段仅 `part/siliconRevision/sdk/toolchain/abi`，null 表示未知；未知键、重复路径、非法值及越根会成为 `issues`，不静默忽略。声明与构建线索不一致时报告冲突，不自动改任何一方。配置只携带事实，不包含可执行命令、保护级别或自动恢复开关。

无 Node 时人工完成发现与检查，不能为一次代码修复安装 Node。脚本只用 Node 标准库，建议 Node 22+。

## Hook 安装与状态

仅在用户要求启用时执行 `on`；当前工程注册到 `.codex/hooks.json`，加 `--user` 才注册到个人 CODEX_HOME。脚本保留其他 provider/hook、备份已有清单，仅管理自己标记的两个 handler；`off` 只移除自己的 handler，不删除其他配置或历史备份。不是 Impeccable 自己的 hook，也不与它共用忽略规则。

注册后在 Codex 桌面设置的 **Hooks / Review hooks** 或 CLI `/hooks` 审阅并信任。脚本不编辑信任记录、不使用绕过开关；`status` 只证明配置存在，不能证明宿主已加载、已信任或曾运行。脚本/安装路径变化可能需要重新注册/审阅。

UserPromptSubmit 与 context 共用型号词典，另以开发意图筛选，非嵌入式请求静默；该事件的 matcher 不负责筛选提示词。PostToolUse matcher 为 apply_patch/Edit/Write，按编辑文件所属范围检查，同一事件同一扫描范围复用发现结果。Bash、MCP、脚本间接改写和无法提取路径的写入不在自动扫描覆盖内。没有 Stop 强制循环，编辑后 hook 无法撤销写入。

行为改变且未观察到 hook 生效或经 Bash/MCP 改写时，对实际改动 C/C++ 文件手动 `detect` 一次，再完成相关项目检查；纯注释/格式不强制。review 只触发契约核验，不自动增加重复保护。不能把 `NO_PATTERN_MATCHES` 写成“内存安全”或“硬件通过”。

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
