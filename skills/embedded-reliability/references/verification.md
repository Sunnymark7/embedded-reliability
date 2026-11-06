# 验证与交付

`VER-01` 必须：验证选择与 profile 和本次风险匹配。已有门禁必须运行；先复现和记录基线，再验证改动。未找到工具链/板卡时说明缺口，不伪造命令、报告或通过状态。

## 构建与静态检查

| Profile | 基线 | 按风险选用 |
| --- | --- | --- |
| linux-kernel | 目标树 Kbuild、目标 config/架构、相关告警 | `checkpatch.pl`、sparse（`C=1`）、Smatch、binding/DT 检查、不同相关配置 |
| linux-user / portable-core | 项目构建、交叉构建及正确 sysroot、已有格式门禁 | 编译器告警、clang-tidy/分析器、ASan/UBSan、独立 TSan 构建、解析器 fuzz |
| mcu-rtos | 目标 SDK 编译与链接、map/段和内存用量 | 栈分析、RTOS assert/栈水位、静态分析、看门狗/故障注入、HIL |

内核测试区分验证内部逻辑的 KUnit 与验证对外行为的 kselftest；内核动态检查可按配置选择 KASAN、KCSAN、UBSAN、lockdep、kmemleak。工具适用性和执行成本按目标决定。[Kernel Testing Guide](https://docs.kernel.org/dev-tools/testing-overview.html)

新便携 C/GCC 模块可评估 `-Wall -Wextra -Wconversion -Wsign-conversion -Wshadow -Wformat=2 -Wstrict-prototypes -Wmissing-prototypes -Wundef`；支持时加 `-Wcast-align=strict`。C++ 不使用 C 专属告警。先查当前工具链支持，项目已有告警优先；不能把这组 flags 加到内核/厂商代码整个构建。[GCC Warning Options](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html)

`VER-02` 必须：告警处理定位根因，不用全局 `-w`、大量强转或通配 suppress。存量问题可建立经解释的基线，本次改动不新增相关高风险项。MISRA 分析报告必须标明版本、工具覆盖、人工检查和偏离，不能把某个开源扫描器结果写成“完整符合”。

## 行为与边界

`VER-03` 必须：功能涉及内存、解析或生命周期时，验证可观察的不变量，不只匹配代码写法。

| 变化 | 必要的相关场景 | 验收证据 |
| --- | --- | --- |
| 字节解析/编解码 | 黄金向量、每个截断长度、最大/超限、未知类型、损坏、无效输出不提交 | 宿主测试、适用 sanitizer/fuzz |
| 分配/释放/异步 | 获取阶段失败、取消/超时、晚回调、多次停止、资源耗尽 | 分析结果、故障注入与泄漏检查 |
| 共享状态/队列 | 并发启停、满队列、丢唤醒、竞争、回绕 | race/lock 检测、压力测试和计数 |
| 驱动/DMA/PM | probe 失败、解绑重绑、suspend/resume、离线、非一致缓存条件 | 目标内核日志、HIL、资源/数据校验 |
| ADC/通信时序 | 精度/带宽、丢样/帧、边界时序、断线恢复、输出安全态 | 波形、仪器条件、原始数据与预算 |

ASan/UBSan 仅支持的运行环境使用；TSan 通常单独构建，不和 ASan 混拼。宿主工具不证明目标 MMIO、DMA 或电气正确。原生端序的往返测试也不能替代协议黄金字节向量。[Clang ASan](https://clang.llvm.org/docs/AddressSanitizer.html)

`VER-04` 必须：涉及持久化配置/升级时，在项目范围内验证校验/版本、掉电恢复、原子替换及回滚；Linux write/close 成功不等于数据已持久化。不要在真实设备上未经任务授权烧录、擦除、刷固件或测试危险执行器。

## 示例包的验证

示例是 12 字节自定义演示帧：`A5 5A | version=1 | kind | payload_len_le16=4 | payload(4) | crc_le16`。CRC 为 CRC-16/CCITT-FALSE，poly `0x1021`、init `0xFFFF`、refin/refout false、xorout `0x0000`，覆盖前 10 字节；标准字符串 `123456789` 的 check 为 `0x29B1`。它不代表任何设备标准，也不包含鉴权/流缓存/重试。

在复制出的 `assets/examples` 目录，用项目现有工具链执行。GCC 示例：

```sh
cc -std=c11 -Wall -Wextra -Wconversion -Wsign-conversion -Wshadow -Werror frame_codec.c test_frame_codec.c -o test_frame_codec
./test_frame_codec
```

支持 sanitizer 的主机可单独运行：

```sh
clang -std=c11 -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer frame_codec.c test_frame_codec.c -o test_frame_codec_san
./test_frame_codec_san
```

MSVC Developer Command Prompt：

```bat
cl /nologo /std:c11 /W4 /WX frame_codec.c test_frame_codec.c /Fe:test_frame_codec.exe
test_frame_codec.exe
```

示例 API 要求所有指针指向足够大小的有效对象；输入对象、字节缓冲、输出对象和 written 输出彼此不重叠。调用者负责该前置条件，NULL/长度校验不能判断任意地址是否有效。成功才提交输出，失败时保持输出内容。测试覆盖 CRC check、独立黄金帧、两种 tag、所有短长度、超长/坏头/版本/类型/长度/CRC、NULL、每位翻转、输出不变及固定种子随机输入。

## 交付格式

记录实际执行的命令、工具/目标版本、结果和关键工件（测试报告、map、波形）。状态只能是通过、失败、未执行、不适用；未执行必须附原因和剩余验收动作。预算和风险结论必须区分实测、静态上界、估算、假设。格式检查和技能结构校验不能代替固件验证。
