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

它们不是八层串行 limiter，而是四组 live / shadow，而且后续已经把四组职责全部定名：

```text
Download CDN live    ↔ Download CDN shadow
Download Total live  ↔ Download Total shadow
Upload live          ↔ Upload shadow
Upload Total live    ↔ Upload Total shadow
```

后两组的身份来自独立的 `set upload sl` 执行函数：它明确记录 `upload_sl / total_sl / current_upload_src / current_total_src`，并分别更新第三、第四组 live bucket。

因此旧实现实际上把下载与上传的全局速率控制放在同一个 limiter 对象里；qingluan 新架构则已经分别出现 `download::SpeedLimitor` 与 `upload::SpeedLimitor`，职责拆分得更彻底。

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


---

## 十七、策略仲裁层与执行 Token 层已经分离确认

继续追 `locatedownload`、CMS 与下载请求的 token 获取路径后，可以把旧下载控制进一步拆成两层，而不是把所有 `AccumulateTokenBucket` 都视为同一种“全局限速桶”。

### 1. 策略仲裁层

这一层长期保存各来源竞争后的策略状态：

```text
user / CMS / locatedownload / P2P SDK / application / default
                         ↓
                   source priority
                         ↓
              Download CDN policy
              Download Total policy
```

当前进程在空闲状态下仍保留：

```text
CDN policy   rate = 122880 B/s, source = locatedownload
Total policy rate = 122880 B/s, source = CMS
```

这说明策略状态会跨任务/调度周期保留，并不等于当下每个网络请求正在直接消费同一个 bucket。

### 2. CMS Total policy 本身确实进入请求授权路径

`get_download_token()` 的实际执行路径中，会取得当前 Download Total policy bucket，并调用 token 获取逻辑。也就是说：

```text
CMS total_limit_speed
      ↓
Total policy bucket
      ↓
try_acquire(requested_len)
      ↓
请求是否继续
```

因此 CMS Total 不只是配置、统计或 UI 展示值，而是真正参与下载额度判断。

### 3. locatedownload 还会同步运行时执行 bucket

locatedownload 更新 CDN / Total policy 后，还会把运行时 Total 候选同步到另一组执行 bucket。下载 token 获取入口会优先尝试从这一执行 bucket 获取额度。

与此同时，`cdn_speed_limit_dispatch` 会读取 CDN policy 上限，再结合当前下载速度、通道状态和任务情况计算执行速率，最终更新一个 CDN 执行 bucket。HTTP/数据请求处理路径会从该 bucket 获取 token。

因此更准确的数据流是：

```text
locatedownload
   ├─→ CDN policy ─→ cdn_speed_limit_dispatch ─→ CDN execution bucket ─┐
   └─→ Total policy / runtime total execution bucket                  │
                                                                      ├─→ request gating
CMS ───────────────→ Total policy bucket ──────────────────────────────┘
```

这也解释了为什么静态上能同时看到多个 120 KiB/s 状态，但运行时并不是“每个 block 从两个完全相同的全局 bucket 各扣一次”。不同 bucket 分别承担策略仲裁、动态分发和实际额度执行。

### 4. 空闲状态下执行 bucket 会恢复宽松值

本轮只读活体检查中，策略层仍保存两个 122880 B/s 状态，但 CDN / locatedownload Total 的执行 bucket 已恢复到约 100 MiB/s 的宽松默认值。

因此可以确认：

> policy bucket 是持久策略状态；execution bucket 是运行期调度状态，会随任务生命周期和 dispatcher 重新配置。

### 5. `no token` 路径是多层联合门控

下载请求失败日志同时记录 `total_token / task_token / peer_token` 等状态；对应执行代码只有在多个额度检查均通过时才继续。

因此最终吞吐更适合表示为：

```text
policy arbitration
       ↓
runtime execution buckets
       ↓
global / task / peer token gates
       ↓
network request allowed
```

而不是一个单独的 `speed_limit` 数值直接决定全部下载流量。

### 结论修正

此前“当前 120 KiB/s 主要对应一个 CMS Total bucket”的结论需要补充为：

> 当前普通下载策略中，CMS Total 与 locatedownload CDN 都曾明确给出 122880 B/s；CMS Total policy 本身进入 token 获取路径，而 locatedownload 还通过 CDN dispatcher / runtime execution bucket 形成另一条执行链。客户端最终速度来自多层 token gate 的共同结果，而不是单一 bucket。


---

## 十八、当前两个限速栈使用不同底层时钟

继续向下追真正参与请求授权的 legacy `AccumulateTokenBucket` 后，已经确认它与 qingluan 新栈并不使用同一个底层时钟 API。

### legacy policy bucket

legacy bucket 的 refill 函数调用一个时间包装器。继续追到底层后，该包装器最终调用：

```text
GetSystemTimeAsFileTime
```

随后进行 epoch / duration 换算、与一次性初始化的基准时间做差，并最终得到供 bucket 使用的毫秒级时间量。

bucket 的核心仍然是：

```text
elapsed_ms × rate / 1000
        ↓
refill token
        ↓
capacity clamp
```

其中 CMS Total policy bucket 就属于这一栈，而且前一节已经确认它会实际进入请求 token 获取路径。

### qingluan bucket

此前对 qingluan `TokenBucket / AccumulateTokenBucket` 的还原则确认其时间来源为：

```text
QueryPerformanceCounter
        ↓
QueryPerformanceFrequency
        ↓
高精度 duration
        ↓
毫秒换算
        ↓
elapsed × rate / 1000
```

因此当前客户端至少同时存在：

```text
legacy policy limiter   → FILETIME-derived clock
qingluan limiter        → QPC-derived clock
```

### 为什么这能解释历史时间加速工具的版本差异

如果某个时间虚拟化工具只改变其中一种时钟的推进速度，那么它最多只会改变依赖该时钟的 bucket refill；其他 Total / CDN / task / peer gate 仍然可以成为瓶颈。

因此不同版本或不同下载路径可能出现：

```text
旧路径主要受被虚拟化的 clock 驱动
        → throughput 明显变化

新路径增加另一套 clock / 另一组 token gate
        → 单一 clock 不再决定最终速度
```

这比“客户端有没有一个固定 Sleep”更符合目前恢复出的实际架构。

另外，legacy 时钟包装器中存在大量有符号/溢出安全运算，但目前没有看到再使用 QPC 等独立单调时钟去校正 FILETIME 推进速率的逻辑。因此从机制上说，连续改变 FILETIME 的推进速度确实可以影响这一 legacy bucket 对 `elapsed` 的判断；但最终吞吐仍受其他 gate、服务端策略和网络能力共同限制。


---

## 十九、运行中的 kernel 与磁盘最新 kernel 并不是同一小版本

本轮进一步核对运行进程、文件时间与代码字节后，发现一个必须修正实验边界的重要事实。

当前 `baidunetdiskhost` 启动时间早于当天 kernel 文件更新：

```text
running host start     ≈ 10:26
old kernel revision    = 3.0.20.223
new kernel revision    = 3.0.20.233
new kernel write time  ≈ 10:32
```

运行进程中的手工映射 image 与 `.223` 机器码一致；与磁盘文件相比，仅存在正常的装载重定位差异。这意味着：

> 本文今天实际测得的约 120 KiB/s 普通下载、legacy telemetry、FILETIME-driven policy bucket，严格对应的是客户端外壳 8.4.0 进程中仍在运行的 kernel 3.0.20.223 会话。

磁盘上更新后的 3.0.20.233 尚未被这个已运行 host 热替换。

### 两版都已经包含 qingluan

这并不是“`.223` 没有 qingluan、`.233` 才新增 qingluan”。两版都包含：

```text
enable_ql_pan_download
download_common_qingluan
no qingluan
use_global_bandwidth_manager
qingluan-download source paths
```

因此更准确的模型是：

```text
kernel .223
  ├─ legacy download stack
  └─ qingluan download stack

kernel .233
  ├─ legacy download stack
  └─ qingluan download stack
```

两套实现长期共存，由任务运行时条件选择。

### 当前 .223 会话实际走 legacy

对运行进程私有内存中的已经格式化 telemetry 进行只读搜索：

```text
legacy download_common          : 29 records
download_common_qingluan        : 0 records
```

因此对本次已经实测的普通下载会话，可以把 FILETIME-driven legacy limiter 与约 120 KiB/s 观测直接关联起来；但不能把这个结果未经重启验证就自动外推到磁盘最新 `.233` 的下一次新会话。

### `enable_ql_pan_download` 不是 wrapper 中的单一 if 开关

在任务控制 / 参数设置等 wrapper 中，代码会：

1. 先检查任务句柄是否属于某个内部任务映射；
2. 再检查与该任务关联的对象/身份状态；
3. 不满足 qingluan 路径时进入 `no qingluan` fallback；
4. 读取 `network.enable_ql_pan_download`，默认值为 `1`；
5. 将该配置值继续转发给内部下载/网络子系统。

值得注意的是，在已经还原的 fallback wrapper 中，这个配置返回值本身没有直接参与紧邻的条件跳转。因此不能简单写成：

```text
enable_ql_pan_download == 0
→ legacy
```

更符合代码的描述是：

```text
task identity / task-handle ownership / service state
                  +
runtime qingluan-related config
                  ↓
          choose / configure path
```

此外，`.223` 与 `.233` 的 `no qingluan` wrapper 结构高度一致，没有看到这个小版本更新把核心双栈选择逻辑简单翻转。

### 一个附带修正

此前分析中的一个前置 predicate 后续已通过内部字符串定名为：

```text
identity_workspace_task
```

它用于识别 workspace/history 类任务，而不是“qingluan 是否可用”的通用判断。后续架构图应把 workspace/history 特殊分支与 qingluan/legacy 双栈选择分开描述。


---

## 二十、磁盘最新 3.0.20.233 仍保留 legacy FILETIME 限速链

虽然本次动态实验对应的是仍在运行的 3.0.20.223 image，但对当天更新到磁盘的 3.0.20.233 做静态对照后，可以确认 legacy 限速机制并未被这个小版本删除。

### FILETIME 路径基本保持不变

`.223` 与 `.233` 都存在同构的时间包装器：

```text
GetSystemTimeAsFileTime
        ↓
Windows FILETIME epoch conversion
        ↓
duration / baseline conversion
        ↓
legacy bucket elapsed time
```

两个版本对应函数的指令结构高度一致，仅因版本增量导致地址和部分辅助函数位置变化。

### CMS Total policy 链也仍存在

3.0.20.233 仍然解析：

```text
total_limit_speed
total_limit_enable
```

在启用分支中，仍把解析出的 Total 候选以 CMS source 送入 legacy speed-limit policy 仲裁器。

因此 `.233` 静态上仍有：

```text
CMS config
   ↓
legacy Total policy
   ↓
FILETIME-derived TokenBucket refill
```

### 当前证据边界

这能够证明：

> 3.0.20.233 仍包含并可配置 legacy FILETIME-driven limiter。

但不能仅凭静态代码证明：

> 新启动的 3.0.20.233 普通 PAN 下载一定会选择 legacy 而不是 qingluan。

要回答后一个问题，需要让 host 以 `.233` 重新启动后，再进行同样的只读 telemetry / throughput / live bucket 观察。

---

## 二十一、3.0.20.233 新会话与 Adapter 任务映射

晚间继续验证时，先完成了此前缺失的版本切换实验。

原 `baidunetdiskhost` 会话启动于约 10:26，而当天早些时候磁盘上的 `kernel.dll` 已在 10:32 后更新，因此白天的动态观测严格属于旧的 `.223` 运行 image。

本轮关闭旧会话并重新启动百度网盘后，新 `baidunetdiskhost` 于约 18:55 启动，进程模块明确加载：

```text
kernel.dll 3.0.20.233
```

与此同时还发现一个需要额外绑定实验边界的细节：更新器再次写入了同版本号的 `kernel.dll`。新的磁盘文件为：

```text
version = 3.0.20.233
size    = 55,056,128 bytes
SHA-256 = 527AA8734AC7E3A825EDD6869981BDF9BC44A286F6AC27198AF695B44ACE1B44
```

而本轮开始时磁盘上同样标记为 `3.0.20.233` 的文件大小约 44 MB，hash 也不同。

因此后续逆向记录不能只用 `3.0.20.233` 作为二进制身份，至少还要同时记录：

```text
version + file size + hash
```

### 新会话已经成立，但还没有动态栈判别样本

新 host 已经建立多个网络连接，但当时没有实际下载任务运行。

只扫描新 host 的私有提交内存后：

```text
download_common           : 0
download_common_qingluan  : 0
no qingluan               : 0
enable_ql_pan_download    : 0
```

因此这里不能把 0 解释为“没有 legacy”或“没有 qingluan”，只能说明当前没有产生可用于判别下载栈的格式化 telemetry。

真正的 `.233` 动态栈判别仍需要在新会话中启动一个普通 PAN 下载后重复采样。

### `enable_ql_pan_download` 的 wrapper 控制流进一步收窄

对当前 hash 的 `.233` 重新做 xref 和函数边界恢复后，`identity_workspace_task`、`enable_ql_pan_download`、`no qingluan` 的调用点集中在同一组任务 wrapper 中。

其中 `set_task_param` 一类 wrapper 的结构可以抽象为：

```text
Adapter map contains(task_handle)
        ↓ yes
identity_workspace_task(adapter task field)
        ↓ yes
直接进入 Adapter set_task_param

否则
        ↓
查询另一张兼容任务表
        ↓ exists
读取 network/enable_ql_pan_download（默认 1）
        ↓
把配置值转发到内部配置/网络对象
        ↓
记录 "no qingluan|task_handle=..."
        ↓
继续 Adapter set_task_param
```

这里最重要的修正是：

> `enable_ql_pan_download` 的返回值仍然没有直接参与紧邻的条件跳转。

代码先根据任务句柄映射和 workspace 身份决定路径；配置值只在 fallback 分支中被读取并继续转发。

所以仍然不能把双栈 selector 简化为：

```text
enable_ql_pan_download == 1 -> qingluan
enable_ql_pan_download == 0 -> legacy
```

### 第一张任务表已经可以定名为 Adapter task map

此前 `0x18010da80 / 0x18010daf0` 只能描述成“任务句柄表 A”。本轮已经找到直接日志证据，可以进一步定名。

同一对象的 `[object + 8]` 红黑树在 `erase_task` 路径中会打印：

```text
Adapter task map not have the handle.handle=%1%
```

而 `0x18010da80` 查的正是同一棵 `[rcx + 8]` 红黑树。

因此可以确认：

```text
0x18010da80
    = Adapter task map contains(task_handle)
```

`0x18010daf0` 则不是简单的另一个 contains。

它找到 Adapter 节点后，会取节点对象中的一个字段（当前偏移约 `+0x120`），再直接进入：

```text
identity_workspace_task(...)
```

因此可以把它描述为：

```text
Adapter task exists
    +
该 Adapter task 是否属于 workspace/history 特殊身份
```

这再次证明：

> workspace/history 特殊任务分流与 qingluan/legacy 双栈选择不是同一个 predicate，后续架构图必须分开画。

### 第二张兼容任务表暂不强行命名

fallback 中还有另一张独立任务句柄树。

目前已经确认它：

- 与 Adapter task map 不是同一对象；
- 在若干 wrapper 中作为 fallback 资格判断；
- 存在时才会进入 `enable_ql_pan_download` 配置转发和 `no qingluan` 日志路径。

但当前还没有足够证据证明它到底代表：

```text
qingluan task registry
legacy/private task registry
或其他兼容旁路集合
```

因此暂时保持“第二张兼容任务表”的中性命名，不因为日志文字就提前把它等同于某个后端。

### 当前更新后的边界

到这里，新的结构可以写成：

```text
public task wrapper
        ↓
Adapter task map contains(handle)?
        ├─ yes + workspace/history identity
        │        ↓
        │   Adapter special path
        │
        └─ otherwise
                 ↓
          compatibility task table
                 ↓
        runtime qingluan-related config forwarding
                 ↓
             "no qingluan" fallback log
                 ↓
             Adapter operation
```

下一步最有价值的实验已经非常明确：

1. 在当前新启动的 `.233` host 中开始一个普通 PAN 下载；
2. 再次只读扫描私有内存 telemetry；
3. 对比 `download_common` 与 `download_common_qingluan`；
4. 同时记录长期吞吐与 live policy / execution bucket；
5. 最终把 `.233` 的真实运行后端与其时钟来源绑定起来。

这一步完成后，才能回答“同一个 8.4.0 客户端的新 `.233` 会话是否仍默认走 legacy”这个目前最后缺失的动态问题。

## 十九、BrowserEngine 任务控制层与 `.233` 新会话补充

### 19.1 BrowserEngine 明确导出正式任务控制 API

对 `module/BrowserEngine/browserengine.dll` 的 PE export table 检查确认，以下函数为真实导出而非仅日志字符串：

- `browser_engine_pause_task`
- `browser_engine_pause_all_task`
- `browser_engine_pause_all_remote_task`
- `browser_engine_enqueue_task`
- `browser_engine_enqueue_all_task`
- `browser_engine_get_task_items`
- `browser_engine_get_task_count`
- `browser_engine_delete_task`
- `browser_engine_top_task`

同时 `bnusdk.dll` 也导出：

- `bnu_sdk_pause_task`
- `bnu_sdk_start_task`
- `bnu_sdk_set_speed_limit`

这说明桌面端的暂停/恢复并不依赖 UI 点击本身，而是有稳定的内部 ABI 层。

### 19.2 `pause_task` / `enqueue_task` 不是简单的整数 task_id API

`browser_engine_pause_task` 导出 thunk 最终进入 `browser_transfer.cpp`，再进入 `filetransfer/file_trans_manager.cpp`。

反汇编确认外部参数至少包含：

- 一个布尔/类型参数（经 `DL` 传递）；
- 两个 C 字符串形态参数（内部均检查空指针/首字节，并按 NUL 结尾扫描）；
- FileTransManager 自身通过 BrowserEngine 内部 singleton/context 隐式取得。

因此数据库 `download_file.task_id` 不能直接当成唯一参数硬调用。当前没有在签名未完全恢复前直接注入调用，避免误调用导致客户端崩溃。

### 19.3 UI/任务管理与下载后端是明确分层的

当前静态控制流可整理为：

```text
桌面 UI / WebView
    ↓
BrowserEngine export ABI
    ↓
browser_transfer.cpp
    ↓
FileTransManager
    ↓
任务对象 / task map / adapter
    ↓
kernel download wrapper
    ↓
qingluan / legacy backend
```

这进一步支持此前结论：`enable_ql_pan_download` 不是 UI 层或任务管理层的直接总开关，而是在任务已经进入 kernel wrapper 后才参与后续分流。

### 19.4 当前新建下载批次不是合格限速样本

`transmission.db` 中新建的一批下载任务处于 `status=3`，大部分 `complete_size=0`；连续 12 秒采样无增长。

其中 4 个约 69 MB 的 m4a 曾短暂写入：

- 212,992 bytes
- 81,920 bytes
- 49,152 bytes
- 49,152 bytes

随后均出现 `error_code=1000001`，目标文件没有稳定落盘。

因此这批任务只证明 BrowserEngine 已完成建任务、取直链和部分连接调度，不能作为稳定吞吐/限速路径样本。

### 19.5 当前动态验证状态

`.233` 新会话仍然成立，kernel host 已建立大量 `80/443/18000/18501/19000/28000` 连接；但在没有稳定数据传输时：

- `download_common` telemetry：未捕获到稳定运行态实例；
- `download_common_qingluan` telemetry：未捕获到稳定运行态实例；
- `transmission.db` 完成字节不持续增长。

因此此时仍不能仅凭连接数量断言真实 payload 走哪一套后端。

## 二十、干净重启基线与 legacy 运行态证据

### 20.1 重启前下载会话

在 `.233` kernel host 的下载会话中，连续多次私有内存采样稳定观察到：

- `download_common`: 11 个运行态实例；
- `download_common_qingluan`: 0；
- `no qingluan`: 2 个运行态实例；
- `enable_ql_pan_download`: 0。

这些地址在多轮采样中稳定存在。

### 20.2 辅助进程重启后的干净基线

一次不满足线程上下文的 BNU 控制调用导致 `BaiduNetdiskUnite` 辅助进程退出，客户端随后自动拉起全新 Unite/host。数据库 `PRAGMA quick_check` 返回 `ok`，下载任务未丢失；6 个已有进度的大文件恢复为暂停态。

新 kernel host：

- PID: `25940`
- 启动时间：`2026-09-01 20:25:37`
- 加载根目录 `.233 kernel.dll`

在未恢复下载的干净新会话中，同一内存扫描结果为：

```text
download_common: 0
download_common_qingluan: 0
no qingluan: 0
enable_ql_pan_download: 0
```

因此，重启前观察到的 `11 × download_common` 与 `2 × no qingluan` 不是静态映像字符串或扫描器固定误报，而是与实际下载会话绑定的运行时对象/文本。

这使“该次实际下载走 legacy/common 路径，而非 qingluan telemetry 路径”的证据显著增强。仍需通过一次可控的暂停→开始 A/B 再确认对象随任务生命周期重建。

### 20.3 BNU 控制 API 的边界

进一步反汇编确认：

- `bnu_sdk_pause_task` / `bnu_sdk_start_task` 对外只有一个整数参数；
- TaskManager 本体把该参数作为 32 位 `cmd(id)`，用于 paused/running/waiting/failed 多棵任务树查找；
- 但该 DLL 的源码路径属于 `pc-sdk-upload`，不能把 BrowserEngine `download_file.task_id` 直接等同为 BNU upload `cmd(id)`；
- 直接在新远程线程中调用还存在任务线程/sequence 上下文约束，测试未改变下载状态并导致辅助 Unite 进程重启。

