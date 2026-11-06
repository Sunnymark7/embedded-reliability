# 标准检索、综合取舍与来源

核验日期：2026-11-06。默认使用场景由用户明确为**嵌入式 Linux / 多平台混合**。本目录内容是面向工程执行的原创综合规范，不是任何标准的逐条转录或符合性证明。

## 综合结论

可靠性不能只靠代码排版。规则应同时约束语言行为、资源与上下文、设备生命周期、信号/协议边界、真实验证和 AI 的证据。采用一个主技能维护统一任务边界，专题按需加载，避免十个技能重复采访或出现冲突指令。

| 依据 | 主要价值 | 采用方式与边界 |
| --- | --- | --- |
| MISRA C / C++ | 限制高风险语言行为，支持关键系统的规范化开发 | 确定所需版本与工具覆盖；不凭公开摘要臆造条款，不强套到整个 Linux kernel |
| CERT C | 内存、数组、整数、并发等可导致缺陷的模式 | 用可查证规则支撑风险检查；区分规则/建议和持续更新站点；不照搬所有历史建议 |
| Linux 官方文档与目标源码 | kernel style、驱动模型、DMA/锁、子系统和 ABI | 内核组件的主要工程依据；API 签名以目标树为准 |
| BARR-C:2018 | 有助于减少嵌入式代码歧义的命名/表达风格 | 选用有实际收益的约定；不照搬过时文件名限制或覆盖仓库风格 |
| C++ Core Guidelines | 所有权、RAII、接口和类型设计 | 用于已采用 C++ 的组件；结合语言版本、运行库和实时预算 |
| RTOS/SDK 官方资料 | ISR API、调度、内存、外设与缓存机制 | 只在相应平台使用，不将 FreeRTOS 规则泛化为所有 RTOS |
| 芯片/总线规范与应用笔记 | 电气时序、ADC acquisition、抗混叠、通信物理层 | 软件与硬件联合核验；通用笔记不能替代具体器件手册与实测 |

