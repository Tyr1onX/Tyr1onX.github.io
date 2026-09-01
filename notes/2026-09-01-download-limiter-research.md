# 从 120 KiB/s 到 Token Bucket：一次下载限速机制的逆向记录

今天做了一次很完整的客户端限速机制排查。

起点其实只是一个很简单的问题：为什么以前有些“变速”工具似乎会影响百度网盘的下载速度？如果这种现象不是错觉，那么客户端内部是不是存在依赖时间推进的限速逻辑？

一开始这只是一个猜想。真正有意思的部分，是把猜想一步一步变成可以互相印证的证据。

这篇记录不讨论如何绕过某个服务的限制，只记录我今天学到的逆向方法、限速器结构，以及怎样区分“看起来合理”和“真的被证据支持”。

---

## 一、先不要急着找“限速函数”

如果一上来就拿二进制搜索 `speed_limit`，很容易得到大量看似相关、实际无关的结果。

更稳妥的方式，是先从外部行为建立基线。

这次我先观察了一个普通下载任务的真实吞吐。不同采样方式得到的长期结果都接近：

- 系统接收流量约 120 KiB/s；
- 进程 I/O 也长期围绕这个数量级波动；
- 单秒速度并不完全恒定，而是会出现轻微突发。

随后在客户端资源配置里发现了：

```text
122880 B/s
```

换算后正好是：

```text
120 KiB/s
```

这一步非常重要。

它还不能证明“122880 就是当前限速器真正使用的值”，但已经形成了第一组独立证据：

```text
静态默认值 ≈ 运行时长期吞吐
```

如果后面还能找到真正的 rate limiter，并且它的 rate 也能接到这个值上，证据链才算继续闭合。

---

## 二、客户端并不是只有一个“下载速度变量”

继续向下看之后，发现实际结构比“一个 max_download_speed”复杂得多。

二进制中可以看到很多相关概念：

```text
download_rate
max_download_speed
global_max_download_speed
file_speed_limit
total_speed_limit
UserSpeedLimit
p2s_limit_speed
global_token
task_token
peer_token
cdn_token
```

这提示限速很可能是分层的，而不是单点判断。

后来出现的日志字符串进一步说明了这一点：客户端同时维护 Global、Task、Peer、CDN/P2P 等不同层级的 token 状态。

可以把它抽象成：

```text
Global / Total budget
        ↓
Task budget
        ↓
Peer / CDN / P2P budget
        ↓
最终允许读取的数据量
```

所以真实吞吐更接近：

```text
min(
  客户端总限速,
  任务限速,
  Peer/CDN/P2P 限制,
  服务端策略,
  当前网络能力
)
```

这也解释了为什么只找到客户端限速器，并不能推出“整个下载速度完全由客户端决定”。

---

## 三、Token Bucket 从猜测变成了真实类

最关键的突破来自 RTTI 和类型字符串。

在 `kernel.dll` 中直接出现了这些真实 C++ 类型：

```text
TokenBucket
AccumulateTokenBucket
DownloadBandWidthManager
qingluan::common::TokenBucket
qingluan::common::AccumulateTokenBucket
```

这意味着“令牌桶”不再只是根据日志猜测出来的模型，而是客户端里真实实现的类。

通过 MSVC RTTI、Complete Object Locator 和虚表继续向下，可以恢复出 bucket 的核心行为。

普通 Token Bucket 的逻辑大致是：

```cpp
void update() {
    auto now = clock_ms();
    auto elapsed = now - last_time;
    last_time = now;

    auto added = elapsed * rate / 1000;
    tokens += added;

    if (tokens > capacity)
        tokens = capacity;
}
```

也就是说：

> 下载资格不是每秒一次性发放，而是随着时间持续补充 token。

如果 rate 是：

```text
122880 B/s
```

那么理论补充量就是：

```text
100 ms  → 12288 B
1 s     → 122880 B
```

这和实际观察到的 120 KiB/s 再次对应起来。

---

## 四、为什么速度不是一条完全平直的直线

这里还出现了另一个很有意思的类：

```text
AccumulateTokenBucket
```

相比最简单的 Token Bucket，它允许一定程度的 token 累积。

这意味着即使长期平均值被控制在某个 rate 附近，短时间仍可能出现：

```text
80 KiB/s
150 KiB/s
110 KiB/s
130 KiB/s
```

只要较长时间窗口内重新回到预算范围即可。

因此运行时看到“偶尔超过 120 KiB/s”，并不能直接证明限速失效。

反过来，这种轻微 burst 反而和累积令牌桶的行为很吻合。

这也是今天一个很实用的经验：

> 分析限速器时，不要只盯某一个瞬时速度，要看足够长时间的平均值和 burst 行为。

---

## 五、时间源真的进入了 refill 公式

接下来最关键的问题是：

