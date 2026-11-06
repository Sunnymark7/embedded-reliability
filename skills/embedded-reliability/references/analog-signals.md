# 模拟信号、采集与输出

适用于涉及 ADC/DAC、传感器模拟前端、PWM 模拟输出和采集软件的任务。规则涉及软硬件接口；没有原理图、目标 ADC 手册和测量条件时，不能给出已验证的元件值或精度结论。

## 先建立信号链契约

`ANA-01` 必须：记录输入范围/共模、源阻抗、带宽、过压/负压保护、增益/偏置、ADC 编码/参考源、有效位、采样率/触发源、通道扫描顺序、单位和允许总误差。标明单端/差分、单极/双极、直二进制/补码/偏移二进制；不能只知道分辨率就套换算公式。[ADI ADC/DAC 术语](https://www.analog.com/en/resources/technical-articles/types-of-adcs-and-dacs.html)

`ANA-02` 必须：对目标手册确认 acquisition、conversion、通道切换和前端 settling 时间；高源阻抗不能靠软件延时猜测解决。多通道复用需评估前一通道残留、首样丢弃是否被手册要求，以及参考源稳定。数字读数稳定不证明输入电压正确。[Microchip acquisition time](https://developerhelp.microchip.com/xwiki/bin/view/products/data-converters/adc-specs/acquisition-time/)

`ANA-03` 必须：采样前模拟链满足抗混叠需求。`fs > 2 × 信号带宽` 只是理想带限条件，不足以决定实际滤波器；考虑带外干扰、过渡带、衰减和相位。采后滤波不能恢复已经混叠的信息。过采样只有在相应噪声与带宽条件下才可能改善分辨率。[NI 抗混叠说明](https://www.ni.com/en/shop/data-acquisition/measurement-fundamentals/analog-fundamentals/anti-aliasing-filters-and-their-usage-explained.html)

## 数据与时序

`ANA-04` 必须：先按编码提取有效位、移位/符号扩展，再换算工程量；按器件 transfer function 决定用 `2^N` 还是满量程码，不统一套 `code * Vref / (2^N - 1)`。校准有单位、版本、有效温度/日期、范围及完整性验证，错误校准不能默默启用。

`ANA-05` 必须：定点实现验证最坏中间值；累加平均考虑样本数乘最大码；负值、饱和、舍入有定义。保留原始码、校准值和状态可追溯；数据有效性/过量程/参考异常单独表示，不用某个“正常电压值”代替失败。

`ANA-06` 必须：稳定采样由硬件触发/适合的子系统提供；不能将 Linux 用户态 sleep 周期当准确采样周期。时间戳尽量靠近采样事件，说明硬件时钟/内核时钟/接收时钟及误差。多通道同步和多器件相位一致性不能仅凭同一软件启动证明。

`ANA-07` 必须：连续采集有块/双缓冲所有权和覆盖检测，区分 DMA 正在写、可消费、处理中、可复用；统计 overrun/drop、最大排队深度与数据年龄。断流后重启需重建序号、时间基准和滤波状态，不能继续混合旧样本。

`ANA-08` 必须：滤波器记录采样率、参数、初始状态、群延迟/相位、启动瞬态和缺失样本策略。控制/告警算法评估新增延迟，不能以“更平滑”作为唯一目标；变采样率后重算系数或明确拒绝。

## Linux IIO

`ANA-09` 必须：使用实际 scan 元数据解析缓冲：启用通道、index、端序、sign、realbits/storagebits、repeat、shift、对齐/填充、时间戳。用户态不能假设每个样本为连续 `uint16_t[]`；读取不足一个 scan 时按接口契约缓存/报错。[IIO buffers](https://docs.kernel.org/driver-api/iio/buffers.html)

修改内核 IIO 驱动还需核对 direct mode 与 buffer mode 的互斥、trigger 完成通知和目标版本要求；在触发线程处理读取及缓冲发布。[IIO triggered buffers](https://cdn.kernel.org/doc/html/latest/driver-api/iio/triggered-buffers.html)

## 输出与硬件核验

`ANA-10` 必须：DAC/PWM 定义上电、复位、通信丢失和进程崩溃时的输出状态。PWM 低通输出评估纹波、频率/分辨率和负载响应；DAC 更新评估建立时间、glitch、输出负载和更新同步。软件限幅不是硬件过压/故障保护的替代。

建议与硬件人员核对地与回流、参考/供电去耦、模拟/数字耦合、时钟与开关噪声、布线和屏蔽；具体设计依器件应用笔记与板级测量。不能统一要求“模拟地数字地必须分割”。

验证计划按需求选取：已知精度源的零点/中点/近满量程、负输入/过量程（在额定条件内）、DC 偏置与增益、频率响应与混叠、通道串扰、温漂/供电变化、丢样与重启、输出失联状态。报告仪器、量程、采样条件、原始数据及误差预算；无仪器和板卡时标为待硬件验证。
