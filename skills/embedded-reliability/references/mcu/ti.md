# TI：MSP430、MSPM0 与 C2000 数据模型不能混用

| 路线 | 必须核验 |
| --- | --- |
| MSP430 | 16 位/扩展地址模型、指针宽度、ISR 属性、FRAM/Flash 写入和低功耗唤醒；32 位共享访问不能假设单指令原子 |
| MSPM0 | 目标 Arm 内核、NVIC/RTOS port、SysConfig 与 DriverLib 版本、DMA/时钟/低功耗；不能复用 MSP430 ISR/地址模型 |
| C2000 F28x | C28x 字节宽度/ABI、CLA/其他 C28x/CM、共享 RAM 所有权、ADC SOC/ePWM 触发链、Flash 时序；不是普通 Cortex-M 移植 |

C28x 编译器的 C byte 为 16 bit，`CHAR_BIT`、`sizeof` 与 wire octet 不能混同；`uint8_t` 不一定存在。不能把 `uint_least8_t` 当恰好 8 bit。便携协议应使用明确 0..255 的 octet 语义与目标专用 pack/unpack，逐 octet 传输并核对访问 intrinsic/外设宽度；本技能的 `uint8_t` C11 示例**仅适用 CHAR_BIT=8 的目标，不是 C28x 适配代码**。

CLA 与 C28x 数据类型/指针可能不同；共享结构布局、padding、链接段、消息 RAM 与中断/握手需两端检查，不能把 C28x 指针直接传给 CLA/CM。缓存/顺序/原子性按各处理单元与总线而非“TI MCU”统一处理。

控制场景检查 ADC 采样窗口、PWM shadow update、同步/相位、故障 trip 和启动输出；软件线程活着不证明控制循环准时。配置 ePWM/Flash/保护寄存器需具体 part TRM/errata，不能从例程推断安全输出。

来源：[C28x language implementation](https://downloads.ti.com/docs/esd/SPRU514I/Content/SPRU514I_HTML/tms320c28x_c_c_language_implementation.html)、[C2000 CLA FAQ](https://software-dl.ti.com/C2000/docs/cla_software_dev_guide/faq.html)、[F2838x memory accessibility](https://software-dl.ti.com/C2000/docs/C2000_Multicore_Development_User_Guide/memories.html)。后者只用于对应产品内存域实例；MSP430/MSPM0 此处为核验清单，实际实现必须补各自用户指南与工具链依据。
