# 百度网盘 Windows 客户端限速机制逆向：从 `sl=120` 到 FILETIME Token Bucket

> 这是一篇机制研究记录。本文只讨论静态逆向、只读运行态观察和自有 harness 中的受控复现，不提供对真实在线客户端实施限速绕过的操作步骤。

很多关于“百度网盘为什么会被某些变速工具影响”的解释，最后都会落到一句话：客户端用了时间相关的限速逻辑，变速工具改了时间，所以下载速度也变了。

这个方向并不新鲜。真正让我想继续追下去的问题是：**在一个具体版本里，这条链到底长什么样？**

如果限速真的发生在客户端，那么服务器下发了什么，客户端把它变成了什么，哪一个对象真正卡住了吞吐，token 又按什么时间源补充？如果改变时间感知，最终变化的是一个抽象模型，还是原始机器码控制下的真实 I/O？

这次研究围绕 Windows 客户端 `kernel.dll 3.0.20.234` 展开。最后得到的结论比“OpenSpeedy 能加速”更具体：在我们观察到的普通长文件下载状态中，客户端存在一条由策略值驱动的本地 Token Bucket 限速链，实际绑定瓶颈是一个 `122880 B/s` 的 TOTAL gate；它的 refill 依赖 FILETIME 时间感知。在不修改真实百度网盘进程的前提下，把同一原始限速机器码放进自有进程中，端到端 socket → file 吞吐会近似按进程感知到的时间倍率缩放。

## 1. 从 `sl=120` 开始

最早抓到的线索来自 locatedownload 结果中的速度字段。

普通长文件样本里可以看到：

```text
sl = 120
```

继续沿客户端原始策略代码追踪后，这个值会被换算成：

```text
120 × 1024 = 122880 B/s
```

并进入客户端的全局限速状态。

这里还有一个容易误判的点：客户端不是只有一个“120 KiB/s gate”。实际能看到 CDN、TOTAL、任务级/NetGrid 等多层速度约束，而且不同来源之间存在仲裁。

在本轮真实运行状态中，最终稳定出现的策略指纹是：

```text
CDN   = 122880 B/s, source = locatedownload
TOTAL = 122880 B/s, source = enable_cms_total_sl
```

离线重放原始 `set_sl` 仲裁逻辑，也能得到同样的结果：locatedownload 先建立 CDN/TOTAL 值，随后 CMS 接管 TOTAL；更低优先级的来源无法覆盖当前状态。

这说明 `122880` 不是单纯在内存里碰巧出现的常量，而是原始策略路径计算、写入并保留的有效限速状态。

## 2. 配置了很多 gate，真正卡住的是哪一个？

只知道某个对象的 rate 是 122880 还不够。一个 gate 可以存在，但完全不参与当前数据路径。

所以后续重点转向真实运行任务的只读观察。

同一个普通下载任务在运行时，BrowserEngine 提供的官方任务速率为：

```text
positive samples = 78 / 78
min rate         = 122764 B/s
max rate         = 126223 B/s
average rate     = 124370 B/s
median rate      = 124425 B/s
```

与此同时，高频只读采样得到：

```text
GLOBAL TOTAL rate          = 122880 B/s
GLOBAL TOTAL token min     = 699 B
GLOBAL TOTAL token max     = 122384 B
GLOBAL TOTAL token changes = 23
TOTAL token < 16 KiB       = 480 / 482 samples
```

也就是说，在 482 个采样点里，有 **99.6%** 的时间 TOTAL bucket 都处于接近耗尽状态。

旁边还有两个很有迷惑性的对象：

```text
TASK DOWNLOAD rate = 524288000 B/s   # 500 MiB/s
TASK CDN rate      = 16384 B/s       # 16 KiB/s
```

但前者始终有大量 token，明显不是瓶颈；后者虽然存在，在这次真实传输中 token/timestamp 却保持不变，也没有表现出正在控制数据流。

因此，这个真实普通长文件样本的绑定关系可以收敛成：

```text
policy
  -> TOTAL = 122880 B/s
  -> TOTAL Token Bucket 持续 refill / consume
  -> token 长期接近耗尽
  -> 官方任务速度稳定在约 120 KiB/s
```

## 3. 暂停，是一个很有价值的自然对照

如果上面的 TOTAL bucket 真的和当前下载绑定，那么暂停同一个任务后，它的活动也应该一起停止。

实际观察正是这样。

运行态时：

```text
TOTAL = 122880 B/s
timestamp/token 持续变化
token 长期低位
BrowserEngine rate ≈ 124 kB/s
```

任务进入正常 paused 状态后：

```text
TOTAL rate   = 122880 B/s   # 配置没有消失
TOTAL token  = 18 B
时间戳不再变化
token 不再变化
finish_size 不再增长
进程传输 read bytes delta = 0
执行 NetGrid 对象被卸载
```

