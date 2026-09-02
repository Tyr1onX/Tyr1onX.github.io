# 百度网盘 Windows 客户端限速机制逆向：从 `sl=120` 到 FILETIME Token Bucket

> 这是一篇机制研究记录。本文只讨论静态逆向、只读运行态观察和自有 harness 中的受控复现，不提供对真实在线客户端实施限速绕过的操作步骤。

很多关于“百度网盘为什么会被某些变速工具影响”的解释，最后都会落到一句话：客户端用了时间相关的限速逻辑，变速工具改了时间，所以下载速度也变了。

这个方向并不新鲜。真正值得追的问题是：**在一个具体版本里，这条链到底长什么样？**

服务器或策略层给了什么值？客户端把它变成了什么？多个 limiter 同时存在时，哪一个才真正卡住吞吐？Token Bucket 的 refill 又依赖什么时间源？如果改变时间感知，变化的只是一个抽象模型，还是原始机器码控制下的真实 I/O？

这次研究围绕 Windows 客户端 `kernel.dll 3.0.20.234` 展开。最后得到的结论比“OpenSpeedy 能加速”更具体：在我们观察到的普通长文件下载状态中，客户端存在一条由策略值驱动的本地 Token Bucket 限速链，实际绑定瓶颈是一个 `122880 B/s` 的 TOTAL gate；它的 refill 依赖 FILETIME 时间感知。在不修改真实百度网盘进程的前提下，把同一原始限速机器码放进自有进程中，端到端 socket → file 吞吐会近似按进程感知到的时间倍率缩放。

## 1. 从 `sl=120` 开始

最早抓到的线索来自 locatedownload 结果中的速度字段。普通长文件样本中可以看到 `sl=120`。

继续沿客户端原始策略代码追踪后，这个值会被换算成 `120 × 1024 = 122880 B/s`，随后进入客户端的全局限速状态。

这里第一个容易误判的地方是：客户端并不只有一个“120 KiB/s gate”。实际能够看到 CDN、TOTAL、任务级/NetGrid 等多层速度约束，而且不同策略来源之间还有仲裁。

本轮真实运行状态最终稳定出现的策略指纹是：

- CDN：`122880 B/s`，来源为 `locatedownload`。
- TOTAL：`122880 B/s`，来源为 `enable_cms_total_sl`。

离线重放原始 `set_sl` 仲裁逻辑也得到同样结果：locatedownload 先建立 CDN/TOTAL 状态，随后 CMS 接管 TOTAL；更低优先级的来源无法覆盖当前值。

因此，`122880` 不是在内存里偶然搜到的常量，而是原始策略路径实际计算、写入并保留的有效限速状态。

## 2. 有很多 gate，真正卡住的是哪一个？

只知道某个对象的 rate 是 `122880` 仍然不够。一个 gate 可以存在，却完全不参与当前数据路径。

所以后续重点转向真实下载任务的只读观察。

同一个普通长文件任务在运行时，BrowserEngine 提供的官方任务速率为：

- 78 / 78 个样本均为正速率。
- 最低 `122764 B/s`。
- 最高 `126223 B/s`。
- 平均 `124370 B/s`。
- 中位数 `124425 B/s`。

与此同时，对真实 limiter 做高频只读采样：

- GLOBAL TOTAL rate：`122880 B/s`。
- TOTAL token 最低：`699 B`。
- TOTAL token 最高：`122384 B`。
- 482 个采样点中，480 个低于 `16 KiB`。

也就是说，**99.6% 的采样时间里，TOTAL bucket 都接近耗尽**。

旁边还有两个很有迷惑性的对象：一个任务级 download gate 配到了 `500 MiB/s`，另一个 NetGrid CDN gate 是 `16 KiB/s`。但前者始终有大量 token，明显不是瓶颈；后者虽然存在，在这次真实传输中 token 和 timestamp 却保持不变，也没有表现出正在控制数据流。

因此，这个真实普通长文件样本的绑定关系可以收敛成：

> policy → TOTAL `122880 B/s` → TOTAL Token Bucket 持续 refill / consume → token 长期接近耗尽 → 官方任务速度稳定在约 `120 KiB/s`。

## 3. 暂停，是一个很干净的自然对照

如果上面的 TOTAL bucket 真的和当前下载绑定，那么暂停同一个任务以后，它的活动也应该一起停止。

实际观察正是这样。

运行状态下：

- TOTAL 仍是 `122880 B/s`。
- token 与 timestamp 持续变化。
- token 长期处于低位。
- BrowserEngine 任务速度约 `124 kB/s`。

同一个任务正常进入 paused 状态后：

