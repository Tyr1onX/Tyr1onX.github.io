window.TYR1ONX_LEARNING_LOG = [
  {
    date: "2026-09-06",
    entries: [
      {
        area: "JavaScript",
        title: "Promise / async-await / Event Loop",
        type: "learned",
        summary: "完成第一轮异步模型学习：同步代码先执行，Promise.then 与 await 后续进入微任务，微任务清空后再处理 setTimeout 等任务；明确 async 一定返回 Promise，await 只暂停当前 async 函数。"
      },
      {
        area: "Algorithms",
        title: "和为 K 的子数组 · 前缀和 + 哈希表",
        type: "built",
        summary: "完成 LeetCode 560。用“前缀和 -> 出现次数”的哈希表统计 sum - k，理解 count[0] = 1 的意义，并确认平均时间 O(n)、额外空间 O(n)。"
      },
      {
        area: "Review",
        title: "间隔复习",
        type: "reviewed",
        summary: "补做并通过 49、15、128、283、11、42、438 的算法回忆，同时完成 const 与对象内部可变性的基础知识复习。"
      }
    ]
  },
  {
    date: "2026-09-02",
    entries: [
      {
        area: "JavaScript",
        title: "DOM / Event 基础",
        type: "built",
        summary: "练习 document、querySelector、textContent、addEventListener 与 event.target，完成点击事件修改页面文本的基础交互。"
      },
      {
        area: "Algorithms",
        title: "找到字符串中所有字母异位词 · 固定滑窗",
        type: "learned",
        summary: "完成 LeetCode 438。窗口长度固定为 p.size()，右字符进入计数 +1、左字符退出计数 -1；时间 O(n)、额外空间 O(1)。"
      }
    ]
  },
  {
    date: "2026-09-01",
    entries: [
      {
        area: "JavaScript",
        title: "Prototype / 原型链",
        type: "learned",
        summary: "理解自身属性优先、缺失时沿原型链查找，练习 Object.create(proto)，并区分实例数据与 prototype 上的共享方法。"
      },
      {
        area: "Algorithms",
        title: "接雨水 · 双指针",
        type: "learned",
        summary: "完成 LeetCode 42。依据较小的 leftMax / rightMax 结算对应侧，完成时间 O(n)、额外空间 O(1) 的实现与复杂度分析。"
      }
    ]
  },
  {
    date: "2026-08-31",
    entries: [
      {
        area: "JavaScript",
        title: "this 基础",
        type: "learned",
        summary: "理解普通函数的 this 主要由调用方式决定，方法取出独立调用会丢失原对象关系，并区分普通内部函数与箭头函数的 this。"
      },
      {
        area: "Algorithms",
        title: "三数之和 · 排序 + 双指针",
        type: "learned",
        summary: "完成 LeetCode 15。排序后固定 i，再用左右指针寻找目标并处理去重；时间复杂度 O(n²)。"
      }
    ]
  },
  {
    date: "2026-08-30",
    entries: [
      {
        area: "JavaScript",
        title: "作用域与闭包",
        type: "learned",
        summary: "学习词法作用域、块级作用域与 shadowing，区分 return fn 和 return fn()，建立闭包的基础直觉。"
      },
      {
        area: "Algorithms",
        title: "盛最多水的容器 · 双指针",
        type: "learned",
        summary: "完成 LeetCode 11。理解面积由短板决定，因此每轮移动较短边以保留获得更大面积的可能。"
      }
    ]
  },
  {
    date: "2026-08-29",
    entries: [
      {
        area: "JavaScript",
        title: "函数定义与调用",
        type: "learned",
        summary: "学习函数定义与调用、形参与实参、return、无显式 return 时的 undefined，并建立局部变量与基础作用域概念。"
      },
      {
        area: "Algorithms",
        title: "移动零 · 双指针",
        type: "learned",
        summary: "完成 LeetCode 283。用 write 表示下一个非零元素写入位置，保持非零元素相对顺序；时间 O(n)、额外空间 O(1)。"
      }
    ]
  },
  {
    date: "2026-08-28",
    entries: [
      {
        area: "JavaScript",
        title: "对象与数组",
        type: "learned",
        summary: "学习对象 / 数组、属性访问、共享引用直觉，并明确 const 限制变量绑定但不阻止对象内部属性修改。"
      },
      {
        area: "Algorithms",
        title: "最长连续序列 · 哈希集合",
        type: "learned",
        summary: "完成 LeetCode 128。只从不存在 x - 1 的元素启动连续扫描，平均时间 O(n)、空间 O(n)。"
      }
    ]
  },
  {
    date: "2026-08-27",
    entries: [
      {
        area: "JavaScript",
        title: "变量与基础类型",
        type: "learned",
        summary: "梳理 let / const、undefined / null、typeof、== / === 与 JavaScript 动态类型，为后续 JavaScript 主线建立基础。"
      },
      {
        area: "Algorithms",
        title: "字母异位词分组 · 哈希表",
        type: "learned",
        summary: "完成 LeetCode 49。用排序后的字符串作为分组 key，完成时间 O(n·k log k)、空间 O(n·k) 的复杂度分析。"
      }
    ]
  }
];