这个 running → paused 的同任务对照很重要。它排除了一个替代解释：之前看到的 bucket 活动并不是某个无关后台任务造成的，而是和这次真实传输生命周期同步。

## 4. 时间进入了哪里？

静态分析和离线探针继续向 Token Bucket 的 refill 路径收缩。

客户端这套 limiter 的基本行为可以抽象成：

```text
new_tokens ≈ rate × elapsed_time
```

关键在于 `elapsed_time` 从哪里来。

在这一版本里，我们把原始 limiter 的时间路径追到了 FILETIME 系统时间感知。换句话说，如果进程看到的时间流逝速度发生变化，refill 计算得到的 token 量也会跟着变化。

仅凭这个结论仍然只能说明“理论上会受时间影响”。于是后面的实验全部围绕因果性进行。

## 5. 原始机器码：rate × perceived time

为了避免自己重写一个 Token Bucket 再证明自己，我们没有把核心实验建立在仿真模型上，而是让自有 harness 加载本机原始、签名有效的百度 `kernel.dll 3.0.20.234`，调用原始 TOTAL limiter 的策略、refill 和 consume 路径。

在固定 TOTAL rate 为 `122880 B/s` 时，改变进程感知到的时间倍率：

| 时间倍率 | 实际吞吐 |
| ---: | ---: |
| `0.25x` | `29.79 KiB/s` |
| `0.50x` | `59.56 KiB/s` |
| `1.00x` | `119.13 KiB/s` |
| `2.00x` | `239.25 KiB/s` |
| `5.00x` | `598.13 KiB/s` |

线性拟合约为：

```text
slope     = 119.68 KiB/s per factor
intercept = -0.27 KiB/s
R²        = 0.9999994
```

而把 configured rate 也作为第二个变量后：

```text
 60 KiB/s × 1x / 2x / 5x
120 KiB/s × 1x / 2x / 5x
240 KiB/s × 1x / 2x / 5x
```

两个维度都会近似线性地改变稳态吞吐。

因此，这套原始 limiter 的行为可以非常简洁地写成：

```text
steady real-time allowance ≈ configured_rate × perceived_time_factor
```

这已经把“时间相关”从猜测推进成了原始机器码上的可重复因果关系。

## 6. 从 bucket 循环推进到真正的 socket → file

但内存里的 `consume()` 循环仍然不是下载。

下一步把 harness 扩展成完整 I/O：本地 TCP sender 发送真实字节，receiver 每次只有在百度原始 TOTAL bucket 批准下一块数据后才能 `recv()`，收到的数据实际写入临时文件，并执行 flush。真实耗时使用不在本次 FILETIME 虚拟化路径里的时钟单独测量。

每次实验都传输：

```text
3145728 bytes
```

客户端/服务器字节数完全一致，payload hash 也完全一致。

在同一个 `122880 B/s` TOTAL 策略下：

| 条件 | 感知时间 / 真实时间 | socket → file 吞吐 |
| --- | ---: | ---: |
| no hook | `1.000` | `119.14 KiB/s` |
| `0.5x` | `0.500` | `59.57 KiB/s` |
| `1x` | `1.000` | `119.13 KiB/s` |
| `2x` | `2.000` | `239.20 KiB/s` |
| `5x` | `5.000` | `599.53 KiB/s` |

no-hook 与 1x 几乎完全相同，说明“仅仅加载时间补丁”本身没有带来可见吞吐变化；真正对应吞吐变化的是感知时间斜率。

至此，因果验证已经不再只是 bucket 数学，而是覆盖了：

```text
原始百度策略状态
  -> 原始 TOTAL limiter
  -> 时间感知
  -> token refill / consume
  -> Winsock recv
  -> 文件写入与 flush
  -> 真实吞吐
```

## 7. 再进一步：使用 OpenSpeedy 自己的 Bridge

前面的实验可以直接在 harness 内加载时间补丁，但为了验证“真实变速工具进程级链路”本身，又增加了一组控制实验。

这里使用的是 OpenSpeedy 官方 3.3.8 的外部 Bridge 注入架构，**目标仍然只是自有 harness，而不是真实 `baidunetdiskhost.exe`**。

目标进程内部依然是：原始签名百度 `kernel.dll` + 真实策略状态 + 原始 limiter + TCP 接收 + 文件写入。

为了避免运行中从 1x 突然切换倍率带来的时钟连续性问题，最干净的一组实验是在目标进程接收补丁之前就预先设定倍率。

结果：

| 预设倍率 | FILETIME / real | limiter helper / real | 端到端吞吐 |
| ---: | ---: | ---: | ---: |
| `0.5x` | `0.500` | `0.500` | `59.57 KiB/s` |
| `2x` | `2.000` | `2.000` | `239.23 KiB/s` |
| `5x` | `4.999` | `4.999` | `599.65 KiB/s` |

