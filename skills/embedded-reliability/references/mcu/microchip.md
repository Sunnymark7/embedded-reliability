# Microchip：AVR/PIC/dsPIC/SAM 分开审查

厂商名不能确定内核与内存模型。AVR/PIC 的程序/数据空间和编译器扩展，与 SAM Arm 或其他 PIC 架构不能套同一指针/ISR/DMA 规则。

设计检查：

- 8 位 AVR/PIC 上多字节变量可被 ISR 打断，`volatile uint16_t` 不保证原子快照；读-改-写即使对单字节也可能竞争。使用目标原子/临界区机制，恢复进入前中断状态，并核对多核/其他 master 是否存在。
- Flash 常量读取、program memory 地址、near/far 指针、banked memory 和链接模型按具体编译器/part；不能直接把任意常量地址交给只读数据 RAM 的 DMA。
- PIC16/PIC18、PIC24/dsPIC、PIC32 与 SAM 是不同架构/工具链路线；函数指针、中断修饰、上下文保存、C byte/整数宽度与移位规则先确认。
- SAM D/E 等目标的 DMAC descriptor 对齐、SRAM 可达性、cache 与总线安全属性逐 part 查证；不能声称所有 SAM 有 D-cache，也不能套 STM32 HAL。
- NVM 自编程核对写保护、擦写单元、时钟/电压、RWW 和 ISR/代码执行依赖；fuse/配置位修改可能改变启动/调试，不能在普通编码任务中顺手烧写。
- ADC acquisition、源阻抗、参考与通道切换按目标数据手册计算；不要以平均滤波掩盖未建立的输入。

证据：完整 part、编译器与内存模型、ISR/共享变量访问反汇编或目标原子 API、NVM/ADC 手册和边界验证。没有目标只列待核对项。

来源：[Microchip AVR volatile qualifier](https://onlinedocs.microchip.com/oxy/GUID-BD1C16C8-7FA3-4D73-A4BE-241EE05EF592-en-US-9/GUID-5E98DCA8-1CE9-4ED8-BF47-CDE5540BFB24.html)、[PIC ISR shared data](https://onlinedocs.microchip.com/oxy/GUID-BB433107-FD4E-4D28-BB58-9D4A58955B1A-en-US-9/GUID-765B5807-91BF-43B9-B1C1-C08DA2C69A3A.html)、[ADC acquisition](https://developerhelp.microchip.com/xwiki/bin/view/products/data-converters/adc-specs/acquisition-time/)。这些文档不涵盖每一 SAM/PIC 子线；必须取得目标手册再实现。
