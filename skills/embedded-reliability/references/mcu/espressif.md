# Espressif：SoC、IDF target 与版本一起确认

ESP32 家族不能当同一芯片。经典 ESP32、S2/S3 与 C/H/P 子系列的核、无线功能、PSRAM、DMA/缓存和低功耗能力需逐型号核对；检测器识别系列不授予这些能力。

设计检查：

- 从 `sdkconfig` 的 IDF target、CMake、芯片/模组 part、revision、IDF 版本取得一致证据。Arduino core 也锁定其底层 IDF/配置，不能直接套最新 IDF API。
- 区分 Xtensa 与 RISC-V 工具链/RTOS port，核数与 SMP 配置按目标确认。本核关 IRQ不形成跨核互斥；任务 affinity、共享外设与中断分配/释放的核约束按目标 API。
- `ESP_INTR_FLAG_IRAM` 是整条 ISR 调用链及其读取数据的保证；入口 `IRAM_ATTR` 不保证 helper、常量、日志、虚调用或被访问 buffer 在 Flash/cache 不可用期间安全。
- 使用目标 IDF 的 capability allocator 和具体外设 DMA 契约；普通 malloc 返回可用 CPU 内存不等于可用 DMA 内存。描述符与 payload 的放置限制分别核对。
- PSRAM 的 DMA 支持与限制是 SoC、控制器、driver 和 IDF 版本共同决定的；不能一律“禁止 PSRAM DMA”，也不能一律“PSRAM 任意 DMA 可用”。尤其 ESP32-S3 的外 RAM 规则不能回灌经典 ESP32。
- Flash erase/write、OTA、NVS 对 cache/IRQ/实时采集的影响需验证；关键日志不能自身依赖 cache-off 不可读区域。
- ADC 校准、attenuation、参考、可用通道及无线共存限制查目标；不要把经典 ESP32 的 ADC/Wi-Fi 经验推广到 S3/C 系列。睡眠后外设、DMA、RTC 时间域与队列状态按 SDK 处理。
- 模组 Flash/PSRAM 电压和引脚连接以模组/芯片数据手册为准；不根据家族名编写 eFuse、strap 或不可逆配置命令。

验证：锁定 target 的配置与构建；Flash/NVS 活动期间采集/通信回归；cache-off 路径审查；多任务启停与队列溢出；睡眠/重启代次。硬件动作需任务授权及安全台架。

来源：

- [ESP32 interrupt allocation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/intr_alloc.html)：中断核约束与 IRAM-safe 行为，需切换到项目具体版本/target。
- [ESP32-S3 external RAM](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/external-ram.html)：外 RAM 与 DMA 限制；stable 可变化，不作为已锁定 SDK。
- [ESP32 memory model](https://developer.espressif.com/blog/esp32-programmers-memory-model/)：经典芯片内存模型的背景，不是全家族能力表。

对 C5/C61/H2/P4 等这里只有识别和核验流程，未给逐外设适配实现；需要该目标时必须补查对应官方指南。
