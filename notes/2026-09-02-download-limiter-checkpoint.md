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

## 2026-09-02 真实 paused 任务对象关联

本轮在 `kernel.dll 3.0.20.234`（SHA-256 `40EB35FCA9316FA2E24AACF18177747295D48B01F852AEA9372E2EDE13E1C5D6`）对应的真实 `baidunetdiskhost.exe` 中做了只读观测。目标进程仅以 `PROCESS_QUERY_INFORMATION | PROCESS_VM_READ` 打开，没有向百度网盘进程写内存。

当前客户端恰好保留一个已暂停下载任务：

- UI / `transmission.db` task id：`1788314213`
- batch id：`38ce56ad2d655d626b49e4a5243aae8d`
- 文件：`1.项目总览.mp4`
- size：`200307093 B`
- complete：`22413312 B`
- status：`3`（客户端当前计入 paused）
- `download_file.reserved5`：`b9583c2d733809b9349644679acc6d4a|`

`reserved5` 中的 16-byte id 与真实进程中 legacy `EntityTask` 的 `+0x24` task id 精确一致，因此已经建立：

`UI/DB task 1788314213 → batch 38ce... → native id b9583c... → legacy EntityTask`

当前进程中同一个 `b9583c...` 出现在两个 `EntityTask` 实例（本次地址 `0x4d46450` / `0x4f23090`）；两者在 paused 状态的 `+0x108/+0x110` NetGrid 关联均为 null。两个实例的精确角色仍待运行态对照，不把它们直接解释成“两个下载任务”。

同时，RTTI 对 bucket 所属对象给出了更强的类型证据：

- `0x524fb0 / 0x524fe8 / 0x525020 / 0x525058` 四个 `AccumulateTokenBucket` 连续内嵌在同一个 `std::_Ref_count_obj2<qingluan::download::SpeedLimitor>` 对象中；当前 rate 均为 `524288 B/s`（512 KiB/s），paused 采样期间 token/timestamp 不变化。
- `0x53d710` 的高 rate bucket 属于 `std::_Ref_count_obj2<qingluan::upload::SpeedLimitor>`，因此不能混入下载链分析。
- 从同版本 DLL 的 MSVC RTTI 恢复出 `std::_Ref_count_obj2<qingluan::download::EntityTask>` vtable RVA `0x1399AC8` 与 `std::_Ref_count_obj2<qingluan::download::NetGrid>` vtable RVA `0x13BDC28`；paused 状态下两者在可读 private heap 中均为 0 个 live control block。

这组 paused baseline 更支持一个分层模型：上层 legacy `EntityTask` 仍保留任务身份，而 qingluan 的执行 `EntityTask/NetGrid` 可在暂停时被销毁或卸载；共享 `download::SpeedLimitor` 则继续常驻。这个解释仍需要同一任务恢复运行后的对象出现/绑定证据才能升级为结论。

另外，对 native id `b9583c...` 做二进制只读扫描时，在进程 private memory 中发现 18 个副本，其中包括两个 legacy `EntityTask +0x24` 以及若干 peer/strategy 相关区域。这说明该 16-byte id 会沿 native 执行链传播，但尚未把每个副本都归属到具体 qingluan 类型。

### 本轮生命周期验证状态

已完成并归档 **paused baseline**。尝试通过本机 Electron CDP 自动触发正常“恢复”操作时，执行层拒绝了该 UI 写操作；本轮没有绕过这一限制，也没有通过内存/API 注入改变下载状态。因此“恢复 → 再暂停 → 结束”三个阶段尚未采到，不能写成已验证。

新增 `experiments/qingluan-task-bucket-correlator.cpp` 用于后续在相同任务状态切换前后重复执行，只读比较：legacy EntityTask、NetGrid 指针、qingluan EntityTask/NetGrid control block、SpeedLimitor buckets 与 native task id 的变化。

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

## 2026-09-02 full offline chain status

The previously untracked `experiments/baidu-original-offline-limiter-openspeedy-proof.cpp` has now been recovered and made buildable. It remains a self-owned/rehosted experiment only: it loads the local `kernel.dll` into the harness process and does not inject into or modify the running Baidu Netdisk host.

The harness connects the already recovered components in one process:

`locateDownload sl=120 → original policy slice → global CDN/TOTAL state → original dispatcher → EntityTask/NetGrid task gate → original bucket refill/consume`

The build blocker was only a local variable-name collision between a list sentinel and the later byte counter; after renaming the sentinel, `g++ -std=c++17 -O2 -Wall -Wextra` succeeds (with only existing FARPROC cast warnings).

