# MCU 设计审查与验证报告

日期：2026-11-06。审查对象是此前通用版技能和本次新增自动化，不是一个已连接的硬件产品。

## 审查结果与已实施修正

| 原有缺口 | 影响 | 本次修正 |
| --- | --- | --- |
| MCU 规则主要停留在通用 HAL/DMA/缓存检查 | AI 易把相同厂商/内核当相同芯片能力 | 新增精确型号/硅修订审核表，按 9 个系列路由到 8 份专项文档，未知型号不套最近模板 |
| 示例的 C11/uint8_t 使用边界不够显眼 | C28x 等非 8-bit C byte 平台不能直接复用 | TI 专题与数值规则显式区分 C byte/octet；示例保留 CHAR_BIT=8 断言 |
| STM32 H7、ESP32、nRF 等子线差异缺乏落点 | DMA 内存域、cache、双核、安全域与 SDK 规则混用 | 给出对应系列/子线审查点和一手来源范围，不填伪造统一数值 |
| 自动匹配 policy 仅依赖默认值，缺少发现流程 | 普通固件功能可能没有加载相关规范 | 精简目标明确的 description，显式 implicit policy，context/路由/底线串联 |
| 无编辑反馈与可复核工具 | 只能依赖模型一次记住全部规范 | 实现只读 context/doctor/detect、可选 hook，提供行为测试 |
| 缺少安装/运行/信任边界说明 | 容易把“有 hook 文件”误报为“已运行且强制安全” | 文档和工具分别报告注册、信任未知、词法检查及目标硬件验证范围 |

这些是规范覆盖与工作流缺口，不能直接等同于发现了某个产品固件漏洞。

## MCU 证据范围

- STM32：核对 ST cache、指定双核 IPC、安全分区资料；不声称审查全部 H7RS/N6 或所有 SKU。
- Espressif：核对经典 ESP32 interrupt 与 ESP32-S3 external RAM 官方文档；实际 IDF 版本/target 决定能力，C/H/P 子线按需补查。
- NXP：AN12042 的 RT1050 示例和 LPC55Sxx 安全资料；Kinetis/MCX 为查证入口。
- Nordic：nRF5340 EasyDMA/产品规范及 nRF54L 官方培训；不将其当全部 nRF 子线适配表。
- RP：RP2040 手册、RP2350 官方索引/修订说明；RP2350 PDF 在线读取遇大小限制，明确没有逐页审查。
- TI：核对 C28x 语言模型、CLA 类型与 F2838x 内存访问资料；MSP430/MSPM0 保留目标手册核验要求。
- Microchip：核对 AVR volatile 与 PIC ISR shared data、ADC acquisition；SAM/PIC 各子线仍需目标 RM。
- GD32/CH32/Renesas：核验官方产品/生态入口；CH32 正文动态加载，未取得全部 RM。只提供识别/查证，不能称逐寄存器验证完成。

所有系列都是“有规则路由与核验要求”，不是“全部芯片已跑过”。

## 可运行验证

本地 Node 标准库行为测试覆盖 9 个系列的构建线索、Kconfig 宏内嵌型号、未知目标、Web 误触发、混合仓库组件选择、Linux kernel/user 分离、越根/符号链接、扫描截断与第三方目录、词法检测及注释/字符串、CLI 返回状态、prompt 与编辑事件、隐私不回显、hook 合并幂等/备份与其他 handler 保留。

运行 `node --test tests/tooling.test.mjs`：当前本地 33 项通过，0 失败，0 跳过。真实测试发现并修正了 `CONFIG_SOC_NRF5340_CPUAPP` 在下划线后的匹配问题，并添加 STM32/NXP 同类宏回归。

运行 `node scripts/validate.mjs`：校验 UTF-8、技能 frontmatter/implicit policy、相对链接、全部参考可达性、系列路由、规则定义唯一性。官方 skill-creator quick_validate 另行用于技能结构检查。

协议示例保留前次的严格 MSVC C11 与 AddressSanitizer 验证（每次 65,362 项断言，含各 10,000 次往返/随机输入）。本次 CI 额外配置 GCC/Clang 的严格构建与 ASan/UBSan，CI 是否已运行以 GitHub run 为准，不把工作流配置当通过结果。

## 自动触发验证边界

测试运行的是脚本函数及真实 CLI 进程的模拟 hook payload，不是另一个模型的隐式选择评测，也不是实际 Codex 会话触发回放。`allow_implicit_invocation` 和 hook JSON 可验证；模型选中率、宿主信任与真实执行仍需在实际会话观察。当前技能不声称阻断所有 Bash/MCP 写入。

## 未执行

未执行各 MCU 的目标交叉编译、烧录/实板/HIL、模拟/数字信号波形、真实 cache/DMA/低功耗/双核验收；未对所有芯片获取完整最新 RM/errata；未进行完整 MISRA/功能安全符合性评估。遇到这些任务时必须补具体工程证据和对应验证。