因此后续不再使用跨线程直接注入 BNU export 作为下载控制手段。


---

## 二十一、8.7.9 Electron 控制链与 kernel 3.0.20.234 差分

### 21.1 暂停/恢复控制链已经从源码层闭环

当前 Electron `core.asar` 中可以直接看到 BrowserEngine FFI 声明与下载器封装。下载方向使用固定布尔值 `true`，普通个人网盘 `cid/scope` 默认使用字符串 `"0"`，任务 ID 在上层经过 `JSON.stringify()` 后传入。

```text
browser_engine_enqueue_task(string, bool, string)
browser_engine_pause_task(string, bool, string)
browser_engine_enqueue_all_task(string, bool)
browser_engine_pause_all_task(string, bool)

普通个人下载：
  enqueueTask(ids, "0") -> browser_engine_enqueue_task("0", true, JSON.stringify(ids))
  pauseTask(ids, "0")   -> browser_engine_pause_task("0", true, JSON.stringify(ids))
```

主进程 IPC 注册器会把导出的类名首字母小写后注册到 `ipcMain`，因此实际命令名为：

```text
enqueueDownloadTask
pauseDownloadTask
enqueueAllDownloadTask
pauseAllDownloadTask
```

这说明桌面按钮、Electron IPC 与 BrowserEngine ABI 已形成完整控制链，不再需要猜测 task id 的编码格式。单任务参数本质上是类似 `[1788231912]` 的 JSON 数组字符串。

### 21.2 `1000001` 的语义得到源码级纠正

当前客户端常量明确包含：

```text
TASK_RUNNING = 0
TASK_WAITING = 1
TASK_FAILED  = 2
TASK_PAUSED  = 3
TASK_CREATE  = 4

CLIENT_ERR_LOCAL_USER_PAUSE = 1000001
```

因此此前 `status=3 / error_code=1000001` 的大文件不是网络失败，而是“本地用户暂停”。这使这些已有进度任务可以作为后续暂停→恢复 A/B 的稳定样本。

例如当前数据库仍有：

```text
task_id=1788231912
status=3
error_code=1000001
complete_size=237142016
file_size=342265426
```

### 21.3 当前运行内核已自动更新到 3.0.20.234

2026-09-01 21 时段检查时，真正加载下载内核的 `baidunetdiskhost` 为 PID 25940；其加载的根目录 `kernel.dll` 已是：

```text
version: 3.0.20.234
size: 55073024 bytes
write time: 2026-09-01 20:26:55
SHA-256: 40EB35FCA9316FA2E24AACF18177747295D48B01F852AEA9372E2EDE13E1C5D6
```

同时本机仍保存两个旧版本，可直接做版本级差分：

```text
kernel_o.dll   = 3.0.20.223
kernel.dll.o   = 3.0.20.233
kernel.dll     = 3.0.20.234
```

### 21.4 3.0.20.234 仍同时包含两套 limiter 与两套时钟

`.234` 的 import 和真实反汇编调用都仍然包含：

```text
GetSystemTimeAsFileTime
QueryPerformanceCounter
QueryPerformanceFrequency
GetTickCount
timeGetTime
```

Limiter/telemetry 字符串与 RTTI 也仍同时存在：

```text
TokenBucket
AccumulateTokenBucket
qingluan::common::TokenBucket
qingluan::common::AccumulateTokenBucket
download_common
download_common_qingluan
enable_ql_pan_download
total_limit_speed
total_limit_enable
no qingluan
use_global_bandwidth_manager
```

QPC 包装器在 `.234` 中仍呈现标准结构：

```text
QueryPerformanceFrequency
    -> QueryPerformanceCounter
    -> counter / frequency 比例换算
```

FILETIME 包装路径同样仍然存在：

```text
GetSystemTimeAsFileTime
    -> 0xfe624e212ac18000 Windows epoch 常量换算
    -> duration / baseline conversion
```

### 21.5 `.233 -> .234` 的 FILETIME 实现是结构保持的

对 `kernel.dll.o` (3.0.20.233) 与 `kernel.dll` (3.0.20.234) 直接反汇编比较后，FILETIME 换算核心块保持同样的指令序列。典型块在两个版本中都具有：

```text
call GetSystemTimeAsFileTime
movabs 0xfe624e212ac18000
add FILETIME
mul 0xcccccccccccccccd
...
时间单位换算
```

此前已经绑定到 legacy 时间运算的相邻块在 `.234` 中主要表现为地址整体平移，关键算术结构没有改写。

因此目前可以把版本边界推进为：

> 3.0.20.223、3.0.20.233、3.0.20.234 都保留 legacy FILETIME-driven 时间基础；`.234` 同时也保留 qingluan 的 QPC-derived 时间基础。

这仍不等价于“修改系统时间一定可以提高最终下载速度”。最终吞吐还可能同时受 Total / CDN / task / peer token gate、服务端策略和网络能力约束。下一步需要在 `.234` 的真实下载会话中做暂停→恢复生命周期与 telemetry A/B，并只做低风险的时间敏感性验证。


## 二十二、3.0.20.234 活跃任务的官方速率与运行时 122880 证据

### 22.1 通过客户端自己的 Electron IPC 恢复暂停任务

在临时隐藏启动的 Electron 主进程中，仅启用本机 `127.0.0.1` 调试端口用于研究。主 renderer 保留 `require()` / `electron.ipcRenderer` 权限，因此可以走客户端已经存在的正式 IPC：

```text
ipcRenderer.send("enqueueDownloadTask", [1788231912], "0")
```

随后通过 `getSubTasksById` 读取 BrowserEngine 自己维护的任务对象，不直接改任务数据库。任务 `1788231912` 进入运行态并继续增加 `finish_size`。

### 22.2 BrowserEngine 自己报告约 120 KiB/s，而不是只有外部观测如此

连续读取任务对象时，当前任务 `rate` 在约 119,932–125,441 B/s 之间波动；典型样本为：

```text
rate=122856
rate=125198
rate=125441
rate=120191
rate=122353
rate=120838
rate=119932
```

这与此前外部长期吞吐观测的 `122880 B/s = 120 KiB/s` 高度吻合。小幅上下摆动符合累积 token bucket / 调度窗口造成的短 burst 特征。

同时任务对象明确报告：

```text
download_slow = false
network_slow = false
firewall_ban = false
is_speedup = 0
```

因此在客户端自己的诊断语义中，这不是“网络本身被判定为很慢”。

### 22.3 用户设置层没有配置 120 KiB/s 上限

Electron 主进程配置读取结果：

```text
download_max_speed = ""
upload_max_speed = ""
simultaneous_download_task_num = ""
```

因此当前约 120 KiB/s 不是用户在设置页面手工填写的下载上限。

### 22.4 官方 `get_speedup_info(true)` 暴露了三组不同速度概念

主进程已经把 BrowserEngine 包装器挂为 `app.$getSpeedUpInfo`。只读调用 `app.$getSpeedUpInfo(true)` 返回的 JSON 包含：

```text
max_normal_speed      = 3199000 B/s
max_speedup_speed     = 0
download_speed        ≈ 126000–138000 B/s
speedup_ticket_using  = false
speedup_speed_limit   = 307200 B/s
ticket_end_time       = 0
cur_sys_timestamp     = current Unix timestamp
```

其中 `307200 B/s` 精确等于 300 KiB/s。

这个结果说明客户端同时维护：

1. `download_speed`：当前真实下载速度；
2. `max_normal_speed`：某种正常/历史/能力参考值，当前为约 3.2 MB/s；
3. `speedup_speed_limit`：加速票场景的独立速率上限，当前为 300 KiB/s。

所以当前约 120 KiB/s 不能简单解释为“客户端认为这条网络的物理上限只有 120 KiB/s”。

### 22.5 3.0.20.234 活跃 kernel 私有堆中大量存在 122880

对 plugin_id=1000 的 `baidunetdiskhost.exe` 做只读 `MEM_PRIVATE` 扫描，不扫描模块映像，以避免把 DLL 静态字符串误判为运行态对象。扫描器先用 `d.pcs.baidu.com` 校验，确认能够命中活跃下载上下文。

结果：

```text
d.pcs.baidu.com     => 35
122880              => 215
total_limit_speed   => 2
download_common     => 0
download_common_qingluan => 0
```

因此 `122880` 不仅存在于静态配置/机器码，也在 `.234` 当前活跃 kernel 的私有运行时内存中大量出现。

但 `total_limit_speed` 与 ASCII `122880` 没有落在同一个 4 KiB 邻近窗口内，所以暂时不能据此宣称这 215 个 `122880` 全都属于同一个 CMS Total 对象。

### 22.6 当前最强模型

目前可支持的模型进一步收敛为：

```text
网络能力 / 历史正常能力  >> 120 KiB/s
用户手工 download_max_speed 未设置
              ↓
服务端/CMS/场景策略候选
              ↓
客户端 limiter policy / runtime bucket
              ↓
BrowserEngine task rate ≈ 120 KiB/s
              ↓
真实文件增长 ≈ 120 KiB/s
```

仍需继续区分：当前 `.234` 真实普通 PAN 下载最终走 legacy FILETIME limiter、qingluan QPC limiter，还是多个 gate 同时生效。

另外需要注意：`transmission.db` 的 `complete_size` 并不会对每个运行时进度采样即时落盘；BrowserEngine 官方任务 API 的 `finish_size/rate` 是更适合做短窗口动态测量的来源。


## 二十三、BrowserEngine SpeedupManager 与多时钟模型

### 23.1 `max_normal_speed` 不是服务端直接下发的固定“正常限速”

继续反查 `browserengine.dll` 中 `get_speedup_info(true)` 的 JSON 生成函数后，可以把关键字段映射到 `SpeedupManager`：

```text
SpeedupManager + 0x640 = max_normal_speed
SpeedupManager + 0x638 = max_speedup_speed
SpeedupManager + 0x648 = speedup-session flag
SpeedupManager + 0x650 = normal-window baseline tick
```

采样循环会读取与 `download_speed` 同源的实时速度（查询类型 27）：

```text
if speedup_flag != 0:
    if current_speed > max_speedup_speed:
        max_speedup_speed = current_speed
else:
    if GetTickCount() - normal_baseline > 30000 ms:
        if current_speed > max_normal_speed:
            max_normal_speed = current_speed
```

因此当前观察到的：

```text
max_normal_speed = 3199000 B/s
```

更准确的含义是：客户端曾在非 speedup 状态、稳定窗口之后记录到约 3.2 MB/s 的实际峰值。它不是当前普通下载的固定策略上限。

这进一步加强了一个判断：当前约 120 KiB/s 并不是客户端认为网络只能达到的物理容量。

### 23.2 speedup flag 的生命周期也被闭合

`SpeedupManager + 0x648` 初始化为 0。开始 speedup 会话的路径会将其设为 1；结束路径会清零，并把当前内部 tick 写入 `+0x650`，从而重新开始普通状态的 30 秒稳定窗口。

附近还保留：

```text
min_member_speedup_file_size
min_member_speedup_percent
system_limit
timestamp=%lld&token=%s
```

以及源码路径：

```text
.../filetransfer/taskmanager/file_download_task_manager.cpp
```

这说明“普通速度峰值”和“speedup 速度峰值”本来就是 BrowserEngine 设计中两个分离的统计状态。

### 23.3 BrowserEngine 的内部单调时钟已确认是 `GetTickCount`

大量调度/采样代码都通过跳板 `0x180031133` 取得内部 tick。继续追跳板后得到：

```text
0x180031133
  -> 0x180b13230
  -> KERNEL32!GetTickCount
```

因此 BrowserEngine 的 SpeedupManager、稳定窗口和大量本地调度逻辑使用的是 `GetTickCount`，不是 QPC。

### 23.4 `cur_sys_timestamp` 是 `_time64` + 可选 `GetTickCount` 校准推进

`get_speedup_info` 中 `cur_sys_timestamp` 的实现为：

```text
raw = _time64(NULL)

if calibration_disabled:
    return raw

if base_timestamp > 0 and base_tick > 0:
    return base_timestamp + seconds(GetTickCount() - base_tick)

return raw
```

对应状态：

```text
object + 0x488 = calibrated base timestamp
object + 0x490 = GetTickCount baseline
object + 0x498 = calibration enabled
```

setter 位于 `web_url_manager.cpp`：

```text
if timestamp <= 0:
    assert/fail
else:
    base_timestamp = timestamp
    calibration_enabled = true
    base_tick = GetTickCount()
```

DLL 中还存在真实 JSON 字段：

```text
server_time
```

并且其他运行日志明确同时记录：

```text
local_ts=%lld
server_time=%lld
```

因此 BrowserEngine 存在“服务端/外部时间基准 + 本地 GetTickCount 持续推进”的校时设计。当前还不把 `+0x488` 的每一次写入都绝对等同于 `server_time`，但源码位置与字段结构已高度支持这个解释。

### 23.5 当前至少存在四种时间来源，不能混为一谈

```text
BrowserEngine 会话/速度统计：GetTickCount
BrowserEngine speedup Unix 时间：_time64，或 base_timestamp + GetTickCount elapsed
legacy kernel limiter：GetSystemTimeAsFileTime / FILETIME-derived elapsed
qingluan limiter：QueryPerformanceCounter / QueryPerformanceFrequency
```

这对“本地变速为什么可能有效”非常关键：一个工具若只改变 Windows 墙钟、只改变 `GetTickCount`、或只改变 QPC，受到影响的子系统可能完全不同。

因此不能再把“修改时间”视为单一操作。真正需要回答的是：当前实际 120 KiB/s 的最终 token gate 读取哪一种时钟，以及变速工具实际 hook 了哪些时钟 API。


## 二十四、3.0.20.234 活跃下载：RTTI 对象扫描与 120 KiB/s 持久策略结构

### 24.1 用 RTTI/vtable 直接扫描运行对象

为了避免继续依赖可能被释放的日志字符串，本轮从 `kernel.dll` 的 MSVC RTTI 反推出 limiter vtable，然后在 `plugin_id=1000` 的 `baidunetdiskhost.exe` 私有堆中只读扫描对象。

`.234` 中恢复出的主要 vtable：

```text
legacy::TokenBucket                  RVA 0x133e1c8
legacy::AccumulateTokenBucket        RVA 0x133e1f8
qingluan::common::TokenBucket        RVA 0x13bd408
qingluan::common::AccumulateTokenBucket RVA 0x13bd438
```

暂停/空闲附近曾观察到：

```text
legacy TokenBucket                  5
legacy AccumulateTokenBucket        5
qingluan TokenBucket                0
qingluan AccumulateTokenBucket      5
```

恢复目录下载后，legacy 对象数量迅速膨胀到：

```text
legacy TokenBucket             103 -> 142（随任务生命周期继续变化）
legacy AccumulateTokenBucket   20
qingluan AccumulateTokenBucket 5（保持固定）
```

这提供了比“二进制包含某类”更强的运行时证据：当前普通下载启动时，大量执行态 limiter 对象来自 legacy 栈；qingluan 的 5 个对象长期保持固定地址和固定状态。

### 24.2 qingluan 四连桶在运行时被直接确认

四个连续对象：

```text
0x524FB0
0x524FE8
0x525020
0x525058
```

每个对象相隔 `0x38`，均为：

```text
qingluan::common::AccumulateTokenBucket
```

字段当时为：

```text
rate      = 524288 B/s   (512 KiB/s)
token     = 1048576
last_time = 49
```

另一个 qingluan AccumulateTokenBucket：

```text
rate = 524288000 B/s     (500 MiB/s)
```

这与此前静态推断的 Live/Shadow Peer + Live/Shadow Total 四桶布局高度吻合。

更重要的是，在真实下载从数 MB/s 回落到约 125~132 KB/s 时，这四个 qingluan 桶的 `last_time` 仍保持在 `49`，没有像 legacy 活对象那样推进。因此当前这次普通下载的低速平台并不像是由这组 qingluan 四桶直接消耗产生。

### 24.3 TokenBucket 真实对象布局被反汇编闭合

legacy 与 qingluan 的方法实现都确认了相同的核心布局：

```text
+0x00  vtable
+0x08  capacity/burst-related value
+0x10  current token
+0x18  last timestamp
+0x20  rate (B/s)
+0x24  denominator = 1000
```

refill 逻辑：

```text
elapsed = now - last_timestamp
add = elapsed * rate / 1000
token += add
token = clamp(token, capacity/burst ceiling)
```

`AccumulateTokenBucket` 还具有额外的累计容量字段。

### 24.4 活跃 legacy limiter 的特征

普通目录下载恢复后，legacy TokenBucket 大量出现；多数 rate 为宽松值：

```text
104857600 B/s
78053454 B/s
103311760 B/s
```

legacy AccumulateTokenBucket 观察到：

```text
16384 B/s       × 5
91133 B/s       × 1
104857600 B/s   × 6
524288000 B/s   × 8
```

其中 `rate=16384` 的多个对象具有持续推进到约 `2.7e6 ms` 的 timestamp，说明它们不是纯静态垃圾；但实际同时存在多个子下载，单个子任务速度可高于该数值，因此不能把这些低 rate 对象直接等同于最终 Total gate。它们更可能是 peer/source/channel 级预算中的某一层。

### 24.5 当前 `.234` 低速态没有标准 `TokenBucket(rate=122880, denominator=1000)`

当 BrowserEngine 实时总速率回落到：

```text
download_speed ~= 132000 B/s
随后 ~= 125621 B/s
```

对 kernel 私有堆扫描标准 TokenBucket 字段对：

```text
rate = 122880
denominator = 1000
```

结果：

```text
0 hits
```

所以 `.234` 不能简单复用 `.223` 的结论“当前 live bucket 本体就是一个 122880 B/s TokenBucket”。

### 24.6 但 `.234` 私有堆确实存在持久的 `122880` 策略结构

继续对私有堆扫描裸 `DWORD 122880`，在低速态最终只剩一个稳定命中：

```text
0x3826914 = 122880
```

它附近形成一个明显的长期管理结构，而不是随机字节。关键邻域（按 32-bit 字段观察）包含：

```text
... dynamic_value ...
5205568
state/count
100000
40
860
122880
1
...
1572864
5242880
100
...
```

对同一结构做三态差分：

```text
运行态：state/count = 2, 122880 保持
暂停态：state/count = 0, 122880 保持
恢复态：state/count = 2, 122880 保持
```

同时另一个动态字段在运行/暂停过程中从约：

```text
122737 -> 124464
```

发生变化。

因此这个 `122880` 不是一次网络缓冲里的偶然整数，而属于一个跨任务暂停继续保留的持久策略/管理对象；旁边的状态字段又明确跟下载运行生命周期联动。

当前最合理的标记是：

```text
3.0.20.234 120 KiB/s policy/manager candidate
```

但尚未证明它直接执行 token acquire，也尚未恢复该结构的具体 C++ 类型。

### 24.7 BrowserEngine 权益层同时暴露普通速度、加速上限和闲时策略

`payDlTip` 组件的运行数据提供了另一条独立证据：

```text
dlSpeed(history normal peak) = 3199000 B/s
dlSpeedNow                   ~= 125621 B/s
speedLimit                    = 307200 B/s
```

`307200 B/s` 正好等于 300 KiB/s，也与 `get_speedup_info(true)` 返回的：

```text
speedup_speed_limit = 307200
```

一致。因此该 `speedLimit` 更像 speedup/权益可用上限，而不是当前普通下载的 120 KiB/s 上限。

同一组件还拿到了明确的服务端闲时下载配置：

```text
北京时间 01:00-09:00：闲时下载卡可享极速下载
其他时间：普通速度
```

这证明 `.234` 前端明确维护“普通速度 / 特权速度 / 时间窗口”的服务端权益策略。

### 24.8 当前模型更新

`.234` 的证据更适合写成：

```text
服务端账号/权益策略
  -> BrowserEngine policy/guide state
  -> kernel persistent 120 KiB/s manager/policy candidate
  -> legacy runtime execution objects (大量动态 TokenBucket)
  -> task/source/peer/channel gates
  -> network requests
```

当前 120 KiB/s 平台仍与本地策略值高度相关，但“策略值存储对象”和“最终 token 执行对象”在 `.234` 中已经明显分层，不能把二者视为同一个 TokenBucket。

下一步：反查 `0x3826914` 所在 heap allocation 的引用者/写入代码，给这个持久 122880 结构恢复类型和更新函数；再观察它如何向 legacy execution buckets 分发预算。


## 二十五、3.0.20.234：`basic_speed=122880` 的命名策略与 legacy 执行层

### 25.1 `122880` 不再只是运行时候选值，而是明确命名的 `basic_speed` 默认值

对 `.234` 中所有真实的 `0x1e000`（122880）立即数引用重新精确枚举后，找到一段明确解析下载/P2P 速度策略的函数。它连续处理四个配置字段：

```text
+0x438  spup_peer
+0x43C  p2pup_percent
+0x440  spup_percent
+0x444  basic_speed
```

其中 `basic_speed` 的查找/解析路径在配置缺失时直接执行：

```text
basic_speed = 122880
```

即：

```text
122880 B/s = 120 KiB/s
```

附近还存在明确日志：

```text
get p2p switch|spup_peer=%1%|p2pu_percent=%2%|spup_percent=%3%|basic_speed=%4%
```

