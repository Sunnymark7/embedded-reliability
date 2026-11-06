# MCU 型号审查与移植入口

核验日期 2026-11-06。覆盖常见系列的**检查方法与风险点**，不声称穷尽所有 SKU/修订或做过全部实机验证。只有产品入口而未取得手册内容的系列，明确标为查证入口，不能生成具体寄存器方案。

## 发现不是确认

context 输出 `candidates` 是由源码/构建线索匹配的系列；命中 `STM32H743xx` 不证明实际焊接的是该芯片或某个 revision。完整 part、硅 revision、板型/修订、SDK commit、编译器/ABI、linker/map、bootloader 和选项字节须有项目证据。多个候选保留冲突，不能选第一个就写驱动。

| 系列线索 | 加载参考 | 覆盖与重点 |
| --- | --- | --- |
| STM32 F0/F1/F3/F4/G0/G4/L0/L4、F7/H7、L5/U5/H5 | [STM32](mcu/stm32.md) | 分组审查；缓存/TCM、H7 子线/单双核、TrustZone、Cube 配置 |
| ESP32 / S2 / S3 / C2/C3/C5/C6/C61/H2/P4 | [Espressif](mcu/espressif.md) | Xtensa/RISC-V 不是同一 port；IRAM 调用链、capability 内存、PSRAM/IDF 版本 |
| i.MX RT、LPC55、Kinetis/MCX | [NXP](mcu/nxp.md) | RT 与 i.MX Linux MPU 区别、cache/TCM、XIP 与安全域；其余按目标手册 |
| nRF52 / nRF53 / nRF54 | [Nordic](mcu/nordic.md) | EasyDMA、无线栈资源、应用/网络核、NCS/Zephyr 与旧 SDK |
| RP2040 / RP2350 | [Raspberry Pi](mcu/raspberry-pi.md) | XIP Flash、多核、PIO/DMA、具体 stepping errata |
| MSP430 / MSPM0 / C2000 F28x | [TI](mcu/ti.md) | 不混数据模型/中断；C28x 16-bit byte、CLA/CM、ADC/PWM 时序 |
| AVR / PIC / dsPIC / SAM | [Microchip](mcu/microchip.md) | 8/16 位非原子访问、Flash/数据空间、DMA/缓存随型号 |
| GD32 / CH32、Renesas RA/RX | [其他系列](mcu/other-families.md) | 兼容性/架构/工具链重新核实；仅有限一手证据 |
| 未命中、STM32N6/H7RS 等尚无专项覆盖 | 当前入口 + 目标手册 | 不能强行归入最近相似型号；先补具体参考与证据 |

## 每个 MCU 的审核表

`FAM-01` 必须：下面关键项标为“事实 + 来源 / 假设 / 不适用 / 未知”，而不是统一勾通过。

| 维度 | 需要核对 | 常见错误 |
| --- | --- | --- |
| 身份 | 完整 part、封装、revision、板修订、errata | 家族名代替 SKU，忽略 silicon stepping |
| 核/ABI | ISA、FPU/DSP、浮点 ABI、字节宽度、对齐、工具链选项 | Cortex-M4F 推导工程已开 hard-float，C byte 当 octet |
| 启动 | vector/入口、data/bss、链接布局、boot offset、双镜像 | 只改 linker Flash origin、不处理向量/跳转条件 |
| 存储 | CPU/DMA/其他核可达性、cache/MPU、buffer 对齐/寿命 | SRAM 名称相同就认为可 DMA，关 cache 掩盖问题 |
| IRQ/RTOS | 控制器、优先级表示、嵌套、ISR ABI、RTOS port | 所有 MCU 使用 NVIC/CMSIS 或相同 `FromISR` 优先级 |
| 时钟/低功耗 | 外设时钟、PLL、分频、tick、唤醒/保留 | CPU 主频等于 timer 时钟，STOP 后自动恢复全部状态 |
| 外设 | 触发链、FIFO、DMA request、状态位清除、错误处理 | 相近寄存器名/API 就视作同一 IP |
| 模拟/电气 | ADC acquisition/参考/校准、引脚/电平、输出复位态 | 默认 3.3V/5V tolerance、统一 ADC 换算 |
| Flash/安全域 | 擦写/RWW、XIP、选项字节、TrustZone/访问权限 | 代码在 RAM 但调用/常量仍来自被阻塞 Flash |
| 协同 | 多核/无线栈/共享外设/缓存与重置代次 | 临界区只关本核 IRQ却认为跨核互斥 |

`FAM-02` 必须：先匹配应用笔记的明确器件和版本范围，再采用操作序列；“同厂”“同核”“同引脚”不是依据。勘误有触发条件与 workaround 版本，不能跨系列复制。

`FAM-03` 必须：迁移输出 source→target 差异、影响文件、需要验证的配置/软件/实板项。所有“已支持”的措辞注明等级：已提供规则路由 / 已宿主测试 / 已交叉编译 / 已目标板验证。当前系列资料只代表前一等级。

## 与自动化的边界

`scripts/data/families.json` 只存系列识别模式和参考位置，不存未经验证的寄存器、内存大小、默认 cache line 或芯片能力表。出现候选时按此文审查；未识别时继续通用 C/资源规则，依赖特定硬件的实现暂停猜测。