- TOTAL 配置仍然是 `122880 B/s`，并没有消失。
- token 停在 `18 B`。
- timestamp 不再变化。
- token 不再变化。
- `finish_size` 不再增长。
- 进程传输 read bytes delta 为 0。
- 对应执行 NetGrid 对象被卸载。

这个 running → paused 的同任务对照很重要。它排除了一个替代解释：之前看到的 bucket 活动并不是某个无关后台任务造成的，而是和这次真实传输生命周期同步。

## 4. 时间进入了哪里？

静态分析和离线探针继续向 Token Bucket 的 refill 路径收缩。

这套 limiter 的基本行为可以抽象成 `new_tokens ≈ rate × elapsed_time`。真正关键的是 `elapsed_time` 从哪里来。

在这一版本里，我们把原始 limiter 的时间路径追到了 FILETIME 系统时间感知。换句话说，如果进程“认为”时间流逝得更快或更慢，refill 计算出的 token 数量也会跟着变化。

但仅凭这一点仍然只能说“理论上会受时间影响”。所以后面的实验都围绕因果性展开。

## 5. 不重写模型，直接跑原始机器码

为了避免“自己写一个 Token Bucket，再用它证明 Token Bucket”的循环论证，核心实验没有建立在仿真模型上。

自有 harness 直接加载本机原始、签名有效的百度 `kernel.dll 3.0.20.234`，调用原始 TOTAL limiter 的策略、refill 与 consume 路径。

在 TOTAL rate 固定为 `122880 B/s` 时，只改变进程感知到的时间倍率：

- `0.25x` → `29.79 KiB/s`。
- `0.50x` → `59.56 KiB/s`。
- `1.00x` → `119.13 KiB/s`。
- `2.00x` → `239.25 KiB/s`。
- `5.00x` → `598.13 KiB/s`。

五个倍率点做线性拟合后，斜率约为 `119.68 KiB/s per factor`，截距约 `-0.27 KiB/s`，`R² = 0.9999994`。

再把 configured rate 作为第二个变量，分别测试 `60 / 120 / 240 KiB/s` 与 `1x / 2x / 5x` 的组合，两个维度都会近似线性改变稳态吞吐。

因此，这套原始 limiter 的行为可以非常简洁地概括为：

> `steady real-time allowance ≈ configured_rate × perceived_time_factor`

“时间相关”到这里已经从猜测推进成了原始机器码上的可重复因果关系。

## 6. 从 bucket 循环推进到真正的 socket → file

不过，内存里的 `consume()` 循环仍然不能叫下载。

下一步把 harness 扩展成完整 I/O：本地 TCP sender 发送真实字节，receiver 每次只有在百度原始 TOTAL bucket 批准下一块数据后才能继续接收；收到的数据实际写入临时文件并 flush。真实耗时则用不在本次 FILETIME 虚拟化路径里的时钟单独测量。

每轮都传输完全相同的 `3145728 bytes`，客户端与服务器字节数一致，payload hash 也一致。

在同一个 `122880 B/s` TOTAL 策略下得到：

- no hook：感知/真实时间 `1.000`，吞吐 `119.14 KiB/s`。
- `0.5x`：感知/真实时间 `0.500`，吞吐 `59.57 KiB/s`。
- `1x`：感知/真实时间 `1.000`，吞吐 `119.13 KiB/s`。
- `2x`：感知/真实时间 `2.000`，吞吐 `239.20 KiB/s`。
- `5x`：感知/真实时间 `5.000`，吞吐 `599.53 KiB/s`。

no-hook 与 1x 几乎完全相同，这也排除了“仅仅加载时间补丁 DLL 就会让吞吐发生明显变化”的解释。

到这里，因果链已经覆盖：

> 原始百度策略状态 → 原始 TOTAL limiter → 时间感知 → token refill / consume → Winsock receive → 文件写入与 flush → 真实吞吐。

## 7. 再进一步：让 OpenSpeedy 自己完成进程级链路

前面的受控实验可以直接在 harness 内加载时间补丁。为了验证真实变速工具的外部进程链路，又增加了一组实验。

这里使用 OpenSpeedy 官方 3.3.8 的 Bridge 架构，**目标仍然只是自有 harness，不是真实 `baidunetdiskhost.exe`**。目标进程内部仍是原始签名百度 `kernel.dll`、真实策略状态、原始 limiter、TCP 接收和文件写入。

为了避免运行中从 1x 突然切换倍率带来的时钟连续性问题，最干净的一组实验是在目标进程接收补丁之前就预先设定倍率。

结果是：

