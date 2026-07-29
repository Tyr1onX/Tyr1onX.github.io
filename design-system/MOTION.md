# Tyr1onX Spatial Motion System

本文件是网站动效的唯一语义规范。视觉概念保持不变：项目是行星，文字是悬星，风场是空间状态。

## 1. 状态机

每次跨页动效必须遵循以下顺序：

```text
idle
  → pressed
  → retracting
  → navigating
  → deploying
  → revealing
  → settling
  → idle
```

### pressed

- 点击后 100ms 内必须出现反馈。
- 只改变 opacity、transform 或局部光晕，不改变布局尺寸。

### retracting

- 源页面负责收回对象。
- 悬线与星点必须使用同一时钟。
- 必须等待实际 CSS Animation 的 `finished`，不能只依赖估算的 `setTimeout`。

### navigating

- 只有 retracting 完成后才允许导航。
- 一个方向只能有一个控制器拥有导航权，快速重复点击必须被锁定。

### deploying

- 目标页面负责放出对象。
- 源对象不得直接出现在目标终点。
- 悬线完全放出、坐标落位后，才允许进入 revealing。

### revealing

- 标题、正文、脉络与辅助内容在核心对象落位后展开。
- 内容可有 30–50ms 的小幅 stagger，但不能与上一阶段重叠。

### settling

- 风场、轨道与物理系统恢复常态。
- 必须先移除消费 CSS 变量的 selector，再清理变量，避免宽流/窄流反跳。
- 所有权最后交还首页物理系统。

## 2. Motion tokens

实际数值统一定义在 `transition-sequence-timing.css`：

| Token | 角色 |
|---|---|
| `--motion-press` | 点击即时反馈 |
| `--motion-micro` | hover、focus、局部状态变化 |
| `--motion-fold` | 文案与支线收束 |
| `--motion-retract` | 文字坐标与悬线收回 |
| `--motion-project-retract` | 首页全部悬星为项目让路 |
| `--motion-release` | 坐标、悬线与回程对象放出 |
| `--motion-world-exit` | 页面空间退场 |
| `--motion-world-enter` | 页面空间进入 |
| `--motion-identity` | 头像与名称共享移动 |
| `--motion-project-transfer` | 课刻行星正向移动 |
| `--motion-project-return` | 课刻行星回程 |
| `--motion-environment` | 风场与环境恢复 |
| `--motion-stagger-*` | 星点、坐标与文案的序列间隔 |

统一缓动：

- `--ease-enter`：对象进入和放出；
- `--ease-exit`：对象退出和收回；
- `--ease-spatial`：跨页面共享元素；
- `--ease-settle`：绳索、轨道和环境的轻微稳定。

## 3. 所有权

| 路径 | 源页面控制器 | 目标页面控制器 |
|---|---|---|
| 首页 → 课刻 | `keke-transition.js` | `keke-transition.js` |
| 首页 → 文字 | `writing-transition.js` | `writing-transition.js` |
| 课刻/文字 → 首页 | `return-route-fix.js` | `return-home-transition.js` |
| 首页正常物理 | `home-cosmos.js` | — |

禁止两个脚本同时：

- 拦截同一个链接；
- 修改同一批文字星的位置；
- 改写同一组风场播放速率；
- 清理另一个控制器仍在使用的 class 或 CSS 变量。

## 4. 实现规则

1. 动画优先使用 `transform`、`translate`、`scale` 和 `opacity`。
2. 不通过 width、height、top、left 制作连续动画。
3. 复杂跨页转场可以超过 400ms，但点击反馈必须立即出现。
4. 退出阶段应短于或等于进入阶段。
5. 共享元素只承担空间连续性，不承担整页内容显隐。
6. `prefers-reduced-motion` 下直接导航或将全部 token 压缩到 1ms。
7. 新增时长前先判断现有 token 是否能表达语义；不得在新文件中复制近似数字。
8. JS 中的 `setTimeout` 只允许用于按压反馈、缓存预热和异常 fallback，不得作为主要阶段完成信号。

## 5. 修改检查

每次调整转场后至少检查：

- 收线是否全部完成后才导航；
- 目标悬线是否全部放完后才展开内容；
- 连续快速点击是否只触发一次导航；
- BFCache 恢复后是否仍只有一个视觉状态；
- 风场是否只发生一次连续宽窄变化；
- 页面隐藏或离屏后动画是否暂停；
- reduced motion 是否可直接完成导航；
- 手机端第一次触摸预览与第二次进入是否仍成立。