因此，`.234` 中的 120 KiB/s 已经从“与长期低速平台高度吻合的裸整数”升级为“明确命名的基础速度策略默认值”。

### 25.2 `basic_speed` 会被向下一层转交，而不是只用于日志/UI

解析完 `basic_speed` 后，函数会读取同一配置对象的 `+0x444` 字段，并通过统一 callback/消息发送路径继续向下传递。附近日志还暴露出：

```text
max_upload_speed=%1%|basic_speed=%2%|target_speed=%3%|connection_count=%4%
```

以及：

```text
slow than threshold|...|download_threshold_speed=%2%|task_download_rate=%3% ...
more than threshold|need_speed=%1%|download_threshold_speed=%2%|task_download_rate=%3% per_p2s_speed=%4%
connect p2s peer|task_download_rate=...
close p2s peer|task_download_rate=...
```

�z+�9�#��\�X���YY9c�.#��9�+Z�^K�����@�L����ꛞ�[�V���3�3�v{�6W�꿖�W���(+��O�&7�nӖB#�B�j�VÚ6����b���

```text
basic_speed
  + spup_percent / p2pup_percent / spup_peer
        ↓
target_speed / download_threshold_speed
        ↓
task_download_rate 与 threshold 比较
        ↓
P2S/CDN peer 跹��y�l9.#�o 9al�, �n���������K��:, �n��+�y��� 9��: �yi'�-�XZR�Vv7�67V�V�FUF��V�'V6�WC��6WE�&FV ��Yʎy��X["���函数中观寝b,9�m9�l:`'[�b�f��"��S�����_��k���Ƈ��_��ז#�k��c��W��ۦf����þ�3��;�&一速度上限兺/��l#�`/;�#9a�y���aiyl#�nazf���.�h�X���3����"C��行时目栅`/8� �a�y�l9�*[�[n��z�V�j�Ʌє����g��

```text
0x1800e83d0
```

