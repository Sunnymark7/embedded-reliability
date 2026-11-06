# Embedded Reliability · 嵌入式可靠开发

面向 Codex 的中文优先嵌入式开发技能。根据工程证据识别 MCU/运行上下文，约束架构、驱动、内存、指针、并发、DMA、模拟采集、数字通信和代码书写。支持 Linux 内核、Linux 用户态、MCU 裸机/RTOS 与便携 C/C++ 的分开处理。

**默认写简单、清晰、符合现有嵌入式规范的代码。** 必要检查放在真实边界，内部已保证的契约不重复校验；注释说明用途、单位、所有权、上下文和设计原因。没有当前需求时，不增加通用 HAL、锁、重试、引用计数或恢复状态机。额外保护有明显成本时先给具体方案和取舍，由用户决定，主体工作继续。

2.1 版修复了注释误识别、子目录启动漏父级证据、同系列不同型号合并、混合工程 hook 范围问题；共用型号词典，加入按目标文件读取编译定义及可选 JSON 组件声明。设计取舍见 [适度设计](skills/embedded-reliability/references/proportionate-design.md)。

技能入口：[SKILL.md](skills/embedded-reliability/SKILL.md)。规范检索与来源：[来源综合](skills/embedded-reliability/references/standards-and-sources.md)。

## 安装到 Codex

将 `skills/embedded-reliability` 目录放入**一个**宿主实际扫描的 skills 位置，避免同名副本重复出现：

- 当前 OpenAI 文档中的个人位置：`~/.agents/skills/embedded-reliability`。
- 团队仓库位置：`<project>/.agents/skills/embedded-reliability`。
- 已由 Codex 桌面列出的个人 `~/.codex/skills` 位置可沿用；不要仅因另一份文档提及新位置就维护两份同名技能。

也可以使用 `$skill-installer` 从本 GitHub 仓库的 `skills/embedded-reliability` 路径安装。重新打开/刷新 Codex 会话后检查技能是否被发现。安装目录必须包含 SKILL.md，不能只复制整个 Git 仓库到技能子目录后期待任意深度都被识别。

