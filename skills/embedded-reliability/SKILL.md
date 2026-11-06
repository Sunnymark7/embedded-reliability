---
name: embedded-reliability
description: 嵌入式固件和驱动开发、设计、审阅、排障或移植时使用。适用于 STM32、ESP32、NXP、nRF、RP2040/RP2350、TI、AVR/PIC/SAM、GD32/CH32、Renesas 等 MCU，裸机/RTOS、嵌入式 Linux 与混合平台 C/C++；检查 DMA/缓存、中断、指针与内存、ADC、UART/I2C/SPI/CAN 和协议布局。嵌入式功能实现也应应用，不限于显式规范审查；纯 Web UI、桌面业务逻辑和单纯芯片选型不触发。
metadata:
  version: "2.0.0"
license: MIT
---

# 嵌入式可靠开发

把需求转为有边界、可验证的实现。中文说明，保留源码标识符和官方术语。依据项目环境选择规则，不混用 Linux 内核、POSIX 用户态和 MCU 的 API 或语言假设。

## 开始工作

1. 判断用户要求的是设计、只读审阅，还是实施修复。审阅不授权改代码；开发任务按已有授权推进。不因使用本技能自动索要批准。
2. 对有源码的任务，在项目 cwd 运行一次 `node "<skill-base-dir>/scripts/context.mjs"`；有明确目标时附 `--target <path>`。脚本只读、无网络，给出型号线索与待核对项；不能把候选当已确认硬件。Node 不可用则人工完成相同发现，不安装新运行时。读取适用的 `AGENTS.md`、构建配置、同版本头文件、现有同类模块和测试。复用既有 SDK/构建，区分历史问题与新增问题。
3. 从代码和文档提取 profile：目标板/SoC、CPU/字节序、OS/内核与 SDK 版本、语言方言、运行上下文、内存/时延约束、ABI/协议版本。多平台项目按组件标注 `linux-kernel`、`linux-user`、`mcu-rtos`、`portable-core`，可叠加 `cpp`。尚无证据时写明未知，不能把示例型号当事实。
4. 仿照 [项目配置模板](assets/project-profile.yaml) 记录必要事实；小改动可直接在任务说明记录，不强制新建配置文件。只有缺失信息会实质影响正确性或风险时提问，继续不依赖该信息的工作。
5. 按下表读取相关参考，不一次加载整套材料。首次制定项目规范时先读来源与适用性，普通开发直接读当前领域。

## 任务路由

隐式匹配时直接处理用户任务，不先弹菜单。只有单独输入技能名且没有任务时，简短展示以下选项。命令是本技能的自然语言参数，不宣称为已注册的独立斜杠命令。

| 参数/意图 | 行为 | Playbook |
| --- | --- | --- |
| `init` / 建立项目规范 | 提取事实，生成必要项目契约，保留原 AGENTS | [工作流程](references/workflows.md) |
| `design` / 设计架构 | 只设计接口、分层、预算与恢复，不擅自改实现 | [工作流程](references/workflows.md) |
| `build` / 实现功能 | 加载相关专题和编辑前底线，完成授权实现 | [工作流程](references/workflows.md) |
| `audit` / 审查型号或源码 | 只读，风险排序，逐项证据 | [MCU 审查入口](references/mcu-families.md)与[工作流程](references/workflows.md) |
| `harden` / 修复稳定性 | 由证据定位问题，修复失败/并发/边界路径 | [工作流程](references/workflows.md) |
| `port` / 更换 MCU | 先做精确型号差异表，禁止寄存器/API 机械替换 | [MCU 审查入口](references/mcu-families.md) |
| `verify` / 验证 | 使用工程检查，诚实区分宿主/目标/硬件 | [验证与交付](references/verification.md) |
| `detect` / `doctor` | 只读检测源码风险线索 / 配置与型号证据缺口 | [自动化与约束](references/automation.md) |
| `hooks on/off/status` | 按请求管理当前项目 hook；`--user` 才作用于个人配置 | [自动化与约束](references/automation.md) |

每次编辑嵌入式源码前读 [编辑前可靠性底线](references/reliability-floor.md)。规划/只读任务不为此启动写入流程。MCU 相关任务先加载 [型号审查入口](references/mcu-families.md)，再仅加载命中系列。没有配置文件不等于新项目，脚本缺失线索不等于硬件已验证。

## 专题参考

