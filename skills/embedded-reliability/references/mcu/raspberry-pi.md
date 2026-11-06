# RP2040 / RP2350：XIP、多核、PIO 与 stepping

先确认 RP 芯片、开发板和 Flash 型号、SDK commit、RP2350 所选架构和 silicon stepping。不能把树莓派 Linux SBC 与 RP MCU 混用，也不根据 Pico/Pico 2 的商品名猜全部硬件连接。

设计检查：

- Flash XIP 与擦写期间其他核、ISR、向量、常量和 helper 的访问协调；使用目标 SDK 的安全方案，并核对第二核是否已参与约定。只将单个函数放 RAM 不证明调用闭包安全。
- 多核 FIFO、spinlock、共享内存和 DMA 的数据所有权分别定义；禁本核 IRQ 不保护另一个核。避免在对端永远不能运行的情形无限等待 FIFO/lockout。
- PIO 程序记录时钟分频、状态机/指令存储/FIFO 资源、pin mapping、shift 方向、DMA DREQ 与 underrun/overrun；PIO 不是无限吞吐或免费精确定时。
- RP2040 与 RP2350 的 PIO、DMA、访问权限与启动/安全差异以 SDK/目标手册为准，不直接复制寄存器布局。RP2350 的 Arm/RISC-V 选择影响编译器、异常/IRQ 与同步代码。
- 依据实际 stepping 查 errata；不能把某个已修复的 GPIO/ADC 问题无条件应用到所有批次，也不能因型号相同忽略板卡上的旧修订。

证据：SDK target、实际 revision、Flash 操作与双核并发回归、PIO/DMA 极限负载和外部波形、ADC 校准/边界。系列参考不是实板验证。

来源：[RP2040 datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)、[RP2350 文档入口](https://pip.raspberrypi.com/categories/1214-rp2350)、[Pico SDK hardware API](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html)、[官方 RP2350 A4 修订说明](https://www.raspberrypi.com/news/rp2350-a4-rp2354-and-a-new-hacking-challenge/)。RP2350 完整 PDF 本次在线读取遇体积限制，不能声称已逐页审查；实现前取得对应版本手册。