作为对照：

```text
no hook baseline = 119.14 KiB/s
external 1x      = 119.15 KiB/s
```

因此，在**自有进程**中，真实 OpenSpeedy Bridge 链、百度原始 limiter 机器码、socket I/O 和磁盘写入可以共同形成接近理想线性的倍率关系。

这也是目前最强的一组受控进程级证据。

## 8. 不符合预期的数据，反而让结论更清楚

如果在进程已经初始化以后，再动态把倍率从 1x 改成更高值，结果并不总是精确线性。

例如一些 5x 实验中，实际 FILETIME 斜率只落在大约 3.7x～3.8x，吞吐也相应落在约 456 KiB/s；高频单独调用 FILETIME 时甚至还能出现另一种非线性。

进一步隔离发现：

- 空闲最小进程中的预设 5x 可以稳定得到 5.000；
- 加载百度 kernel 但不高频调用 limiter 时，也能得到 5.000；
- 高频 refill 或高频时间 API 调用时，会暴露 OpenSpeedy 自身的计时状态非线性。

所以更准确的结论不是“设置 5x 就必然获得严格 5x”，而是：

**百度 limiter 的 refill 对进程实际感知到的时间斜率近似线性；至于一个具体变速工具在某种调用模式下最终制造出怎样的时间斜率，是另一个问题。**

这个反例很重要，因为它把“百度限速器的因果行为”和“OpenSpeedy 自己的实现细节”分开了。

## 9. 历史真实日志提供了另一条独立证据

除了实时观察，我们还分析了已经滚动关闭的 BaiduKernel 日志。

当前样本中重建出 34 次 CMS 配置事件。原始输入全部相同：

```text
total_limit_enable = 0
total_limit_speed  = 81920
```

但在不同 locatedownload CDN 上下文中，最终 TOTAL 会跟随当前兼容策略产生不同结果：

```text
current CDN 122880 -> computed TOTAL 122880   (33 次)
current CDN 204800 -> computed TOTAL 204800   (1 次)
```

这与前面逆向出的 CMS compatibility branch 一致。

更关键的是长期吞吐。

在 TOTAL 固定为 `122880 B/s` 的记录里，只选择 duration ≥ 600 s 的样本：

```text
CDN = 122880 B/s
records           = 7
combined duration = 17432 s
weighted speed    = 122853.26 B/s
```

另一组：

```text
CDN = 204800 B/s
TOTAL = 122880 B/s
records           = 2
combined duration = 1921 s
weighted speed    = 121815.69 B/s
```

CDN 从 120 KiB/s 提高到 200 KiB/s，增幅约 66.7%，长时间吞吐却没有随之提高，两组都仍然贴着未改变的 TOTAL 120 KiB/s ceiling。

这是一组天然发生的策略 A/B，也独立支持了“普通长文件状态下 TOTAL 是稳态聚合瓶颈”的结论。

## 10. 为什么有时短文件看起来完全不遵守 120 KiB/s？

研究中还出现过一个看起来非常反常的样本：

```text
file size      = 16,263,587 B
reported TOTAL = 204800 B/s
average speed  ≈ 2.03 MB/s
```

如果强行拿它证明“TOTAL 不起作用”，整篇分析都会出问题。

继续追机器码和日志后，发现它属于另一条小文件执行路径。

这一版本的原始代码中，小文件分支的 cutoff 是：

```text
size <= 20 MiB
```

候选 HTTP 连接数近似按：

```text
floor(size / 512 KiB) + 1
```

计算，然后受全局连接 cap 限制。当前真实运行状态下 cap 是 12；16.3 MB 样本计算出的候选值大于 12，日志中实际也正好出现 12 个 HTTP target。

与此同时，这两个自然小文件样本的 locatedownload 状态里都出现了 `fsl=0`。继续沿任务配置到 `get_download_token` 的原始代码追踪后确认：`fsl=0` 会跳过其中一个 normally participating 的全局 singleton token-bucket consume。

这并不意味着 `fsl=0 = 完全不限速`，因为其他 gate 和连接策略仍然存在。更准确的说法是：

> `fsl=0` 是一条特殊执行条件，会绕开这一个特定 global consume；结合小文件多连接 fast path，会形成和普通大文件稳态完全不同的短时行为。

因此，短文件的高吞吐不是普通 120 KiB/s Token Bucket 模型的反例，而是另一条路径。

## 11. OpenSpeedy 的公开资料能证明什么？

OpenSpeedy 自己公开说明，它通过 Ring3 Hook 修改 Windows 时间函数，包括 `GetSystemTimeAsFileTime`，开发者文档也描述了 bridge 负责把速度补丁 DLL 注入目标进程、补丁侧使用 inline hook/trampoline 改写时间调用。

