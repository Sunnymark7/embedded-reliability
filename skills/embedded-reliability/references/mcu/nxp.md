# NXP：i.MX RT、LPC55 与其他线分开

i.MX RT 是本技能的 MCU 路由；i.MX 6/8/9 等 Linux MPU 应优先进入 Linux profile，不能被 `i.MX` 一词归成同一 MCU。

设计检查：

- i.MX RT 逐 part 核对 FlexRAM/TCM/OCRAM、DMA master 和外部内存通路；SDK 的 cache maintenance 是否已做，避免应用和 SDK 双重维护；非缓存段的链接地址、MPU 属性必须与名称一致。
- XIP Flash 操作审查代码、ISR、vector、literal、helper 与其他核的执行位置/访问；禁 cache 不是通用并发方案。
- 新旧 RT 子线的单/多核、cache/TCM 和外设差异按手册；不把 AN12042 的 RT1050 示例认作所有 RT 的参数表。
- LPC55Sxx 按 SKU 核对安全域、CPU/协处理器、DMA 权限、向量与启动。具有 TrustZone 相关功能不等于项目已经正确划分安全世界；外部传入指针和长度也须验证。
- Kinetis、MCX 等这里只提供发现与核验流程；使用对应 SDK pack、startup、linker 与 RM。不能从 NXP 厂商名推导与 LPC/i.MX RT 相同实现。
- pinmux、时钟和低功耗恢复由实际 board/SDK 生成配置确定；FSL/MCUXpresso driver API 以目标版本签名为准。

证据：part/SDK、linker+map、cache/MPU 与 DMA buffer 生命周期、XIP/低功耗边界测试、secure/nonsecure 构建与接口测试。未具备目标工具链时标未验证。

来源：[NXP AN12042](https://www.nxp.com/docs/en/application-note/AN12042.pdf)（RT1050 示例范围）；[NXP AN12278](https://www.nxp.com/docs/en/application-note/AN12278.pdf)（LPC55Sxx 安全差异）。
