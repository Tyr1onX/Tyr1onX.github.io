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


---

## 十三、122880 的数据流终于闭环

继续追 legacy 下载栈后，`120 KiB/s` 已经不再只是“配置值与实测值吻合”，而是可以恢复出完整的数据流。

CMS 处理逻辑会得到 `total_limit_speed`，随后调用统一的 `set_sl(cdn, total, source)`。这次普通下载对应的 source 为：

```text
source = 1 = enable_cms_total_sl
```

调用形态等价于：

```cpp
set_sl(
    cdn_limit = unchanged,
    total_limit = 122880,
    source = enable_cms_total_sl
);
```

`set_sl` 内部维护 CDN 与 Total 两套独立 source。Total 的 live bucket 是第二个 live `AccumulateTokenBucket`；当新的 source 优先级足够高时，它会把传入的 Total 值直接交给 bucket 的 `set_rate()`。

因此这条链现在可以写成：

```text
CMS total_limit_speed = 122880
            ↓
source = enable_cms_total_sl
            ↓
set_sl(...)
            ↓
Total live AccumulateTokenBucket
            ↓
set_rate(122880)
            ↓
rate = 122880 B/s
```

旧栈 `set_rate()` 本体也已经还原：

```cpp
void set_rate(uint32_t rate) {
    if (rate != 0) {
        this->rate = rate;
        this->capacity = max(rate, 16 * 1024);
    }
}
```

运行进程只读扫描又找到唯一一组符合该 manager 布局的 8 个 bucket，当前状态正好是：

```text
CDN live:
  rate   = 122880
  source = 2  (locatedownload)

Total live:
  rate   = 122880
  source = 1  (CMS)

其他 bucket:
  仍处于 default source
```

因此“CMS 写入的 122880”与“运行时真正持有 122880 的 Total bucket”已经一一对应。

### source 优先级

legacy 的 source 表已经可以可靠还原：

```text
0  user_ctl
1  enable_cms_total_sl
2  locatedownload
3  p2psdk
4  application
5  default
```

仲裁规则是同一维度内数字越小优先级越高。因此：

```text
user > CMS > locatedownload > p2psdk > application > default
```

例如用户主动设置总限速时，会以 source 0 写入 Total limiter；之后 source 1 的 CMS 策略不能覆盖它。普通状态下没有 user limit，因此 CMS source 1 可以覆盖 locatedownload source 2。

### locatedownload 的作用

locatedownload 返回的速度值会先换算为 B/s，然后以 source 2 同时写入 CDN 与 Total 两个维度。没有有效值时使用很大的内部上限，语义更接近“这一层不形成实际瓶颈”。

这解释了为什么当前活体中可以同时看到：

```text
CDN  source=locatedownload  rate=122880
Total source=CMS             rate=122880
```

真正控制长期总吞吐的是更高优先级的 Total CMS bucket。

---

## 十四、会员变化不是直接改速率，而是 reset + reapply

`set_membership_type` 的行为也进一步明确。它不会直接写：

```cpp
normal ? 122880 : vip ? 409600 : unlimited;
```

会员状态变化后会调用真正命名为：

```text
reset_speed_limitor
```

的函数。

这个 reset 会把整个 legacy limiter 的 8 个 bucket 恢复到默认状态：

```text
前四个 bucket → 默认约 512 KiB/s
后四个 bucket → 很大的内部上限
所有 source    → default
```

随后由 CMS、locatedownload、P2P、用户设置等策略重新覆盖。

所以更准确的会员模型是：

```text
membership change
       ↓
reset old limiter state
       ↓
重新取得 / 重新应用业务策略
       ↓
CMS / locatedownload / P2P / user source 仲裁
       ↓
最终 Total / CDN rate
```

这说明本地 membership 枚举本身不是最终速度值。真正的速度决策位于策略层，会员状态只是策略输入和重算触发条件之一。

另外，对正在运行的 `.223` 与磁盘待加载的 `.233` 做对比后，新版本仍保留相同的 `set_sl` 日志、CMS Total 日志、用户限速入口、CDN/Total source 布局以及 Total live bucket 结构。因此这套 legacy limiter 在 `.233` 中仍然是被维护的实际代码，而不是马上要删除的旧残留。


---

## 十五、qingluan 新栈也完成了“策略 → live bucket”闭环

在 legacy 的 CMS → Total bucket 数据流确认之后，又对 qingluan `SpeedLimitor` 做了同样的追踪。

新栈的统一入口会记录：

```text
speed_limit_type
current_peer_sl_type
current_peer_sl
current_total_sl_type
current_total_sl
```

控制流确认它先把 source 分成 Total 与 Peer 两组，再分别进行优先级仲裁：

```text
Total: 0 user_total_ctl
       1 p2p_total_sl
       3 p2s_total_sl
       5 application_total_ctl

Peer:  2 p2p_peer_sl
       4 p2s_peer_sl
       6 application_peer_ctl
```

