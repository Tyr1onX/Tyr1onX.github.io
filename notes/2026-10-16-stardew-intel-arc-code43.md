# 《星露谷物语》打不开：从 OpenGL 报错追到显卡 Code 43

朋友的《星露谷物语》突然打不开了。Steam 验证过游戏文件完整性，问题依旧；有人怀疑系统中毒，甚至建议重装 Windows。

但电脑上还有不少资料和原有软件环境。为了一个游戏直接重装系统，代价太大。我决定先看看它到底在哪里失败。

## 先看日志，而不是重装

在 Windows 中打开：

```text
%APPDATA%\StardewValley\ErrorLogs
```

拿到的 9 份崩溃日志，核心错误完全一致：

```text
Failed to create graphics device!
MonoGame requires either ARB_framebuffer_object
or EXT_framebuffer_object.
GPU: Could not detect.
```

这说明游戏在初始化 OpenGL 图形设备时失败。它不像存档问题，也没有证据指向病毒。下一步应该看显卡是否真的正常工作。

## “驱动最新”不等于“设备正常”

在 PowerShell 中查询显示设备：

```powershell
Get-CimInstance Win32_VideoController |
  Select-Object Name, DriverVersion, Status, ConfigManagerErrorCode
```

结果很关键：

```text
Intel(R) Arc(TM) Graphics    Error    43
OrayIddDriver Device         OK        0
GameViewer Virtual Display   OK        0
```

Intel Arc 的驱动版本是 `31.0.101.5382`。华为电脑管家显示驱动已经是最新，但 Windows 仍然报告 **Code 43**——设备或驱动报告了故障，系统因此停止使用该设备。它不是“驱动有更新”的提示，而是设备当前的运行状态异常。

电脑里还有向日葵与 GameViewer 的虚拟显示驱动，不过两者当时的设备错误代码都是 0。仅凭它们存在，不能判断发生了冲突。

## 最小操作，随后验证

我们没有卸载驱动，而是在设备管理器中找到 **Intel Arc Graphics**，先禁用、再启用，然后正常重启电脑。

重启后重新查询，Intel Arc 的错误代码从 **43 恢复为 0**，设备管理器也显示运行正常。

再次启动游戏时，起初还是等了很久。我一度以为没有修好，直到终于看见了《星露谷物语》的主菜单。随后退出游戏再启动，这次明显快了很多，Steam 也正常显示游戏正在运行。

整个过程没有重装 Windows，没有重装游戏，也没有动存档。

## 这次到底证明了什么？

已验证的事实是：**显卡设备状态从 Code 43 恢复为 0 后，游戏能够正常启动；第二次启动速度也恢复正常。**

二者高度相关，但我们没有找到最初触发 Code 43 的底层原因。不能据此断言是虚拟显示驱动冲突、某次更新导致故障，或显卡硬件损坏。第一次恢复启动为什么特别慢，也没有采集足够的性能数据来解释。

如果在远程控制中操作显示适配器，还要特别小心：禁用显卡可能导致黑屏或远程会话断开，必须先保存工作，并确保有人能在电脑旁接手。

这次让我记住的不是某个万能修复命令，而是一条更可靠的排查顺序：

**复现现象 → 读取错误日志 → 检查相关设备状态 → 做最小修改 → 再次验证。**

系统出问题时，“重装”当然是一种选择，但它不该代替诊断。

参考：[Microsoft Learn：设备管理器错误 Code 43](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/cm-prob-failed-post-start)