> Token Bucket 的 `elapsed` 到底从哪里来？

在 qingluan 这一套实现里，调用链可以恢复成：

```text
QueryPerformanceCounter
        ↓
QPC × 1e9 / QueryPerformanceFrequency
        ↓
纳秒
        ↓
毫秒
        ↓
elapsed_ms × rate / 1000
        ↓
补充 token
```

也就是说，至少这一套真实下载限速器明确依赖高精度单调时钟推进。

这让“修改进程所感知的时间会影响 token refill”从纯理论变成了一个技术上完全成立的解释。

不过这里仍然要区分两个结论：

可以确认的是：

> 客户端存在真实的、依赖时间差补充 token 的限速器。

不能直接确认的是：

> 改变任意一个时间 API 就一定能改变当前所有下载任务的最终速度。

因为实际客户端里存在多个时钟源、多个 bucket、不同执行栈以及服务端策略。

---

## 六、客户端内部实际上存在两代下载栈

今天另一个很大的收获，是发现百度网盘当前客户端里并不是只有一套下载实现。

一边可以看到旧的下载/P2P Kernel 路径；另一边则存在完整的 qingluan 下载体系：

```text
qingluan::download::DownloadService
qingluan::download::TaskContainer
qingluan::download::TaskImpl
qingluan::download::EntityTask
qingluan::download::SpeedLimitor
```

甚至还有源码路径残留：

```text
qingluan-download/project/src/...
```

这说明客户端正在长期保留兼容层或进行逐步迁移，而不是一次性把旧实现完全替换掉。

运行时进一步验证了这一点。

只扫描进程私有内存、排除 DLL 自己携带的静态日志模板后，我能看到真实格式化过的：

```text
download_common
```

却没有看到：

```text
download_common_qingluan
```

因此今天那批实际测到约 120 KiB/s 的普通任务，确实是在 legacy 下载执行栈中运行。

这很重要，因为它避免了一个常见误判：

> “二进制里有某个类”不等于“当前任务正在使用这个类”。

---

## 七、qingluan 的 SpeedLimitor 比想象中完整

虽然今天的实际任务走的是旧栈，但 qingluan 的限速结构反而被还原得更完整。

它内部不是一个 bucket，而是至少区分：

```text
Total
Peer
```

并且每种策略有 source 优先级。

概念上包括：

```text
User
P2P
P2S
Application
Default
```

Total 与 Peer 两组分别仲裁。

可以理解为：

```text
总预算控制整个任务/下载器能吃多少
Peer 预算再限制单个数据来源能贡献多少
```

更有意思的是，它内部有 4 个连续的 `AccumulateTokenBucket`：

```text
Live Peer
Shadow Peer
Live Total
Shadow Total
```

继续跟踪之后发现，Shadow bucket 不是另一层长期限速，而是给 speedup 状态切换保存现场。

逻辑大致是：

```text
开启 speedup
  ↓
保存当前 live bucket + source
  ↓
临时放宽 live bucket
  ↓
关闭 speedup
  ↓
把原来的 bucket 状态恢复回来
```

而恢复的是整个 bucket 状态，不只是单独恢复一个 rate。

这是一种很典型、也很值得学习的工程设计：

> 临时策略不要破坏原状态，而是快照 → 替换 → 恢复。

---

## 八、旧栈和新栈之间还有 Adapter

继续研究后又发现，架构并不是简单的：

```text
上层
 ├─ legacy API
 └─ qingluan API
```

而更像：

```text
上层统一/兼容 API
        ↓
DownloadTaskAdapter
        ↓
  legacy / qingluan backend
```

目前已经定位到真实类型：

```text
services::p2p_kernel::DownloadTaskAdapter
services::p2p_kernel::DownloadTask
```

以及源码路径：

```text
services/content/download/download_task_adapter.cpp
```

同时 qingluan 内部还有 inside task id，外层则维持 outside task handle。

这种设计可以让上层长期使用相对稳定的任务接口，而底层逐步替换实现。

这其实比“找到限速代码”更有价值，因为它解释了为什么同一版本客户端里可以同时保留两套行为明显不同的下载引擎。

---

## 九、今天真正学到的逆向方法

比具体结论更值得保留的是这套流程。

### 1. 先做黑盒基线

先回答：

```text
真实速度是多少？
长期平均是多少？
是否有 burst？
```

没有基线，后面的静态字符串很容易被过度解释。

### 2. 静态字符串只能当入口

`speed_limit`、`token`、`bucket` 都只是线索。

必须继续确认：

- 是否有代码 xref；
- 是否属于真实类；
- 是否被构造；
- 当前运行任务是否真的走到这里。

### 3. RTTI 非常有价值

MSVC 二进制即使没有符号文件，也可能残留：

```text
TypeDescriptor
Complete Object Locator
vtable
```