- 预设 `0.5x`：FILETIME / real = `0.500`，limiter helper / real = `0.500`，端到端吞吐 `59.57 KiB/s`。
- 预设 `2x`：FILETIME / real = `2.000`，limiter helper / real = `2.000`，端到端吞吐 `239.23 KiB/s`。
- 预设 `5x`：FILETIME / real = `4.999`，limiter helper / real = `4.999`，端到端吞吐 `599.65 KiB/s`。
- 对照 no-hook baseline：`119.14 KiB/s`。
- 对照 external 1x：`119.15 KiB/s`。

因此，在**自有进程**中，真实 OpenSpeedy Bridge 链、百度原始 limiter 机器码、socket I/O 和磁盘写入可以共同形成接近理想线性的倍率关系。

这是目前最强的一组受控进程级证据。

## 8. 不符合预期的数据，反而把结论变得更准确

如果进程已经初始化，再动态从 1x 修改到更高倍率，结果并不总是严格线性。

一些 5x 实验里，实际 FILETIME 斜率只有约 3.7x～3.8x，吞吐也相应落到约 `456 KiB/s`。进一步隔离以后发现：

- 空闲最小进程的预设 5x 可以稳定得到 `5.000`。
- 加载百度 kernel、但不高频调用 limiter 时，同样可以得到 `5.000`。
- 高频 refill 或高频时间 API 调用会暴露 OpenSpeedy 自身计时状态的非线性。

所以更准确的结论不是“OpenSpeedy 设置 5x 就必然获得严格 5x”，而是：

> **百度 limiter 的 refill 对进程实际感知到的时间斜率近似线性；至于一个具体变速工具在某种调用模式下最终制造出怎样的时间斜率，是另一个问题。**

这个反例很重要，因为它把“百度限速器的因果行为”和“OpenSpeedy 自己的实现细节”分开了。

## 9. 历史真实日志给了另一条独立证据

除了实时观察，我们还分析了已经滚动关闭的 BaiduKernel 日志。

当前样本中重建出 34 次 CMS 配置事件。它们的原始输入都相同：`total_limit_enable=0`、`total_limit_speed=81920`。

但在不同 locatedownload CDN 上下文里，最终 TOTAL 会跟随当前兼容策略产生不同结果：

- current CDN `122880` → computed TOTAL `122880`，共 33 次。
- current CDN `204800` → computed TOTAL `204800`，共 1 次。

这和前面逆向出的 CMS compatibility branch 一致。

更关键的是长期吞吐。在 TOTAL 固定为 `122880 B/s`、只选择 duration ≥ 600 s 的记录以后：

- CDN = `122880 B/s`：7 条记录，合计 `17432 s`，加权速度 `122853.26 B/s`。
- CDN = `204800 B/s`：2 条记录，合计 `1921 s`，加权速度 `121815.69 B/s`。

CDN 从 120 KiB/s 提高到 200 KiB/s，配置增幅约 66.7%，长时间吞吐却没有随之上升，两组都仍然贴着未改变的 TOTAL 120 KiB/s ceiling。

这是一组天然发生的策略 A/B，也独立支持了“普通长文件状态下 TOTAL 是稳态聚合瓶颈”的结论。

## 10. 为什么有些短文件完全不像 120 KiB/s？

研究过程中还遇到过一个看起来非常反常的样本：文件约 `16.3 MB`，reported TOTAL 为 `204800 B/s`，平均速度却约 `2.03 MB/s`。

如果直接拿它反驳前面的模型，整篇分析都会出问题。

继续追机器码和日志以后，发现它属于另一条小文件执行路径。

这一版本原始代码里的小文件 cutoff 是 `20 MiB`。候选 HTTP 连接数近似按 `floor(size / 512 KiB) + 1` 计算，再受到全局连接 cap 限制。当前真实运行状态下 cap 是 12；16.3 MB 样本的候选数会超过 12，而真实日志中也正好出现了 12 个 HTTP target。

与此同时，自然出现的两个小文件样本都带有 `fsl=0`。沿任务配置继续追到 `get_download_token` 后确认：`fsl=0` 会跳过其中一个 normally participating 的 global singleton token-bucket consume。

这**不等于** `fsl=0 = 完全不限速`，因为其他 gate 和连接策略仍然存在。更准确的说法是：

> `fsl=0` 是一个特殊执行条件，会跳过这个特定 global consume；配合小文件多连接 fast path，会形成和普通大文件稳态完全不同的短时行为。

所以短文件高吞吐不是普通 120 KiB/s Token Bucket 模型的反例，而是另一条执行路径。

## 11. 公开资料能证明什么？