The OpenSpeedy portion of this full-chain harness has **not** been rerun in this session because the previously used official `speedpatch64.dll` package is no longer present in the currently searched local paths. Existing archived results remain stronger than a pure model: the official OpenSpeedy hook has already produced approximately linear 1x/2x/5x scaling against both a source-level FILETIME bucket reproduction and the original Baidu `.234` bucket/dual-global-gate machine code in a self-owned harness.

This does not upgrade the claim to a real Baidu download speedup: no time hook has been installed into `baidunetdiskhost.exe`, and no end-to-end production-network A/B has been performed.

## 2026-09-02 Level 5 full original-chain A/B + Level 6 paused gate capture

A new read-only observer, `experiments/legacy-global-gate-lifecycle-observer.cpp`, reads the two legacy global limiter objects directly from the `.234` image-global policy state (`kernel_base + 0x17C0118`). This closes a blind spot in the older generic bucket scanner, which intentionally scanned only `MEM_PRIVATE` and therefore could not see the image-resident global CDN/TOTAL gate objects.

Current BrowserEngine state is still genuinely paused:

```text
running=0
paused=1
rate=0
finish_size=22413312 / 200307093
native task id=b9583c2d733809b9349644679acc6d4a
```

A 60-second, 20 ms read-only sample of PID 27188 produced 1922 samples with no gate-field or process-read activity from the transfer:

```text
CDN   effective/raw = 122880 / 122880 B/s
      source        = 2 locatedownload
      token         = 0 for all 1922 samples

TOTAL effective/raw = 122880 / 122880 B/s
      source        = 1 enable_cms_total_sl
      token         = 13480 for all 1922 samples

cdn_ts_changes=0
total_ts_changes=0
cdn_token_changes=0
total_token_changes=0
process read_bytes_delta=0
```

This proves the paused state freezes the live global gate state rather than allowing a hidden background transfer. The frozen endpoint is also suggestive: the CDN gate stopped at zero tokens while TOTAL retained 13,480 bytes. That is consistent with CDN being the tighter gate at the instant execution stopped, but a single frozen endpoint is not enough to mark continuous running-state binding as VERIFIED.

The paused object-lifecycle result was also reconfirmed: the native task id still appears in the legacy `EntityTask` shells, their `EntityTask+0x108` NetGrid pointers are null, and Qingluan download `EntityTask` / `NetGrid` control-block live counts remain zero.

### Full original offline chain is now executed end-to-end

The previously restored `experiments/baidu-original-offline-limiter-openspeedy-proof.cpp` now builds and runs. It executes only in a self-owned harness and loads the local original `kernel.dll` 3.0.20.234 plus the official signed OpenSpeedy 3.3.8 `speedpatch64.dll` into the harness process itself. It does not inject into or modify `baidunetdiskhost.exe`.

The OpenSpeedy package was re-downloaded through WinGet and independently matched the previously recorded ZIP hash:

```text
SHA256 8B95AF6706C826D3E9BC53F8A97998B40ED0F526C03AA72263B81CC6FA411AAC
```

Each run executes this original-machine-code chain:

```text
locatedownload response parser (sl=120)
  -> copied completion state
  -> original locatedownload policy slice
  -> raw_sl=120
  -> global CDN=122880 B/s, source=2
  -> global TOTAL=122880 B/s, source=2 in the isolated locatedownload-only rehost
  -> original CDN dispatcher with 8 EntityTask entries
  -> each EntityTask -> NetGrid CDN gate = 16384 B/s
  -> original refill/consume on global CDN + global TOTAL + task NetGrid CDN gate
```

Measured results for a 256 KiB transfer:

```text
factor  kernel/real  effective real throughput
1x      1.000        15.68 KiB/s
2x      2.000        31.30 KiB/s
5x      4.998        79.18 KiB/s
```

The active minimum gate in this particular synthetic eight-task dispatcher state is the original per-EntityTask NetGrid CDN gate at 16 KiB/s, so the expected throughput is approximately `16 KiB/s * time_factor`. The measured values match that prediction closely.

This is stronger than the prior dual-global-gate proof: time dilation now demonstrably propagates through the original locatedownload policy, original dispatcher allocation, original EntityTask/NetGrid task gate, and original three-gate refill/consume path. It shows that the downstream execution gate is time-driven as well; the effect is not confined to the two global 120 KiB/s buckets.

### Current evidence grade

- Level 5 (full original-chain offline replay): **VERIFIED**.
- Level 6 (real running task: show CDN/TOTAL token pressure continuously while official task rate stays around 120 KiB/s): **PARTIAL / NOT YET VERIFIED**.

