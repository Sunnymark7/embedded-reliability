# 代码书写与命名

先遵守目标树/子系统和现有 `.clang-format`、`.editorconfig`。以下默认只用于新建的用户态、便携或 MCU C 模块；不能以此全树格式化历史代码。Linux kernel 的命名、缩进、头文件和类型遵从 [官方 coding style](https://www.kernel.org/doc/html/latest/process/coding-style.html)。BARR-C 用作减少歧义的风格参考，不逐项复制其历史限制。[BARR-C 介绍](https://barrgroup.com/introduction)

## 默认约定（项目可配置）

| 对象 | 默认形式 | 示例/解释 |
| --- | --- | --- |
| 文件/目录、变量、函数、字段 | `lower_snake_case` | `adc_reader.c`, `adc_read_sample` |
| 对外 API | 模块前缀 + 动作 + 对象 | `sensor_start`, `sensor_read_sample`；避免 `do_work` |
| 内部函数/对象 | 文件作用域 `static` | 不为每个局部变量加 `g_`/`s_` |
| struct/enum tag | 带模块前缀的名词 | `struct sensor_sample`, `enum sensor_state` |
| 常量宏、枚举项 | 模块前缀 + `UPPER_SNAKE_CASE` | `SENSOR_MAX_CHANNELS`, `SENSOR_STATE_READY` |
| 布尔 | 肯定式状态或谓词 | `is_ready`, `has_data`, `is_enabled`；避免双重否定 |
| 数量/单位 | 名称写明单位或物理量 | `timeout_ms`, `period_ns`, `voltage_uv`, `sample_count`, `buffer_size_bytes` |
| 指针 | 语义命名，`T *name` | 不强制匈牙利类型前缀，必要时区分 `src/dst/owner` |

新 C 便携模块建议：4 空格、K&R、100 列软上限、UTF-8、文件末换行、无尾随空白。kernel 使用其 tab/宽度规则。C typedef 不默认添加 POSIX 保留的 `_t` 后缀；内核按自身类型政策，不能为每个 struct 建 typedef。

## 细节规则

`STY-01` 必须：一条语句只表达清晰的一次操作，声明即初始化到语义有效状态；不把未 ready 的资源初始化成“成功”。新便携 C 控制语句使用大括号；已有 kernel 代码遵从目标样式，不强改简单分支。

`STY-02` 必须：禁止无意的 switch fallthrough；需要时用目标支持的 fallthrough 标注或明确注释。外部 enum/状态有非法值处理；不能用 default 静默掩盖新增分支，结合 `-Wswitch-enum`/平台等价检查。

`STY-03` 必须：公共头文件自包含、有 include guard，暴露必要类型；私有结构细节能隐藏则隐藏。源文件首先包含自己的接口头以暴露缺失依赖（目标生态另有要求时遵从）；避免循环 include 与公共头传播 SDK 依赖。include guard 不使用实现保留标识符。

`STY-04` 必须：宏不重复求值，不隐藏 return/break 或难以发现的副作用；可替换时优先类型明确的 `static inline`。必要多语句宏使用 `do { ... } while (0)`，参数/表达式合理括号。禁用 `MAX(i++, j++)` 这类调用。

`STY-05` 必须：注释说明硬件依据、单位、寿命、锁约束或取舍，不逐行翻译源码。手册引用记录器件/修订/章节；临时 workaround 记录触发条件和移除条件。寄存器魔法值改成有来源的 mask/常量，但不复制一整套无用寄存器封装。

`STY-06` 必须：函数返回约定一致。kernel 通常负 errno；POSIX 常为 `-1 + errno`；自有库可用枚举/状态和输出参数。适配边界显式转换，不能在同一 API 随机混用。检查所有有意义的错误返回，刻意忽略需说明；断言不是输入验证和可恢复错误处理。

`STY-07` 建议：函数按单一职责和错误路径拆分；不强制任意行数、单出口或“禁止 goto”。命名优先清楚而非尽量短。修改只格式化相关区域，供应商/生成文件通过生成流程修改。

`STY-08` 必须：日志带设备/操作/错误原因与必要计数，异常风暴限流，高频/ISR 不做不受控格式化；不暴露密钥或未初始化数据。不要通过关闭告警或捕获所有错误返回成功使构建“变绿”。

## C++ 叠加规则

只适用于已有 C++ 项目的用户态/MCU，不用于 Linux 内核。目标为 C++17/20/其他由项目决定，不能为使用新语法自动升级工具链。

- `CPP-01` 必须：资源使用 RAII，默认单一所有权；`unique_ptr` 配正确 deleter，借用指针不释放。`shared_ptr` 仅在真实共享寿命需要时使用，注意引用环和实时路径的最后释放成本。
- `CPP-02` 必须：`span/string_view` 等不拥有数据，不能延长寿命；C++17 没有标准 `std::span`，不能虚构 API。异步 lambda 捕获引用/`this` 要证明被捕获对象存活。
- `CPP-03` 配置项：异常、RTTI、动态多态、标准容器和堆策略按工程约束。不能一概禁用 STL，也不能不顾栈/堆/延迟直接引入；异常不能穿过 C ABI、ISR 或不允许异常的边界，`noexcept` 需与实际行为一致。
- `CPP-04` 必须：明确 `enum class`、`nullptr`、显式窄化检查，避免 C 风格强转；`reinterpret_cast` 不免除别名/对齐/寿命规则。C ABI 用明确 C 接口，不能导出 STL 对象布局。

这些是项目推荐，资源语义与设计依据见 [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)。需要 MISRA C++ 时选择项目声明版本，并核对完整标准，而非宣称此清单等同该标准。
