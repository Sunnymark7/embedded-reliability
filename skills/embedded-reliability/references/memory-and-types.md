# 内存、指针与复合类型

术语：“嵌合体”在本技能按“嵌套结构体、结构体与联合体组合”处理；若用户指特定编译器扩展，先确认其定义。

## 分配和寿命

`MEM-01` 必须：每个对象有分配者、拥有者、借用者和释放点。禁止 double free、use-after-free、越界、返回局部变量地址。释放后置空只能保护该指针，不能消除其他别名。[CERT 内存规则目录](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/rules/)

`MEM-02` 必须：分配/复制前验证算术。`count * sizeof(*p)` 前先验证 `count <= SIZE_MAX / sizeof(*p)`；`header + payload` 用上界相减验证；环形索引与长度同样不能先溢出再检查。Linux 内核优先 `kmalloc_array/kcalloc/struct_size/check_*_overflow` 等目标 API。不能把强制类型转换当范围检查。

`MEM-03` 配置项：允许堆的位置和上限。Linux 用户态允许有界动态分配；高频路径考虑复用。MCU 硬实时运行阶段优先静态/池，是否允许堆取决于分配器、碎片与最坏耗时证据。Linux 内核按上下文选择分配 flags；`GFP_ATOMIC` 不是通用修复，仍可能失败。禁止“一律无堆”或“一律 malloc”。

`MEM-04` 必须：确认栈预算（调用深度、ISR 嵌套、库调用、局部数组）。内核不用 VLA；便携/MCU 模块默认不用 VLA/未界定递归。C++ 大对象和隐式临时对象也计入。任务栈水位只是观测，不等于最坏情况证明。

`MEM-05` 必须：重分配用临时指针保留原块，定义零长度策略；失败不丢原所有权。清理路径按实际获取阶段释放，C 允许清晰的 `goto cleanup`，不为“单一 return”复制多段释放逻辑。

## 指针契约

`PTR-01` 必须：缓冲参数同时给实际长度/容量，说明单位、零长度时是否允许 NULL、读写权限、重叠语义。检查 NULL 不证明长度或寿命；C 无通用可靠的“指针有效性探测”。不要以固定地址范围比较代替所有权。[CERT ARR30-C](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/rules/arrays-arr/arr30-c/)

`PTR-02` 必须：先验证索引，再形成指针；只在同一数组对象允许范围内运算/比较。one-past 指针可形成但不可解引用。不要先做 `buf + len` 再检查 len，NULL 加零也不是通用可移植技巧。

`PTR-03` 必须：输入只读用 `const T *`；`T *const` 只固定指针本身。不得去掉 const/volatile 掩盖错误；不得把 `T **` 当 `const T **` 传递。回调类型完全匹配，不强转不兼容函数指针。

`PTR-04` 必须：异步操作的 buffer/context 在完成或取消确认前有效。提交失败与成功后的所有权分别定义；取消超时不能直接 free；zero-copy 需归还协议、引用计数或池代次，避免池槽复用造成 ABA。

