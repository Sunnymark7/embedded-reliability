# Nordic：EasyDMA 与无线/多核资源契约

nRF52、nRF53、nRF54 不按同一外设表、内核或 SDK 处理。确认完整 part/revision、板型、nRF Connect SDK/Zephyr commit、或明确使用旧 nRF5 SDK/SoftDevice；不能混用两套调度/IRQ/driver 约定。

设计检查：

- 对 EasyDMA 外设确认 buffer 是否位于其可达 RAM、地址对齐、最大传输计数与有效期；`const` 数组可能被放在 Flash，不能默认可直接 DMA。驱动若使用 bounce buffer，检查其容量和复制时机。
- nRF5340 应区分应用核与网络核的镜像、RAM/外设权限、IPC、启动/复位次序；共享数据有序列化/寿命与复位代次，不跨核共享进程指针假设。
- 无线栈占用的 timer、IRQ、时钟与优先级必须按实际 SDK/控制器配置确定；不能私自抢占协议栈资源。
- nRF54 各子线的处理器、EasyDMA/缓存/存储权限与外设连接必须重新核对；不以 nRF5340 文档推导 nRF54 的实现。
- 定时采样/通信需要时使用目标支持的硬件事件链，但 PPI/DPPI 的可用实例与语义按目标，不手写跨型号通用寄存器。
- SAADC 参考/增益、acquisition、校准、过量程和 buffer 有效性按器件；低功耗含 RAM 保留、时钟源和外设 stop 的真实完成条件。

证据：EasyDMA pointer 所在区及实际 linker/map，提交/完成/stop 时序、无线负载/低功耗与多核恢复回归。

来源：[nRF5340 EasyDMA](https://docs.nordicsemi.com/r/bundle/ps_nrf5340/page/easydma.html)、[nRF5340 Product Specification](https://infocenter.nordicsemi.com/pdf/nRF5340_PS_v1.0.pdf)、[Nordic Academy nRF54L EasyDMA](https://academy.nordicsemi.com/courses/designing-low-power-bluetooth-le-products/lessons/lesson-6-soc-specific-power-optimization-ii/topic/direct-access-memory-easydma/)。旧版 PDF 只作已核验背景，项目实施需目标 revision 的规范与 errata。
