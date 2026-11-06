# Linux 驱动设计

以目标内核头文件、同子系统驱动、binding 和硬件手册为准。这里提供设计检查点，不承诺某个 API 在所有版本存在。

## 子系统与生命周期

`DRV-01` 必须：先确认已有子系统与上游/厂商驱动：ADC/IMU 优先 IIO，CAN 优先 SocketCAN，GPIO/输入/hwmon/watchdog 等使用对应接口。新建字符设备或 ioctl 要有已有接口不足的理由；已有驱动的功能不要转为用户态 bit-banging。[IIO](https://docs.kernel.org/driver-api/iio/buffers.html)、[SocketCAN](https://docs.kernel.org/networking/can.html)、[GPIO character API](https://docs.kernel.org/userspace-api/gpio/chardev.html)

`DRV-02` 必须：probe 的每个失败点都可回退。区分 NULL、`ERR_PTR`、错误整数等返回约定；依赖未 ready 时按目标子系统传递 `-EPROBE_DEFER`。禁止将所有错误归为 `-EINVAL` 或打印后返回成功。

`DRV-03` 必须：区分自动释放与停止访问。`devm_*` 管理释放，不保证 DMA、IRQ、work、timer、用户 fd 都停止引用对象。失败和 remove 的依赖顺序需证明。[Devres](https://docs.kernel.org/driver-api/driver-model/devres.html)

拆卸设计约束：阻止新请求并发布 stopping 状态；按设备要求停止事件来源和 DMA；禁止新工作入队；等待/取消进行中的 IRQ、work、timer、传输和回调；协调子系统注销、剩余用户引用和释放。fd 可跨 remove 存活时需独立对象寿命。

`synchronize_irq()`、`cancel_work_sync()` 等不得在持有回调需要的锁时等待。release 顺序不总是 probe 的机械反转；需证明“谁还会访问谁”。

## 寄存器和总线

`DRV-04` 必须：MMIO 使用 `__iomem` 和 `readl/writel` 等接口或合适的 regmap；不当普通 RAM 解引用，不用普通 `memcpy` 访问。确认访问宽度、端序、posted write/读回需求。[设备 I/O](https://docs.kernel.org/driver-api/device-io.html)

`DRV-05` 必须：确认 reset 值、保留位、W1C/W0C/read-clear/self-clear 属性。W1C 不能随意 read-modify-write；`regmap_update_bits` 不自动解决副作用。电源关闭或 runtime suspend 时不能直接访问寄存器。

`DRV-06` 必须：I²C/SPI 操作在允许睡眠的上下文执行；硬 IRQ 只做必要且安全的确认与唤醒，耗时事务使用 threaded IRQ/工作线程。确认完成数量、错误和短传输语义。[SPI API](https://docs.kernel.org/driver-api/spi.html)

## DMA

`DMA-01` 必须：区分 CPU 虚拟地址、物理地址与 DMA 地址；用 `dma_addr_t` 和 DMA API，检查 mask 和映射失败，不能以强转或 `virt_to_phys()` 代替映射。[DMA guide](https://docs.kernel.org/core-api/dma-api-howto.html)

`DMA-02` 必须：记录分配、map 方向/长度、CPU/设备所有权转移、sync/unmap 与最后访问。streaming mapping 按 API 同步，所有权未归还 CPU 前不能随意读写。

`DMA-03` 必须：coherent 不等于有序。描述符完成后再发布有效位/doorbell，使用设备和 DMA API 所需 barrier；按完成协议取得数据。不能用 C `volatile` 或 `atomic_thread_fence()` 代替内核约定。并发写入需考虑 cache line 隔离。

`DMA-04` 必须：不能把栈、普通 `vmalloc()` 地址交给要求物理连续的 `dma_map_single()`；scatter-gather 使用对应 API，区分 map 返回段数与 unmap 原始条目数。具体限制查目标 DMA API。

## 固件描述、电源与 UAPI

`DRV-07` 必须：设备树描述硬件事实；GPIO 极性、IRQ、clock/reset/regulator、pinctrl 与手册对应。binding 变更跑目标树 `dt_binding_check`/`dtbs_check`，不随意加入 Linux 策略。[Binding schema](https://docs.kernel.org/devicetree/bindings/writing-schema.html)

`DRV-08` 必须：runtime PM 的 get/put 与成功失败路径配对；核对目标 `pm_runtime_resume_and_get()` 语义；suspend/resume 与 IRQ/DMA、regcache、运行请求协调，分别测试系统和 runtime 休眠。[Runtime PM](https://docs.kernel.org/power/runtime_pm.html)

`ABI-01` 必须：用户地址用 `copy_from_user/copy_to_user` 等接口，不直接解引用；复制可能睡眠，返回未复制字节数。先获取并验证内核快照，防止 TOCTOU；验证长度、权限、溢出及输出初始化。

`ABI-02` 必须：新增 ioctl 用正确 `_IO*` 宏和类型参数，兼顾 32/64 位；UAPI 用适当 `__u*`/`__aligned_u64`，明确保留字段、填充和兼容处理。扩展时保留旧行为，必要时新命令号，不能偷偷改变旧命令。[ioctl 设计](https://docs.kernel.org/driver-api/ioctl.html)

验证至少覆盖适用的 probe 失败、解绑/重绑、并发 I/O 与 remove、PM、设备离线。仅 insmod 成功不足以说明生命周期正确。