它们能帮助恢复真正的类结构，而不是只靠字符串猜函数职责。

### 4. 要区分“存在”和“正在使用”

这是今天最重要的一点之一。

二进制中同时存在 legacy 与 qingluan，如果不做运行态验证，很容易把 qingluan 的结论错误套到今天真正工作的 legacy 下载任务上。

### 5. 每个推断都要允许撤回

过程中有一次内存窗口看起来像出现了 `No such node`，似乎能证明某个配置不存在。

但后续精确匹配无法复现，因此这个判断被撤回。

这是正常的。

逆向最危险的不是看错一次，而是因为已经说出口，就不愿意推翻前面的解释。

---

## 十、目前还没有完全解开的地方

现在最大的未解点已经很集中：

```text
普通 DownloadTask
        ↓
DownloadTaskAdapter
        ↓
什么条件决定？
   ┌────┴────┐
legacy    qingluan
```

已经确认存在：

```text
network / enable_ql_pan_download
```

而且代码默认值是开启状态。

但当前运行时最终配置值、以及总开关之后还有哪些任务级 eligibility 条件，还没有完全闭环。

下一步应该继续沿 `DownloadTaskAdapter` 的构造和调用链向上追，而不是继续盲目搜索更多 `qingluan` 字符串。

---

## 十一、关于最开始那个问题

回到最初的问题：为什么某些历史版本里，修改进程时间感知的工具可能会影响下载速度？

现在可以给出一个比最开始更严谨的解释：

客户端真实存在以时间差补充 token/quota 的限速机制；legacy 与 qingluan 两套下载栈中都能看到时间驱动的速率控制设计，只是具体实现和时钟源不同。

因此，历史上“时间变快后限速行为发生变化”在机制上是合理的。

但客户端后来加入或切换了更多层级的预算、不同时间源、Peer/CDN/P2P 控制、任务适配以及服务端策略之后，单独改变某个时间源就未必还能得到相同效果，甚至可能产生完全相反的行为。

这也是今天这次研究最有意思的地方：

> 一个看似很简单的“为什么下载只有 120 KiB/s”，最后背后连着配置系统、会员策略、令牌桶、时间源、带宽管理器、双下载栈、Adapter 和服务端共同作用。

真正需要学习的不是某个具体限制怎么绕过去，而是怎样把这些层一层层拆开，并且只相信能被不同证据互相验证的结论。


---

## 十二、继续追踪：新后端不是“配置一开就立即接管”

继续沿 `create_p2sp_task` 向下追后，下载管理器里出现了一个很关键的布尔状态。它在构造时默认是 `false`，公共创建入口最后会依据它在两套路径之间二选一。

概念上可以写成：

```cpp
if (new_backend_enabled) {
    create_via_new_task_state_machine(...);
} else {
    create_via_legacy_queue(...);
}
```

`false` 路径更像旧任务链表/队列；`true` 路径会出现 `add new task`、`create_task`、`create new task`、`found create task` 等完整任务状态机。

更重要的是，这个状态并不是在构造时直接根据 `enable_ql_pan_download` 赋值。继续追调用链后发现：

```text
yunp2p_init
    ↓
初始化下载/P2P manager
    ↓
注册已有任务枚举 callback
    ↓
on_enum_task
    ↓
处理/迁移已有任务
    ↓
atomic enabled = true
    ↓
重新投递此前等待的任务
```

也就是说，`enable_ql_pan_download` 更像“允许新路径”的配置条件，而 manager 自己还有一个运行期 readiness 状态。新后端需要先完成初始化和已有任务枚举，之后才真正切换。

这解释了一个之前看起来矛盾的现象：二进制中 `enable_ql_pan_download` 的默认值可以是开启的，但某个真实任务仍可能暂时或最终走 legacy。

目前更合理的模型是：

```text
任务类型 / Workspace 分流
        ↓
配置是否允许 qingluan
        ↓
P2P/download subsystem 是否初始化完成
        ↓
已有任务枚举/迁移是否完成
        ↓
manager runtime enabled
        ↓
legacy / new backend
```

另外，`no qingluan|task_handle=%1%` 的实际代码路径也确认了：上层会先查询 qingluan 任务注册表；找不到对应任务时，会明确记录 fallback，再继续通过旧任务接口设置参数。这说明两套 backend 并不是完全分离的两个程序模块，而是由兼容层在运行时维护并回退。

到这里，静态结构已经接近闭环。剩下最有价值的工作不再是继续堆字符串，而是把以下两件事做实：

1. 把 `enable_ql_pan_download`、特殊任务身份、初始化 readiness 与最终 manager 状态之间的条件关系继续定名；
2. 在真实大文件下载期间做只读运行态验证，确认当前任务实例落在哪个 backend，以及哪个速率层真正约束长期吞吐。