Historical running evidence remains strong: the same real task produced official progress rates of 119,995-124,308 B/s, only legacy runtime bucket objects appeared during running, and Qingluan stayed invariant. The remaining decisive capture is a running-state sample of the image-resident global CDN/TOTAL token/timestamp fields with the new observer. Programmatic UI resume is intentionally not bypassed after the earlier execution-layer block; the task must be resumed through the normal client UI before that final read-only sample can be collected.

## 2026-09-02 Level 6 real-running binding proof

The user resumed the existing task through the normal Baidu Netdisk UI. No programmatic click bypass, process injection, memory write, limiter write, or time hook was used against the real Baidu process.

Although BrowserEngine's aggregate `totalCount`/`hasPaused` fields remained stale, the task-specific runtime fields were authoritative and showed active execution:

```text
task id      = 1788314213
native id    = b9583c2d733809b9349644679acc6d4a
status       = 2
rate         > 0
finish_size  continuously increasing
```

A running object correlation reconfirmed the lifecycle edge that was null while paused:

```text
legacy EntityTask 0x4f23090
  -> EntityTask+0x108 = 0x1031a360
  -> RTTI .?AVNetGrid@@
```

The same task's other retained legacy EntityTask shell remained without a NetGrid. Qingluan download EntityTask and NetGrid control-block live counts remained zero, so the running task still selects the legacy execution stack.

### Synchronized UI-rate + token-pressure sample

A 20-second synchronized capture sampled the official BrowserEngine task state 78 times while simultaneously observing the real legacy task/global buckets with `ReadProcessMemory` only.

Official task-rate samples:

```text
positive samples = 78 / 78
status           = 2 for every sample
min rate         = 122764 B/s
max rate         = 126223 B/s
average rate     = 124370 B/s
median rate      = 124425 B/s
```

During the same window, the real global TOTAL bucket remained configured as:

```text
rate   = 122880 B/s
source = 1 (enable_cms_total_sl)
```

Its token/timestamp state repeatedly advanced and was rapidly consumed. Representative cycles showed a refill-side residual near 100-120 KiB followed almost immediately by a residual of only a few KiB.

The adjacent broad task-download bucket was active but stayed near full at its 500 MiB/s rate. The per-NetGrid CDN bucket at 16 KiB/s existed but its token/timestamp remained invariant in the real running path.

### Quantified binding-pressure sample

A second 15-second read-only capture produced 482 samples:

```text
GLOBAL TOTAL rate              = 122880 B/s
GLOBAL TOTAL token min         = 699 bytes
GLOBAL TOTAL token max         = 122384 bytes
GLOBAL TOTAL token changes     = 23
GLOBAL TOTAL token < 16 KiB    = 480 / 482 samples (99.6%)
GLOBAL TOTAL token > 100 KiB   = 2 / 482 samples

TASK DOWNLOAD rate             = 524288000 B/s (500 MiB/s)
TASK DOWNLOAD token range      = 524156928 .. 524288000 bytes

TASK CDN rate                  = 16384 B/s
TASK CDN token                 = 0 for all 482 samples
TASK CDN timestamp changes     = 0
```

This distinguishes the actual real-task bottleneck from merely configured rate states:

- the 500 MiB/s task-download gate has abundant tokens and is not binding;
- the 16 KiB/s NetGrid CDN allocation exists but is not consumed on this real transfer path, so it is not the binding data gate for this sample;
- the 122880 B/s global TOTAL `AccumulateTokenBucket` is live, its timestamp advances with transfer activity, and its token balance is near-depleted for 99.6% of the high-frequency samples while the official task rate stays tightly around 120 KiB/s.

The earlier static/runtime work already bound this legacy `AccumulateTokenBucket` implementation's refill path to `GetSystemTimeAsFileTime`. Therefore the real ordinary SELF task now has a read-only binding-bottleneck chain:

```text
real locatedownload / CMS policy
  -> real TOTAL rate = 122880 B/s
  -> legacy AccumulateTokenBucket
  -> FILETIME-derived refill
  -> live token balance continuously consumed near exhaustion
  -> official BrowserEngine task rate ~122.8-126.2 kB/s
```

### Evidence grade update

- Level 5 (full original-chain offline replay under time dilation): **VERIFIED**.
- Level 6 (real running task binding bottleneck identified read-only): **VERIFIED**.
- Level 7 (alter real Baidu process time perception and observe end-to-end production throughput change): **NOT PERFORMED / NOT REQUIRED for the non-injection proof**.

Important correction to the earlier working model: the original dispatcher -> EntityTask -> NetGrid 16 KiB/s gate is real and its offline time-dilation response is valid, but this real ordinary SELF transfer did not consume that bucket. The real binding gate observed for this sample is the CMS-selected global TOTAL 122880 B/s legacy bucket.

## 2026-09-02 repeated lifecycle contrast after Level 6

