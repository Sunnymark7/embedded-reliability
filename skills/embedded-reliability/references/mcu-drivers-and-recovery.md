# MCU 驱动与系统恢复

用于 `mcu-rtos`，以及 Linux/MCU 协同系统的失联和恢复设计。Linux 驱动部分仍按 [Linux 驱动](linux-drivers.md)；不可在 MCU 直接使用内核 DMA API。

## 驱动分层与状态

`MCU-01` 必须：区分板级引脚/时钟/供电、总线控制器、芯片设备驱动、采集/通信服务和产品策略。优先复用 SDK 已验证的 HAL/LL；只有真实需求才绕过 HAL，记录受影响初始化、并发、回调和升级兼容性。中断向量/生成文件按工程机制接入，不直接重写生成器管理区域。

`MCU-02` 必须：外设初始化有正确供电/复位/时钟/pinmux 顺序和失败回退；未 ready 不对外开放 API。多实例通过显式 context 管理，不用一个全局句柄暗中绑定所有器件。芯片寄存器读写与总线实例分开，纯解码逻辑可宿主测试。

`MCU-03` 必须：轮询等待硬件 ready、FIFO、校准、DMA 完成时有真实时钟和总上限；确认该时钟在当前启动/关中断上下文确实运行。依赖 SysTick 的 timeout 在其不递增时可能失效。不能在 ISR 或关中断区调用依赖同级/更低优先级中断推进的阻塞 API。

`MCU-04` 必须：明确 init/idle/busy/error/stopping 等实际状态，防止并发启动同一通道、重置与回调竞态。ISR 记录必要状态并唤醒任务；错误回调也必须归还缓冲/终结事务。SDK 回调签名与调用上下文以目标版本为准。

## DMA、缓存与内存域

`MCU-05` 必须：从具体芯片 bus matrix/内存手册确认 DMA 可达区域，不假设任意 SRAM/TCM/外部存储可访问。buffer 的链接段、对齐和实际链接地址需要 map/运行地址证据。

`MCU-06` 必须：cacheable buffer 的 DMA 读写有目标规定的 clean/invalidate、barrier、对齐和所有权协议；TX/RX 方向、DMA 前后动作分别查证。invalidate 可能丢弃同 cache line 中 CPU 的脏数据；独立缓冲需连同首尾 cache line 一起隔离，不能简单对任意地址“向外取整后 invalidate”。

`MCU-07` 必须：不能把关闭全部 cache 当通用修复。需要时选择目标支持的非缓存区/MPU 属性或正确缓存维护；验证性能与内存属性。STM32F7/H7 的示例可参考 [ST AN4839](https://www.st.com/resource/en/application_note/an4839-level-1-cache-on-stm32f7-series-and-stm32h7-series-stmicroelectronics.pdf)，但该笔记不是所有 MCU/所有 H7 型号和 SDK 的统一动作序列；仍查目标编程手册、errata 与 SDK。

## 故障、看门狗与恢复

`REC-01` 必须：故障按设备、服务、进程/任务、系统层隔离；先定义可恢复、降级、停机/复位条件与最大恢复时间。重启不能覆盖根因证据；保留有界的复位原因、错误计数、最近状态和必要日志。

`REC-02` 必须：看门狗由实际健康/进展驱动，不能在无条件定时器中永远喂狗掩盖任务卡死。确认超时、窗口、低功耗、debug halt、bootloader 到应用交接及复位后的输出态。Linux 看门狗的 close/nowayout 行为依驱动与配置，不能假设关闭 fd 就停用。[Linux watchdog API](https://docs.kernel.org/watchdog/watchdog-api.html)

`REC-03` 必须：Linux↔MCU 的 heartbeat 携带身份/会话或复位代次，并区分进程活着、链路活着和功能有进展。失联后的输出策略来自产品要求；恢复时不能自动重放未确认的有副作用命令。

`REC-04` 必须：涉及 Flash/NVM 时确认擦写粒度、寿命、供电要求、读写执行限制和掉电窗口。配置有版本、长度和校验，更新具有可恢复提交点或双副本策略；不把 RAM 中结构体直接落盘。若任务不涉及存储/升级，不为此新增复杂 OTA 框架。

`REC-05` 必须：故障处理路径本身有界；崩溃/ISR 中不做可能死锁的分配和大量日志。Linux 进程退出/设备断开释放资源要处理并发线程；MCU fault 信息保存需符合架构、栈有效性与上下文限制，不由 AI 猜异常栈布局。

验证按当前需求选择断线、单模块超时、队列耗尽、任务停滞、重启代次、看门狗复位或安全范围内掉电；只有明确任务授权并具备合适台架时执行真实复位/掉电/刷写动作。可先做模拟故障与纯逻辑恢复测试。