`PTR-05` 必须：避免不兼容类型别名和未对齐访问。普通内存用字节解码或 `memcpy` 到合法本地对象；复制位模式仍需处理端序和类型表示。`restrict` 只有调用者能保证不别名时使用。`uintptr_t` 仅在目标支持且确需时用于有文档的转换，不用于序列化指针。[CERT EXP39-C](https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/rules/expressions-exp/exp39-c/)、[内核未对齐访问](https://www.kernel.org/doc/html/latest/core-api/unaligned-memory-access.html)

## 整数、字符串和数值

`NUM-01` 必须：协议/寄存器边界使用明确位宽、符号和字节序；长度用 `size_t`，POSIX I/O 返回用 `ssize_t` 并先判负再转长度。不要假设 `int/long/enum/bool` 宽度或 `char` 符号性。精确宽度整数只在目标提供时使用，线协议明确要求 8 位字节。

线协议的 8-bit octet 与 C 的 `sizeof` byte 分开。C28x 等目标可有 `CHAR_BIT=16`，精确 `uint8_t` 可能不存在；`uint_least8_t` 也不证明恰好 8 bit。需要目标专用 octet pack/unpack 与外设访问适配，本技能 C11 示例不适用该数据模型。参见 [TI 系列](mcu/ti.md)。

`NUM-02` 必须：移位次数小于提升后操作数位宽；位掩码避免有符号左移、负数右移的可移植性问题。检查整数提升与混合有/无符号比较、除零、最小负值取反、乘除中间量溢出。无符号回绕只有设计明确时才允许。

`NUM-03` 必须：字符串容量包含终止符。`snprintf` 返回负数表示失败，返回值大于等于容量表示截断；不能直接当实际写入长度。`strncpy` 不保证终止且有填充成本；二进制帧不能用 `strlen`。不可信格式串只作为数据参数传递。

`NUM-04` 必须：对浮点/定点定义单位、范围、缩放、舍入、溢出/饱和、NaN/Inf 策略。安全相关判断不用未经量化的魔法 epsilon。浮点表示不直接作为跨平台协议，若协议明确 IEEE-754 则验证目标表示并显式处理端序。

## 结构体、嵌套结构体、联合体、位域

`TYP-01` 必须：内部对象按语义组织，组合优于隐藏的全局耦合；嵌套结构体可以表达 cfg/state/stats 等边界，但不要为包装而深层嵌套。内部布局不能自动变成外部 ABI。

`TYP-02` 必须：结构体可能含 padding；禁止直接 `memcmp` 比较语义相等，禁止发送 `sizeof(struct)`。逐字段初始化/比较；输出至外界时清理整个输出缓冲并显式编码，不能依赖结构体赋值使 padding 可预测。`{0}` 不意味着所有对象表示都适合导出。

`TYP-03` 必须：联合体使用明确 tag，创建时初始化对应成员，读取前校验 tag，切换时处理旧成员资源。C 对 union 重解释有实现/表示约束，C++ 活动成员与对象寿命限制更严格；本规范的便携默认是**不靠读取另一个成员实现 type punning**，但不错误宣称所有 C union 重解释都必然 UB。

```c
enum reading_kind { READING_ADC, READING_ERROR };
struct reading {
    enum reading_kind kind; /* 内部标签，不直接发送 enum */
    union {
        struct { uint16_t code; uint16_t reference_mv; } adc;
        struct { uint32_t flags; } error;
    } data;
};
```

C++ 用户态可在资源预算允许时使用 `std::variant`；含非平凡成员的原生 union 需要构造、析构及活动成员管理，不由 AI 随意生成复杂手工方案。[C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)

`TYP-04` 必须：位域的分配方向、基础类型与布局依赖 ABI/实现，不能作为通用线格式。MMIO 默认用目标寄存器访问函数和 mask，防止编译器生成不合硬件语义的访问宽度/RMW。已有厂商位域头文件需核对工具链与手册，不能凭喜好替换。

`TYP-05` 必须：`packed` 仅用于有外部布局依据且工具链支持的场景；不能解决字节序、别名、对象寿命或任意 CPU 的未对齐问题。不要把 packed 成员地址传给要求自然对齐的接口。对必要 ABI 使用 `_Static_assert/static_assert` 与 `offsetof/sizeof` 检查，并在支持的架构运行布局测试。

`TYP-06` 必须：flexible array 分配检查头部加元素数的溢出，验证传入实际对象大小；C++ 中不是标准通用方案。`container_of` 等平台惯用法按平台契约使用，不向无相关保证的便携模块扩散。

审阅证据：分配/释放路径表、每个异步对象的最后访问点、协议黄金向量、边界长度/整数值测试、适用的 ASan/UBSan 或内核检测结果。