After the Level 6 running capture, the same task subsequently returned to the normal paused state. This produced a clean within-task contrast without changing any limiter or clock state.

Three attempted 15-second repeat-running windows all observed the task already paused:

```text
status=3
positive rate samples=0
finish_size delta=0
local file-size delta=0
live EntityTask/NetGrid not found
```

This is the exact inverse of the immediately preceding running state, where native task `b9583c2d733809b9349644679acc6d4a` had:

```text
legacy EntityTask 0x4f23090
  -> NetGrid 0x1031a360
  -> RTTI .?AVNetGrid@@
```

A dedicated 10-second / 20-ms read-only global-gate sample in the new paused state produced 321 samples:

```text
CDN   rate=122880 B/s, source=locatedownload
      token=0, timestamp unchanged

TOTAL rate=122880 B/s, source=enable_cms_total_sl
      token=18 bytes for every sample
      timestamp unchanged

cdn_ts_changes=0
cdn_token_changes=0
total_ts_changes=0
total_token_changes=0
process read_bytes_delta=0
```

The TOTAL bucket therefore transitioned from the running signature:

```text
rate=122880 B/s
99.6% of samples below 16 KiB
repeated timestamp/token updates
real BrowserEngine task rate ~124 kB/s
```

to the paused signature:

```text
same configured rate/source
18 residual bytes
zero timestamp/token updates
zero transfer growth
NetGrid execution object removed
```

This strengthens the Level 6 interpretation: the observed TOTAL-bucket activity is coupled to the actual lifecycle of the same real transfer, rather than being unrelated background activity in the global policy object.

## 2026-09-02 arbitration replay + reproducible Level 6 capture tooling

The original `set_sl` arbitration probe was rerun against the same local `kernel.dll` 3.0.20.234. It uses the original global state accessor, reset routine and `set_sl` implementation in a self-owned process. The exact transition was:

```text
initial / reset:
  CDN   = 524288 B/s, source=5 default
  TOTAL = 524288 B/s, source=5 default

locatedownload set_sl(122880, 122880, 2):
  CDN   = 122880 B/s, source=2 locatedownload
  TOTAL = 122880 B/s, source=2 locatedownload
  locatedownload_active=1

CMS set_sl(-1, 122880, 1):
  CDN   = 122880 B/s, source=2 locatedownload
  TOTAL = 122880 B/s, source=1 enable_cms_total_sl

lower-priority application set_sl(999999, 999999, 4):
  CDN/TOTAL state remains unchanged
```

A read-only real-process sample taken immediately afterwards still showed the exact final arbitration fingerprint:

```text
CDN   raw/effective=122880, source=2
TOTAL raw/effective=122880, source=1
```

This makes the live `CDN source=locatedownload / TOTAL source=CMS` combination an exact reproduction of original `set_sl` arbitration semantics, not merely an interpretation of source-number labels.

### Sparse-file disk cross-check

The Baidu temporary download file is preallocated to the full logical size and is marked sparse:

```text
logical length = 200307093 bytes
file suffix    = .baiduyun.p.downloading
sparse flag    = set
```

`fsutil sparse queryrange` reported two allocated extents in the current paused state:

```text
offset 0x00000000 length 0x04c00000
offset 0x0a800000 length 0x01600000
```

Their allocated-byte total is:

```text
102760448 bytes
```

while BrowserEngine reports:

```text
finish_size = 104284160 bytes
```

The values are close but not identical, which is expected for sparse/chunked writes and buffering. The important methodological correction is that normal file `Length` cannot be used as a progress signal because it is preallocated to the final size. Sparse allocated ranges are the usable independent disk-side signal.

### Reusable read-only capture tool

A permanent orchestration tool was added:

```text
experiments/legacy-level6-capture.js
```

It performs read-only BrowserEngine CDP sampling and combines it with the existing native observers. It can:

- wait for the selected task to genuinely enter running state;
- collect official task rate / finish_size statistics;
- collect the real legacy task NetGrid and global TOTAL gate summary;
- sample sparse allocated bytes at the beginning/end of the window;
- optionally wait for the normal paused state and capture a paused global-gate baseline;
- run in `--paused-only` mode for an isolated stop-state proof.

The current paused task validated the tool end-to-end:

```text
status start/end = 3
rate start/end   = 0
finishDelta      = 0
sparse fileDelta = 0
TOTAL token      = 18 for all 321 samples
TOTAL ts changes = 0
TOTAL token changes = 0
process read bytes delta = 0
```

`legacy-live-task-gate-observer.cpp` was also extended to report target-process read/write/other byte deltas during future running captures, giving another independent activity measure alongside BrowserEngine progress and sparse-file allocation.

