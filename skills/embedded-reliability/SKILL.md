---
name: embedded-reliability
description: 嵌入式固件和驱动的设计、实现、审阅、排障或移植时使用。覆盖 MCU 裸机/RTOS、嵌入式 Linux 与混合 C/C++，包括 STM32、ESP32、NXP/MCX、nRF、RP、TI、AVR/PIC/SAM、GD32/CH32、Renesas。按项目证据处理内存/指针、IRQ、DMA/缓存、ADC 和通信，强调简单实现、合理注释与必要验证。普通功能开发也适用；纯 Web UI、桌面业务与单纯选型不触发。
metadata:
  version: "2.1.0"
license: MIT
---

# 嵌入式可靠开发

中文说明，保留代码标识符。先做任务所需的最简单正确实现，保持易读、可维护；采用 [适度设计](references/proportionate-design.md)，领域清单只在本次涉及的风险上适用。

## 开始与执行

1. 判断设计、只读审阅或授权实施；明确任务直接处理，不先弹菜单。审阅不自动改代码，实施不扩大到刷写、设备执行或无关重构。
2. 复用已有上下文、适用 AGENTS、同类模块和构建。单纯命名/注释/等价局部整理不做完整硬件调查。需要确定新目标或硬件行为时，在工程 cwd 运行一次 `node "<skill-base-dir>/scripts/context.mjs" --target <path>`（无目标可省略参数）。Node 不可用则人工核验，不安装依赖。
3. 区分 `linux-kernel / linux-user / mcu-rtos / portable-core` 及 C++；context 输出是证据线索，不能代替焊接 part/revision 或真实编译结果。只有影响当前改变的未知项才提问；暂停依赖部分，继续独立工作。
4. 一批行为编辑前读一次 [可靠性底线](references/reliability-floor.md)，按下表只加载相关参考；目标/上下文/约束变化才重读。接口契约可写在头文件，不要求每个 helper 新建文档。
5. 实现保持直接控制流、清晰命名和短而完整的错误路径。外部数据/真实异步风险保留必要边界检查；内部已成立的契约不重复防御。额外重试、冗余、恢复状态机或通用封装若增加复杂度，按适度设计提出具体收益/代价，由用户决定；复用已授权要求，不重复批准。
6. 跑项目已有且与本次相关的检查。功能变更经 Bash/MCP 或未确认 hook 反馈时，结束前对实际改动文件手动 `detect` 一次；纯注释/格式无须强制检测。真实失败需修复回归，不因一次检查上限跳过；不为绿灯重写无关代码。

## 意图路由与参考

`init/design/build/audit/harden/port/verify/detect/doctor/hooks` 是自然语言参数，不是独立注册的斜杠命令。仅输入技能名时可简短列选项；已有明确任务按意图进入对应流程。

| 工作 | 按需加载 |
| --- | --- |
| 流程、权限、交付，init/design/build/audit/harden | [工作流程](references/workflows.md)、[AI 协作](references/ai-workflow.md) |
| 分层/跨平台接口 | [平台与架构](references/profiles-and-architecture.md) |
| MCU 新驱动/硬件改变/port | [型号审查入口](references/mcu-families.md) → 命中系列；[MCU 与恢复](references/mcu-drivers-and-recovery.md) |
| Linux 驱动/MMIO/DMA/UAPI/PM | [Linux 驱动](references/linux-drivers.md) |
| 分配/指针/整数/结构体/union/位域/ABI | [内存与类型](references/memory-and-types.md) |
| IRQ/任务/锁/取消/实时 | [并发与时序](references/concurrency-and-time.md) |
| 模拟链/ADC/DAC/IIO | [模拟采集](references/analog-signals.md) |
| UART/I²C/SPI/CAN/网络/解析 | [数字通信](references/digital-communications.md) |
| 命名、注释、排版、C/C++ | [代码书写](references/code-style.md) |
| verify、构建/分析/故障/板级验证 | [验证与交付](references/verification.md) |
| detect/doctor/hooks | [自动化与约束](references/automation.md) |
| 制定规范或核对条款来源 | [标准综合与来源](references/standards-and-sources.md) |

## 能力与证据边界

- 寄存器、清中断方式、DMA 可达性、cache/安全域、API 签名来自目标手册/errata/同版本源码，不凭相似型号猜测；不必为无关局部改动补齐全部硬件参数。
- `volatile` 不代替同步，CPU 原子/锁不代替 DMA 缓存维护；异步对象在最后访问结束后释放。跨外部边界显式编解码，不导出 padding、原生指针或未经约定的 enum 布局。
- 遵循目标 kernel/SDK/仓库风格，不向内核塞 libc/STL，不全树改格式，不因泛化建议改供应商/生成代码。
- context 不执行构建、不解释全部条件编译；JSON 声明与编译定义可冲突。detect 是词法线索，不能证明无 UAF/竞态；现有语义分析器按 [验证参考](references/verification.md) 使用。
- 内部规则 ID 不是 MISRA 条款。本技能/宿主测试不等于全型号适配、硬件验收或正式符合性。审阅定位真实路径，推断标为推断。

交付说明行为变化、实际执行证据、未执行项目及原因。状态区分通过/失败/未执行/不适用；小任务简短报告，不强制填写整个清单。

## 可复用材料

- [embedded-profile.json](assets/embedded-profile.json)：可选的唯一机器配置；按组件声明 profile/part/版本，缺失不阻塞已知任务。格式见自动化参考。
- [EMBEDDED 模板](assets/EMBEDDED.md)、[模块契约](assets/module-contract.md)：只在确有持久记录需要时使用。
- [AGENTS 片段](assets/AGENTS.embedded.md)：用户要求建立项目规范时合并，保留原内容；[偏离记录](assets/deviation-record.md)仅用于真实项目规则偏离，不记录每个正常简化。
- [编解码头文件](assets/examples/frame_codec.h)、[实现](assets/examples/frame_codec.c)、[测试](assets/examples/test_frame_codec.c)和[验证命令](references/verification.md#示例包的验证)：8-bit byte 的教学示例，不含完整设备协议。
