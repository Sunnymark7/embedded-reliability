# GD32 / CH32 / Renesas 及未覆盖目标

此参考提供查证入口与风险清单，**不声称完成全部型号硬件能力核验**。

## GD32

按完整系列区分 Arm 与 RISC-V，核验启动文件、编译器 ISA/ABI、中断控制器/嵌套、RTOS port、时钟树、DMA 与外设实例。不可因为引脚/寄存器名称近似就复制 STM32 驱动；状态位、Flash、ADC、时钟/电气和 errata 重新核对。GD32VF103 识别不能推导所有 GD32 系列都是 RISC-V。

来源：[GigaDevice GD32VF103 产品与文档入口](https://www.gigadevice.com/product/mcu/main-stream-mcus/gd32vf103-series)。本次核验产品/文档索引，未逐页取得该系列所有 RM/errata；具体中断寄存器和行为不能只依本入口生成。

## CH32

区分 CH32F 与 CH32V，不把 RISC-V interrupt controller 当 NVIC；QingKe 核版本、fast interrupt ABI、硬件压栈、编译器扩展和 RTOS port 必须来自目标官方 SDK/处理器手册。不要把一个标准 RISC-V ISR prologue 与厂商 fast-interrupt 属性混拼；不能按 CH32V307 推导 CH32V003/V203。

来源：[WCH CH32V307 官方入口](https://www.wch-ic.com/products/CH32V307.html)。本次站点正文依赖 JavaScript，未取得完整 RM 内容；上述为必须查证的维度，不是已确认所有型号的能力。无本地官方包时停止猜具体寄存器/中断实现。

## Renesas RA / RX

RA 的 FSP/生成配置、目标 Arm 内核、安全域和 driver API 按工程版本确认；RX 不是 RA Arm，工具链/ISA、ISR、字节序配置、DTC/DMAC 和内存访问按目标硬件手册查证。不要把 DTC 与任意 DMA 控制器等同，不把 RA FSP 接口用于 RX。兼容性与 read/write/abort/callback 时机都要实测或同版本契约支持。

来源：[Renesas RA FSP](https://www.renesas.com/en/software-tool/ra-flexible-software-package-fsp)。本次确认软件生态入口，没有逐型号 RX/RA 适配证明。

## 其他 MCU（含 8051、国产替代、专用 DSP）

保留系列未知状态。从编译定义、启动/链接脚本、pack/SDK 和板级 part 提取证据；核验 C byte、memory space、指针/函数指针、ISR ABI、DMA/缓存与外设副作用。新增系列时应补来源、识别 fixture 和边界说明，再称“具有规则路由”。检测器命中单词不能自动扩展能力表。