同一组内数字越小优先级越高。

一旦新 source 可以覆盖当前 source，统一入口会直接调用 qingluan `AccumulateTokenBucket::set_rate(rate)`，因此数据流同样是：

```text
业务 / 服务端策略
      ↓
(rate, speed_limit_type)
      ↓
SpeedLimitor::set_speed_limit
      ↓
Total / Peer source 仲裁
      ↓
live AccumulateTokenBucket::set_rate
```

qingluan 的 `set_rate()` 与 legacy 很相似，但普通最小 bucket 容量约为 28 KiB：

```cpp
rate = new_rate;
capacity = max(new_rate, minimum_bucket);
```

### 已经确定的直接来源

业务参数入口的映射为：

```text
业务 type 0 → user_total_ctl        (source 0)
业务 type 1 → application_peer_ctl  (source 6)
业务 type 2 → application_total_ctl (source 5)
```

locatedownload / P2S 响应则会把同一个服务端速度字段换算为 B/s，并分别写入：

```text
p2s_peer_sl  (source 4)
p2s_total_sl (source 3)
```

当服务端返回 0 时，代码会分别使用较大的内部 Peer / Total 上限，语义仍然是“这一策略维度不构成实际瓶颈”。

这说明新旧两代的设计理念是一致的：服务端返回的速度策略不是直接控制 socket，而是先进入本地策略仲裁器，最终变成 TokenBucket 的 refill rate。

### 四个 bucket 的角色

`SpeedLimitor` 的四个 qingluan `AccumulateTokenBucket` 已经可以解释为：

```text
Live Peer   + Shadow Peer
Live Total  + Shadow Total
```

普通策略只更新 Live Peer / Live Total。进入 speedup 时，当前 live bucket 与 source 被复制到 shadow，再临时放宽 live 限制；退出 speedup 时恢复之前的完整 bucket/source 状态。

### P2P source 1/2 的保留疑点

有一个结论需要明确保持“未完全证明”：

```text
p2p_total_sl = 1
p2p_peer_sl  = 2
```

虽然枚举和仲裁逻辑都真实存在，但在 `.223` 和 `.233` 中，统一 qingluan setter 都只有 7 个普通 direct caller，而且这些 caller 只使用 source：

```text
0, 3, 4, 5, 6
```

没有 source 1/2；同时也没有找到指向该 setter 的函数指针或 tail-jump。

因此目前不能声称已经知道 P2P source 1/2 的写入路径。可能性包括：

- 当前 Windows 构建预留但未启用；
- 通过另一种对象状态复制方式生效；
- 通过目前尚未识别的跨 service / Mojo 间接状态进入；
- 枚举用于兼容其它平台或实验分支。

这里应保留为开放问题，而不是为了“画完整架构图”强行补全。

### .223 与 .233 的一致性

两版 qingluan `SpeedLimitor::set_speed_limit` 都有完全相同数量的 7 个直接调用入口，source 结构和 Total/Peer 仲裁模型也一致。这再次说明 `.233` 更像小版本迭代，而不是限速核心的重新设计。


---

## 十六、qingluan 之外还有一层 User / Server Total Gate

继续追踪新栈后发现，`SpeedLimitor` 并不是唯一的总速率控制器。外围还有一个独立状态对象，同时维护：

```text
user_sl
server_sl
effective_total_sl
try_speedup_flag
previous_server_sl
```

它的核心计算非常直接：

```cpp
effective_total_sl = min(user_sl, server_sl);
```

然后把 `effective_total_sl` 写入另一只 `AccumulateTokenBucket`。

当某一侧传入 0 时，内部会替换成一个很大的上限，语义仍然是“这一侧当前不构成实际限制”。

因此这一层更像：

```text
用户主动限速 ────────┐
                     ├─ min() → Total Gate Bucket
服务端总速率策略 ────┘
```

### speedup 的真实行为

`set_try_speedup_flag` 的控制流显示，进入 speedup 时并不会把所有限制全部抹掉。

它会：

```text
保存当前 server_sl
        ↓
临时把 server_sl 放宽到很大的内部上限
        ↓
重新计算 min(user_sl, server_sl)
        ↓
更新 Total Gate Bucket
```

退出 speedup 时再恢复之前的 `server_sl`。

所以如果用户自己设置了较低速度：

```text
user_sl < speedup 后的 server_sl
```

最终仍然是：

```text
effective_total_sl = user_sl
```

这说明 speedup 的客户端语义不是“无条件突破所有本地限制”，而是“临时放宽服务器侧/业务侧的总速率约束，同时尊重用户主动设置的上限”。

### 新栈因此至少有两层 Total 控制

目前可以确认的新栈结构至少是：

