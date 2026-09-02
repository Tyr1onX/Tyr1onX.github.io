# 下载限速机制研究 checkpoint — 2026-09-02

> 范围：只记录离线/本地机制验证与证据链，不进行生产环境限速绕过。

## 当前结论

### 已由现有离线探针直接支持

1. `locateDownload` 响应中的 `sl = 120` 会进入客户端返回对象与 completion 数据结构。
2. original policy 会把 `raw_sl = 120` 转换为 `122880 B/s`，并写入全局 CDN 与 Total 两个限速 gate；对应来源标记为策略来源，且 `locatedownload_active = 1`。
3. `kernel.dll` 内存在可独立构造、设置 rate、补充 token、消费 token 的 Token Bucket 实现；对象布局与 rate/token/timestamp 字段已由探针恢复。
4. dispatcher 路径存在任务级 CDN rate 设置入口，说明全局 gate 之外还有 task / NetGrid 级别的限速参与者。
5. `qingluan::common::AccumulateTokenBucket` 已通过 RTTI/vtable 定位，并已有只读运行时 observer 用于枚举对象和读取 rate/token/timestamp。
6. `baidu-original-offline-limiter-chain-proof.cpp` 已把上游 `locateDownload` 策略链与后续 dispatcher/task 构造放入同一个离线 proof 中，研究已不再停留在孤立函数级别。

## 对“三个同速 bucket 串联”的修正

恢复模型中的 peer / total / task 三个 Token Bucket 如果都配置为同一个 `120 KiB/s`，它们串联并不会把稳态吞吐继续相乘或除三。

在上游带宽充足、三个 bucket 同时补充 token 的模型里：

- factor 0.5 → 约 60 KiB/s
- factor 1.0 → 约 120 KiB/s
- factor 2.0 → 约 240 KiB/s
- factor 5.0 → 约 600 KiB/s
- factor 10.0 → 约 1200 KiB/s

直到碰到上游带宽或其他更小的 gate。

这说明多层 bucket 的作用更接近“多个约束共同取最小值”，而不是“每经过一层再限一次”。

## 时间源证据的正确表述

现有 `openspeedy-filetime-proof.cpp` 与 `baidu-original-bucket-openspeedy-proof.cpp` 已建立实验框架，用真实系统时间与客户端/Kernel 感知时间做对照。

目前可以安全表述为：

- Token Bucket refill 依赖 elapsed time；
- 如果其使用的时间源被整体放大，模型中的 refill 速率会按同一比例放大；
- 这解释了为什么改变客户端时间感知“理论上可能”影响本地限速器。

但在没有把真实运行结果重新归档前，不把它写成“生产下载速度必然按 factor 放大”。

## legacy / qingluan 当前关系

当前证据更支持“两套实现/演进层同时存在”，而不是简单二选一：

- legacy/original 路径已经能从 `locateDownload sl` 追到全局 gate 与 dispatcher；
- qingluan 路径中能观察到独立的 `AccumulateTokenBucket` 对象和 peer/total/task 模型；
- 尚缺一条干净证据证明某一个真实下载任务在运行时究竟只走其中一套，还是 original policy 负责策略、qingluan/NetGrid 负责实际数据执行。

后者目前是更值得验证的架构假设。

## 当前最有价值的下一步

不再继续堆新的“改 rate”探针。优先做只读关联验证：

1. 用 task id / entity / NetGrid 对象关系，把 dispatcher 中的任务对象与 qingluan bucket observer 看到的 bucket 对象对应起来。
2. 记录一次下载任务从创建、暂停、恢复到销毁期间，相关 bucket 对象数量、rate、token、timestamp 的生命周期变化。
3. 只读比较 `sl=120` 与不受该策略限制的合法场景，确认 policy state 与 qingluan bucket rate 是否同步变化。
4. 若能建立 `locateDownload policy → task entity → qingluan bucket` 的对象级对应关系，则客户端限速机制的本地证据链基本闭环。

## 尚未证明

- 服务器/CDN 是否存在独立的第二层吞吐限制。
- 客户端 gate 之外是否还有动态策略、会员策略或网络侧限制。
- OpenSpeedy 对真实生产下载任务的最终吞吐影响是否完全由 Token Bucket 时间源解释。
- legacy/original 与 qingluan 在真实下载任务中的精确职责边界。

因此当前结论应保持为：**已经非常强地证明客户端内部存在由 `sl=120` 驱动的 122880 B/s Token Bucket 限速链，但还不能把整条真实网络下载速度归因于单一客户端 gate。**