当前发现机制与安装路径以 [OpenAI 官方 Skills 文档](https://learn.chatgpt.com/docs/build-skills) 和实际宿主为准。

## 自动匹配与约束

`description` 负责让固件/驱动任务可被匹配，`agents/openai.yaml` 明确启用 `allow_implicit_invocation: true`。不需要每次手动写技能名；但模型自动选择不是百分百命中或代码安全保证。任务太泛、技能未加载、上下文预算缩短描述时，显式 `$embedded-reliability` 可提供确定的调用意图。

例如：

```text
为 STM32H743 的 ADC DMA 双缓冲实现采集服务，沿用当前工程接口，处理缓存、取消和丢样。
```

选中技能后执行：只读发现工程 → 确认型号/SDK/ABI/上下文 → 加载系列与领域参考 → 编辑前底线 → 实现或只读审阅 → 检测线索与实际构建/测试 → 报告未验证硬件项。

这个流程按任务裁剪：命名/注释/等价整理复用已知上下文，不强制硬件问卷或新增测试；同一批行为编辑只加载一次底线，目标或约束变化才重读。缺失与本次无关的硬件事实不阻塞纯逻辑工作。

可选配置统一为 [embedded-profile.json](skills/embedded-reliability/assets/embedded-profile.json)，按路径声明 MCU、Linux 或便携组件；不需要同时维护 YAML。配置会校验并与构建线索对照，详细格式和证据等级见 [自动化说明](skills/embedded-reliability/references/automation.md)。

## 命令式使用

这些是技能参数，不是独立注册的 `/audit` 等全局命令。

```text
使用 $embedded-reliability audit，审查驱动卸载、DMA 和异步指针寿命，只读。
使用 $embedded-reliability design，设计 Linux 与 MCU 的采集通信接口。
使用 $embedded-reliability port，评估并迁移现有驱动到明确的新 MCU。
使用 $embedded-reliability harden，修复已定位的串口解析越界并验证。
使用 $embedded-reliability doctor，报告当前项目的型号证据和配置缺口。
```

`init / design / build / audit / harden / port / verify / detect / doctor / hooks` 的路由见主技能；普通明确任务直接执行，不先要求选菜单。

## MCU 覆盖等级

已提供系列规则路由与识别 fixture，**不表示所有型号已交叉编译或实板认证**。

| 系列 | 审查重点 |
| --- | --- |
| STM32 常见 F/G/L，F7/H7，L5/U5/H5 | DMA 可达性、TCM/cache、H7 子线/双核、安全域、Cube 配置 |
| ESP32/S2/S3、C/H/P 子线 | 精确 IDF target、ISR 整条调用链、PSRAM/DMA 与 SDK 版本 |
| NXP i.MX RT / LPC55；Kinetis/MCX 入口 | XIP、cache/TCM、DMA、TrustZone；不与 Linux i.MX MPU 混用 |
| Nordic nRF52/53/54 | EasyDMA、无线资源、应用/网络核、SDK 生态差异 |
| RP2040/RP2350 | 多核/Flash XIP、PIO/DMA、架构与 silicon stepping |
| TI MSP430/MSPM0/C2000 | 不同 ABI/中断、C28x 16-bit byte、CLA/CM 与控制时序 |
| Microchip AVR/PIC/dsPIC/SAM | 窄核原子性、程序/数据空间、ISR/指针模型 |
| GD32/CH32、Renesas RA/RX | 识别与查证入口；部分官方手册未完整获取，不猜寄存器 |

完整范围与未覆盖边界见 [MCU 入口](skills/embedded-reliability/references/mcu-families.md)。新型号/修订必须回到目标 RM、errata、SDK 头文件与项目证据，不根据最相近名称推断能力。

## 可选的自动 hook 反馈

Node 22+，只使用标准库，无 npm 安装、网络查询、遥测或自动更新。在工程 cwd 使用实际技能路径：

```sh
node "<skill-dir>/scripts/hook-admin.mjs" on
node "<skill-dir>/scripts/hook-admin.mjs" status
node "<skill-dir>/scripts/hook-admin.mjs" off
```

加 `--user` 作用于个人 CODEX_HOME，而不是工程。安装脚本保留其他 hooks，并备份既有清单。

随后在 Codex 桌面 **Settings → Hooks / Review hooks** 或 CLI `/hooks` 审阅并信任。注册和测试脚本不代表自动获得宿主信任；脚本不会改信任记录或绕过信任。

- UserPromptSubmit：只对匹配的嵌入式任务提醒加载技能。
- PostToolUse：对直接 Edit/Write/apply_patch 的 C/C++ 文件输出定位风险线索。
- Bash/MCP 间接写入、未知工具事件和跨根目标不保证自动扫描。行为变更未确认 hook 生效时手动运行 `detect`；纯注释/格式不强制。只运行与当前改动相关的工程验收。

详见 [自动化与约束](skills/embedded-reliability/references/automation.md)。Hook 为反馈，不是全能防火墙或内存/并发证明。

## 本地验证

```sh
node --test tests/tooling.test.mjs tests/discovery.test.mjs
node scripts/validate.mjs
cc -std=c11 -Wall -Wextra -Wconversion -Wsign-conversion -Wshadow -Werror skills/embedded-reliability/assets/examples/frame_codec.c skills/embedded-reliability/assets/examples/test_frame_codec.c -o /tmp/test_frame_codec
/tmp/test_frame_codec
```

CI 使用 Ubuntu/Windows 测试 Node 脚本，GCC/Clang 编译 C11 例子，并单独运行 ASan/UBSan。测试与覆盖边界见 [审查报告](docs/mcu-review.md)。

47 项脚本测试覆盖配置/目标证据、组件隔离、触发和边界；它们不等于真实模型行为评测。可用于后续模型端验收的任务与判据见 [行为评测场景](docs/behavior-evaluation.md)，不会自动调用收费模型或操作板卡。

C11 协议示例只用于 `CHAR_BIT == 8` 且提供精确宽度整数类型的目标；不适用于 C28x 的直接复用。没有烧录/实板、完整 MISRA 工具链或形式验证时，不宣称这些检查已完成。

## 设计来源与许可

MIT 许可用于本仓库原创内容与代码。第三方标准、手册和品牌仍按各自条款使用，不附带完整 MISRA 文本或厂商 SDK。

参考用户提供的 Impeccable 4.1.3 的**上下文发现、按意图路由、编辑前底线、机械检测与人工判断分开、只报告配置漂移**的机制设计。本仓库没有复制其实现，也不修改/依赖它；未照搬前端视觉规则、npx 命令、特殊工具权限或跨宿主配置。说明见 [设计对照](docs/design-comparison.md)。
