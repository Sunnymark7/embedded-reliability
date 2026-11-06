# STM32：必须细分到子线与 revision

本参考是审查规则，不是所有 STM32 的统一能力表。F/G/L/H/U 等命名不直接证明内核、cache、DMA 实例、存储容量或某个 IP 版本；完整 part 和官方参考手册先于系列经验。

| 分组 | 设计检查 | 禁止的推导 |
| --- | --- | --- |
| F0/F1/F3/F4、G0/G4、L0/L4 等 | 确认内核/RTOS port、APB timer 时钟、DMA 请求/路由、ADC 触发/校准与 Flash RWW；低功耗后时钟/引脚恢复 | 按一张 F1 示例初始化所有型号；把 Flash accelerator/prefetch 当通用 D-cache |
| F7、经典 H7 M7 子线 | 用 bus matrix 确认 DMA master→buffer 通路，TCM/AXI/AHB 区域与 linker/map；cache/MPU 与首尾 cache line 隔离 | 所有 SRAM/TCM 都能被任意 DMA 访问；所有 H7 都相同 |
| H745/755、H747/757 双核 | 分核启动/镜像/内存、共享缓冲、硬件信号量/IPC、发布顺序、M7 cache、重置同步 | 本核关 IRQ 或 HSEM 直接等同数据已同步到另一核 |
| L5/U5/H5 等安全域型号 | 按 SKU 确认 SAU/IDAU/厂商安全控制、secure/nonsecure 外设/DMA/IRQ、跨域指针与 gateway；核实 cache/GPDMA/低功耗差异 | 所有 M33 都启用 TrustZone；U5 与 H5 配置完全相同 |
| 新 H7RS/N6/其他未覆盖子线 | 先取得对应 RM、errata、SDK 和内存/cache 文档，再补专项规则 | 把经典 H743 的 cache/TCM/DMA 规则直接用于新子线 |

具体修改前核验：CubeMX `.ioc` 的 part 与编译宏/启动文件/linker 一致；生成器所有权；HAL tick 在启动/ISR/低功耗仍有效；NVIC 优先级分组与 RTOS 可调用区；DMA 接收半满/满/idle/错误的竞态；W1C/read-clear 清状态顺序。`HAL_OK` 不能被当作线已发空或 DMA cache 已同步。

ADC 依据手册检查 regulator/校准、单端/差分、采样时间、通道切换、oversampling、数据对齐和参考源；不能统一选择分母或 Vref。Flash 擦写期间中断、常量和函数依赖都需可访问，不能只给入口加 RAM section。

交付证据：完整目标、RM/errata 修订、内存可达性表、map 中 DMA buffer 位置、IRQ/回调所有权图、适用的 cache/DMA、双核和低功耗回归。未确认这些时只能输出待核对项，不能宣称驱动已适配所有 STM32。

来源与限制：

- [ST AN4839](https://www.st.com/resource/en/application_note/an4839-level-1-cache-on-stm32f7-series-and-stm32h7-series-stmicroelectronics.pdf)：F7/H7 的 L1 cache 应用实例，不能覆盖所有后续子线。
- [ST AN5617](https://www.st.com/resource/en/application_note/an5617-stm32h745755-and-stm32h747757-lines-interprocessor-communications-stmicroelectronics.pdf)：明确用于 H745/755、H747/757 的双核通信。
- [ST AN5347 页面](https://www.st.com/content/st_com/en/technical-documents/an5347-introduction-to-arm-trustzone-features-on-stm32l5-stm32u5-and-stm32u3-mcus-stmicroelectronics_asset/chunk-002-topic-an5347-stm32l5-series-security-configurations.html)：L5/U5/U3 安全分区；不能代替 H5 手册。
- [ST Memory Management Tool 指南](https://wiki.st.com/stm32mcu/wiki/Getting_started_with_MMT)：部分支持型号的内存/安全上下文入口。

以上为来源支持的设计核对点；数值与 API 要查本项目对应文档/头文件，不在此硬编码默认值。