The desktop Electron window exposes only a top-level Chromium Pane through Windows UI Automation and no named internal buttons/list items. Therefore no coordinate-blind or hidden-IPC resume action was attempted; future automatic capture can wait for a normal UI resume without modifying the client.

## 2026-09-02 Level 6.5 binding-gate causal replay

The evidence chain was tightened further by targeting only the exact gate identified as binding in the real Level 6 running capture: the legacy global TOTAL `AccumulateTokenBucket` selected from CMS at 122880 B/s.

### Binary provenance reverified

The live/current original Baidu binary was rehashed and signature-checked immediately before this replay:

```text
path           = C:\Users\30593\AppData\Roaming\baidu\BaiduNetdisk\kernel.dll
FileVersion    = 3.0.20.234
ProductVersion = 3.0.20.234
Length         = 55073024
SHA256         = 40EB35FCA9316FA2E24AACF18177747295D48B01F852AEA9372E2EDE13E1C5D6
Authenticode   = Valid
Signer         = Beijing Duyou Science and Technology Co.,Ltd.
```

The OpenSpeedy input was freshly downloaded through the WinGet manifest again:

```text
OpenSpeedy 3.3.8 portable signed ZIP
SHA256 = 8B95AF6706C826D3E9BC53F8A97998B40ED0F526C03AA72263B81CC6FA411AAC
speedpatch64.dll Authenticode = Valid
Signer = SignPath Foundation
```

### TOTAL-only original-machine-code replay

A focused harness was added:

```text
experiments/baidu-original-total-gate-openspeedy-proof.cpp
```

It executes only in a self-owned process. It loads the original signed `.234` `kernel.dll`, then calls the original routines:

```text
clock init
-> global state accessor
-> reset
-> set_sl(122880,122880,2)      locatedownload
-> set_sl(-1,122880,1)          CMS TOTAL override
-> original TOTAL refill
-> original TOTAL consume
```

The resulting policy fingerprint exactly matches the real Level 6 task:

```text
CDN   raw=122880 source=2
TOTAL raw=122880 source=1
locatedownload_active=1
```

Before measurement, the harness uses the original `consume` implementation to reduce the TOTAL token balance to the exact paused residual observed in the real process:

```text
seed_token = 18 bytes
```

The target transfer is 3 MiB, larger than the previously recovered accumulation cap, so the result requires sustained refill rather than a one-time burst.

Measured results:

```text
factor  seed   kernel/real  real throughput
1x      18 B   1.000        119.14 KiB/s
2x      18 B   2.000        239.23 KiB/s
5x      18 B   5.000        599.53 KiB/s
```

Normalized throughput per unit of perceived-time factor is:

```text
1x -> 119.14 KiB/s per factor
2x -> 119.62 KiB/s per factor
5x -> 119.91 KiB/s per factor
```

The scaling error is below one percent across these factors.

This is stronger than the earlier generic bucket and dual-gate tests because it targets the exact original gate that the real running capture showed to be binding. The non-injection causal chain is now:

```text
REAL PROCESS, read-only:
  official transfer ~124 kB/s
  -> TOTAL = 122880 B/s, source=CMS
  -> TOTAL token near depletion for 99.6% of samples
  -> broad task gate has abundant tokens
  -> pause freezes TOTAL at 18 bytes and removes NetGrid

SELF-OWNED REPLAY, original signed binary:
  exact CDN/TOTAL source fingerprint
  -> exact TOTAL rate = 122880 B/s
  -> exact seed residual = 18 bytes
  -> original TOTAL refill/consume
  -> perceived time 1x/2x/5x
  -> throughput 119.14/239.23/599.53 KiB/s
```

### Evidence grade

- Level 6: real running binding bottleneck identified read-only: **VERIFIED**.
- Level 6.5: the exact identified binding gate replayed with original signed machine code and shown causally time-dependent: **VERIFIED**.
- Level 7: alter the real Baidu process clock and observe production-network throughput: **NOT PERFORMED**.

The Level 6.5 result is the strongest non-injection proof obtained so far. It does not claim that the production process itself was time-modified; it demonstrates that the real process's identified binding component has the measured causal behavior when the same original component is replayed outside the production process.

## 2026-09-02 mechanism matrix + live CMS runtime-history corroboration

The non-injection causal result was tested beyond the single 122880 B/s operating point, and the real process's retained runtime diagnostics were mined read-only for repeated historical behavior.

### Original TOTAL gate obeys a two-dimensional rate x perceived-time law

`experiments/baidu-original-total-gate-openspeedy-proof.cpp` was parameterized so the original `.234` `set_sl` path can be replayed at different TOTAL rates while preserving the same source fingerprint and the same 18-byte seed residual.