历史 issue 中也有人报告过：旧版本曾能影响百度网盘速度，后来某些版本/倍率行为发生变化；另一个 issue 则记录过百度网盘相关注入器异常。

这些材料只适合当作**外部旁证**。

它们可以说明“时间注入与百度网盘产生交互”并非我们独自观察到的现象，但无法证明当前 `kernel.dll 3.0.20.234` 的具体机制，更不能替代本地的机器码、运行态和受控实验。

本文的核心证据仍然来自自己的样本。

## 12. 最终模型

把目前最可靠的证据压缩成一张文字图，大致是：

```text
locatedownload
  sl = 120
     |
     v
original policy
  120 × 1024
     |
     v
CDN = 122880 B/s
TOTAL = 122880 B/s
     |
     v
ordinary long-file real task
  TOTAL bucket is binding
  token stays near depletion
     |
     v
FILETIME-derived elapsed time
     |
     v
refill ≈ rate × elapsed
     |
     v
real steady throughput ≈ 120 KiB/s
```

在自有进程中进一步改变 perceived time：

```text
0.5x -> ~ 60 KiB/s
1.0x -> ~120 KiB/s
2.0x -> ~240 KiB/s
5.0x -> ~600 KiB/s
```

而小文件则可能进入：

```text
<= 20 MiB
  -> multi-HTTP fast path
  -> fsl=0 special handling
  -> different token participation
```

所以“百度网盘限速”并不是一个单独的数字，而是一套带策略来源、仲裁、多层 gate、特殊路径和时间驱动 refill 的客户端执行机制。

## 13. 我们没有证明什么

这里必须把结论边界写清楚。

这次研究**没有**把时间补丁注入真实在线 `baidunetdiskhost.exe`，也没有进行生产百度网络下的端到端倍率 A/B。

因此本文不声称：

- 真实生产下载速度一定会严格按 OpenSpeedy UI 倍率变化；
- 客户端 gate 是百度完整下载链上唯一的速度约束；
- 服务器/CDN 不存在第二层限制；
- 所有文件、账号、策略状态都走本文观察到的同一条 limiter 路径。

我们能够支持的更严格表述是：

> 在 `kernel.dll 3.0.20.234` 的当前样本中，普通长文件真实运行态存在一个由策略配置为 `122880 B/s`、并实际处于 token-starved 状态的客户端 TOTAL Token Bucket；同一原始 limiter 在自有进程中对 FILETIME 感知时间具有近似线性的 refill/吞吐响应。使用 OpenSpeedy 官方 Bridge 对该自有进程进行受控时间注入时，socket → file 的端到端吞吐随实际感知时间倍率同步变化。

这已经足以解释“为什么一个时间变速器有可能影响这类客户端限速器”，但它和“对生产客户端实施绕过”仍然是两件不同的事。

## 14. 研究里最值得保留的经验

这次最有意思的其实不是最后那个 120 KiB/s。

一开始我们也曾被“有三个同速 bucket，是不是会连续限三次”“16 KiB/s task CDN 看起来更小，是不是它才是最终瓶颈”“TOTAL=204800 的短文件为什么能跑到 2 MB/s”这些现象带偏。

最后真正有用的方法始终是同一个：

**不要因为一个对象存在，就认为它在工作；不要因为一个数字更小，就认为它是瓶颈；不要因为一个异常样本不符合模型，就先改模型。**

先看生命周期，再看 token pressure，再做自然 A/B，最后才做因果实验。

当真实任务、暂停对照、历史日志、原始机器码和受控 I/O 最后都指向同一个位置时，机制才算真正开始闭环。

---

### 样本与实验边界

- Baidu `kernel.dll`: `3.0.20.234`
- SHA-256: `40EB35FCA9316FA2E24AACF18177747295D48B01F852AEA9372E2EDE13E1C5D6`
- OpenSpeedy controlled package: `3.3.8 portable signed`
- OpenSpeedy ZIP SHA-256: `8B95AF6706C826D3E9BC53F8A97998B40ED0F526C03AA72263B81CC6FA411AAC`
- 生产百度进程：只读观察；未进行时间修改或 limiter 写入
- OpenSpeedy 进程级注入实验：仅针对自有 harness

### 外部参考

- OpenSpeedy README：公开列出包括 `GetSystemTimeAsFileTime` 在内的 Windows 时间 Hook。
- OpenSpeedy 开发者文档：公开描述 bridge + DLL 注入、inline hook 与 trampoline 架构。
- OpenSpeedy historical issue #60：曾有用户报告百度网盘速度受版本/倍率影响。
- OpenSpeedy historical issue #106：曾有用户报告百度网盘场景下 32-bit injector 异常。

原始研究日志、只读 observer、离线 proof 与自有 harness 保留在研究分支中；正文只保留能够支撑结论的最小证据集。
