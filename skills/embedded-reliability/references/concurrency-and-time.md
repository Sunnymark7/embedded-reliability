# 并发、中断、时序与实时性

## 上下文表

修改共享状态前写出访问者：进程/线程、硬 IRQ、threaded IRQ、softirq、workqueue、RTOS 任务、ISR、DMA。记录能否睡眠、优先级、CPU 核、保护机制与锁顺序；不要只写“线程安全”。

`CON-01` 必须：每份可变共享数据有同步策略和对象寿命策略。`volatile` 既不保证原子性、顺序，也不建立线程间 happens-before。MMIO 的 volatile 访问是另一问题，Linux 应走 I/O accessor。[CERT CON02-C](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/recommendations/concurrency-con/con02-c/)、[Linux volatile 说明](https://cdn.kernel.org/doc/html/latest/process/volatile-considered-harmful.html)

`CON-02` 必须：不能混用内核原子/锁与用户态 C/C++ 原子模型。`READ_ONCE/WRITE_ONCE` 不自动提供所有排序或对象寿命保障。选择成熟锁或队列；只有测量证明需要时才自行实现 lock-free，并说明发布/获取配对及内存回收。[Linux memory barriers](https://docs.kernel.org/core-api/wrappers/memory-barriers.html)

`CON-03` 必须：硬 IRQ/不允许睡眠的上下文不等待 mutex、普通阻塞 I/O 或常规分配。Linux 根据上下文和 PREEMPT_RT 选锁；不能把“spinlock 永不睡眠”当所有配置的事实。不能随意把 `spinlock_t` 换 `raw_spinlock_t`。关本核中断不保护其他核。[Lock types](https://docs.kernel.org/locking/locktypes.html)

`CON-04` 必须：RTOS 的 ISR 只用目标明确允许的 ISR API，并核对中断优先级上限；FreeRTOS `FromISR` 名称不代表任意 IRQ 优先级都可调用。mutex 不用于 ISR。退出临界区恢复先前中断状态，不能无条件重新使能。[FreeRTOS ISR 临界区](https://www.freertos.org/Documentation/02-Kernel/04-API-references/04-RTOS-kernel-control/02-taskENTER_CRITICAL_FROM_ISR_taskEXIT_CRITICAL_FROM_ISR)、[Mutex](https://freertos.org/Real-time-embedded-RTOS-mutexes.html)

`CON-05` 必须：锁有全局一致顺序；持锁区域尽量短，不调用未知回调/不受控阻塞；避免持有工作自身所需锁做 join、flush 或 cancel-sync。回调内释放、重新提交、关闭设备的行为要定义。

## 队列、环形缓冲和唤醒

`CON-06` 必须：明确 SPSC/MPSC/MPMC、容量、满队列策略、数据所有权、生产/消费边界。SPSC 算法不能未经证明扩展到多生产者。事件通知和数据发布有正确顺序；条件变量用谓词循环，处理虚假唤醒与取消，不能把一次通知等同于一次数据。

队列容量可先按 `突发样本数 + 峰值速率 × 最长不可消费时间` 估算，再用实测和边界分析修正；需考虑服务速率不足导致长期积压。满时选择丢最旧/最新、反压或停止采集，并记录丢失计数。无界队列不解决吞吐不足。

`CON-07` 必须：停止不是布尔变量赋值结束。建立拒绝新工作、唤醒等待者、取消/完成进行中工作、join/drain、最后释放的协议。超时意味着尚未证实停止，不意味着可以释放仍被引用的对象。

## 超时与时间戳

`TIM-01` 必须：持续时长使用单调时钟；决定 suspend 时间是否应计入，再在 Linux 中选择 `CLOCK_MONOTONIC` 或 `CLOCK_BOOTTIME` 等。墙钟用于人类时间，不用于抗校时的超时判断。[clock_gettime](https://man7.org/linux/man-pages/man2/clock_gettime.2.html)

`TIM-02` 必须：重试/短传输共用总截止期，不能每次 EINTR 或部分成功都重新获得完整 timeout。tick/ns/ms 转换做范围与舍入处理；剩余不足一个 tick 不应意外变无限等待。CPU 调度导致的超时超调需纳入需求。

`TIM-03` 必须：MCU unsigned tick 差值法只有在回绕宽度、采样间隔和比较算法成立时使用；区间必须小于相应可判定范围。带符号差值技巧依赖实现/范围，不能不说明地跨平台复制。测试回绕附近和长时间暂停。

`TIM-04` 必须：采集时间、接收时间和处理时间分开。跨处理器的时间戳带时钟域/同步误差，不能直接相减；建立同步/漂移模型或只报告各自域内时延。

## Linux 用户态与实时路径

`USR-01` 必须：read/write 处理短传输、EINTR、EAGAIN 和断开；具体设备/消息语义不同，不能对所有 fd 套字节流补齐循环。poll 就绪也可能只允许部分传输；处理 HUP/ERR/NVAL，避免忙轮询。[read](https://man7.org/linux/man-pages/man2/read.2.html)、[write](https://man7.org/linux/man-pages/man2/write.2.html)、[poll](https://man7.org/linux/man-pages/man2/poll.2.html)

`USR-02` 必须：signal handler 只做 async-signal-safe 操作；不能 malloc/printf/锁普通 mutex。优先按架构使用 sigwait/signalfd 或最小通知。Linux `close()` 出错后不机械重试，以免关闭已复用 fd；跨 POSIX 平台查各自语义。[signal-safety](https://man7.org/linux/man-pages/man7/signal-safety.7.html)、[close](https://man7.org/linux/man-pages/man2/close.2.html)

`RT-01` 配置项：实时路径是否允许分配、page fault、文件系统、日志、锁、系统调用及其预算。Linux 高优先级线程、mlock 或 PREEMPT_RT 不是自动硬实时保证；调度策略、IRQ 负载、优先级反转和平台延迟要实测。修改调度/IRQ 亲和性必须有需求依据，不能盲目加最高优先级。

验证场景：并发启停、回调重入、超时与取消交错、生产快于消费、设备重置、32 位读取 64 位计数、tick 回绕、suspend 与截止期；使用平台对应 race/lock 检测，而非只看输出顺序。