官方商店当前列出 MISRA C:2025（2025 年 3 月更新）和 MISRA C++:2023（TC1:2026）；后者面向 C++17，TC1 页面说明未增加新 guidelines。这是检索时点事实，项目仍应保留合同/工具链要求的明确版本，不自动升级。[MISRA C](https://misra.org.uk/product/misra-c2025/)、[MISRA C++](https://misra.org.uk/product/misra-cpp2023/)

## 规则分层

1. **已知正确性约束**：越界、未定义行为、对象寿命、并发、数据校验、硬件副作用；必须验证相关路径。
2. **平台工程约束**：内核 API、PREEMPT_RT、RTOS ISR、DMA/缓存、用户态 fd；只在适用 profile 强制。
3. **项目配置**：超时、队列容量、堆策略、标准版本、精度/延迟；从需求、仓库和测量获得，不伪造统一数值。
4. **维护风格建议**：命名、缩进、函数组织；保持本地一致，不为样式重构无关模块。

同一项目的权限与用户任务范围仍由当前会话/项目规则决定。通用参考不能授权刷写设备、覆盖仓库规范或外发私有资料。

## 易误用建议的处理

| 过度概括 | 本技能的取舍 |
| --- | --- |
| 嵌入式一律不准 malloc/STL/异常 | 按 profile、资源上限、实时要求和现有工程确定，资源寿命必须清晰 |
| 共享变量加 volatile 即可 | 使用平台同步；MMIO、CPU 顺序和 DMA 一致性分别论证 |
| 设备所有资源用 devm 就可直接卸载 | 仍需停止事件源、drain 异步访问并处理最后引用 |
| packed struct/位域可直接收发 | 外部布局显式编解码，必要 ABI 专项检查 |
| union 一律安全或一律 UB | 区分 C/C++ 与目标保证，便携默认 tagged union，不靠非活动成员做重解释 |
| 所有错误都重试、加延时会更稳 | 检查副作用与幂等性，限制总时限，用证据定位根因 |
| 采样率大于两倍即可准确采集 | 同时约束模拟滤波、acquisition/settling、参考、噪声和时间戳 |
| 单测通过即可说板卡稳定 | 明确宿主、交叉、目标内核与电气/HIL 证据边界 |
| 所有代码统一 4 空格和 stdint | 尊重 kernel/SDK/现有工程生态，只给新便携代码默认值 |

这些取舍为作者综合判断，不是某一标准的原文或官方统一结论。

## 规则与验证的定位

| 内部规则组 | 专题 | 主要可观察验证 |
| --- | --- | --- |
| ARC | 分层、跨平台和资源契约 | 依赖图、接口、构建隔离和预算 |
| DRV / DMA / ABI | 驱动、DMA、UAPI | 失败/解绑/PM、映射寿命、ABI 布局 |
| MCU / REC | MCU 驱动、系统恢复 | DMA 内存域、回调/超时、复位/失联/看门狗 |
| MEM / PTR / NUM / TYP | 内存、指针、整数、复合类型 | 边界、所有权、分析器、sanitizer、黄金向量 |
| CON / TIM / USR / RT | 并发、时间、用户态、实时 | race/lock 检测、并发取消、截止期/延迟 |
| ANA | 模拟信号与 IIO | 精度、滤波、采样时序、丢样、波形 |
| SIG / BUS / PRO | 电气、总线、协议 | 时序/电平、错误注入、组帧/CRC/fuzz |
| STY / CPP | 风格、C++ | 编译/格式、RAII/寿命审阅 |
| VER / AI | 证据和 AI 行为 | 实际命令与结果、事实来源、权限边界 |

## 已核验的主要一手来源

下表的“用途”只限定本技能如何引用；目标项目实施仍需锁定其具体版本。网页可能更新，正式合规项目应保存合法取得的版本及访问记录。

| 来源 | 本技能用途 |
| --- | --- |
| [MISRA C:2025](https://misra.org.uk/product/misra-c2025/) | 标准版本与适用范围 |
| [MISRA C++:2023 (TC1:2026)](https://misra.org.uk/product/misra-cpp2023/) | C++17 与勘误版本 |
| [SEI CERT C](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/) | 风险规则结构及持续更新边界 |
| [CERT ARR30-C](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/rules/arrays-arr/arr30-c/) | 越界指针和数组 |
| [CERT EXP39-C](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/rules/expressions-exp/exp39-c/) | 不兼容类型别名 |
| [CERT CON02-C](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/recommendations/concurrency-con/con02-c/) | volatile 不是同步 |
| [BARR-C 介绍](https://barrgroup.com/introduction) | 嵌入式风格基线 |
| [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) | 资源、所有权和类型设计 |
| [Linux coding style](https://www.kernel.org/doc/html/latest/process/coding-style.html) | 内核风格 |
| [Linux stable API 说明](https://docs.kernel.org/process/stable-api-nonsense.html) | 内核内部 API 版本边界 |
| [Devres](https://docs.kernel.org/driver-api/driver-model/devres.html) | 托管资源与失败清理 |
| [Driver basics](https://docs.kernel.org/driver-api/basics.html) | 驱动基础 API，具体签名查目标树 |
| [Device I/O](https://docs.kernel.org/driver-api/device-io.html) | MMIO accessor 与顺序 |
| [DMA API HOWTO](https://docs.kernel.org/core-api/dma-api-howto.html) | DMA 地址、映射与一致性 |
| [Memory barriers](https://docs.kernel.org/core-api/wrappers/memory-barriers.html) | Linux 发布/顺序模型 |
| [Lock types](https://docs.kernel.org/locking/locktypes.html) | PREEMPT_RT 与锁上下文 |
| [Volatile harmful](https://cdn.kernel.org/doc/html/latest/process/volatile-considered-harmful.html) | 内核共享状态同步 |
| [Unaligned access](https://www.kernel.org/doc/html/latest/core-api/unaligned-memory-access.html) | 对齐与字节访问 |
| [ioctl interfaces](https://docs.kernel.org/driver-api/ioctl.html) | UAPI 布局与扩展 |
| [Runtime PM](https://docs.kernel.org/power/runtime_pm.html) | 电源与资源计数 |
| [DT binding schema](https://docs.kernel.org/devicetree/bindings/writing-schema.html) | 硬件描述验证 |
| [IIO buffers](https://docs.kernel.org/driver-api/iio/buffers.html) | scan 元数据与连续采集 |
| [IIO triggered buffers](https://cdn.kernel.org/doc/html/latest/driver-api/iio/triggered-buffers.html) | 触发处理与通知 |
| [Linux SPI](https://docs.kernel.org/driver-api/spi.html) | 控制器/设备驱动与事务 |
| [Linux I²C user interface](https://docs.kernel.org/i2c/dev-interface.html) | 组合事务与接口能力 |
| [SocketCAN](https://docs.kernel.org/networking/can.html) | CAN 子系统与帧语义 |
| [Kernel Testing Guide](https://docs.kernel.org/dev-tools/testing-overview.html) | KUnit、kselftest 与动态工具 |
| [read(2)](https://man7.org/linux/man-pages/man2/read.2.html) | 短读与返回值 |
| [write(2)](https://man7.org/linux/man-pages/man2/write.2.html) | 部分写与失败语义 |
| [poll(2)](https://man7.org/linux/man-pages/man2/poll.2.html) | 就绪与等待 |
| [clock_gettime(2)](https://man7.org/linux/man-pages/man2/clock_gettime.2.html) | 单调时钟与 suspend |
| [signal-safety(7)](https://man7.org/linux/man-pages/man7/signal-safety.7.html) | 信号处理约束 |
| [close(2)](https://man7.org/linux/man-pages/man2/close.2.html) | Linux fd 释放与错误 |
| [GCC warnings](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html) | 编译器告警选项 |
| [Clang ASan](https://clang.llvm.org/docs/AddressSanitizer.html) | 宿主内存检测 |
| [FreeRTOS ISR critical section](https://www.freertos.org/Documentation/02-Kernel/04-API-references/04-RTOS-kernel-control/02-taskENTER_CRITICAL_FROM_ISR_taskEXIT_CRITICAL_FROM_ISR) | ISR 优先级/临界区 |
| [FreeRTOS mutexes](https://freertos.org/Real-time-embedded-RTOS-mutexes.html) | 任务与中断边界 |
| [Zephyr coding guidelines](https://docs.zephyrproject.org/latest/contribute/coding_guidelines/index.html) | 平台自定义 MISRA 子集的实例，不能视为所有 RTOS 的规则 |
| [NXP UM10204](https://www.nxp.com/docs/en/user-guide/UM10204.pdf) | I²C 电气和时序 |
| [TI RS-485 guide](https://www.ti.com/lit/an/slla272d/slla272d.pdf) | 物理层、终端、偏置 |
| [ADI ADC/DAC terms](https://www.analog.com/en/resources/technical-articles/types-of-adcs-and-dacs.html) | 编码、采样与建立术语 |
| [Microchip ADC acquisition](https://developerhelp.microchip.com/xwiki/bin/view/products/data-converters/adc-specs/acquisition-time/) | 输入建立时间 |
| [NI anti-aliasing](https://www.ni.com/en/shop/data-acquisition/measurement-fundamentals/analog-fundamentals/anti-aliasing-filters-and-their-usage-explained.html) | 模拟抗混叠 |
| [ST AN4839](https://www.st.com/resource/en/application_note/an4839-level-1-cache-on-stm32f7-series-and-stm32h7-series-stmicroelectronics.pdf) | 特定 MCU 的 L1 cache/DMA 实例 |
| [Linux watchdog API](https://docs.kernel.org/watchdog/watchdog-api.html) | 看门狗接口与配置差异 |
| [GPIO character API](https://docs.kernel.org/userspace-api/gpio/chardev.html) | 用户态 GPIO 与既有驱动边界 |

## 尚需具体项目补充

SoC/板级原理图、器件手册和 errata、厂商 kernel/SDK commit、编译器/ABI、实际负载、精度/实时/资源指标、危险输出边界、正式标准授权及项目合规要求。当前没有嵌入式代码仓库或目标板证据，因此本次交付是通用技能与参考实现，不是某个产品稳定性或符合性验收。