OpenSpeedy 的 [README](https://github.com/game1024/OpenSpeedy/blob/master/README.zh-CN.md) 公开列出了包括 `GetSystemTimeAsFileTime` 在内的 Windows 时间函数 Hook；[开发者文档](https://github.com/game1024/OpenSpeedy/wiki/%E5%BC%80%E5%8F%91%E8%80%85%E6%96%87%E6%A1%A3) 也描述了 bridge、DLL 注入、inline hook 与 trampoline 的基本架构。

历史 [issue #60](https://github.com/game1024/OpenSpeedy/issues/60) 中，有用户报告旧版本曾经能够影响百度网盘下载速度，后来某些版本和高倍率下行为发生变化；[issue #106](https://github.com/game1024/OpenSpeedy/issues/106) 则记录过百度网盘场景中的 32-bit injector 异常。

这些材料只适合作为**外部旁证**。它们能说明“时间注入与百度网盘产生交互”并不是一个完全孤立的观察，但无法证明当前 `kernel.dll 3.0.20.234` 的具体机制，更不能替代本地机器码、运行态和受控实验。

本文的核心证据始终来自自己的样本。

## 12. 最终模型与结论边界

把目前最可靠的证据压缩下来，普通长文件路径大致是：

> locatedownload `sl=120` → original policy `120 × 1024` → CDN / TOTAL `122880 B/s` → 真实普通长文件中 TOTAL bucket 处于 binding / token-starved 状态 → FILETIME-derived elapsed time 驱动 refill → 长时间真实吞吐约 `120 KiB/s`。

而在自有进程中改变 perceived time 后：

- `0.5x` → 约 `60 KiB/s`。
- `1.0x` → 约 `120 KiB/s`。
- `2.0x` → 约 `240 KiB/s`。
- `5.0x` → 约 `600 KiB/s`。

小文件则可能走另一条路径：`≤20 MiB` → multi-HTTP fast path → `fsl=0` 特殊 token participation。

所以“百度网盘限速”不是一个孤立数字，而是一套带策略来源、仲裁、多层 gate、特殊路径和时间驱动 refill 的客户端执行机制。

这里也必须把没有证明的部分写清楚：这次研究**没有**把时间补丁注入真实在线 `baidunetdiskhost.exe`，也没有进行生产百度网络下的端到端倍率 A/B。

因此本文不声称真实生产下载一定严格按照 OpenSpeedy UI 倍率变化，也不声称客户端 gate 是整个百度下载链唯一的速度约束，更不排除服务器/CDN、账号策略或其他网络侧限制。

我们能够支持的严格表述是：

> 在 `kernel.dll 3.0.20.234` 的当前样本中，普通长文件真实运行态存在一个由策略配置为 `122880 B/s`、并实际处于 token-starved 状态的客户端 TOTAL Token Bucket；同一原始 limiter 在自有进程中对 FILETIME 感知时间具有近似线性的 refill/吞吐响应。使用 OpenSpeedy 官方 Bridge 对该自有进程进行受控时间注入时，socket → file 的端到端吞吐随实际感知时间倍率同步变化。

这已经足以解释“为什么一个时间变速器有可能影响这类客户端限速器”，但它和“对生产客户端实施绕过”仍然是两件不同的事。

## 13. 比最终数字更重要的，是怎么证明它

这次最有意思的其实不是最后那个 120 KiB/s。

研究中我们也被不少现象带偏过：三个同速 bucket 是否会连续限三次？16 KiB/s 的 task CDN 看起来更小，是不是它才是最终瓶颈？TOTAL=204800 的短文件为什么能跑到约 2 MB/s？

最后真正有用的方法始终是同一个：

> **不要因为一个对象存在，就认为它在工作；不要因为一个数字更小，就认为它是瓶颈；不要因为一个异常样本不符合模型，就先修改模型。**

先看生命周期，再看 token pressure，再利用自然 A/B，最后才做因果实验。

当真实任务、暂停对照、历史日志、原始机器码和受控 I/O 最后都指向同一个位置时，机制才算真正开始闭环。

---

### 样本与实验边界

- Baidu `kernel.dll`：`3.0.20.234`。
- SHA-256：`40EB35FCA9316FA2E24AACF18177747295D48B01F852AEA9372E2EDE13E1C5D6`。
- OpenSpeedy controlled package：`3.3.8 portable signed`。
- OpenSpeedy ZIP SHA-256：`8B95AF6706C826D3E9BC53F8A97998B40ED0F526C03AA72263B81CC6FA411AAC`。
- 生产百度进程：只读观察；未进行时间修改或 limiter 写入。
- OpenSpeedy 进程级注入实验：仅针对自有 harness。
- [完整原始研究分支](https://github.com/Tyr1onX/Tyr1onX.github.io/tree/content/2026-09-01-download-limiter-notes)：保留研究日志、只读 observer、离线 proof 与自有 harness；正文只抽取支撑结论所需的最小证据集。