前斅m���9��h.ZHފ�^X{�i[K���Vv7�67V�V�FUF��V�'V6�WC��6WE�&FVy�B&FRi�Nik�zք�#9am��.9h"�3����뼚

```text
if rate != 0:
    bucket.rate = rate
    bucket.capacity = max(rate, 16384)
```

调用现场形态：

```text
... calculate runtime rate ...
lea bucket_like_object + 0x30, rcx
mov calculated_rate, edx
call 0x1800e83d0
```

这补上了一个此前缺失的重要连接：

```text
named speed policy
    ↓
target / threshold calculation
    ↓
peer/channel scheduling
    ↓
calculated runtime rate
    ↓
legacy AccumulateTokenBucket::set_rate
    ↓
legacy execution limiter
```

因此 `.234` 的 120 KiB/s 不一定以 `TokenBucket.rate == 122880` 的形态直接存在。更叮 �y�+�h()���ѕ��(�����������ͥ�ѕ�н��ͥ�������䁉�͕����+�H�͍���ձ�ȁ��ɥٕ́�չѥ���ѡɕ͡���̽Ʌѕ�+�H������ȁ��ɔ��ᕍ�ѥ����Ս���́ɕ���ٔ���ɥٕ��م�Օ�)���(+��与�:(c9���/c�`'�� y�j���(	�k*iȒ&FS�##���FV��֖�F�#�y�Nj~XxbF��V�'V6�WN���K�nZَYʎh�K�R##��z�ynZ�Z�׊w�j�:âƇ���ӎ((�����ԸЃ���⫢�判已经排除：`124464` 不是实时下载速度

此前候选结构 `0x3826914` 附�y�9. 9.*�ke���y..��&���^�L�����. 9n��� 9�yk�>���昭k�����`'[�n8 ��Y�j�R"j��xZ�Ր��#�����\�[��[�H9�.�."�/oz`'�n��g*9�&���^�L��Ћ���MЋ���.b�e�9��b�;�#9/a�+�yke���yi����9/�y� HL��9.#ya�8 ��Y�j�N�ɠ��FW�@�#CCcB�ƗfRF�v���B�&FR6�V�FW � ��i�NX8�X�����[�V����b#��"[��ϖ�k������数。

### 25.5 仍未闭合的边界

目前仍不能直接审��;ɠ��FW�@��3�#c�B��&6�5�7VVBf�V�B���CCB�� ��K�N�^�;�z�>Z�K��##����Ί��K�����[�nY�Y����K�n[	�iʮ�	���~Z���[�^yJ��Xi�XZ^X{�i[��b;����ǚb��B3����_��ז�{��/�(+��/�������c�#�ꟾ�h((ĸ���8����ͥ�}��������j��&�� callback)��9�j{�Y�h.ZH�h�^iKnik��ɰ�"�Z��i[Nh.ZH�F&vWE�7VVFK��F�v���E�F�&W6���E�7VVFy�Ni[Z�nX[>{;��ɰ�2�Yʎ�C��3�^ۖ�k��7���ꛖ�象中的�yn�9ke���{�&�9l!�)��Z�Z�ג�8�	ɽ�͕��������хͭ}��ݹ����}Ʌѕ���k�B3����^ۦ^Ӗ�5��ɰ�R�i�{��z��NY:�K��FW&�fVB&FR�*�g���N�����������䁕ᕍ�ѥ����Ս��ӎ(

## 二十六、3.0.20.234：确认 `UploadBandwidthDetect`，拆开两种 `basic_speed`

### 26.1 真正的调度对象类名已经由 RTTI 闭环

此前 `0x180909da0` 的调用者会持续操作同一个对象：

```text
this + 0x30   legacy AccumulateTokenBucket
this + 0x60   rate meter
this + 0x168  connection_count / scheduler state
this + 0x184  detected rate
```

对应构造函数位于 `0x18054db60`：

```text
this + 0x30 -> 0x1800e8370   AccumulateTokenBucket constructor
this + 0x60 -> 0x1800be4c0   byte/time rate-meter constructor
```

对象 vtable 为 `0x181359248`。其 MSVC Complete Object Locator 指向的 TypeDescriptor 明确为：

```text
.?AVUploadBandwidthDetect@@
```

即类名：

```text
UploadBandwidthDetect
```

因此这组对象应被解释为“上传带宽探测 / P2P 调度”组件，而不是普通下载总限速器。

### 26.2 `+0x184` 是上传速率观测值，不是静态 `basic_speed`

`0x1800be510` 每收到一批字节就累计 byte count，并通过时间差计算 B/s；`0x1800be770` 会在查询时更新并返回该速率。

运行路径：

```text
lea this+0x60, rcx
call 0x1800be770
mov eax, this+0x184
```

同时二进制中的同一路径存在日志：

```text
detect upload rate=%1%
non detect upload rate=%1%
```

因此：

```text
UploadBandwidthDetect + 0x184
    = detected/current upload rate
```

这修正了此前把 `+0x184` 猜成固定 `basic_speed` 的假设。

### 26.3 scheduler 默认策略常量

构造函数将 `0x181359120` 的 16 字节常量写入 `this+0xC0`，按四个 32-bit 整数解码为：

```text
C0 = 1310720   = 1.25 MiB/s
C4 = 10
C8 = 50
CC = 1048576   = 1 MiB/s
```

`0x180909da0` 中日志：

```text
max_upload_speed=%1%|basic_speed=%2%|target_speed=%3%|connection_count=%4%
```

四个参数已经逐项闭合为：

```text
max_upload_speed = this + 0x184
basic_speed      = local_dc
target_speed     = local_fc
connection_count = this + 0x168
```

其中 runtime `basic_speed` 的核心公式为：

```text
basic_speed = min(
    C0,
    max_upload_speed * C4 / 100
)
```

代入默认值就是：

```text
basic_speed = min(
    1.25 MiB/s,
    detected_upload_speed * 10%
)
```

之后还会结合 `C8`、`CC`、随机/扰动逻辑和阈值判断生成 `target_speed`；最终：

```text
set_rate(this + 0x30, target_speed)
```

即写入 legacy `AccumulateTokenBucket`。

当检测上传速率不高于约 `CC = 1 MiB/s` 时，代码存在进入更保守 `target_speed = 16384 B/s` 分支的路径，并相应调整 `connection_count`。

因此更准确的模型是：

```text
upload byte/time meter
      ↓
detected upload speed (+0x184)
      ↓
min(policy cap C0, detected speed × C4 / 100)
      ↓
runtime basic_speed
      ↓
C8 / CC / threshold / perturbation
      ↓
target_speed
      ↓
legacy AccumulateTokenBucket (+0x30)
      ↓
P2P/P2S contribution / connection scheduling
```

### 26.4 `C0 / C4 / CC` 不是死常量，会被外部策略刷新

运行配置更新路径中存在：

```text
source + 0x08 -> scheduler + 0xC0
source + 0x04 -> scheduler + 0xC4
source + 0x0C -> scheduler + 0xCC
```

也就是说这些只是构造时默认值，之后可以由外部查询/策略结果覆盖。

RTTI 还确认该类存在回调签名：

```text
UploadBandwidthDetect(... QueryUploadBandwidthDetectInfo ...)
```

这和动态策略刷新模型一致。

### 26.5 与固定 `basic_speed=122880` 的关系必须暂时拆开

另一路已确认的配置解析器仍然存在：

```text
spup_peer
p2pup_percent
spup_percent
basic_speed
```

且缺失 `basic_speed` 时明确默认：

```text
basic_speed = 122880 B/s = 120 KiB/s
```

但本节确认 `UploadBandwidthDetect` 日志中的 `basic_speed` 是由“检测到的上传速度 × 百分比 / 上限”实时算出的局部值。

因此目前不能把两者直接等同：

```text
named config basic_speed = 122880
        != 已证明
UploadBandwidthDetect runtime basic_speed
```

更安全的当前模型是存在两条相关但尚未闭合的数据链：

```text
A. P2P switch/config parser
   basic_speed default = 122880

B. UploadBandwidthDetect
   upload-rate meter -> runtime basic_speed -> target_speed -> legacy bucket
```

下一步应追踪 A 的 callback / message consumer，确认 `122880` 最终进入哪一个 manager / scheduler / policy bucket，再判断它是否与 B 汇合。


## 二十七、3.0.20.234：固定 `basic_speed=122880` 落入全局 P2P 状态单例

### 27.1 `basic_speed` 的运行时解析值可以直接追到一个 setter

`.234` 中除前述缓存配置对象外，还存在一套按 key 即时读取的运行时配置路径。函数约位于 `0x180a6eca0`，会构造并查找：

```text
basic_speed
```

解析成功后整数值被保存到：

```text
rbp + 0x1F4
```

对应路径包括：

```text
call 0x180860f70       ; integer parse helper
mov  eax, rbp+0x1F4
```

失败路径则出现明确字符串：

```text
basic_speed parse error
```

随后日志 `basic_speed=%1%` 同样引用 `rbp+0x1F4`，因此这里拿到的就是命名配置项本身的整数值，而不是另一个同名局部概念。

### 27.2 直接消费者：全局/单例对象 `+0x600`

解析完成后存在非常直接的数据流：

```text
0x180a6f9b5  call 0x180b58a80
0x180a6f9ba  mov  rbp+0x1F4, edx
0x180a6f9c0  mov  rax, rcx
0x180a6f9c3  call 0x180b59130
```

其中：

```text
0x180b58a80
```

返回一个全局/单例状态对象，而 `0x180b59130` 只是一个纯 setter：

```text
0x180b59130:
    mov edx, [rcx+0x600]
    ret
```

语义即：

```text
singleton + 0x600 = parsed basic_speed
```

配套 getter 位于：

```text
0x180b59120:
    mov eax, [rcx+0x600]
    ret
```

因此命名配置 `basic_speed` 在 `.234` 中已经闭合到一个持久的全局 P2P/network 状态字段，而不只是解析器栈变量。

### 27.3 Correction: only `+0x600` is the confirmed 120 KiB/s scalar

A re-check of constructor `0x180b56e70` corrects an earlier layout interpretation. Around `0x180b572c8` / `0x180b57310`, the fields are not a continuous sequence of integer tuning parameters. Instead:

```text
+0x5E0 / +0x5E8 = shared_ptr pair #1
+0x5F0 / +0x5F8 = shared_ptr pair #2
+0x600          = 0x1E000 = 122880 B/s = 120 KiB/s
+0x604          = start of another embedded object
```

The constructor evidence is direct:

```text
0x180b572c8  mov rsi, [rcx+0x5E0]
0x180b572cf  mov rax, [rcx+0x5E8]
0x180b57310  mov rsi, [rax+0x5F0]
0x180b5731b  mov rcx, [rax+0x5F8]
0x180b57322  mov dword ptr [rax+0x600], 0x1E000
0x180b5732c  lea rcx, [rax+0x604]
0x180b57333  call 0x1800d5290
```

So the strong conclusion that survives is:

```text
named basic_speed
  -> singleton +0x600
  -> default 122880 B/s
```

The previously listed values at `+0x5E8..+0x5FC` must not be treated as adjacent integer policy parameters. They were a structure-layout misread and are explicitly withdrawn here.

### 27.4 已确认的 getter 用途是任务统计/报告序列化

目前对 `0x180b59120` 的清晰静态调用出现在 `0x180b8210b`：

```text
call 0x180b58a80
call 0x180b59120
mov  eax, rbp+0xD4
```

随后代码在 `0x180b82585` 左右明确构造字符串：

```text
basic_speed
```

并把 `rbp+0xD4` 作为该字段的值交给序列化 helper。

这与二进制中的长统计日志完全吻合：

```text
eApiCode=...
...
p2puser_percent=%12%
speedup_percent=%13%
basic_speed=%14%
disk_slow=%15%
```

所以至少有一条已证明的数据链是：

```text
singleton +0x600 basic_speed
        ↓
getter
        ↓
task statistics/report serialization
```

### 27.5 重要纠错：当前仍不能把命名 `basic_speed=122880` 直接画成执行限速桶

本轮没有发现：

```text
singleton +0x600
    ↓
TokenBucket::set_rate / try_acquire
```

这样的直接执行链。

因此需要修正更早的宽泛表达：

```text
named basic_speed=122880
```

与 `UploadBandwidthDetect` 中日志里的 runtime `basic_speed` 是两个不同语境：

```text
A. named P2P/network config basic_speed
   default 122880
   -> singleton +0x600
   -> 已证明参与报告/状态

B. UploadBandwidthDetect runtime basic_speed
   detected_upload_speed × percent / cap
   -> target_speed
   -> legacy AccumulateTokenBucket
```

两者目前不能直接等同，也不能据此证明 120 KiB/s 命名配置本身就是普通下载总限速器。

### 27.6 与此前 heap `122880` 候选也是两个不同位置

全局单例位于模块静态数据区，其 `+0x600` 与此前私有 heap 中观察到的：

```text
0x3826914 = 122880
```

不是同一个地址/对象。

因此 `.234` 运行时至少可能同时存在：

```text
1. global P2P state basic_speed = 122880
2. private-heap persistent 122880 candidate
```

后者仍需独立恢复类型，不能因为数值相同就合并解释。

### 27.7 下一步

优先继续解析同一运行时配置函数紧随其后的：

```text
spup_peer
p2pup_percent
spup_percent
basic_speed
```

分别映射到单例中的 setter/member offset，再从各自 getter/use-site 反推真正的调度消费者。

特别要验证：

```text
basic_speed 是否只是 P2P 基线/上报参数
还是会经由其它 subobject / memcpy / QueryInfo 路径间接进入执行调度
```

在闭合执行消费者之前，不把 `122880` 本身称为已证实的最终限速 gate。


## 28. P2P switch fields and TokenBucket-driven peer-selection threshold

### 28.1 Exact four-field P2P switch layout

The `.234` binary contains a grouped status string:

```text
get p2p switch|spup_peer=%1%|p2pu_percent=%2%|spup_percent=%3%|basic_speed=%4%
```

Two async parser callbacks (`0x18036b220-0x18036be62` and `0x18036c330-0x18036cfb7`) independently write the same four consecutive 32-bit fields:

```text
object + 0x438 = spup_peer
object + 0x43C = p2pu_percent
object + 0x440 = spup_percent
object + 0x444 = basic_speed
```

The mapping is direct: each value is parsed from its named text field, stored at the corresponding offset, then emitted in the same order by the grouped log.

A small accessor at `0x1803285d0` returns the beginning of this block:

```asm
lea rax, [rcx+0x438]
ret
```

Its known direct caller (`0x1800fcd10-0x1800fd498`) reads all four dwords and packages them into a query/status result. This proves the block is a coherent P2P policy/status structure, but this particular caller is not a byte-gating execution path.

### 28.2 The threshold logs form a P2S/CDN peer-control state machine

The binary contains a consistent family of runtime messages:

```text
task_download_rate=%1%|download_threshold_speed=%2%
slow than threshold|using_p2s_peer_count=...
close p2s peer|task_download_rate=...|download_threshold_speed=...
connect p2s peer|task_download_rate=...|download_threshold_speed=...
slow than threshold|connect_ct=...|download_threshold_speed=...|task_download_rate=...
more than threshold|need_speed=...|download_threshold_speed=...|task_download_rate=...|per_p2s_speed=...
don't close cdn|global cdn speed=...|global max speed=...|global non cdn rate=...
```

Important containing functions include:

```text
0x1801cd7d0-0x1801cefd7  choose_http_server_peer_for_one_task
0x18107af40-0x18107d5bb  connect / close p2s peer paths
0x181082d90-0x1810896ed  threshold decision logic
```

This identifies the subsystem as HTTP/CDN/P2S peer selection and connection-count control.

### 28.3 `download_threshold_speed` comes from a real TokenBucket object

In `0x1801cd7d0`, the code obtains a bucket-like object and calls `0x1800e8280`:

```asm
mov rcx, <bucket>
call 0x1800e8280
```

The result is stored as the second log argument in:

```text
task_download_rate=%1%|download_threshold_speed=%2%
```

Thus the mapping is positive:

```text
first argument  = task_download_rate
second argument = download_threshold_speed
```

`0x1800e8280` is simply:

```asm
mov eax, [rcx+0x08]
ret
```

RTTI around this object family identifies:

```text
FluxBucket
TokenBucket
AccumulateTokenBucket
```

Relevant vtables in this `.234` image are:

```text
0x18133e198 -> FluxBucket
0x18133e1c8 -> TokenBucket
0x18133e1f8 -> AccumulateTokenBucket
```

### 28.4 TokenBucket field semantics

The TokenBucket constructor and update methods recover the following layout:

```text
+0x08 = bucket capacity
+0x10 = current token count
+0x18 = last timestamp
+0x20 = refill rate
+0x24 = time divisor (1000)
```

The refill method is structurally:

```text
elapsed = now - last_time
tokens += elapsed * rate / 1000
tokens = min(tokens, capacity)
```

The setter at `0x1800e82e0` performs:

```text
rate     = requested
capacity = max(requested, 16 KiB)
```

The AccumulateTokenBucket setter at `0x1800e83d0` applies the same rate/capacity relationship for nonzero requested rates, with an additional accumulation/burst field used by its refill path.

Therefore the value logged as `download_threshold_speed` is technically the bucket capacity (`+0x08`). For requested rates at or above 16 KiB/s, its numeric value equals the configured refill rate.

### 28.5 A 0.8 / 1.3 hysteresis band controls peer adjustment

`0x1801cd7d0` contains two double constants:

```text
0x18134ed60 = 0.8
0x18134ed88 = 1.3
```

The function compares the current task rate against the bucket-derived threshold using these factors. The high-level behavior is:

```text
rate < 0.8 * threshold
    -> low-side adjustment path

0.8 * threshold <= rate <= 1.3 * threshold
    -> hold / avoid unnecessary peer churn

rate > 1.3 * threshold
    -> high-side adjustment path
```

This is a classic hysteresis pattern for connection/peer control rather than a single hard equality test.

### 28.6 Direct link into P2S decision logic

The larger P2S function `0x18107af40` obtains the relevant bucket through:

```text
task/network state
  -> 0x1801b7fa0
  -> bucket pointer
  -> 0x1800e8280
  -> bucket capacity / download_threshold_speed
  -> 0x181082d90
  -> connect/close P2S peer decision
```

Inside `0x181082d90`, several peer-category counts are collected and summed, and the bucket-derived threshold is compared with current aggregate rates/counts before requesting or dropping peers.

### 28.7 Current conclusion and remaining gap

The evidence now supports a more precise model:

```text
TokenBucket / AccumulateTokenBucket state
        -> download_threshold_speed
        -> 0.8 / 1.3 hysteresis
        -> HTTP/CDN/P2S peer-count selection
```

This is stronger than treating `download_threshold_speed` as a mere log variable. It is backed by a real bucket object and participates in execution decisions.

However, it is still not evidence that the named P2P config field:

```text
basic_speed = 122880 B/s
```

directly sets this bucket or directly gates ordinary PAN download bytes. The missing data-flow edge is still:

```text
spup_peer / p2pu_percent / spup_percent / basic_speed
        -> ?
        -> bucket rate setter
        -> download_threshold_speed
```

The next priority is therefore to recover the owner of the bucket returned by `0x1801b7fa0`, find every path that changes its refill rate/capacity, and test whether any of those inputs originate from the four-field P2P switch block.


### 28.8 The threshold bucket is embedded at owner + 0xE0

The accessor at `0x1801b7fa0` is exact:

```asm
lea rax, [rcx+0xE0]
ret
```

Therefore the bucket used by the P2S/CDN threshold logic is an embedded subobject at:

```text
network/task policy owner + 0xE0
```

The same owner also contains another independent bucket at `+0x90`. Function `0x1801b7c20-0x1801b7e67` updates that `+0x90` bucket through `AccumulateTokenBucket::set` (`0x1800e83d0`). Nearby scalar policy fields include `+0xC8`, `+0xCC`, `+0xD0`, `+0xD4`, and `+0xD8`.

This means the owner is not a thin wrapper around a single limiter. It is a composite task/network state object that contains multiple bucket instances plus peer-selection policy state.

The immediate next data-flow question is now narrower:

```text
P2P switch four-field block
        -> ?
        -> owner + 0xE0 bucket rate/capacity
        -> download_threshold_speed
        -> P2S/CDN peer-selection hysteresis
```


## 29. Qingluan task-download token path from locatedownload

### 29.1 `owner + 0xE0` is the task download token bucket

The method-name cluster around the same owner contains `get_download_token`, `set_cdn_download_token`, and `set_task_download_token`.

The `get_download_token` path at `0x18109b280-0x18109c9a8` obtains the embedded object through `0x1801b7fa0` (`owner + 0xE0`) and immediately invokes a token query/consume routine on it. Therefore `+0xE0` is not merely a peer-selection threshold snapshot; it participates in the real download-token path.

`set_task_download_token` is `0x180ecaa60-0x180ecb630`. It forms `owner + 0xE0`, reads the previous rate, then applies the new rate to that same embedded bucket.

### 29.2 The implementation is explicitly Qingluan

The final bucket setter used by `set_task_download_token` is `0x180d01e20`. RTTI for its class hierarchy identifies:

```text
qingluan::common::FluxBucket
qingluan::common::AccumulateTokenBucket
```

The setter performs:

```text
rate     = requested
capacity = max(requested, 0x7000)
```

The refill/update path uses `QueryPerformanceCounter` and `QueryPerformanceFrequency`, confirming that this task-token bucket belongs to the Qingluan clock domain.

### 29.3 `notify_speed_limit` bridges KiB/s into the Qingluan task token

`set_task_download_token` has one direct business caller: `0x180d245c0-0x180d25500`, whose embedded method name is `notify_speed_limit`.

Its third argument is stored as a KiB/s value. At the final dispatch it performs:

```asm
mov edx, <third argument>
shl edx, 0xA
call set_task_download_token
```

Therefore:

```text
notify_speed_limit(speed_kib)
        -> speed_kib * 1024
        -> set_task_download_token(speed_bps)
        -> owner + 0xE0 qingluan::common::AccumulateTokenBucket
```

A facade thunk at `0x180ecaa20` forwards to `notify_speed_limit` after loading its backend from `this + 0x10`.

### 29.4 The meaningful nonzero input comes from `handle_locatedownload_finish`

One caller resets the notification with `(0, 0)`. The meaningful caller is `0x181044e20-0x1810451fa`, which forwards:

```text
third argument  = locatedownload_result + 0xD8
second argument = locatedownload_result + 0xDC
```

The function containing that call is reached only from a larger handler carrying the literal method name `handle_locatedownload_finish` (`0x1810422c0-0x1810446fa`). The result structure is the handler's original second argument.

The same `+0xD8` field is also shifted left by 10 and passed to a separate `set_speed_limit` path before the task-token notification.

Thus the currently recovered active data flow is:

```text
locatedownload result + 0xD8   (KiB/s)
        -> set_speed_limit(..., value * 1024, ...)
        -> notify_speed_limit(..., value)
        -> value * 1024
        -> set_task_download_token
        -> Qingluan task download AccumulateTokenBucket
```

This is the strongest static evidence so far that the `.234` ordinary download control path feeds a Qingluan task token from locatedownload policy/result state.

The remaining question is the provenance of `locatedownload_result + 0xD8`: direct response field, locally decoded limit, P2P-switch override, or a combination. The next target is `decode_speed_limit` and the locatedownload response parser.


### 29.5 Locatedownload result fields `sl` and `fsl` are mapped exactly

The locatedownload/CDN completion path `0x18026b530-0x18026ea9d` emits:

```text
|cdn_urls_finish|fid=%8%|handle=%9%|urls=%1%|err=%2%|sl=%3%|pcs_error=%4%|error_msg=%5%|consume_time=%6%|fsl=%7%
```

The formatter arguments are built in this exact order:

```text
%1  result + 0x18   -> urls
%2  result + 0x128  -> err
%3  result + 0xD8   -> sl
%4  result + 0x140  -> pcs_error
%5  result + 0x148  -> error_msg
%6  local elapsed   -> consume_time
%7  result + 0xDC   -> fsl
%8  fid
%9  handle
```

Therefore the previously recovered task-token input can now be named precisely:

```text
locatedownload_result + 0xD8 = sl
locatedownload_result + 0xDC = fsl
```

Combined with the downstream path:

```text
sl (KiB/s)
  -> set_speed_limit(sl * 1024)
  -> notify_speed_limit(..., sl)
  -> set_task_download_token(sl * 1024)
  -> owner + 0xE0 qingluan::common::AccumulateTokenBucket
```

This establishes `sl` as a concrete locatedownload policy/result value that directly feeds the Qingluan task-download token limiter. What remains unresolved is whether `sl` is parsed directly from the remote response or locally derived/overridden before the result object is delivered.


### 29.6 `sl` and `fsl` are parsed in the locatedownload response handler

The function `0x1807554e0-0x18075d0d3` is positively identified as a locatedownload response-processing path by its own strings, including:

```text
locatedownload time info|local_time=%1%|server_time=%2%
locate_download_finish|rank=%1%|is_encrypt=%2%|url=%3%
sl=%1%|fsl=%2%|min_timeout=%3%|max_timeout=%4%|max_continuous_failure=%5%|bak_rank_slice_num=%6%|restrict_ratio=%7%|enterprise_p2p_open=%8%
```

Within this same parser, the key `sl` is processed and the resulting integer is stored at:

```asm
mov eax, <parsed sl>
mov [result_state + 0x1B0], eax
```

The immediately following `fsl` parse stores:

```asm
mov eax, <parsed fsl>
mov [result_state + 0x1B4], eax
```

Concrete locations:

```text
0x180758c87...0x180758d02  -> parse `sl`  -> +0x1B0
0x180758d60...0x180758dd5  -> parse `fsl` -> +0x1B4
```

The later grouped log reads this same consecutive state block in `sl, fsl, ...` order.

This proves that `sl/fsl` originate in the locatedownload response-processing layer rather than being invented at the final Qingluan task-token setter. There is still an intermediate representation boundary between the parser-state offsets `+0x1B0/+0x1B4` and the downstream completion-result offsets `+0xD8/+0xDC`; the exact conversion function remains to be named. Semantically, however, both sides identify the fields as the same `sl/fsl` pair.

The current evidence therefore supports:

```text
locatedownload response
  -> parse sl / fsl
  -> locatedownload parser state
  -> completion/result representation
  -> sl / fsl
  -> notify_speed_limit
  -> Qingluan task download AccumulateTokenBucket
```


### 29.7 Correction: the Qingluan locatedownload path has its own parser and an embedded `LocatedownloadReturnItem`

A later RTTI pass exposed an important scope correction. The binary contains both an older/non-namespaced locatedownload stack and a Qingluan-specific stack. Therefore the earlier parser at `0x1807554e0` must not be used as direct evidence for Qingluan object layout.

The Qingluan type can be identified explicitly through RTTI:

```text
qingluan::download::LocatedownloadServer
qingluan::download::LocatedownloadReturnItem
qingluan::download::P2SUrlManager
```

For `qingluan::download::LocatedownloadServer`:

```text
TypeDescriptor  0x1817BC980
COL             0x1813EF790
vtable          0x1813EF778
constructor     0x1810AE130
```

The constructor shows that this object is large and that `+0x1B0` belongs to string-like storage in this class. This rules out the previous temptation to interpret every `+0x1B0` seen in the binary as a speed field.

The Qingluan-specific locatedownload response parser is `0x1810C5B00-0x1810C6204`. It receives the server object as `RCX` and parses the response fields directly into it:

```text
"sl"      -> server + 0x470
"fsl"     -> server + 0x474
"min_sl"  -> server + 0x478
```

Concrete stores include:

```asm
0x1810C5BC6  mov [rcx + 0x470], eax   ; sl
0x1810C5C9D  mov [rcx + 0x474], eax   ; fsl
0x1810C61A1  mov [r14 + 0x478], eax   ; min_sl / next policy field
```

The caller `0x1810B9DA0-0x1810B9F9E` makes the structure relationship explicit. After calling the parser at `0x1810B9EDF`, it does:

```asm
lea  rdx, [server + 0x398]
lea  rcx, [local_return_item]
call 0x18105E5E0
```

`server + 0x398` is therefore an embedded `LocatedownloadReturnItem`. The offset arithmetic closes the gap exactly:

```text
0x470 - 0x398 = 0xD8
0x474 - 0x398 = 0xDC
0x478 - 0x398 = 0xE0
```

So the Qingluan parser is not translating one speed-layout into another. It is writing directly into fields of an embedded return object:

```text
LocatedownloadServer + 0x398 = LocatedownloadReturnItem
LocatedownloadReturnItem + 0xD8 = sl
LocatedownloadReturnItem + 0xDC = fsl
LocatedownloadReturnItem + 0xE0 = next speed-policy field
```

The return-item copy routine `0x18105E5E0-0x18105E9B0` confirms the layout is preserved. In particular:

```asm
movups 0xD8(source), xmm0
movups xmm0, 0xD8(destination)
```

That 16-byte copy carries the `sl/fsl` block and the following policy fields unchanged.

The typed callback chain is also recoverable from RTTI. The binary contains a concrete:

```text
std::_Func_impl_no_alloc<
  binder(P2SUrlManager member taking LocatedownloadReturnItem and int64),
  void(LocatedownloadReturnItem)
>
```

Its vtable is `0x1813EE4E8`; `_Do_call` is `0x18105E520`. The binder creation site `0x18103B020-0x18103B2A3` stores the member-function target:

```asm
0x18103B224  lea rax, [0x181042020]
0x18103B22B  mov [function_object + 0x08], rax
```

`0x181042020` is the P2SUrlManager locatedownload completion member. It carries the typed `LocatedownloadReturnItem` into the later asynchronous handler `0x1810422C0` (`handle_locatedownload_finish`). That handler eventually passes the same return-item pointer to `0x181044E20`, where:

```asm
mov r15, rdx
mov eax, [r15 + 0xD8]   ; sl
shl eax, 10             ; KiB/s -> B/s
...
mov r8d, [r15 + 0xD8]   ; sl
mov edx, [r15 + 0xDC]   ; fsl
call 0x180ECAA20         ; notify_speed_limit facade
```

This produces a Qingluan-only, type-consistent chain without relying on the older locatedownload parser:

```text
remote locatedownload response
  -> qingluan::download::LocatedownloadServer parser
  -> embedded LocatedownloadReturnItem.sl/fsl
  -> std::function<void(LocatedownloadReturnItem)>
  -> P2SUrlManager locatedownload completion
  -> handle_locatedownload_finish
  -> notify_speed_limit(sl, fsl)
  -> sl << 10
  -> set_task_download_token
  -> qingluan::common::AccumulateTokenBucket
```

This is the strongest static evidence so far that the Qingluan download path consumes the locatedownload `sl` policy as the task-download token rate.


### 29.8 Non-zero `sl` is used directly; zero takes a permissive fallback

The Qingluan `handle_locatedownload_finish` helper at `0x181044E20` shows the first local arbitration applied to the returned `sl` field.

It reads the locatedownload value and immediately converts the unit:

```asm
mov eax, [return_item + 0xD8]   ; sl, KiB/s
shl eax, 0xA                    ; sl * 1024 -> B/s
```

For two local speed-limit categories, a non-zero `sl` replaces the defaults without an intermediate downward clamp:

```asm
r14d = 0x1F400000              ; 524,288,000 B/s = 500 MiB/s
if (sl != 0) r14d = sl << 10

edi  = 0x06400000              ; 104,857,600 B/s = 100 MiB/s
if (sl != 0) edi = sl << 10
```

These values are then sent to `set_speed_limit` (`0x180B92DA0`) under category ids `3` and `4`.

After that, the original locatedownload values are still forwarded unchanged in their KiB/s form:

```asm
mov r8d, [return_item + 0xD8]   ; raw sl
mov edx, [return_item + 0xDC]   ; raw fsl
call 0x180ECAA20                ; notify_speed_limit facade
```

The facade reaches `0x180D245C0`, where `sl` is again converted with `<< 10` before updating the Qingluan task-download token bucket.

The important semantic distinction is therefore:

```text
sl != 0:
    locatedownload sl is treated as a concrete cap
    -> local category limits = sl * 1024
    -> task token rate       = sl * 1024

sl == 0:
    the two category limits use permissive 100 MiB/s / 500 MiB/s defaults
    while raw sl=0 is still propagated into the task-speed notification path
```

No local reduction of a non-zero `sl` has been observed between the Qingluan locatedownload parser and the task-token update. The remaining arbitration can still occur in other global/user/peer/token layers, so this does not imply that `sl` is the only possible bottleneck.


### 29.9 `sl` simultaneously programs Qingluan P2S total and peer limits

The category argument passed into `set_speed_limit` (`0x180B92DA0`) is not opaque. The function indexes a static name table at `0x1817A0ED0`:

```text
0 = user_total_ctl
1 = p2p_total_sl
2 = p2p_peer_sl
3 = p2s_total_sl
4 = p2s_peer_sl
5 = application_total_ctl
6 = application_peer_ctl
7 = default_total_ctl
```

Its own log template is explicit:

```text
set sl|sl=%1%|speed_limit_type=%2%|current_peer_sl_type=%3%|current_peer_sl=%4%|current_total_sl_type=%5%|current_total_sl=%6%|
```

This lets the two calls from `handle_locatedownload_finish` be named exactly:

```text
category 4 -> p2s_peer_sl
category 3 -> p2s_total_sl
```

Therefore, when locatedownload returns a non-zero `sl`, the same converted value is applied to both P2S scopes:

```text
p2s_peer_sl  = sl * 1024
p2s_total_sl = sl * 1024
```

When `sl == 0`, the caller substitutes permissive defaults before these two calls:

```text
p2s_peer_sl  = 100 MiB/s
p2s_total_sl = 500 MiB/s
```

The tail of `set_speed_limit` also exposes the limiter's two-bucket arbitration layout. It uses bit mask `0x2B`, whose set bits are categories `{0,1,3,5}` — exactly the total-limit sources:

```text
user_total_ctl
p2p_total_sl
p2s_total_sl
application_total_ctl
```

These update the winning total source field at `SpeedLimitor + 0xA0` and program the bucket at:

```text
SpeedLimitor + 0x70 = total bucket
```

The peer categories `{2,4,6}` update the winning peer source at `SpeedLimitor + 0x30` and program the bucket beginning at the object base:

```text
SpeedLimitor + 0x00 = peer bucket
```

Both branches call the same Qingluan bucket-rate setter `0x180D01E20`.

This is a direct implementation match for the earlier source-priority model: User / P2P / P2S / Application / Default are not merely labels in the binary; `set_speed_limit` actively records the winning source separately for peer and total scope and updates the corresponding token bucket.

### 29.10 `LocatedownloadReturnItem + 0xE0` is `min_sl`

The Qingluan locatedownload response parser constructs the literal key `min_sl` and stores its parsed integer at:

```asm
mov [server + 0x478], eax
```

Because `server + 0x398` is the embedded `LocatedownloadReturnItem`:

```text
0x478 - 0x398 = 0xE0
```

so the field can be named precisely:

```text
LocatedownloadReturnItem + 0xE0 = min_sl
```

The P2SUrlManager completion path later forwards this field separately:

```asm
mov edx, [return_item + 0xE0]
call 0x180ECAA50
```

`0x180ECAA50` is a trivial setter:

```asm
mov [object + 0x140], edx
ret
```

Thus the locatedownload `min_sl` survives the typed return-item callback and is retained in downstream task/P2S state at `+0x140`. Its later behavioral use is the next item to trace.


### 29.11 Return-item defaults and the `no_speed_limit` state

The constructor used for the embedded Qingluan `LocatedownloadReturnItem` is `0x1810AECD0`. Its 16-byte policy block at `+0xD8` is initialized from constant `0x1813EF760`:

```text
raw: 00 00 00 00  ff ff ff ff  00 00 00 00  00 00 00 00
```

Interpreted as four signed 32-bit fields:

```text
+0xD8  sl      = 0
+0xDC  fsl     = -1
+0xE0  min_sl  = 0
+0xE4  next    = 0
```

This rules out an important alternative explanation: the approximately 120 KiB/s value is not a built-in default in the Qingluan locatedownload return object. If this path is responsible for a live ~120 KiB/s cap, a non-zero value such as `sl=120` must have been supplied/parsed after construction.

`notify_speed_limit` keeps both locatedownload values in task state and also updates a literal key named `no_speed_limit`. The relevant branch is equivalent to:

```text
if (fsl != 0 && sl != 0)
    no_speed_limit = "0";
else
    no_speed_limit = "1";
```

Thus the constructor defaults:

```text
sl  = 0
fsl = -1
```

produce `no_speed_limit = 1` because `sl` is zero. A non-zero `sl` combined with the normal non-zero `fsl` state produces `no_speed_limit = 0`.

The evidence does not yet justify expanding the abbreviation `fsl` into a guessed full name. What is established is its control role: it participates in deciding whether the task state is marked as having no speed limit, while the actual task-token rate is derived from `sl`.

### 29.12 P2P-switch fields and the separate 120 KiB/s fallback

The `on_query_p2p_switch` response handlers at `0x18036B220` and `0x18036C330` parse four independent P2P-control integers into a configuration/result object:

```text
+0x438 = spup_peer
+0x43C = p2pu_percent
+0x440 = spup_percent
+0x444 = basic_speed
```

The nearby diagnostic format is explicit:

```text
get p2p switch|spup_peer=%1%|p2pu_percent=%2%|spup_percent=%3%|basic_speed=%4%
```

These handlers do not directly call the already-identified Qingluan P2S limiter functions (`set_speed_limit`, `notify_speed_limit`, or the task-token setter). This supports treating P2P-switch policy and locatedownload `sl` as separate inputs/layers rather than assuming a single shared formula.

A second important observation is that the exact constant `122880 B/s = 120 KiB/s` appears in several code locations. In particular, `0x18036C330` contains `mov esi, 0x1E000` in missing/alternate parsing branches, and other constructors initialize long-lived fields to the same value. This demonstrates that 120 KiB/s also exists as a client-side fallback/base value in another policy path.

However, current evidence does **not** justify saying that this one constant alone causes the observed live cap. The Qingluan locatedownload path separately defaults `sl` to zero and consumes a non-zero remote `sl` directly. The most accurate current model is therefore layered:

```text
P2P-switch policy: spup_peer / p2pu_percent / spup_percent / basic_speed
    may contain a 120 KiB/s local fallback/base value

Qingluan P2S policy: locatedownload sl / fsl / min_sl
    sl -> p2s_peer_sl + p2s_total_sl + task token rate
```

A live dynamic sample is still required to determine which layer wins for a specific ordinary download task.

### 29.13 Minimal reproduction: time dilation multiplies a QPC token-bucket rate

A local standalone experiment was added at `experiments/token-bucket-timewarp-demo.cpp`. It does not interact with Baidu Netdisk. It implements a 120 KiB/s token bucket whose refill clock comes from `QueryPerformanceCounter`, then multiplies only the elapsed time observed by the limiter.

The core model is:

```text
perceived_dt = real_dt * time_factor
tokens += perceived_dt * 120 KiB/s
```

Measured over approximately three wall-clock seconds:

```text
factor 1x  -> 118.06 KiB/s
factor 2x  -> 237.67 KiB/s
factor 5x  -> 596.95 KiB/s
factor 10x -> 1193.73 KiB/s
```

The result is almost perfectly linear. This reproduces the mechanism-level effect expected when a client-side token bucket uses a time API whose returned elapsed time is accelerated: the configured nominal rate remains 120 KiB/s, but the bucket refills approximately `time_factor` times faster in real time.

This experiment supports the time-dilation explanation for OpenSpeedy-like behavior without modifying or bypassing a third-party service. Whether a particular live Baidu Netdisk task is affected still depends on which limiter stack is active, which clock it uses, and whether another server/global/peer gate becomes the next bottleneck.

### 29.14 `fsl` participates in state/telemetry, while the task-token setter consumes the requested token directly

A function at `0x180ECAA60` emits:

```text
no_sl=%1%|p2s_token=%2%|new_token=%3%|fsl=%4%|
```

Its control flow is useful for separating roles. The incoming requested token value is preserved as `new_token`; when the request is zero the function substitutes a very loose `0x1F400000` (500 MiB/s) fallback. It reads the current `no_sl` state, the current P2S token, and `fsl` for state/logging, then finally applies `new_token` to the task token bucket via the Qingluan bucket setter.

Thus `fsl` is not the arithmetic source of the task-token rate in this setter. The concrete task-token rate still comes from the requested value (which the locatedownload path supplies from `sl << 10`). `fsl` participates in the surrounding speed-limit/no-speed-limit state machine.

### 29.15 Three-gate Qingluan model and upstream saturation

A second standalone experiment was added at `experiments/qingluan-limiter-model.cpp`. It models the recovered non-zero locatedownload `sl` behavior using three independent QPC-driven gates:

```text
p2s_peer_sl          = sl * 1024
p2s_total_sl         = sl * 1024
task_download_token  = sl * 1024
```

All three buckets see the same virtual-time factor. A separate upstream/CDN supply limit is applied in wall-clock time so the model can show the next bottleneck taking over.

With `sl=120 KiB/s` and upstream supply limited to `4096 KiB/s`, approximately three-second samples produced:

```text
factor 1x  -> 118.55 KiB/s
factor 2x  -> 238.26 KiB/s
factor 5x  -> 595.84 KiB/s
factor 10x -> 1192.75 KiB/s
factor 50x -> 4074.02 KiB/s
```

The first four samples are nearly linear with the perceived QPC time factor. At 50x, the theoretical token refill is about 6 MiB/s, but observed throughput saturates near the configured 4 MiB/s upstream limit. This demonstrates the layered-limiter model: defeating or accelerating one client-side time-driven gate does not create bandwidth; another server/network/global gate becomes the bottleneck.

This experiment is intentionally standalone and does not modify Baidu Netdisk or a live service limit.

### 29.16 Read-only Qingluan bucket observer

A low-overhead read-only observer was added at `experiments/qingluan-bucket-observer.cpp`. It locates the `baidunetdiskhost.exe` process that actually loaded `kernel.dll`, computes the live address of the `.234` Qingluan `AccumulateTokenBucket` vtable from the recovered RVA, and scans only committed `MEM_PRIVATE` regions with `ReadProcessMemory`.

It does not modify the target process. For each matching object it reports the recovered fields `rate`, `tokens`, `last timestamp`, and denominator.

With no active download task, the current `.234` process reported five resident Qingluan accumulate buckets:

```text
4 x rate = 524288 B/s       = 512 KiB/s
1 x rate = 524288000 B/s    = 500 MiB/s
```

No `122880 B/s` Qingluan bucket was present in the idle state. This gives a useful dynamic baseline: when a future ordinary download becomes active, a newly created or retuned Qingluan bucket near `122880 B/s` would strongly connect the live task to a non-zero `locatedownload.sl` around 120 KiB/s.

### 29.17 Dynamic ordinary SELF sample selects the legacy execution stack

A clean ordinary SELF download was created through the client's own BrowserEngine path from the current personal-netdisk file list. The sample was approximately 200 MB and used a dedicated local research directory. No limiter value, DLL, response, or process memory was modified.

The client emitted real `onDownloadTaskProgress` events while the file grew. After the initial burst, reported speed converged tightly around the long-observed 120 KiB/s region:

```text
121323 B/s
119995 B/s
123433 B/s
122986 B/s
122618 B/s
124308 B/s
```

At the same time `p2p_extend_info` continued to report:

```text
download_slow = false
network_slow  = false
firewall_ban  = false
is_speedup    = 0
```

This also corrects an earlier status interpretation. The progress object carried `status="2"` while `finish_size` was actively increasing, so the previously recovered BrowserEngine enum must not be applied blindly to every DB/progress `status` field. Runtime progress and lifecycle events are the authoritative evidence for this layer.

#### 29.17.1 Qingluan bucket state is invariant during this SELF transfer

The read-only observer showed the exact same Qingluan bucket set in idle, running, and paused states:

```text
qingluan.TokenBucket = 0
qingluan.AccumulateTokenBucket = 5

4 x 524288 B/s       (512 KiB/s), timestamp = 49
1 x 524288000 B/s    (500 MiB/s), timestamp = 51
```

A complete line-by-line diff of the Qingluan objects between paused and running snapshots was empty. No new task-level Qingluan bucket appeared, no rate changed, and the tiny timestamps remained unchanged even while tens of megabytes were transferred.

This is strong runtime evidence that the statically recovered Qingluan `locatedownload.sl -> task token` stack is not the active execution limiter for this ordinary SELF sample.

#### 29.17.2 Legacy bucket lifetime follows the download lifecycle

A new dual-stack observer (`experiments/limiter-bucket-observer.cpp`) scans all four recovered RTTI/vtable types read-only:

```text
legacy TokenBucket                  RVA 0x133E1C8
legacy AccumulateTokenBucket        RVA 0x133E1F8
qingluan TokenBucket                RVA 0x13BD408
qingluan AccumulateTokenBucket      RVA 0x13BD438
```

For a controlled pause -> resume snapshot pair:

```text
paused:
  legacy.TokenBucket = 29
  legacy.AccumulateTokenBucket = 86
  qingluan.TokenBucket = 0
  qingluan.AccumulateTokenBucket = 5

running:
  legacy.TokenBucket = 43
  legacy.AccumulateTokenBucket = 89
  qingluan.TokenBucket = 0
  qingluan.AccumulateTokenBucket = 5
```

The running snapshot therefore contained 14 legacy `TokenBucket` objects and 3 legacy `AccumulateTokenBucket` objects that did not exist in the paused snapshot. One of the run-only accumulate buckets used a 16 KiB/s rate; the others were broad limits. The Qingluan set was bit-for-bit stable by textual object dump.

Pausing through the official `pauseDownloadTask` IPC produced `error=1000001`, `status=3`, removed the task from `runningFilesMap`, and stopped progress after roughly 22.4 MB had been transferred. The task is intentionally left paused for follow-up observation.

The most defensible current conclusion is therefore:

```text
kernel.dll 3.0.20.234 ordinary SELF sample
    -> active legacy runtime bucket lifecycle
    -> Qingluan limiter code remains present but its observed bucket set is idle/invariant
```

This materially strengthens the FILETIME/time-virtualization hypothesis for the currently selected ordinary SELF backend, because the recovered legacy limiter uses the FILETIME clock family. It does NOT yet prove which single legacy bucket or higher-level peer scheduler produces the final ~120 KiB/s plateau: no run-only bucket in this snapshot directly had `rate=122880`. The plateau may be produced by a higher policy/peer-allocation layer, a combination of per-peer gates, or a non-bucket server/CDN constraint before the legacy execution buckets.

#### 29.17.3 The run-only three-bucket owner is `NetGrid`

RTTI recovery on the owner that embeds the three run-only legacy `AccumulateTokenBucket` objects identifies the class as `NetGrid` (`.?AVNetGrid@@`). Its constructor initializes three legacy accumulate buckets at offsets `+0x30`, `+0x60`, and `+0x90`.

The constructor reads `network.max_task_upload_speed` with a 100 MiB/s default and `network.max_task_download_speed` with a 500 MiB/s default. The initialization sequence maps the buckets as follows:

```text
NetGrid +0x30  task upload token     default 100 MiB/s
NetGrid +0x60  task download token   default 500 MiB/s
NetGrid +0x90  CDN download token    default 100 MiB/s
```

The third mapping is not inferred from offset alone. The method that writes `NetGrid+0x90` logs the literal operation name `set_cdn_download_token` and the value as `cdn_token=%1%`. The method resides at `0x1801B7C20` and ultimately calls legacy `AccumulateTokenBucket::set_rate` at `0x1800E83D0`.

For the ordinary SELF runtime sample, the task-download bucket remained broad while the CDN bucket was observed at only 16 KiB/s:

```text
NetGrid task download token : 524288000 B/s  (500 MiB/s)
NetGrid CDN download token  :     16384 B/s  (16 KiB/s)
```

This explains why a single `122880 B/s` total bucket was not present in the run-only set. A plausible model is that the final ~120 KiB/s plateau is composed above/beside the per-NetGrid CDN token through multiple active HTTP/CDN peers or another scheduler layer. That composition is not yet proven; the next step is to trace the virtual callers of `set_cdn_download_token` and recover how the 16 KiB/s argument is produced.

The `set_cdn_download_token` function is present as a virtual method in the primary `NetGrid` vtable. Static byte-pattern scanning for the corresponding vtable slot found two candidate indirect-call sites, with the short function around `0x1801B8DD0-0x1801B8E51` selected as the first target for follow-up because it is small enough to recover completely without broad disassembly scans.

#### 29.17.4 `locatedownload.sl = 120` is converted directly to `122880 B/s`

The most important remaining question was why the live SELF transfer converged near 120 KiB/s even though no run-only legacy bucket was initialized directly with `122880 B/s`.

A parameter-application path in `0x18026B530-0x18026EA9D` closes this gap. The response/state object used by this function stores an integer at `+0xD8`. The function takes a pointer to that field and performs the following logic around `0x18026D4D6`:

```asm
mov    (%r15), %eax        ; raw = object+0xD8
mov    %eax, %ecx
shl    $0xa, %ecx          ; scaled = raw * 1024
test   %eax, %eax
mov    $0x1f400000, %ebx   ; 500 MiB/s fallback
cmovne %ecx, %ebx
mov    $0x06400000, %esi   ; 100 MiB/s fallback
cmovne %ecx, %esi
```

The same unscaled value is subsequently passed into a NetGrid state setter (`vtable +0x170`), which is the setter for `NetGrid+0xD0`:

```asm
mov    (%r15), %edx
...
call   *0x170(%rax)
```

The read-only runtime probe observed `NetGrid+0xD0 = 120` on the relevant limited NetGrid instances. Therefore the conversion performed by the client is exactly:

```text
120 << 10
= 120 * 1024
= 122880 B/s
= 120 KiB/s
```

This numerically matches the real transfer plateau observed in `onDownloadTaskProgress` (`119995-124308 B/s`). The 120 value is therefore not merely correlated with the speed cap; the client explicitly converts it into the byte-per-second limit used by downstream speed-control configuration.

#### 29.17.5 The `+0xD8` and `+0xDC` response fields are named `sl` and `fsl`

The same function emits the format string:

```text
|cdn_urls_finish|fid=%8%|handle=%9%|urls=%1%|err=%2%|sl=%3%|pcs_error=%4%|error_msg=%5%|consume_time=%6%|fsl=%7%|
```

Recovering the formatter insertion order maps the response/state fields as follows:

```text
%1  +0x18   urls
%2  +0x128  err
%3  +0xD8   sl
%4  +0x140  pcs_error
%5  +0x148  error_msg
%6          local consume_time
%7  +0xDC   fsl
%8/%9       fid / handle
```

Thus the raw value converted by `<< 10` is formally the locatedownload/CDN-result `sl` field, while `fsl` is a separate field at `+0xDC`.

At the end of the same path, `fsl` is forwarded as the fourth argument to `0x18038B1F0`, whose log operation is `on_cdn_return_urls`. That function stores the value at its object offset `+0x1AC`, showing that `fsl` remains a distinct downstream URL/peer-level policy value rather than being folded into `sl`.

A separate static log exists in the binary:

```text
task_handle=%1%|file_speed_limit=%2%|total_speed_limit=%3%|
```

Together with telemetry fields such as `locatedownload_sl`, `total_speed_limit`, and `cdn_speed_limit`, this strongly suggests that `sl/fsl` participate in the total/file speed-limit policy hierarchy. However, until the parser/storage fields are connected explicitly to that log, this note keeps the conservative names `sl` and `fsl` rather than equating them unconditionally with `total_speed_limit` and `file_speed_limit`.

#### 29.17.6 The 16 KiB/s CDN bucket is an override, not the stored default

A one-shot read-only probe of live NetGrid objects showed that limited instances commonly retain:

```text
NetGrid+0xC8 = 104857600 B/s   (100 MiB/s backing/default)
NetGrid+0xCC = 0xFFFFFFFF      (override state)
NetGrid+0x90 bucket = 16384 B/s
NetGrid+0xD0 = 120
```

When the override is inactive, instances with `+0xCC = 0` retain the broad `+0x90 = 100 MiB/s` CDN rate. Therefore the observed 16 KiB/s CDN token is a runtime override applied on top of the stored default, while the higher-level locatedownload `sl=120` is separately retained in NetGrid state and converted to the exact 120 KiB/s byte rate in the policy application path.

#### 29.17.7 `sl` is `total_speed_limit`; `fsl` is `file_speed_limit`

A separate policy-tree function at `0x180D245C0-0x180D25500` removes the remaining ambiguity in the short field names. At entry it stores its two integer arguments as:

```text
arg2 (EDX) -> local +0x220
arg3 (R8D) -> local +0x224
```

The function emits the explicit log format:

```text
task_handle=%1%|file_speed_limit=%2%|total_speed_limit=%3%|
```

The formatter maps `%2` to local `+0x220` and `%3` to local `+0x224`. Later, the same function converts those integers to text and writes them into a property tree using the exact keys:

```text
local +0x220 (file_speed_limit)  -> "fsl"
local +0x224 (total_speed_limit) -> "sl"
```

It also updates `no_speed_limit` according to whether these limits are present. Finally, `total_speed_limit` is shifted by 10 bits before being forwarded to the task-download token path:

```asm
mov    local_total_speed_limit, %edx
shl    $0xa, %edx
call   ...set_task_download_token...
```

Therefore the short protocol/policy names can now be stated directly:

```text
fsl = file_speed_limit
sl  = total_speed_limit
```

The business-level operation appears in both legacy and Qingluan implementations, so object type still matters when identifying the active backend. The naming relationship itself, however, is explicit in this shared policy construction path.

#### 29.17.8 `sl`/`fsl` are parsed from the locatedownload response

The response parser at `0x1807554E0-0x18075D0D3` contains the operation strings `handle_response`, `locatedownload time info`, and `locate_download_finish`. It begins from HTTP response state (`response_data.size`, HTTP code, socket error, host) and parses the returned response tree.

Within this locatedownload response handler, the client constructs the literal short key `"sl"`, looks it up in the parsed tree, converts the node value to an integer, and stores it at result-object offset `+0x1B0`. Immediately afterwards it repeats the same sequence for `"fsl"` and stores that integer at `+0x1B4`:

```text
response tree["sl"]  -> integer -> result +0x1B0
response tree["fsl"] -> integer -> result +0x1B4
```

The same function later logs:

```text
sl=%1%|fsl=%2%|min_timeout=%3%|max_timeout=%4%|...
```

and its first two formatter arguments are precisely `result+0x1B0` and `result+0x1B4`. This establishes that these values originate in the locatedownload HTTP response parser rather than from a local hard-coded 120 constant.

Combined with the previous runtime and policy evidence, the current ordinary SELF chain is now:

```text
locatedownload HTTP response
    -> parse sl (= total_speed_limit)
    -> observed sl = 120
    -> client scales sl << 10
    -> 122880 B/s
    -> live transfer converges near 120 KiB/s
```

The separate `fsl` value is forwarded into the downstream CDN URL handling path (`on_cdn_return_urls`) and stored independently. A paused-state memory scan did not retain a trustworthy adjacent `sl=120/fsl=16` response object, so the observed 16 KiB/s NetGrid CDN override is deliberately NOT equated with `fsl` yet. That relationship remains a separate question.

#### 29.17.9 CDN scheduler has a 16 KiB/s floor and applies the computed limit

A local CDN scheduling function at `0x180333300-0x180339319` contains the explicit log format:

```text
|set speed limit|cdn_speed_limit=%1%|set_cdn_speed_limit=%2%|...|task_rate=%5%|...|http_peer_ct=%8%:%9%|http_speed=%10%|...|p2p_speed=%13%|...
```

Inside this function, the working CDN speed-limit value is kept in local `+0x128`. One branch initializes the candidate to `0x4000` and clamps a computed quotient upward to that value:

```asm
mov    $0x4000, %esi
...
cmp    $0x4000, %eax
mov    $0x4000, %esi
cmova  %rax, %rsi
mov    %rsi, local+0x128
```

So that branch implements a minimum of exactly:

```text
0x4000 B/s = 16384 B/s = 16 KiB/s
```

Related scheduler branches can raise the selected value to `0x8000` (32 KiB/s), `0x40000` (256 KiB/s), or use a minimum/maximum involving `0x80000` (512 KiB/s), depending on task/peer state. Therefore the live 16 KiB/s value observed in the NetGrid CDN bucket is consistent with the scheduler's explicit lowest tier rather than a rewritten 100 MiB/s default field.

The working value is not logging-only. Near the end of the same function the code loads local `+0x128` into `EDX` and invokes a task object's virtual method at vtable offset `+0x50`:

```asm
mov    local+0x128, %edx
mov    (%r15), %rax
mov    %r15, %rcx
call   *0x50(%rax)
```

Thus the scheduler-computed CDN speed limit is actively forwarded to a task/backend object. The exact identity of that `vfunc+0x50` is still being traced; it should not yet be equated with the already identified `NetGrid::set_cdn_download_token` until the receiving object's RTTI/vtable is proven.

This also strengthens the separation between two mechanisms:

```text
locatedownload sl=120 -> total/task-level 122880 B/s policy
local CDN scheduler -> per-CDN execution limit with explicit 16 KiB/s floor
```

The relationship between response `fsl` and the live 16 KiB/s scheduler result remains deliberately unclaimed.

#### 29.17.10 CDN dispatcher -> EntityTask -> NetGrid -> CDN token bucket is now closed

The remaining indirection after `cdn_speed_limit_dispatch` can now be identified completely.

The dispatcher iterates a task list whose node layout contains the task pointer at `node+0x10`. The task object's virtual-call pattern matches the primary `EntityTask` vtable at `0x1813500C8` across many independent slots, not just one method:

```text
scheduler slot   EntityTask primary vtable target
+0x08            0x1802820D0
+0x50            0x1802AE170
+0x78            0x1802A6BC0
+0x98            0x1802A93E0
+0xA8            0x1800F0950
+0xB0            0x1802A8480
+0x1D8           0x1802A69D0
+0x1E0           0x1802A6AC0
+0x1F8           0x1802A8510
```

This establishes that the object receiving the dispatcher-computed rate is the legacy `EntityTask`.

The `EntityTask` method at vtable `+0x50`, `0x1802AE170`, is a pure forwarding bridge:

```asm
mov    0x108(%rcx), %rcx
 test   %rcx, %rcx
 je     return
 mov    (%rcx), %rax
 mov    0x158(%rax), %rax
 jmp    *%rax
```

It does not modify `EDX`, so the CDN rate argument is forwarded unchanged to `(EntityTask+0x108)->vfunc+0x158`.

The type of `EntityTask+0x108` is now also proven statically. In the EntityTask initialization function `0x180286E70-0x180287F76`, the code first checks that `this+0x108` is null, allocates exactly `0x2A8` bytes, and calls constructor `0x1801A7E20` on the new object. That constructor writes the four `NetGrid` RTTI/vtable pointers directly into the object, beginning with the primary NetGrid vtable:

```asm
lea    0x18134E208, %rax
mov    %rax, 0x00(%rcx)
lea    0x18134E528, %rax
mov    %rax, 0x08(%rcx)
lea    0x18134E588, %rax
mov    %rax, 0x10(%rcx)
lea    0x18134E6E8, %rax
mov    %rax, 0x18(%rcx)
```

The same constructor then initializes the three legacy `AccumulateTokenBucket` members at `NetGrid+0x30`, `+0x60`, and `+0x90`, exactly matching the previously recovered NetGrid layout.

After construction, EntityTask initialization calls `0x1802A8320` with:

```text
RCX = &EntityTask+0x108
RDX = new NetGrid
```

That helper builds the lifetime/control block, then stores the new object pointer and control block into the target pair:

```text
EntityTask+0x108 = NetGrid*
EntityTask+0x110 = lifetime/control block
```

Therefore the scheduler bridge is now exact:

```text
cdn_speed_limit_dispatch
    computes local+0x128
        (16 KiB/s floor in the observed low-rate branch)
    -> EntityTask::vfunc+0x50(rate)
    -> EntityTask+0x108 = NetGrid
    -> NetGrid::vfunc+0x158(rate)
    -> 0x1801B7C20 set_cdn_download_token(rate)
    -> NetGrid+0x90 legacy AccumulateTokenBucket::set_rate(rate)
```

This closes the origin and execution path of the live 16384 B/s NetGrid CDN token without relying on a guessed vtable slot or runtime proximity correlation.

The next unresolved architectural question is composition: locatedownload supplies `sl=120` (122880 B/s total policy), while the local dispatcher may assign an individual NetGrid CDN token of 16384 B/s. The number/scope of simultaneously active EntityTask/NetGrid instances or peer lanes must be established before claiming how those local 16 KiB/s limits sum to the observed ~120 KiB/s task rate.

#### 29.17.11 The 16 KiB/s value is a CDN fill-budget allocation, not the final 120 KiB/s cap

The same legacy dispatcher (`0x180333300-0x180339319`) identifies itself with the literal operation name `cdn_speed_limit_dispatch` and exposes its global inputs in a grouped log:

```text
global_p2p_dl_speed=%1%|
global_onecloud_dl_speed=%2%|
global_onecloud_http_dl_speed=%3%|
global_third_http_dl_speed=%4%|
global_http_dl_speed=%5%|
global_pop_speed=%6%|
history_global_max_download_speed=%7%|
sl=%8%|
cdn_speed_limit_count=%9%|
set_cdn_speed_limit=%10%|
current_dl_speed=%11%|
global_max_download_speed=%12%
```

The formatter/data-flow mapping is now sufficiently recovered to identify the important fields:

```text
%1  global P2P download speed
%2  global OneCloud download speed
%3  global OneCloud HTTP download speed
%4  another third/non-CDN HTTP lane
%5  ordinary global HTTP/CDN speed
%6  global POP speed
%7  historical global maximum download speed
%8  sl policy scalar
%9  cdn_speed_limit_count policy/state field
%10 dispatcher output local+0x128 = set_cdn_speed_limit
%11 current aggregate download speed
%12 effective global maximum download speed used by the dispatcher
```

The `sl` getter used here (`0x1800C3530 -> 0x1800F0830 -> 0x1800E8280`) ultimately reads a 32-bit rate/capacity field from a local policy object. It is not a live throughput measurement.

In the low-rate branch, the dispatcher compares the current aggregate contribution against `sl`. If the aggregate has not reached `sl`, it computes a remaining budget and divides that budget across the task/list population represented by the dispatcher. The resulting candidate is clamped upward to 16 KiB/s:

```text
remaining = sl - aggregate_speed
candidate = remaining / dispatcher_task_count
set_cdn_speed_limit = max(candidate, 16384 B/s)
```

The `dispatcher_task_count` wording is structural rather than a source-level symbol: the code iterates the list rooted at manager `+0x50` and uses manager `+0x58` as the divisor, matching the MSVC list head/size pair layout. A literal manual increment of `+0x58` was not separately observed, so that detail should not be overstated.

This explains the apparently contradictory runtime observations:

```text
higher-level sl target          = 120 KiB/s
per-EntityTask NetGrid CDN rate = 16 KiB/s in the observed low-rate state
```

The 16 KiB/s value is a per-task CDN execution allocation/floor used to fill a remaining bandwidth budget. It is not the final total task cap.

The dispatcher is adaptive rather than a single fixed divider. The binary contains three double thresholds used by adjacent CDN allocation branches:

```text
0.4
0.6
0.8
```

Different branches scale the remaining bandwidth differently depending on the current/global-speed regime, and may raise the CDN allocation into larger tiers (32 KiB/s, 256 KiB/s, 512 KiB/s or a computed value).

#### 29.17.12 Legacy peer selection explicitly separates non-CDN and CDN contribution

The already identified legacy function `choose_http_server_peer_for_one_task` (`0x1801CD7D0-0x1801CEFD7`) contains the exact log:

```text
don't close cdn|
global_cdn_speed=%1%|
history_global_max_speed=%2%|
global_non_cdn_rate=%3%|
cdn_connect_count=%4%|
task_cdn_download_rate=%5%|
need_cdn_speed=%6%|
history_max_http_speed=%7%|
remaining_block=%8%
```

This function explicitly sums several P2P/OneCloud/non-CDN lane speeds into `global_non_cdn_rate`, while the ordinary HTTP lane is reported separately as `global_cdn_speed`. It then uses `need_cdn_speed` and connection-count state to decide whether CDN contribution should remain active.

So the current `.234` ordinary SELF model is no longer "16 KiB/s times N connections happens to look like 120 KiB/s". The code supports a budget-composition model instead:

```text
remote/local higher-level target (`sl`)
        |
        +-- current non-CDN contribution (P2P / OneCloud / related lanes)
        +-- current CDN/HTTP contribution
        |
        +-- adaptive CDN dispatcher allocates remaining budget
                 |
                 +-- per EntityTask -> NetGrid CDN token
```

This is also consistent with the 0.8 / 1.3 hysteresis already recovered in `choose_http_server_peer_for_one_task`: connection-count changes are deliberately damped rather than oscillating on every small speed fluctuation.

The remaining high-value edge is now narrower: trace the local `sl` scalar consumed by `cdn_speed_limit_dispatch` back to the locatedownload/CMS application path, so the current legacy chain can be written end-to-end without relying only on matching value/name semantics.

#### 29.17.13 `manager+0x58` is the actual dispatcher list count

The `start_task` insertion path provides an instruction-level confirmation for the divisor used by `cdn_speed_limit_dispatch`.

After allocating the list node and storing the `EntityTask*` at node `+0x10` plus its lifetime/control object at node `+0x18`, the code executes:

```asm
add qword ptr [dispatcher_manager+0x58], 1
```

It then links the node into the list rooted at manager `+0x50`.

Therefore `manager+0x58` is not merely inferred from MSVC list layout: it is the real current element count of the same `EntityTask` list iterated by the CDN dispatcher. The low-rate calculation really divides the remaining policy budget across the currently registered dispatcher tasks.

#### 29.17.14 The dispatcher `sl` state lives in legacy `Peer`

The object referenced through dispatcher manager `+0x250` has now been identified through MSVC RTTI.

Its primary vtable is:

```text
0x181383C58
```

The corresponding CompleteObjectLocator points to:

```text
.?AVPeer@@
```

So the shared object used by the dispatcher speed getters and `sl` getter is the legacy `Peer` object, not an anonymous telemetry structure.

The `sl` path is:

```text
0x1800C3530
    -> 0x1800F0830
    -> 0x1800E8280
```

and ultimately reads the `+0x08` field of an embedded rate-state object at `Peer+0xE0`.

That embedded state has at least the following relevant fields:

```text
+0x08 = effective rate
+0x20 = raw/requested rate
```

Its setter is `0x1800E82E0`:

```asm
mov [rcx+0x20], edx       ; preserve requested/raw rate
cmp edx, 0x4000
mov eax, 0x4000
cmova eax, edx
mov [rcx+0x08], eax       ; effective = max(raw, 16384)
```

Thus the same 16 KiB/s lower bound exists inside the `Peer` rate-state itself.

The primary `Peer` vtable exposes the live update methods:

```text
vtable +0x80 -> 0x180A342C0
    if rate != 0:
        setter(Peer+0xE0, rate)

vtable +0x88 -> 0x180A342E0
    if rate != 0:
        setter(Peer+0x108, rate)
```

The second adjacent state at `Peer+0x108` uses the same rate-state implementation.

The `Peer` constructor (`0x180A330E0`) initializes both embedded rate states and sets their default requested/effective rate to `0x06400000`, i.e. 104,857,600 B/s = 100 MiB/s. Therefore the observed ~120 KiB/s policy is not the compile-time/default Peer rate; it must be installed later by a runtime policy path.

This narrows the remaining legacy data-flow edge to:

```text
locatedownload/CMS `sl=120`
        -> convert to byte rate (`120 << 10` = 122880 B/s)
        -> [runtime wrapper/callback still to identify]
        -> Peer::vfunc+0x80 / Peer+0xE0 rate-state
        -> cdn_speed_limit_dispatch
        -> EntityTask::vfunc+0x50
        -> NetGrid CDN token bucket
```

A first scan for the trivial pattern `shl 10` immediately followed by an indirect call through vtable `+0x80/+0x88` found no hit. This suggests the value crosses at least one stored field, helper/wrapper, callback, or delayed policy-application stage rather than being passed directly from the locatedownload parser into the Peer setter.

#### 29.17.15 Legacy locatedownload `sl` directly programs both global CDN and total speed-limit buckets

The unresolved gap between the legacy locatedownload result and the final ~120 KiB/s plateau is now closed at the global bandwidth-policy layer.

In the legacy locatedownload completion/application function `0x18026B530-0x18026EA9D`, the already identified `sl` value is read through the pointer held in `r15` and converted at `0x18026D4D6`:

```asm
mov eax, [r15]          ; raw locatedownload sl, KiB/s
mov ecx, eax
shl ecx, 0xA            ; sl * 1024 -> B/s
test eax, eax
mov ebx, 0x1F400000     ; 500 MiB/s fallback/default
cmovne ebx, ecx
mov esi, 0x06400000     ; 100 MiB/s fallback/default
cmovne esi, ecx
```

Therefore a nonzero `sl=120` produces:

```text
ECX = 120 << 10 = 122880 B/s
ESI = 122880 B/s
EBX = 122880 B/s
```

The same path first preserves the raw KiB/s value in the global policy singleton:

```text
0x1800C2AA0() -> global policy/bandwidth state at 0x1817C0118
0x1800C9990(state, raw_sl) -> state+0xAD8 = raw_sl
```

It then calls:

```text
0x1800C0BC0(state, ESI, EBX, 2)
    -> 0x1800EF110
```

The business log embedded in `0x1800EF110` is exact:

```text
set sl|cdn_sl=%1%|total_sl=%2%|src=%3%|
current_cdn_src=%4%|current_cdn_sl=%5%|
current_total_src=%6%|current_total_sl=%7%|
```

The entry argument mapping is:

```text
EDX = cdn_sl
R8D = total_sl
R9D = source enum
```

The static source-name table at `0x181776030` resolves as:

```text
0 = user_ctl
1 = enable_cms_total_sl
2 = locatedownload
3 = p2psdk
4 = application
5 = default
```

So the call made by the legacy locatedownload path is formally:

```text
set_sl(
    cdn_sl   = sl << 10,
    total_sl = sl << 10,
    src      = locatedownload
)
```

For `sl=120`, both requested limits are exactly 122880 B/s.

`0x1800EF110` maintains two independent priority-controlled rate states. Near its tail it applies the selected values through the legacy `AccumulateTokenBucket::set_rate` routine `0x1800E83D0`:

```text
state + 0x00 bucket  <- selected cdn_sl
state + 0x70 bucket  <- selected total_sl
```

The code reads their current effective rates with `0x1800E8280`, keeps separate source-priority fields at `+0x30` and `+0xA0`, and then updates the corresponding bucket only when the incoming source/value wins the local arbitration.

This changes the interpretation of the live ~120 KiB/s result materially. It is no longer necessary to explain the plateau as a sum of multiple 16 KiB/s NetGrid limits. The client has an explicit global legacy gate that receives the locatedownload value directly:

```text
remote locatedownload response
    -> sl = 120 KiB/s
    -> legacy completion applies sl << 10
    -> set sl(cdn_sl=122880, total_sl=122880, src=locatedownload)
    -> global CDN AccumulateTokenBucket
    -> global TOTAL AccumulateTokenBucket
    -> downstream Peer/CDN scheduling
    -> EntityTask
    -> NetGrid / HTTP execution
```

The adaptive CDN dispatcher and its 16 KiB/s per-EntityTask floor therefore sit *below* (or alongside downstream allocation under) a concrete 120 KiB/s global policy gate. The 16 KiB/s value remains important for distributing/filling CDN budget, but it is not required to explain the total observed plateau.

This also explains why the earlier run-only object scan did not need to find a `NetGrid` bucket whose own rate was 122880 B/s: the exact 122880 B/s cap is installed in the global legacy bandwidth state before the per-task NetGrid allocation layer.

#### 29.17.16 Read-only runtime snapshot confirms two independent 120 KiB/s global gates

A read-only `ReadProcessMemory` snapshot was taken from the current `baidunetdiskhost.exe` process (PID 27188) without resuming the transfer or modifying memory.

The current `kernel.dll` module base is:

```text
0x7FF97C170000
```

The global legacy bandwidth-policy object has preferred image VA `0x1817C0118`, so its runtime address is:

```text
0x7FF97D930118
```

The two embedded global rate states contain:

```text
CDN state at +0x00
  +0x08 effective rate = 122880
  +0x20 raw/requested rate = 122880
  +0x30 source = 2

TOTAL state at +0x70
  +0x78 effective rate = 122880
  +0x90 raw/requested rate = 122880
  +0xA0 source = 1
```

Using the already recovered source table:

```text
0 = user_ctl
1 = enable_cms_total_sl
2 = locatedownload
3 = p2psdk
4 = application
5 = default
```

this means the paused current process retains the following exact policy state:

```text
CDN global gate   = 122880 B/s, source = locatedownload
TOTAL global gate = 122880 B/s, source = enable_cms_total_sl
```

This is stronger than the earlier static conclusion that locatedownload supplies both values at one point in time. `set_sl` performs source/priority arbitration, and the current runtime state shows that the TOTAL side has subsequently been selected from the CMS layer while the CDN side remains selected from locatedownload.

Therefore the current ordinary SELF sample has two independent policy inputs converging on the same 120 KiB/s value.

#### 29.17.17 CMS and P2P-SDK source calls into the same legacy `set_sl` arbitrator

`0x1800C0BC0 -> 0x1800EF110` has only three relevant direct business callers in the current legacy path.

The locatedownload caller was already identified at `0x18026D513` with source `2`.

The function `0x1802AE6B0-0x1802B10BF` contains the other two source-specific calls.

At `0x1802B0434-0x1802B044E`:

```asm
call 0x1800C2AA0
mov  r8d, [rbp+0x288]
mov  rcx, rax
mov  edx, 0xFFFFFFFF
mov  r9d, 1
call 0x1800C0BC0
```

This is exactly:

```text
set_sl(
    cdn_sl   = -1,                  // leave CDN side alone
    total_sl = parsed_value,
    src      = enable_cms_total_sl
)
```

That behavior matches the live snapshot: source `1` owns the TOTAL gate but not the CDN gate.

Later in the same function, at `0x1802B0DDB-0x1802B0DF6`:

```asm
call 0x1800C2AA0
mov  r8d, [rbp+0x28C]
mov  edx, [rbp+0x160]
mov  rcx, rax
mov  r9d, 3
call 0x1800C0BC0
```

This is the alternative `p2psdk` source (`src=3`) feeding both sides of the same arbitration layer.

The CMS TOTAL candidate at local `[rbp+0x288]` is not hard-coded. It is parsed as a signed integer from a string/config-tree node immediately before the `src=1` call. The exact config key is the next item to decode; the nearby key constructor uses a literal length of `0x11` bytes, which is compatible with `total_limit_speed` but this note does not call that proven until the RIP-relative literal itself is decoded.

#### 29.17.18 CMS fields are explicitly `total_limit_speed` and `total_limit_enable`

The config keys consumed by the `src=1` path have now been decoded from their RIP-relative literals rather than inferred from string length.

At `0x1802B018B` the 17-byte key is exactly:

```text
total_limit_speed
```

At `0x1802B02D9` the 18-byte key is exactly:

```text
total_limit_enable
```

The enclosing function advertises itself with the literal operation name:

```text
handle_config_data
```

and contains multiple CMS-specific logs/keys, including:

```text
cms time|membership=%1%|
ss_strategy_version
cms time|ss_strategy_version=%1%|current ver=%2%
cms time|no ss_strategy|
cms time|ss_strategy=%1%|
the user all task rooback in cms config
cms time|ttl=%1%|
cms time|p2s_limit_speed=%1%|
cms time|cms_max_speed=%1%|total_limit_enable=%2%|total_max_speed=%3%|
cms time|total_limit_speed=%1%|current_sl=%2%|
```

Therefore the source enum name `enable_cms_total_sl` corresponds to an actual CMS configuration handler, not merely a misleading local label.

`total_limit_speed` is parsed as a signed integer into local `[rbp+0x288]` and is then passed directly as `R8D=total_sl` to the `src=1` `set_sl` call. There is no `<<10` conversion between the integer parse and the call.

Consequently the two current 120 KiB/s policy values have different source units:

```text
locatedownload: sl = 120 KiB/s -> client shifts <<10 -> 122880 B/s
CMS: total_limit_speed = 122880 -> used directly as B/s
```

The current runtime equality is therefore an explicit convergence of two independently sourced policy layers, not one shared integer field being reused everywhere.

#### 29.17.19 The live 122880 global gates are exactly legacy `AccumulateTokenBucket` objects and refill from FILETIME

A second read-only runtime snapshot of the same global bandwidth-policy object showed that both embedded rate states have the same live vptr:

```text
runtime vptr  = 0x7FF97D4AE1F8
preferred VA  = 0x18133E1F8
```

MSVC RTTI for `0x18133E1F8` resolves exactly to:

```text
.?AVAccumulateTokenBucket@@
```

The global object's stored raw locatedownload field at `+0xAD8` also still equals:

```text
120
```

So the live object graph itself matches the static chain:

```text
raw locatedownload sl = 120
CDN AccumulateTokenBucket rate = 122880 B/s
TOTAL AccumulateTokenBucket rate = 122880 B/s
```

The primary `AccumulateTokenBucket` vtable contains:

```text
+0x08 -> 0x1800E83D0  set_rate
+0x10 -> 0x1800E8300  get_raw/requested_rate
+0x18 -> 0x1800E83F0  refill/update
```

`0x1800E83F0` obtains its current timestamp through `0x1800DDAD0`. That function calls `0x1800B0680`, whose import call at `0x181478EF0` resolves through the PE import table to:

```text
KERNEL32.dll!GetSystemTimeAsFileTime
```

`0x1800B0680` then performs FILETIME/Windows-epoch arithmetic using the constant:

```text
0xFE624E212AC18000
```

The refill implementation computes elapsed time from successive values returned by that clock, multiplies elapsed time by the bucket rate, divides by the bucket timebase, adds the result to the token balance, and clamps the accumulated balance to the bucket capacity/effective ceiling.

This is the strongest timing result so far: the exact two global buckets that currently hold the 120 KiB/s policy are not merely members of a codebase that somewhere uses FILETIME. Their actual refill path is directly driven by `GetSystemTimeAsFileTime`.

Architecture-only implication:

- a one-time forward wall-clock discontinuity can at most create an unusually large refill followed by the normal capacity clamp, so it is naturally bounded as a transient burst;
- a process-local mechanism that continuously changes the perceived progression of `GetSystemTimeAsFileTime` is conceptually different, because this refill formula is proportional to perceived elapsed time;
- this does not by itself prove an end-to-end sustained speed increase, because other task/peer/server/network gates can still become limiting, and no clock hook or limiter modification has been applied in this research.

#### 29.17.20 Current `AccumulateTokenBucket` burst capacity explains one-shot clock-jump behavior

A read-only snapshot of the two live global 120 KiB/s buckets also recovered their current refill constants:

```text
CDN bucket:
  raw rate        = 122880 B/s
  time divisor    = 1000
  accumulate cap  = 2115584 bytes
  current tokens  = 0

TOTAL bucket:
  raw rate        = 122880 B/s
  time divisor    = 1000
  accumulate cap  = 2115584 bytes
  current tokens  = 13480
```

The `AccumulateTokenBucket::refill/update` implementation therefore behaves, for this live configuration, approximately as:

```text
added_tokens = perceived_elapsed_ms * 122880 / 1000
new_tokens   = min(old_tokens + added_tokens, 2115584)
```

At the current rate, filling an empty bucket to the accumulation ceiling requires about:

```text
2115584 / 122880 = 17.216667 seconds
```

of perceived elapsed time.

This makes the difference between two time experiments concrete:

- a one-time large forward discontinuity in perceived wall time can fill the bucket, but the refill is bounded by the ~2.1 MB accumulation ceiling and therefore naturally becomes a transient burst;
- a continuously accelerated perceived clock changes the refill slope on every update rather than merely filling the bucket once.

No clock manipulation was performed; these values were recovered by read-only inspection of the current paused process.

#### 29.17.21 OpenSpeedy current source hooks the exact wall-clock API used by the live Baidu legacy gates

The current OpenSpeedy public source (`game1024/OpenSpeedy`, `src-bridge/speedpatch/speedpatch.cpp`, observed 2026-09-02) explicitly hooks:

```text
GetSystemTimeAsFileTime
GetSystemTimePreciseAsFileTime
QueryPerformanceCounter
GetTickCount / GetTickCount64
...and other wait/timer APIs
```

Its `Hook_GetSystemTimeAsFileTime` maintains real and virtual base points and computes the returned FILETIME using the same conceptual relationship:

```text
virtual_delta = SpeedFactor * (real_now - real_base)
virtual_now   = virtual_base + virtual_delta
```

When the factor changes, OpenSpeedy rebases from its last real/virtual values before continuing, so it changes the *slope* of process-perceived time while preserving continuity rather than applying a single discontinuous system-clock jump.

Public source reference:

```text
https://github.com/game1024/OpenSpeedy/blob/master/src-bridge/speedpatch/speedpatch.cpp
```

This is architecturally significant because the current Baidu global CDN/TOTAL gates call `KERNEL32!GetSystemTimeAsFileTime` through the normal imported API path during every token refill. Thus the two projects' timing mechanisms match at the API boundary:

```text
Baidu live legacy AccumulateTokenBucket
    -> GetSystemTimeAsFileTime

OpenSpeedy process-time virtualization
    -> hooks GetSystemTimeAsFileTime
    -> changes perceived elapsed-time slope
```

OpenSpeedy also hooks `QueryPerformanceCounter`, which is the clock family previously identified in the separate Qingluan limiter implementation. Therefore its published clock coverage includes both clock families discovered statically in Baidu's current `.234` kernel, although the current ordinary SELF sample is specifically evidenced on the legacy FILETIME-driven global buckets.

This is still an architecture result, not an end-to-end bypass result: no hook was installed into `baidunetdiskhost.exe`, no limiter value was modified, and other downstream/network/server constraints could become the bottleneck if the global refill gate ceased to be limiting.

#### 29.17.22 CMS configuration source is a real remote config subsystem

The current kernel contains the production CMS config endpoint:

```text
https://pan.baidu.com/cms/config?method=query
```

and retains server-proxy source/type artifacts including:

```text
H:\baidu\netdisk\qingluan-download\project\src\server_proxy\cms_config_server.cpp
CmsConfigServer
qingluan::download::CmsConfigServer
```

The legacy `handle_config_data` path that parses `total_limit_speed` / `total_limit_enable` also handles membership, strategy version, TTL and P2S speed policy and emits `cms time|...` logs. Together these artifacts establish that `enable_cms_total_sl` is part of a genuine CMS remote-configuration subsystem rather than a purely local user setting.

Static presence of the endpoint alone does not prove that a particular request was emitted at the instant of the snapshot. The stronger per-session fact remains the live arbitrator state: TOTAL source is currently `enable_cms_total_sl` with rate 122880 B/s.

#### 29.17.23 `set_sl` uses a fixed source-priority ordering

The tail of `0x1800EF110` now makes the source arbitration rule explicit for positive speed-limit candidates.

For the CDN side:

```asm
cmp  [state+0x30], incoming_source
jl   skip_cdn_update
...
mov  [state+0x30], incoming_source
call AccumulateTokenBucket::set_rate
```

For the TOTAL side:

```asm
cmp  [state+0xA0], incoming_source
jl   skip_total_update
...
mov  [state+0xA0], incoming_source
call AccumulateTokenBucket::set_rate
```

Therefore a positive incoming candidate is allowed to replace the current source only when:

```text
current_source >= incoming_source
```

Lower enum numbers have higher priority. With the recovered source table, the ordering is:

```text
0  user_ctl              highest priority
1  enable_cms_total_sl
2  locatedownload
3  p2psdk
4  application
5  default               lowest priority
```

This exactly explains the current live state:

```text
locatedownload (2) can initially install TOTAL=122880
CMS (1) can later replace source 2 with TOTAL=122880
locatedownload (2) cannot subsequently displace an active CMS source 1
```

The same ordering is independently maintained for CDN (`state+0x30`) and TOTAL (`state+0xA0`). This is why the current process can simultaneously hold:

```text
CDN   source = 2 locatedownload
TOTAL source = 1 enable_cms_total_sl
```

There is also a normalization rule for non-user sources. Near `0x1800EFC08`, when `source != 0` and the TOTAL candidate is positive, the function ensures:

```text
total_sl = max(total_sl, cdn_sl)
```

when both values are positive. This prevents a non-user policy call from installing a positive TOTAL ceiling below its positive CDN ceiling.

Finally, source `2` (`locatedownload`) sets a dedicated state flag at `state+0x1C1`. The exact downstream meaning of that flag is not yet named, so it is recorded only as a locatedownload-active marker rather than given a stronger semantic label.

The remaining question for this arbitration layer is the release/fallback path: when a higher-priority source such as CMS becomes disabled or invalid, determine how its ownership is relinquished and whether the code immediately restores a lower-priority stored candidate or waits for that source to publish again.

#### 29.17.24 `rest set sl` is a whole-policy reset, not a CMS-only release

The literal `rest set sl|cdn_sl=%1%|cdn_src=%2%|total_sl=%3%|total_src=%4%|` resolves to function `0x1800EE960-0x1800EF0C2`.

This function resets the complete legacy speed-policy state rather than releasing only one source. At entry it writes broad defaults into several embedded buckets and sets the corresponding source fields back to `5 = default`.

For the relevant global gates it performs the equivalent of:

```text
CDN bucket rate   <- 0x80000 (512 KiB/s default in this reset path)
CDN source        <- default (5)
TOTAL bucket rate <- 0x80000
TOTAL source      <- default (5)
```

It also restores several later rate states to much larger defaults (`0x1F400000`) and resets their source fields to `default`.

Two direct callers were recovered:

1. `0x1800C4060-0x1800C4261`: when a stored session/identity-like numeric key at `this+0x8E8` changes from a previous nonzero value, the whole speed policy is reset before storing the new key.
2. `0x1800C5E00-0x1800C6248`: this path parses membership strings including `normal`, `vip`, and `svip`; when the derived membership class changes from the previous value, it calls the same whole-policy reset.

Therefore membership/session transitions rebuild the limiter state from defaults and then allow the normal policy sources to republish their candidates. This is separate from ordinary CMS config refresh.

#### 29.17.25 Disabling CMS total-limit has a consistency guard rather than blindly clearing the limiter

`handle_config_data` initializes `total_limit_enable` to zero, parses the optional `total_limit_enable` field, and then branches around the `src=1` `set_sl` call.

When `total_limit_enable != 0`, the CMS candidate is directly submitted:

```text
set_sl(cdn_sl=-1, total_sl=total_limit_speed, src=enable_cms_total_sl)
```

When `total_limit_enable == 0`, the handler does not simply set TOTAL to zero/unlimited. It first reads:

```text
current CDN effective rate = 0x1800C3530(global_state)
locatedownload-active flag = 0x1800C3570(global_state)
```

`0x1800C3570 -> 0x1800F1E40` is a trivial getter for `global_state+0x1C1`. This byte is set to `1` by `set_sl` when source `2=locatedownload` is processed, so it can now be named a locatedownload-active marker.

The disabled-CMS branch compares the configured CMS total-limit candidate with the current CDN constraint and checks the locatedownload-active marker. In the narrow case where locatedownload is active and the CMS candidate would fall below the current CDN rate, it substitutes the current CDN rate before submitting a CMS TOTAL candidate. Otherwise it skips the CMS update.

This is a policy-consistency guard: the CMS TOTAL layer is prevented from creating a contradictory TOTAL ceiling below an already active locatedownload CDN ceiling.

A read-only runtime snapshot of the current paused process confirms:

```text
locatedownload-active (+0x1C1) = 1
auxiliary flag       (+0x1C0) = 0
CDN source                    = 2 (locatedownload)
TOTAL source                  = 1 (enable_cms_total_sl)
CDN raw rate                  = 122880 B/s
TOTAL raw rate                = 122880 B/s
```

The exact meaning of `+0x1C0` remains unnamed; unlike `+0x1C1`, it is not assigned a semantic label without tracing its writers.

#### 29.17.26 End-to-end causal proof with the official OpenSpeedy hook on a self-owned FILETIME bucket harness

To validate the time-dilation hypothesis without modifying or injecting into BaiduNetdisk, a standalone self-owned harness was added:

`	ext
experiments/openspeedy-filetime-proof.cpp
`

The harness intentionally reproduces the live Baidu legacy global gate parameters recovered from the paused .234 process:

`	ext
rate             = 122880 B/s (120 KiB/s)
accumulate cap   = 2115584 bytes
time source       = GetSystemTimeAsFileTime
refill            = elapsed_ms * rate / 1000
target transfer   = 3145728 bytes (3 MiB)
`

The 3 MiB target is larger than the ~2.1 MiB burst capacity, so completing the run requires sustained refill rather than a single time-jump burst.

The experiment used the official OpenSpeedy 3.3.8 signed portable package obtained through the WinGet manifest. The downloaded ZIP was verified before extraction:

`	ext
OpenSpeedy 3.3.8 portable signed ZIP
SHA256 = 8B95AF6706C826D3E9BC53F8A97998B40ED0F526C03AA72263B81CC6FA411AAC
`

The OpenSpeedy source snapshot inspected for this test was:

`	ext
cf41e57dd9f5f46a8e69fe6fa248072a566909b7
`

No cross-process injection was used. The harness loads speedpatch64.dll into **itself** with LoadLibrary, then calls the exported SP_SetSpeed(double) function. This is important: the experiment tests the real OpenSpeedy hook implementation while avoiding any modification of BaiduNetdisk or another third-party process.

To avoid circular timing measurements, two clocks are sampled inside the harness:

`	ext
GetSystemTimeAsFileTime -> deliberately hooked by official speedpatch64.dll
NtQuerySystemTime       -> not hooked by this OpenSpeedy build; used as real-time reference
`

The harness does not call Sleep in the limiter loop. It yields with SwitchToThread, so the measured throughput increase is not an artifact of OpenSpeedy shortening sleeps.

Measured results:

`	ext
factor  hooked FILETIME elapsed   real NtQuerySystemTime elapsed   FILETIME/real   real throughput
1x      25.782 s                  25.782 s                         1.000           119.15 KiB/s
2x      25.688 s                  12.844 s                         2.000           239.18 KiB/s
5x      25.626 s                   5.125 s                         5.000           599.41 KiB/s
10x     25.620 s                   2.562 s                        10.000          1199.06 KiB/s
`

Theoretical real throughput for a 120 KiB/s refill gate under continuous perceived-time scaling is:

`	ext
1x   120 KiB/s
2x   240 KiB/s
5x   600 KiB/s
10x 1200 KiB/s
`

The measured values are within roughly one percent of this prediction.

This is now direct causal evidence for the mechanism itself:

`	ext
official OpenSpeedy speedpatch64.dll
  -> hooks GetSystemTimeAsFileTime
  -> returned elapsed time scales by factor N
  -> a FILETIME-driven AccumulateTokenBucket refills at ~N * configured rate
  -> real throughput through that gate rises from ~120 KiB/s to ~N*120 KiB/s
`

The test also distinguishes continuous time dilation from a one-shot clock jump: each run transfers more than the bucket's burst capacity while maintaining the predicted N-fold real throughput, so the result cannot be explained by one initial bucket fill.

What this experiment proves:

1. The published OpenSpeedy hook, not merely a hand-written simulation, changes GetSystemTimeAsFileTime at exactly the factor requested.
2. The same rate/cap/refill model recovered from Baidu's live legacy buckets responds linearly to that hook.
3. The causal chain 	ime slope -> elapsed -> refill -> throughput is experimentally demonstrated.

What it intentionally does **not** prove:

- OpenSpeedy was not injected into aidunetdiskhost.exe.
- No Baidu limiter value or process memory was modified.
- It does not establish the final end-to-end throughput that a third-party service would deliver after its client-side gate stopped being the bottleneck; server/CDN/peer/application constraints could become limiting next.

This is the strongest safe validation performed so far: the actual OpenSpeedy hook implementation was exercised against a self-owned reproduction using the exact live Baidu FILETIME bucket parameters.

#### 29.17.27 Original Baidu `.234` AccumulateTokenBucket successfully rehosted

The previous OpenSpeedy experiment used a source-level reproduction of the recovered refill formula. This section removes that remaining approximation: the standalone harness now loads the **original local Baidu `kernel.dll` 3.0.20.234** and directly executes its internal legacy `AccumulateTokenBucket` machine code.

The exact binary under test remains:

```text
kernel.dll version = 3.0.20.234
size               = 55,073,024 bytes
SHA256             = 40EB35FCA9316FA2E24AACF18177747295D48B01F852AEA9372E2EDE13E1C5D6
```

Recovered original functions used by the harness:

```text
clock baseline init              0x1800E8200  (RVA 0xE8200)
AccumulateTokenBucket ctor       0x1800E8370  (RVA 0xE8370)
AccumulateTokenBucket::set       0x1800E83D0  (RVA 0xE83D0)
FluxBucket::consume              0x1800E8220  (RVA 0xE8220)
AccumulateTokenBucket::refill    0x1800E83F0  (RVA 0xE83F0)
legacy relative-time helper      0x1800DDAD0  (RVA 0xDDAD0)
```

The original `AccumulateTokenBucket` vtable at preferred VA `0x18133E1F8` confirms slot `+0x18` points to the original refill routine `0x1800E83F0`, so calling `0x1800E8220` exercises the original virtual refill automatically.

A plain `LoadLibrary(kernel.dll)` was initially insufficient: the constructor produced `last_timestamp=1`, revealing that the limiter clock depends on a host-initialized FILETIME baseline. The minimum required original initialization was recovered as `0x1800E8200`. Calling it establishes the same global relative-time baseline used by `0x1800DDAD0`.

After that initialization, a standalone sanity check produced:

```text
wait 250 ms after clock init
ctor -> last_timestamp = 250

set(122880)
wait ~1.01 s
original refill -> tokens = 124108

wait another ~0.513 s
original refill -> tokens = 187145
```

This directly confirms that the original Baidu machine code is operational outside `baidunetdiskhost.exe` and follows the recovered FILETIME-derived refill behavior.

The rehosted object also reproduces the real layout/defaults:

```text
vptr          -> original AccumulateTokenBucket vtable
initial rate  = 524288000 B/s
initial cap   = 524288000
current token = 0
divisor       = 1000
accumulate cap= 2115584 bytes

set(122880):
rate          = 122880 B/s
capacity      = 122880
accumulate cap remains 2115584
```

This is no longer a source-level approximation of the limiter component; the component under test is the original `.234` implementation.

#### 29.17.28 Binary-level causal proof: original Baidu bucket + official OpenSpeedy hook

A second standalone harness was added:

```text
experiments/baidu-original-bucket-openspeedy-proof.cpp
```

It combines, in a self-owned process only:

```text
original Baidu kernel.dll 3.0.20.234 machine code
  + original clock-baseline initialization
  + original AccumulateTokenBucket ctor/set/consume/refill
  + live rate = 122880 B/s
  + live accumulate cap = 2115584 bytes
  + official signed OpenSpeedy 3.3.8 speedpatch64.dll
```

No code is injected into `baidunetdiskhost.exe`, and no Baidu process memory or limiter state is modified.

The official OpenSpeedy package used was again verified against the WinGet manifest:

```text
OpenSpeedy 3.3.8 portable signed ZIP
SHA256 = 8B95AF6706C826D3E9BC53F8A97998B40ED0F526C03AA72263B81CC6FA411AAC
```

The harness initializes the original Baidu relative-time baseline, loads OpenSpeedy's official `speedpatch64.dll` into the harness itself, calls `SP_SetSpeed`, constructs the original Baidu bucket, and transfers 3 MiB exclusively through the original `FluxBucket::consume` routine. Every failed consume retries after `SwitchToThread`; the harness contains no replacement refill formula.

Two independent clocks are measured:

```text
Baidu original 0x1800DDAD0 relative-time helper
NtQuerySystemTime real-time reference (not hooked by this OpenSpeedy build)
```

Measured results:

```text
factor  Baidu-kernel elapsed  real elapsed  kernel/real  real throughput
1x      25.776 s              25.776 s      1.000        119.18 KiB/s
2x      25.697 s              12.849 s      2.000        239.08 KiB/s
5x      25.627 s               5.125 s      5.000        599.41 KiB/s
10x     26.293 s               2.629 s     10.001       1168.51 KiB/s
```

The 1x/2x/5x results are essentially the theoretical 120/240/600 KiB/s values. At 10x, polling/scheduling overhead becomes visible in wall-clock throughput, but the **original Baidu kernel time helper still observes a 10.001x time slope**. This distinction is important: the clock manipulation itself remains exact while CPU scheduling and retry overhead start to matter at high factors.

The transferred 3 MiB exceeds the original bucket's ~2.1 MiB accumulation ceiling, so these results require sustained refill and cannot be explained by a one-time initial burst.

This closes the limiter-component causal chain at binary level:

```text
official OpenSpeedy speedpatch64.dll
    -> hooks GetSystemTimeAsFileTime inside the self-owned harness
    -> original Baidu 0x1800B0680/0x1800DDAD0 time path observes N-times elapsed
    -> original Baidu AccumulateTokenBucket::refill executes with that elapsed
    -> original Baidu FluxBucket::consume releases data at approximately N * 122880 B/s
```

For the **legacy global AccumulateTokenBucket component**, the earlier source-model uncertainty is now removed: this test executes the same `.234` machine code, object layout, vtable, clock helper, rate, divisor and accumulation ceiling observed in the live Baidu process.

The remaining non-equivalence is above/below this component, not inside it: the standalone harness does not reproduce the full Baidu network stack (`set_sl` arbitration, Peer, CDN dispatcher, EntityTask, NetGrid, HTTP/P2P/CDN server behavior). Therefore this is binary-level proof for the core limiter component, not a claim that a complete real Baidu download would necessarily scale by the same factor after another bottleneck becomes active.

#### 29.17.29 Original `set_sl` arbitration rehost reproduces the live dual-source state

The rehost was extended above the individual bucket level to the original legacy global speed-policy object itself.

Original functions used:

```text
global state accessor  0x1800C2AA0 -> 0x1817C0118
whole-policy reset     0x1800EE960
set_sl                 0x1800EF110
```

`set_sl` ABI is confirmed as:

```text
RCX = global policy state
EDX = cdn_sl
R8D = total_sl
R9D = source
```

A new standalone probe executes the original reset/arbitration sequence:

```text
experiments/baidu-original-setsl-probe.cpp
```

Observed state transitions:

```text
initial / reset:
  CDN   = 524288 B/s, source=5 default
  TOTAL = 524288 B/s, source=5 default
  locatedownload_active=0

set_sl(122880,122880,2 locatedownload):
  CDN   = 122880, source=2
  TOTAL = 122880, source=2
  locatedownload_active=1

set_sl(-1,122880,1 CMS):
  CDN   = 122880, source=2 locatedownload
  TOTAL = 122880, source=1 CMS
  locatedownload_active=1

set_sl(999999,999999,4 application):
  no change; the lower-priority source cannot override either active gate
```

This reproduces the **same source/rate combination observed read-only in the real paused Baidu process**:

```text
CDN   source=2 locatedownload, rate=122880
TOTAL source=1 CMS,            rate=122880
locatedownload_active=1
```

The source arbitration therefore no longer depends only on static control-flow interpretation; the original `.234` arbitration machine code has been executed independently and reproduces the live state.

#### 29.17.30 Binary-level dual-gate OpenSpeedy proof

The rehost was then extended one level further:

```text
experiments/baidu-original-dual-gate-openspeedy-proof.cpp
```

The harness does **not** manually call `set(122880)` on a test bucket. Instead it:

```text
1. loads original kernel.dll 3.0.20.234
2. establishes the original relative FILETIME clock baseline
3. calls original whole-policy reset
4. calls original set_sl as locatedownload:
      cdn_sl=122880, total_sl=122880, source=2
5. calls original set_sl as CMS total policy:
      cdn_sl=-1, total_sl=122880, source=1
6. obtains the two original global AccumulateTokenBucket objects in the policy state
7. loads official OpenSpeedy speedpatch64.dll into the harness itself
8. sets the requested speed factor
9. drains any startup accumulation using original `consume` only
10. transfers 3 MiB through **both** original gates using original refill + original consume
```

The post-hook drain step is important for rehost fidelity. Two startup artifacts were discovered and deliberately characterized:

- Re-basing the kernel relative clock after the DLL's static bucket construction can make the first refill see a large synthetic elapsed interval and fill the accumulation ceiling.
- Loading OpenSpeedy after draining also takes real time; if the bucket timestamp is left behind, the first N-times refill scales that DLL-load interval and creates another startup burst.

Neither is representative of the steady-state real Baidu process. Draining with the original `consume` **after OpenSpeedy is loaded and the factor is set**, immediately before measurement, removes these rehost-only startup artifacts without directly modifying token fields.

Final steady-state results:

```text
factor  Baidu-kernel elapsed  real elapsed  kernel/real  real throughput
1x      25.763 s              25.763 s      1.000        119.24 KiB/s
2x      25.671 s              12.835 s      2.000        239.35 KiB/s
5x      25.609 s               5.122 s      5.000        599.77 KiB/s
```

Throughout all three runs the original policy state remained:

```text
CDN raw rate   = 122880 B/s
CDN source     = 2 locatedownload
TOTAL raw rate = 122880 B/s
TOTAL source   = 1 CMS
locatedownload_active = 1
```

This is now stronger than the single-component test. The following pieces are all original `.234` machine code in the same self-owned process:

```text
legacy global policy singleton
  -> original reset
  -> original set_sl source arbitration
  -> original locatedownload/CDN gate state
  -> original CMS/TOTAL gate state
  -> two original AccumulateTokenBucket objects
  -> original FILETIME-derived relative clock
  -> original refill
  -> original consume
```

and the only external perturbation is the official OpenSpeedy `GetSystemTimeAsFileTime` hook loaded into the harness itself.

The measured 1x/2x/5x values match the theoretical 120/240/600 KiB/s almost exactly. Thus the **legacy global limiter subsystem through `set_sl` and the dual CDN/TOTAL gates** has now been reproduced at binary level outside `baidunetdiskhost.exe`.

The remaining gap to a full-client equivalence is now downstream/upstream of this subsystem: Peer/CDN adaptive dispatch, EntityTask/NetGrid scheduling, actual HTTP/P2P transport, and remote server/CDN behavior are not part of this standalone proof.

#### 29.17.31 Original NetGrid independently rehosted

The Level-3 downstream path was extended into the original `NetGrid` implementation.

`NetGrid` constructor `0x1801A7E20` takes:

```text
RCX = NetGrid* this
RDX = pointer to a two-qword shared/lifetime pair
```

The constructor copies that pair into `NetGrid+0x240/+0x248`. A zero-valued but valid 16-byte pair is sufficient for an isolated self-owned rehost because the constructor checks the control-block pointer before attempting a reference-count increment.

The constructor's 16-byte default block at preferred VA `0x18134E1F0` decodes exactly to:

```text
+0xC0 = 0x1F400000 = 524288000 B/s (500 MiB/s)
+0xC4 = 0x06400000 = 104857600 B/s (100 MiB/s)
+0xC8 = 0x06400000 = 104857600 B/s (100 MiB/s)
+0xCC = 0xFFFFFFFF
```

A new standalone probe executes the original constructor and original `set_cdn_download_token` method:

```text
experiments/baidu-original-netgrid-probe.cpp
```

Observed original state:

```text
after ctor:
  task-upload bucket   = 104857600 B/s
  task-download bucket = 524288000 B/s
  CDN bucket           = 104857600 B/s
  C0/C4/C8             = 500/100/100 MiB/s defaults
  CC                    = 0xFFFFFFFF
  owner/control pair    = null/null in the isolated harness

after set_cdn_download_token(16384):
  CDN bucket = 16384 B/s
  other two buckets unchanged

after set_cdn_download_token(32768):
  CDN bucket = 32768 B/s
```

This reproduces the same 16 KiB/s override state observed in the live task-specific NetGrid objects without reconstructing the bucket algorithm or writing its fields manually.

#### 29.17.32 Original EntityTask -> NetGrid forwarding bridge rehosted

The next downstream indirection was also executed directly.

The original `EntityTask` primary vtable is at preferred VA `0x1813500C8`. Slot `+0x50` resolves to the already recovered bridge `0x1802AE170`:

```text
EntityTask::vfunc+0x50(rate):
    NetGrid* ng = this->member_0x108;
    if (!ng) return;
    tailcall ng->vfunc+0x158(rate);
```

A minimal isolated EntityTask object needs only:

```text
+0x00 = original EntityTask primary vtable
+0x108 = pointer to an original rehosted NetGrid object
```

The probe:

```text
experiments/baidu-original-entity-netgrid-bridge-probe.cpp
```

calls the bridge **through the original EntityTask vtable slot**, not by calling the NetGrid setter directly. Results:

```text
initial NetGrid CDN bucket = 104857600 B/s
EntityTask vfunc+0x50(16384) -> NetGrid CDN bucket = 16384 B/s
EntityTask vfunc+0x50(32768) -> NetGrid CDN bucket = 32768 B/s
```

Therefore the downstream execution chain is now experimentally rehosted at binary level through:

```text
original EntityTask vtable +0x50
    -> original EntityTask forwarding machine code
    -> original NetGrid vtable +0x158
    -> original NetGrid set_cdn_download_token
    -> original legacy AccumulateTokenBucket::set
```

The remaining Level-3 component is the upstream `cdn_speed_limit_dispatch` calculation and its task-list/Peer inputs.

#### 29.17.33 Level-3 dispatcher rehost: corrected manager input and restored NetGrid ownership lifecycle

The isolated Level-3 rehost exposed and corrected an earlier over-strong type assumption. `cdn_speed_limit_dispatch` does **not** treat `manager+0x250` as the previously recovered Peer object. The pointer stored at `manager+0x250` is consumed by the legacy/global speed-policy API family (`0x1800C35xx`, `0x1800C38xx`, etc.) and exposes the global CDN/TOTAL gates together with multiple embedded rate statistics.

The original Peer rehost remains valid as an independent result, but the earlier conceptual edge:

```text
manager+0x250 -> Peer
```

is withdrawn. The dispatcher input is instead the global speed/policy state already used by `set_sl`.

Two original Peer constructors were nevertheless rehosted successfully in isolation:

```text
base Peer ctor    -> default rate states 100 MiB/s / 100 MiB/s
vfunc +0x80       -> first rate state setter
vfunc +0x88       -> second rate state setter

derived Peer ctor -> installs derived vtable and initializes its internal list/state
```

The derived constructor's configuration argument was recovered as a structure containing four consecutive MSVC strings followed by a 16-byte POD block and a dword. Empty valid strings are sufficient for isolated construction.

The more important Level-3 fix was restoring the **real NetGrid shared ownership lifecycle**. Real EntityTask creation does not merely store a raw NetGrid pointer. After `NetGrid::ctor (0x1801A7E20)`, the caller invokes:

```text
0x1802A8320(EntityTask+0x108, raw_netgrid)
```

This function allocates the shared_ptr control block and calls the library's shared-from-this/weak initialization helper on `NetGrid+0x20`. Consequently the following fields become valid through original machine code rather than manual field synthesis:

```text
NetGrid+0x20/+0x28  = self weak/shared ownership state
EntityTask+0x108    = NetGrid shared_ptr object pointer
EntityTask+0x110    = NetGrid shared_ptr control block
```

Immediately afterwards the real client calls NetGrid primary-vtable slot `+0x250`, resolved to `0x1801A8810`. This is a second-stage backend initializer. It consults the abstract owner at `NetGrid+0x240/+0x248`, calls owner vfunc `+0x70` for a backend type, and has concrete branches for at least types `0`, `1`, and `7`.

For the isolated harness, a self-owned owner stub was used. It implements only read-only capabilities exercised by initialization:

```text
owner vfunc +0x70 -> backend type
owner vfunc +0x08 -> empty vector-like configuration view
```

No Baidu process is modified and the stub performs no network I/O. Backend type `7` is sufficient to let the original NetGrid second-stage initializer complete and create its secondary lane object.

The dispatcher also expects an EntityTask statistics aggregate returned through EntityTask vfunc `+0x140`. The original direct rate getters used by `cdn_speed_limit_dispatch` cover these embedded statistics:

```text
+0x000
+0x050
+0x0A0
+0x0F0
+0x140
+0x190
+0x1E0
+0x230
+0x280
+0x2D0
+0x370
```

Each statistic was initialized and sampled through the original `0x1800BE4C0` constructor and `0x1800BE510` add-bytes method. This avoids manually fabricating the average-rate fields and prevents the cold-start integer-divide-by-zero behavior of `0x1800BE770`.

With a one-task manager, original `.234` machine code now completes the full isolated chain:

```text
set_sl(locatedownload/CMS state)
    -> global CDN gate   = 122880 B/s
    -> global TOTAL gate = 122880 B/s
    -> original global/task rate statistics
    -> cdn_speed_limit_dispatch (0x180333300)
    -> original EntityTask vtable
    -> original NetGrid vtable
    -> original CDN token bucket setter
```

Observed result:

```text
before dispatcher:
  global CDN       = 122880 B/s
  global TOTAL     = 122880 B/s
  NetGrid CDN      = 104857600 B/s

after dispatcher:
  NetGrid CDN      = 122880 B/s
  global CDN       = 122880 B/s
  global TOTAL     = 122880 B/s
  active task count = 1
```

Therefore the complete single-task downstream allocation path is now experimentally rehosted using the original Baidu `.234` implementation. The next isolated check is multi-task allocation: use the same original lifecycle with enough EntityTask entries to determine whether the statically recovered 16 KiB/s per-task floor is emitted by the original dispatcher when `122880 / task_count` falls below 16384 B/s.

#### 29.17.34 Multi-task rehost closes the 16 KiB/s CDN floor

A first multi-task harness initially produced a misleading result: 7, 8, and 10 synthetic EntityTask entries all received the full `122880 B/s` CDN token. Static control flow showed the division branch was present, so the discrepancy was traced rather than treated as contradictory evidence.

Two lifecycle details explain the result.

First, the real periodic caller `0x18032A100` maintains `manager+0x218` as a dispatch-cycle counter. Approximately every four seconds it performs:

```text
manager+0x218 += 1
cdn_speed_limit_dispatch(manager)
```

This counter is used by one adaptive scheduler regime. Directly invoking the dispatcher omits that caller-side lifecycle step, although it is not the decisive factor in the mode used by the final boundary experiment.

Second, and decisively, EntityTask vtable slot `+0x1B8` (`0x1802AB250`) tests a 16-byte field at `EntityTask+0x24` through `0x1800D54B0`:

```text
all 16 bytes zero     -> true
any byte nonzero      -> false
```

The real EntityTask constructors initialize this field through the original 16-byte helpers. For example, `0x18027F5F0` calls `0x1800D52A0(EntityTask+0x24, input)` and another constructor at `0x1802808F0` either zeroes the field or copies a 16-byte source depending on its input state. The exact business meaning is not assigned beyond `16-byte task identity/hash-like state` without stronger semantic evidence.

`cdn_speed_limit_dispatch` calls helper `0x1803485B0` after computing the low-rate candidate. That helper iterates all tasks. For each task it combines:

```text
three task-rate statistics
EntityTask::vfunc+0x1B8 (16-byte identity/state is zero)
```

The zero-initialized synthetic EntityTasks therefore made the helper return true, and the dispatcher intentionally replaced the low-rate candidate with the full global CDN `sl`. This explains the earlier all-122880 result.

The corrected harness now initializes each EntityTask identity with the original `0x1800D52A0` copy helper using deterministic self-owned test bytes. No user data or live Baidu task is used. With nonzero identities and active task statistics:

```text
all_task_gate = 0
```

and the original dispatcher preserves the low-rate candidate.

A final boundary experiment reduced only the synthetic **global aggregate statistics** while keeping each task's own statistics in the active range. The global CDN and TOTAL gates remained exactly:

```text
CDN   = 122880 B/s
TOTAL = 122880 B/s
```

The original `.234` dispatcher then emitted:

```text
6 participating tasks:
  each CDN token = 20480 B/s
  122880 / 6     = 20480

7 participating tasks:
  each CDN token = 17554 B/s
  floor(122880/7)= 17554

8 participating tasks:
  mathematical share = 15360 B/s
  emitted CDN token   = 16384 B/s
```

Every value was captured by a self-owned EntityTask vtable copy whose `+0x50` slot only records the argument and immediately forwards to the original `0x1802AE170` implementation. The original NetGrid bucket subsequently contains the same rate.

This closes the static `0x4000` branch experimentally:

```text
candidate = remaining CDN budget / participating task count
candidate = max(candidate, 0x4000)
0x4000    = 16384 B/s = 16 KiB/s
```

In the controlled boundary case where other global consumption is effectively negligible, this reduces to:

```text
candidate = max(122880 / task_count, 16384)
```

The observed 6/7/8-task sequence (`20480`, `17554`, `16384`) proves that 16 KiB/s is a scheduler floor, not a second independent account-level cap and not a TokenBucket minimum-capacity artifact.

The important architectural distinction is now experimentally supported:

```text
122880 B/s (120 KiB/s)
    = global policy/CDN ceiling in this normal-user state

16384 B/s (16 KiB/s)
    = downstream per-task CDN allocation floor inside cdn_speed_limit_dispatch
```

The remaining semantic work is to name the exact business meaning of the task participation/identity state and the scheduler modes around `global_state+0x91C` / `+0x1C0`; the arithmetic and downstream machine-code behavior are now closed.

## 2026-09-02: membership, try-VIP flag, and EntityTask FGID semantics

This closes three previously ambiguous fields used around the legacy CDN dispatcher.

### Global state +0x91C is MembershipType

Function `0x1800C5E00-0x1800C6248` parses the membership string and stores the result at global policy state `+0x91C`:

- `normal` -> `1`
- `vip` -> `2`
- `svip` -> `3`

The previous value is retained at `+0x920`; when membership changes, the function invokes the global limiter reset (`0x1800EE960`) before copying the new value into `+0x920`.

Predicate `0x1800C98B0` explicitly checks `state+0x91C == 3`, so the value `3` used by the CDN strategy is the SVIP membership case rather than a generic scheduler mode.

### Global state +0x1C0 is the try-VIP / normal-speed-up active flag

Getter `0x1800F1E30` reads `state+0x1C0`; wrapper `0x1800C35D0` exposes it to the legacy download control path.

Setter wrapper `0x1800C3560` enters `0x1800F0960`. That function reads the previous `+0x1C0` value, applies the associated speed-state transition, and finally writes the requested boolean back to `state+0x1C0`.

The upstream caller `0x18036E4E0-0x18036EB88` logs exactly:

`set try vip speed up|cur flag=%1%|set flag=%2%|membership=%3%`

It obtains the current flag through `0x1800C35D0` and applies the new flag through `0x1800C3560`. Therefore `+0x1C0` is not a generic scheduler mode; it is the active try-VIP / normal-speed-up state. Telemetry also uses the names `normal_speed_up_flag` and `try_speed_up_flag`.

In `0x1800C98B0`, either actual SVIP membership (`MembershipType == 3`) or this try-VIP flag can satisfy the membership/speed-up side of the strategy predicate, subject to the other strategy-enable conditions.

### EntityTask +0x24 is the 128-bit binary FGID

The `EntityTask` constructor `0x18027F5F0` installs the EntityTask vtable and copies the first 16 bytes of its task config into `EntityTask+0x24` using `0x1800D52A0`.

The helper family establishes the representation:

- `0x1800D52A0`: raw 16-byte copy
- `0x1800D54B0`: returns true only when all 16 bytes are zero
- `0x1800D52C0`: accepts a string only when its length is exactly 16 and converts it into the 16-byte task key
- `0x1800D52F0`: formats the 16-byte value through `0x1800D6EA0`
- `0x1800D6EA0`: converts every input byte into two hexadecimal characters, so 16 bytes become a 32-character hexadecimal string

The direct naming proof is `EntityTask` release logging. Function `0x180281820-0x180281D9B` emits:

`entitytask release|fgid=%1%|status=%2%`

Immediately before formatting `%1`, it executes:

- `lea rcx, [EntityTask+0x24]`
- `call 0x1800D52F0`

Therefore `EntityTask+0x24` is the binary 16-byte/128-bit FGID, and the externally logged/database form is its 32-character hexadecimal representation. This also matches the legacy `t_download_task` schema, where `fgid` is stored as `CHAR(32)`.

The dispatcher-side identity predicate (`EntityTask` vfunc `+0x1B8`) checks whether this FGID is all zero. The multi-task rehost proved that nonzero FGIDs participate in the normal `122880 / N` CDN allocation path, while synthetic all-zero FGIDs trigger a different fallback/gate. The exact business meaning of the zero-FGID case remains separate from the now-closed field identity.

## 2026-09-02: original dispatcher membership and speed-up strategy matrix

A new self-owned rehost harness, `experiments/baidu-original-dispatcher-strategy-matrix.cpp`, extends the already-working original `.234` dispatcher reproduction across membership and speed-up strategy states. The harness does not alter a live Baidu process. It loads the local original `kernel.dll`, constructs the already-recovered original global policy state / EntityTask / NetGrid path in its own process, and records the value that the original dispatcher sends through `EntityTask::vfunc+0x50` before forwarding it into the original NetGrid implementation.

### Exact `use_svip_download_strategy` predicate

Function `0x1800C98B0` implements the predicate consumed by `cdn_speed_limit_dispatch` at `0x180333823`:

```text
strategy_valid
&& (membership == SVIP || try_vip_active)
&& ss_strategy != 0
```

The corresponding state fields are now named from independent code/log evidence:

```text
state + 0xAC8 = strategy_valid
state + 0x91C = MembershipType (normal=1, vip=2, svip=3)
state + 0x1C0 = try-VIP / normal-speed-up active flag
state + 0xACC = ss_strategy
```

The dispatcher log literal reached when the predicate is true is exactly:

```text
use_svip_download_strategy
```

This makes the business purpose of the predicate explicit.

### `state+0xA08` is `network.svip_cdn_limit_factor`

The getter/setter pair is:

```text
0x1800C62D0 -> read  state+0xA08
0x1800C62E0 -> write state+0xA08
```

The network-config application function `0x180329340-0x180329EC4` retrieves the key whose RIP-relative string is exactly:

```text
svip_cdn_limit_factor
```

and stores the parsed value through `0x1800C62E0`. In the isolated `.234` default state used by the harness:

```text
svip_cdn_limit_factor = 120
```

### Membership / strategy matrix at 8 participating tasks

The global policy gates were held at the same values as the normal-user reproduction:

```text
CDN   sl = 122880 B/s
TOTAL sl = 122880 B/s
```

With nonzero synthetic FGIDs and low aggregate global activity, representative original-dispatcher outputs were:

```text
normal, strategy invalid, no try-VIP:
    16384 B/s per task

vip, strategy invalid, no try-VIP:
    16384 B/s per task

svip, strategy invalid, no try-VIP:
    ~419430 B/s per task

normal + try-VIP active, strategy invalid:
    ~419430 B/s per task

normal + try-VIP + strategy_valid + ss_strategy=1:
    15360 B/s per task

svip + strategy_valid + ss_strategy=1:
    15360 B/s per task
```

The first two cases remain on the normal low-rate branch proven by the earlier 6/7/8-task boundary experiment. At 8 tasks:

```text
122880 / 8 = 15360
normal low-rate branch clamps this upward to 16384 B/s
```

The `use_svip_download_strategy` branch is different. When `0x1800C98B0` is true, the code reloads the current global CDN `sl` through `0x1800C3530`, then at `0x180333894-0x1803338BB` divides that value directly by `manager+0x58` (the participating EntityTask count) and stores the quotient into the working `set_cdn_speed_limit` value:

```text
set_cdn_speed_limit = global_cdn_sl / participating_task_count
```

No 16 KiB upward clamp is applied on this branch. Therefore:

```text
122880 / 8 = 15360 B/s
```

is emitted exactly. This is an important correction to any model that treats 16 KiB/s as an unconditional NetGrid/CDN minimum: it is the floor of the normal low-rate dispatcher branch, not a universal post-processing floor across every membership/speed-up strategy.

### Adaptive SVIP / try-VIP branch and the 0.4 / 0.6 / 0.8 regions

When the user is SVIP or try-VIP is active but the explicit `use_svip_download_strategy` predicate is not selected, the original dispatcher enters an adaptive budget calculation.

At the start of the relevant calculation, the code forms a global aggregate speed from multiple lane statistics. A base rate is chosen as at least 4 MiB/s in the reproduced 8-task case. The dispatcher then compares the aggregate to fractions of that base using the three embedded constants:

```text
0.4
0.6
0.8
```

The machine code around `0x18033364D-0x18033379C` applies these scale factors to the remaining budget (`base - aggregate`):

```text
aggregate < 0.4 * base:
    scaled_remaining = (base - aggregate) * 96

0.4 * base <= aggregate < 0.6 * base:
    scaled_remaining = (base - aggregate) * 60

0.6 * base <= aggregate < 0.8 * base:
    scaled_remaining = (base - aggregate) * 40

aggregate >= 0.8 * base:
    scaled_remaining = (base - aggregate) * 30
```

The result is divided by `svip_cdn_limit_factor`. Later, the common per-task division reads `manager+0x58` and divides the selected CDN budget by the participating task count.

For the controlled low-load 8-task case, where the base resolves to 4 MiB/s and aggregate activity is near zero, the dominant formula is therefore approximately:

```text
per_task_cdn
  ~= 96 * (4 MiB/s - aggregate)
     / svip_cdn_limit_factor
     / 8
```

With negligible aggregate activity this simplifies algebraically to:

```text
per_task_cdn ~= 48 MiB / svip_cdn_limit_factor
```

`48 MiB` here is **not** a stored configuration value; it is only the algebraic result of `96 * 4 MiB / 8` for this controlled eight-task boundary case.

### Controlled `svip_cdn_limit_factor` matrix

Only inside the self-owned harness, the factor field was varied while keeping the original dispatcher implementation and the rest of the controlled state unchanged. Representative outputs were:

```text
factor=25   -> about 2,010,865-2,013,265 B/s (~1.92 MiB/s)
factor=50   -> 1,006,632 B/s
factor=100  -> about 502,716 B/s
factor=120  -> about 418,930-419,430 B/s
factor=150  -> 335,144 B/s
factor=200  -> 251,658 B/s
```

The small run-to-run differences come from the intentionally nonzero original rate-meter samples. The inverse relationship is clear and matches the low-load formula. At the default factor 120 and near-zero aggregate:

```text
(96 * 4 MiB) / 120 / 8
= 419430.4 B/s
```

which is the ~419430 B/s value emitted by the original dispatcher.

### Updated dispatcher model

The original `.234` client therefore has at least three distinct CDN allocation behaviors relevant to the states reproduced here:

```text
normal / VIP low-rate branch:
    remaining global CDN budget / participating tasks
    -> upward clamp to 16 KiB/s

SVIP / try-VIP adaptive branch:
    remaining bandwidth
    -> 0.4 / 0.6 / 0.8 regime multiplier
    -> divide by svip_cdn_limit_factor
    -> divide across participating tasks
    -> later tier/guard logic

explicit use_svip_download_strategy branch:
    global CDN sl / participating tasks
    -> no 16 KiB/s floor
```

This means the previously proven 16 KiB/s NetGrid value remains correct for the observed normal SELF task and normal low-rate scheduler state, but it must not be generalized to every membership or speed-up strategy.


### Dynamic proof of all four adaptive multiplier regions

The strategy-matrix harness was extended with an optional `globalSampleBytes` input. It still uses the original `.234` rate-meter constructor/update/getter routines; the extra argument only changes how many synthetic bytes are submitted to the self-owned global rate meters before the original dispatcher runs. The harness also reads the exact five global lane-rate getters summed at the dispatcher entry, so each test records the actual `aggregate` value seen by the original machine code.

With the default `svip_cdn_limit_factor=120`, the first two regions already matched the recovered equations directly. For example:

```text
base      = 4,194,304 B/s
aggregate = 2,365,000 B/s   (~56.4% of base)

(4,194,304 - 2,365,000) * 60 / 120 / 8
= 114331.5

original dispatcher output = 114331 B/s per task
```

Above 0.6 of the base, the default factor can make the raw result small enough to be hidden by a later intermediate 512 KiB total-budget guard. To expose the underlying multiplier without replacing any dispatcher code, only the self-owned harness copy of `svip_cdn_limit_factor` was temporarily set to 10. Four controlled runs then produced:

```text
base = 4,194,304 B/s
task_count = 8
factor = 10

aggregate = 1,550,000  (< 0.4 * base)
expected  = (4,194,304 - 1,550,000) * 96 / 10 / 8
          = 3,173,164.8
observed  = 3,173,164 B/s per task

aggregate = 2,310,000  (0.4-0.6 * base)
expected  = (4,194,304 - 2,310,000) * 60 / 10 / 8
          = 1,413,228
observed  = 1,413,228 B/s per task

aggregate = 2,785,000  (0.6-0.8 * base)
expected  = (4,194,304 - 2,785,000) * 40 / 10 / 8
          = 704,652
observed  = 704,652 B/s per task

aggregate = 3,370,000  (> 0.8 * base)
expected  = (4,194,304 - 3,370,000) * 30 / 10 / 8
          = 309,114
observed  = 309,114 B/s per task
```

All four original-dispatcher outputs match the recovered integer formulas. The adaptive regions can therefore be promoted from static interpretation to experimental binary-level behavior:

```text
< 0.4 * base        -> multiplier 96
0.4 .. <0.6 * base -> multiplier 60
0.6 .. <0.8 * base -> multiplier 40
>= 0.8 * base       -> multiplier 30
```

The test remains isolated: it changes only fields in the harness-owned copy/state initialized inside the standalone process. No live Baidu Netdisk process, account policy, network request, or service-side limiter is modified.