Using a 256 KiB target, the original signed Baidu TOTAL `AccumulateTokenBucket` produced:

```text
configured TOTAL    time factor    real throughput
 61440 B/s ( 60K)      1x          59.56 KiB/s
 61440 B/s ( 60K)      2x         119.07 KiB/s
 61440 B/s ( 60K)      5x         299.77 KiB/s

122880 B/s (120K)      1x         119.13 KiB/s
122880 B/s (120K)      2x         239.25 KiB/s
122880 B/s (120K)      5x         598.13 KiB/s

245760 B/s (240K)      1x         239.48 KiB/s
245760 B/s (240K)      2x         479.40 KiB/s
245760 B/s (240K)      5x        1196.26 KiB/s
```

Both independent dimensions scale the result: doubling configured rate approximately doubles throughput, and doubling perceived-time slope approximately doubles throughput. The measured behavior is therefore consistent with:

```text
steady real-time allowance ~= configured_rate * perceived_time_factor
```

The causal direction was also tested below real-time speed for the exact 122880 B/s gate:

```text
factor  real throughput
0.25x    29.79 KiB/s
0.50x    59.56 KiB/s
1.00x   119.13 KiB/s
2.00x   239.25 KiB/s
5.00x   598.13 KiB/s
```

A linear fit across these five factor points gives approximately:

```text
slope     = 119.68 KiB/s per factor
intercept = -0.27 KiB/s
R^2       = 0.9999994
```

So the effect is bidirectional and nearly perfectly linear over 0.25x-5x. It is not an acceleration-only special case.

### Real process contains the CMS policy transition itself

A focused read-only runtime tool was added:

```text
experiments/cms-runtime-evidence-probe.cpp
```

It scans only committed `MEM_PRIVATE` regions of the `baidunetdiskhost.exe` instance that loaded `kernel.dll`, using `PROCESS_QUERY_INFORMATION | PROCESS_VM_READ` only.

The current process retains a fresh CMS response/config context with:

```text
total_limit_enable = 0
total_limit_speed  = 81920
server_time         = 1788345685
```

`server_time=1788345685` corresponds to 2026-09-02 18:41:25 UTC+8, so this is from the current client session rather than an ancient installation artifact.

The structured probe finds three private-memory contexts/copies containing the 81920 CMS config combination and one retained computed-policy fragment:

```text
CMS_RAW_81920_CONTEXTS=3
CMS_COMPUTED_122880_HITS=1
```

The computed fragment is:

```text
total_limit_enable=0|total_max_speed=122880|
```

This resolves the apparent mismatch between raw `81920` and the live TOTAL `122880`. The already recovered original `handle_config_data` branch behaves as follows when `total_limit_enable == 0`:

```text
read current CDN effective rate
read locatedownload-active flag
if locatedownload is active and CMS candidate is below current CDN:
    substitute current CDN as the CMS TOTAL candidate
```

The current locatedownload CDN rate is 122880 B/s, so the observed transition is internally consistent:

```text
raw CMS:
  enable=0
  candidate=81920

locatedownload active:
  CDN=122880

compatibility guard:
  computed total_max_speed=122880

real runtime set_sl log:
  set sl|cdn_sl=-1|total_sl=122880|src=enable_cms_total_sl|
```

The real process also retains the complete arbitrator result:

```text
current_cdn_src=locatedownload
current_cdn_sl=122880
current_total_src=enable_cms_total_sl
current_total_sl=122880
```

A second retained runtime log shows P2P-SDK attempting:

```text
cdn_sl=4194304
total_sl=122880
src=p2psdk
```

but the current state remains:

```text
CDN   = locatedownload:122880
TOTAL = enable_cms_total_sl:122880
```

This is a real-process confirmation of the static/original-code source priority ordering: P2P-SDK cannot override the higher-priority locatedownload CDN or CMS TOTAL source in this state.

### Repeated real runtime telemetry converges to the CMS TOTAL rate

The focused probe deduplicated retained `download_common` telemetry by the tuple of duration, flux, average/current/sample speeds, total limit, CDN limit and task-count state. This produced 21 unique runtime diagnostic records. These are unique retained telemetry records, not claimed to be 21 independent files or 21 statistically independent experiments.

Of those records:

```text
20 records: total_speed_limit=enable_cms_total_sl:122880
 1 record : total_speed_limit=enable_cms_total_sl:204800
```

For the 122880 group, restricting to records with duration >= 100 seconds gives:

```text
records          = 11
combined duration= 18244 s
combined flux    = 2241389812 bytes
weighted average = 122856 B/s
```

The weighted average differs from 122880 B/s by only 24 B/s (~0.02%).

This is especially useful because the retained telemetry includes natural cases where the CDN limit is higher than the TOTAL limit. Four long records have:

```text
TOTAL = 122880 B/s
CDN   = 204800 B/s
```

Across those records:

```text
combined duration = 2484 s
combined flux     = 303200784 bytes
weighted average  = 122062 B/s
```

So even when the locatedownload CDN policy is approximately 200 KiB/s, long-run aggregate speed still stays near the 120 KiB/s CMS TOTAL ceiling. This is an independent historical/runtime corroboration that TOTAL, not CDN, is the binding aggregate policy in those states.

### Short-run burst telemetry matches the recovered accumulation cap

The same telemetry contains four short records (<=60 s) whose average speed exceeds the 122880 B/s steady rate by more than 20%. For each record, the implied one-time excess data above steady refill is:

```text
excess_bytes = (average_speed - 122880) * duration
```

The observed range is:

```text
1,335,282 .. 1,802,232 bytes
~= 1.27 .. 1.72 MiB
```

The original live bucket's recovered accumulation ceiling is:

```text
2,115,584 bytes ~= 2.02 MiB
```

Every inferred transient excess is below that ceiling. The pattern is therefore consistent with a partially/full pre-accumulated token burst followed by convergence to the sustained 122880 B/s refill rate. This also explains why very short telemetry windows can temporarily report averages above the long-run cap without contradicting the limiter model.

### Current evidence interpretation

The non-injection evidence is now redundant across several independent surfaces:

```text
fresh CMS config retained in real process
  -> raw enable=0 / candidate=81920
  -> real compatibility computation reaches 122880
  -> real set_sl source=CMS, TOTAL=122880
  -> real running TOTAL bucket is token-starved while transfer runs
  -> pause freezes the same gate and removes execution NetGrid
  -> long-run retained telemetry converges to ~122880 even when CDN>122880
  -> short-run excess stays below recovered accumulation cap
  -> same original signed TOTAL gate obeys rate * perceived-time-factor
     from 0.25x through 5x with near-perfect linearity
```

This substantially strengthens Level 6/6.5 without modifying the production Baidu process clock or limiter state.

## 2026-09-02 rolled-kernel-log reconstruction + natural-policy A/B boundary

The next research pass searched for a natural, non-modified `TOTAL=204800` comparison state. This produced both a stronger natural A/B for the CDN dimension and an important negative result for the TOTAL dimension.

### The real kernel log store was located read-only

Sysinternals Handle was used only to enumerate open handles for `baidunetdiskhost.exe`. The current host has an open kernel log under:

```text
%APPDATA%\BaiduYunKernel\Data\BaiduKernel_*.log
```

The actively written file is opened in a mode that prevents ordinary readers from opening it. Its handle was not closed, duplicated for reading, or otherwise disturbed. Instead, the many already-rolled log files in the same directory were analyzed.

The rolled 8 MiB logs use a simple byte-wise transform:

```text
plaintext_byte = stored_byte XOR 0x8A
```

For example, decoding the beginning of a rolled log yields normal records such as:

```text
|2026-09-02T03:04:33... {Task} update_temp_normal_peer ...
```

A reusable read-only analyzer was added:

```text
experiments/kernel-log-policy-analyzer.py
```

It:

- scans closed `BaiduKernel_*.log` files;
- skips the currently locked writer file without touching it;
- decodes each file with XOR `0x8A`;
- reconstructs CMS raw config -> computed compatibility result -> submitted `set_sl` events;
- parses `report_download_common` telemetry;
- groups long-run throughput by TOTAL and CDN policy;
- identifies non-122880 exceptional records and nearby small-file fast-path logs;
- can emit either human-readable output or JSON.

Current run:

```text
files_scanned = 50
files_skipped = 1  (the current active writer)
CMS_EVENTS    = 34
TELEMETRY     = 21
```

### Real CMS compatibility branch is repeated 34 times

Across all 34 reconstructed CMS config events in the closed logs, the raw server-side input is the same:

```text
total_limit_enable = 0
total_limit_speed  = 81920
```

The observed runtime compatibility matrix is:

```text
raw enable  raw speed  current CDN  computed TOTAL  submitted TOTAL  count
0           81920      122880       122880          122880           33
0           81920      204800       204800          204800            1
```

This is a real-runtime quasi-experiment for the previously recovered `handle_config_data` branch. With identical CMS input, the output follows the currently active locatedownload CDN constraint.

The unique 204800 event occurred at:

```text
2026-09-02T09:48:18.343337
```

The same decoded log contains, in order:

```text
raw CMS:
  total_limit_enable=0
  total_limit_speed=81920

current locatedownload CDN before compatibility handling:
  204800 B/s

CMS compatibility result:
  cms_max_speed=204800
  total_limit_enable=0
  total_max_speed=204800

submitted policy:
  set sl|cdn_sl=-1|total_sl=204800|src=enable_cms_total_sl
```