| 当前工作 | 需要的参考 |
| --- | --- |
| 选标准、解释规则来源、制定规范 | [标准综合与来源](references/standards-and-sources.md) |
| 分层、移植、模块边界、Linux/MCU 协作 | [平台与架构](references/profiles-and-architecture.md) |
| Linux 驱动、设备树、MMIO、DMA、卸载 | [Linux 驱动](references/linux-drivers.md) |
| MCU 驱动、缓存、复位/看门狗、故障恢复 | [MCU 与系统恢复](references/mcu-drivers-and-recovery.md) |
| MCU 型号/修订/移植差异与系列路由 | [MCU 型号审查](references/mcu-families.md) |
| 分配、指针、结构体、联合体、ABI、位域 | [内存与类型](references/memory-and-types.md) |
| 线程、ISR、锁、实时、异步取消 | [并发与时序](references/concurrency-and-time.md) |
| ADC/DAC、模拟链路、校准、IIO | [模拟采集](references/analog-signals.md) |
| UART/I²C/SPI/CAN/网络、组帧、恢复 | [数字通信](references/digital-communications.md) |
| 命名、排版、C/C++、宏、头文件 | [代码书写](references/code-style.md) |
| 构建、分析、故障注入、板级验证 | [验证与交付](references/verification.md) |
| AI 的输入、输出及证据 | [AI 协作流程](references/ai-workflow.md) |

## 执行时保留的约束

- **先契约后实现**：对本次影响的接口确定输入范围、单位、所有权、有效期、线程/中断上下文、阻塞上限、错误与取消语义。可使用 [模块契约模板](assets/module-contract.md)，简单私有函数不必建立独立文档。
- **不虚构硬件事实**：寄存器、位定义、清中断方式、时钟、DMA 可达区域、复位和 API 签名必须来自目标版本的头文件、手册或同树实现。能编译不能证明电气或硬件正确。
- **有界资源和等待**：为输入长度、队列、分配、递归/栈、重试、超时建立边界。常驻事件循环可以长期运行，但须能等待、取消和退出；不能用忙等或无限错误重试冒充恢复。
- **所有权先于裸指针**：跨异步边界确认对象在完成、取消和最后引用释放前有效；不可把栈地址交给寿命更长的工作。空指针检查不证明对象有效。
- **并发机制随平台选择**：`volatile` 不提供线程同步；CPU 原子操作不自动提供 DMA 缓存维护；coherent DMA 也仍有顺序要求。Linux 内核使用内核原语，用户态使用 POSIX/C/C++ 原语，MCU 使用经目标确认的 ISR/RTOS 原语。
- **外部数据显式解码**：不把字节缓冲区强转为结构体，不直接发送含填充的内存镜像。联合体使用标签和成员有效期；位域与 `packed` 不作为通用协议、ABI 或 MMIO 方案。
- **保留项目生态**：Linux 内核按目标树和子系统要求；不强行加入 libc、STL、统一 `stdint.h`、全树格式化或通用 `-pedantic` 配置。新用户态/便携模块才采用默认风格。
- **只做证据支持的变更**：不因风格偏好重写工作模块；第三方/生成代码按工程方式隔离，不为消除告警修改供应商源。确需偏离项目规则时记录范围、原因、替代控制与有效期，见 [偏离记录](assets/deviation-record.md)。

规则 ID 如 `MEM-01`、`DRV-02` 是本技能的内部索引，**不是 MISRA 条款编号**。参考中的“必须”是该 profile 下本规范的要求；“建议”允许有依据的替代；“配置项”由项目确定。声称 MISRA/功能安全符合性前必须有完整授权标准、适用性/偏离记录和合格证据，不能用本技能代替认证。

## 最小交付

- 设计任务：交付目标 profile、依赖方向、模块/数据契约、资源及时序预算、失败恢复路径和验证计划；未知硬件参数明确列出。
- 只读审阅：按实际风险排序给出 `规则 ID + 文件/行号 + 触发场景 + 后果 + 修复方向 + 证据`，没有证据时标注推断，不自动编辑文件。
- 开发/修复：实现授权范围内的改动，运行与风险匹配的检查；错误路径、并发和解析器变化需要相应验证。结果中区分“已执行通过 / 失败 / 未执行 / 不适用”，不把计划标成通过。
- 完成说明聚焦行为变化、已验证证据、剩余板级/硬件验证以及偏离项。不要把静态分析、单测、仿真和实机混称“测试通过”。

## 可复用材料

- [项目 AGENTS 片段](assets/AGENTS.embedded.md)：仅在用户要求写入仓库规范时合并到适用位置，保留原规则，不自动覆盖根 `AGENTS.md`。
- [EMBEDDED 上下文模板](assets/EMBEDDED.md)：仅在确需持久记录型号/手册/内存/验证事实时按组件填写，未知项不编造。
- [协议编解码示例](assets/examples/frame_codec.h)、[实现](assets/examples/frame_codec.c)、[边界测试](assets/examples/test_frame_codec.c)：演示显式字节序、带标签联合体、CRC 和失败时输出保持不变；不是具体设备协议，也不直接用于安全控制。
- [示例验证命令](references/verification.md#示例包的验证)：在有 C11 编译器的主机运行，不需要连接设备。
- 编辑后遵循 [自动化与约束](references/automation.md)：hook 未实际生效时，结束前手动运行一次相关 `detect`，分析器只提供线索，不能签发 MCU 合格结论。