```text
User / Server Total Gate
        │
        │ effective = min(user, server)
        ▼
Total Gate TokenBucket
        │
        ▼
qingluan::download::SpeedLimitor
        │
        ├─ Live Total
        └─ Live Peer
        │
        ▼
Task / P2S / Peer 等更细粒度 token gate
```

因此不能把 qingluan 描述成“只有一个 Total TokenBucket”。它本身就是分层 QoS 系统。

目前这个 User / Server Total Gate 的正式 C++ 类名尚未确认。二进制里已经能看到 `server_total_sl`、`USER_SPEED_LIMIT`、`TOTAL_DOWNLOAD_SPEED_LIMIT`、`TRY_SPEEDUP_FLAG` 等状态名，但在没有 RTTI 或源码路径直接证据前，不应为了图完整而给它杜撰类名。


---

## 十三、把 122880 一直追到活跃 Total Bucket

继续追旧下载栈后，`total_limit_speed` 到真正 `AccumulateTokenBucket` 的最后一段数据流已经闭环。

CMS 配置处理器会读取：

```text
total_limit_speed
total_limit_enable
```

当 Total 限速策略生效时，调用关系可以还原为：

```text
CMS total_limit_speed
        ↓
set_sl(cdn = -1, total = total_limit_speed, source = 1)
        ↓
source 1 = enable_cms_total_sl
        ↓
更新 current_total_source
        ↓
Total live bucket
        ↓
AccumulateTokenBucket::set_rate(total_limit_speed)
```

旧 limiter 对象内部的关键布局也与运行态扫描完全对齐：

```text
live CDN bucket       + source
shadow CDN bucket     + source
live Total bucket     + source
shadow Total bucket   + source
...
```

其中 CDN live 与 Total live 相距两个固定 bucket slot。静态代码里 Total 更新时选择的正是这个第二个 live 位置；运行进程中同一个对象的状态是：

```text
CDN live   rate = 122880 B/s, source = locatedownload
Total live rate = 122880 B/s, source = CMS total
```

因此现在已经不是“CMS 值和实测速度恰好一样”，而是：

> CMS 的 122880 B/s 被真实传入旧带宽管理器，并写进当前 Total `AccumulateTokenBucket` 的 rate 字段。

### total_limit_enable

`total_limit_enable` 非零时，会直接应用 CMS Total cap。

为零时不会直接启用这条 Total cap，而会结合已有 locatedownload/CDN 状态做兼容兜底。因此它不是一个简单的 UI 布尔开关，而是 CMS Total 策略是否直接成为执行限制的门控条件。

---

## 十四、会员变化为什么会重算限速

`set_membership_type` 后面确实存在 `reset_speed_limitor` 路径。

继续拆 helper 后发现，这个 reset 会逐个恢复旧 limiter 的整套 bucket/source 状态，而不是只修改一个会员字段。

大致结构：

```text
membership change
      ↓
reset limiter
      ↓
所有 source → default
      ↓
恢复 bucket 默认 rate
      ↓
CMS / locatedownload / P2P / application
重新按优先级写入
```

因此会员状态更准确的职责是：

> 改变策略上下文，并触发下载带宽策略重新计算。

而不是客户端里简单存在一行：

```cpp
speed = vip ? x : y;
```

用户手动总限速也已经接到同一个仲裁器：

```text
set_user_speed_limit
      ↓
set_sl(cdn=-1, total=user_limit, source=0)
```

旧栈 source 的优先级因而可以写成：

```text
0 user_ctl
1 enable_cms_total_sl
2 locatedownload
3 p2psdk
4 application
5 default
```

同一限速维度上，较高优先级策略不会被后来的低优先级 source 覆盖。

---

## 十五、旧栈的 8 个桶其实是 4 组 live / shadow

继续研究 `try speedup` 后，8 个 `AccumulateTokenBucket` 的结构终于变得清楚。

它们不是八层串行 limiter，而是：

```text
Live 1   ↔ Shadow 1
Live 2   ↔ Shadow 2
Live 3   ↔ Shadow 3
Live 4   ↔ Shadow 4
```

进入 speedup 时：

```text
复制 live rate/source 到 shadow
        ↓
保存当前完整 limiter 状态
        ↓
把 4 个 live rate 临时放宽
```

退出 speedup 时则反向把 shadow 整体恢复到 live，恢复内容不只包含 rate，还包含 bucket 的 token、时间状态和 source。

日志明确存在：

```text
try speedup start
try speedup end
cdn_sl
total_sl
cdn_src
total_src
```

另外一套 speedup 日志还记录：

```text
total_sl
user_sl
cur_server_sl
pre_server_sl
```

说明下载器内部的“加速”不是简单删除一个固定 120 KiB/s 常量，而是暂时改变多层限速现场，再在结束时恢复。

这个设计与后来 qingluan `SpeedLimitor` 的 live/shadow 思路非常相似，说明两代实现虽然类结构不同，但设计思想存在明显连续性。