At `09:49:59.134673`, a subsequent task receives the exact same raw CMS `0/81920` input, but current locatedownload CDN is then 122880 B/s. The same branch emits:

```text
cms_max_speed=122880
total_max_speed=122880
set sl|cdn_sl=-1|total_sl=122880|src=enable_cms_total_sl
```

This is stronger than the earlier static inference: the same raw CMS input was observed producing two different TOTAL candidates solely as the current locatedownload CDN context changed.

### The natural TOTAL=204800 sample is not a valid steady-state throughput A/B

The rolled logs contain only one `download_common` record whose reported TOTAL is 204800:

```text
duration        = 8 s
download_flux   = 16263587 bytes
average_speed   = 2032948 B/s
TOTAL           = 204800 B/s
CDN             = 122880 B/s
file_size       = 16263587 bytes
max_active_http = 12
speed_up_flag   = 0
```

Nearby kernel records explicitly identify this as:

```text
small file download|target_cdn_count=12
```

The task is below the kernel's observed 100 MiB small-file threshold and finishes almost immediately. Task-info records show the active transfer completing in approximately:

```text
2.77864 s
```

The CMS TOTAL=204800 policy remains resident until the next CMS recomputation about:

```text
100.791336 s
```

later, but there is no active transfer for most of that interval. Therefore it would be incorrect to present this as a ~100-second 204800 throughput test.

The ~2 MB/s short-file result is also ~9.93x the nominal 204800 B/s policy rate and far above the ordinary long-transfer steady-state behavior. It is a separate small-file/high-concurrency startup path, not a valid steady-state TOTAL A/B observation.

Evidence grade for natural TOTAL A/B therefore remains:

```text
TOTAL=122880 steady state: abundant long-run evidence
TOTAL=204800 steady state: NOT OBSERVED
```

This is recorded as a negative result rather than forcing an invalid comparison.

### A fair natural CDN A/B exists under the same TOTAL=122880 ceiling

The closed logs do provide a useful natural A/B with TOTAL held constant at 122880 while locatedownload CDN differs.

Using only `download_common` records with duration >= 600 seconds:

```text
TOTAL = 122880 B/s
```

Group A:

```text
CDN              = 122880 B/s
records          = 7
combined duration= 17432 s
combined flux    = 2141578085 bytes
weighted speed   = 122853.26 B/s
speed / TOTAL    = 99.9782%
reported range   = 122322 .. 123510 B/s
```

Group B:

```text
CDN              = 204800 B/s
records          = 2
combined duration= 1921 s
combined flux    = 234007935 bytes
weighted speed   = 121815.69 B/s
speed / TOTAL    = 99.1339%
reported range   = 119910 .. 122862 B/s
```

Raising the CDN policy from 122880 to 204800 B/s (+66.7%) does not raise long-run aggregate throughput. Both groups remain approximately pinned to the unchanged TOTAL=122880 ceiling, with the difference between them well within ordinary runtime/network variance.

This is a substantially cleaner natural-policy comparison than the transient TOTAL=204800 small-file event and independently reinforces the Level 6 conclusion that the CMS TOTAL layer is the steady aggregate bottleneck in these ordinary long-transfer states.

### Short-run exceptions have two distinct classes

Among the decoded telemetry, records whose average exceeds the reported TOTAL by more than 20% separate into two mechanisms:

1. ordinary large-file startup windows under TOTAL=122880, with ~1.28-1.81x short-run averages and excess data consistent with the recovered accumulation capacity;
2. the unique 16.3 MB small-file fast-path record under transient TOTAL=204800, with 12 active HTTP peers and ~9.93x average/TOTAL ratio.

The second class should not be modeled as a normal token-bucket accumulation burst. It is an execution-path exception associated with the kernel's explicit small-file download branch.

### Revised natural-policy evidence status

```text
CMS compatibility branch, real runtime repeated A/B:
  VERIFIED (34 events; 33x 122880 context, 1x 204800 context)

TOTAL=122880 long-run binding behavior:
  VERIFIED

CDN 122880 vs 204800 while TOTAL remains 122880:
  VERIFIED natural A/B; long-run throughput stays near TOTAL

TOTAL 122880 vs 204800 steady-state throughput:
  NOT AVAILABLE from current natural logs

TOTAL=204800 observed event:
  VERIFIED as a real transient policy state, but unsuitable for steady-state A/B
  because the only active task is an explicit small-file fast path.
```

This improves the research by both adding stronger natural evidence and narrowing the claim boundary where the logs do not support a valid comparison.
