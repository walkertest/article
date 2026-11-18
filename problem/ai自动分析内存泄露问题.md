标题：AI 自动分析内存泄漏问题

## 问题

线上文本审核服务（TextAuditServer）出现内存异常，导出了一份 **15.2 GB** 的堆转储。

按以前的流程，这件事大概是这样的：

1. 把 15 GB 的 dump 从服务器拉到本地（或者想办法在服务器上装 MAT）
2. 打开 MAT 的图形界面，等它建立索引，通常半小时起步，中途还可能因为内存不够直接挂掉
3. 对着支配树和 Leak Suspects 一层层点开，找到可疑对象
4. 自己去翻源码，对栈帧，写结论

一次下来一两个小时，而且非常依赖操作的人熟不熟 MAT。

这次换了个做法：用一个 **skill**（把分析方法固化成一段可复用的指令）交给 AI 执行，从拿到 dump 到出结论，全程命令行，我只在关键节点做了几次判断。

本文用这个真实 case，介绍这个 skill 是怎么工作的、能做到什么程度、以及哪些地方**不能**信它。

## 一句话结论

先给结果，因为后面的"过程"都是围绕它展开的：

> 9.6 GB 已用堆里，**8.88 GB（86.58%）来自单个线程的一个局部 ArrayList**，里面堆了 **3.11 亿个 `IndexPosition` 对象**。栈顶精确落在 `BlackWhiteWordService.java:401` 的 `getWordIndexPositions` 方法上——一个没有终止的循环在持续分配对象。

同一个线程池里另外 299 个线程，每个只占 240 KB。也就是说：**同一份代码、同一个池，只有这一个请求炸了**，触发条件和这次请求的输入有关。

## 这个 skill 是什么

`dump-analyzer` 是一个把 MAT 命令行用法固化下来的 skill，已开源，下载地址：<https://github.com/walkertest/dump-analyzer-skill>。它核心只有两件事：

**1. 调用 MAT 的批处理能力生成官方报告**

```bash
# 解析 + 生成 Leak Suspects（泄漏嫌疑点）报告
ParseHeapDump.bat heapdump.hprof org.eclipse.mat.api:suspects
# 系统概览
ParseHeapDump.bat heapdump.hprof org.eclipse.mat.api:overview
# 大对象
ParseHeapDump.bat heapdump.hprof org.eclipse.mat.api:top_components
```

这些命令会在 dump 旁边生成 `*_Leak_Suspects.zip`、`*_System_Overview.zip`，里面是 MAT 已经算好的 HTML 报告。

**2. 规定 AI 该看哪些页面、怎么写结论**

skill 里明确列了每个分析维度要读的文件（系统概览、类直方图、线程概览、大对象、GC Roots、系统属性），并要求报告必须包含健康度评级和可操作建议。

换句话说：**MAT 负责"算"，skill 负责"怎么读、怎么讲"**。AI 不做重计算，只做信息提取和推理。

## 实战：从 15.2 GB 到根因

### 1. 先看文件，不要直接开跑

```
文件大小：15,237,229,987 字节（15.2 GB）
格式：JAVA PROFILE 1.0.2，8 字节对象 ID
转储时间：2026-11-16 11:59:23
系统内存：34 GB（可用约 16.7 GB，其余是文件缓存可回收）
```

15 GB 的 dump 直接上 MAT，最怕的不是慢，是**跑到一半 OOM**——分析器自己把内存吃满，然后什么都得不到。

所以先定预算：`-Xmx24g`、8 核、页文件只有 4.8 GB。

### 2. 解析（19:35 → 19:53）

MAT 首解析会把索引全部算一遍，包括支配树——这是 Leak Suspects 报告的前提。

```
19:37  .threads              4 MB
19:43  .a2s / .o2c / .idx    约 5 GB
19:49  .inbound / .outbound  约 7 GB
19:50  .o2hprof / .index
19:51  .domIn                1.2 GB
19:52  .o2ret                1.6 GB
19:53  .domOut               3.0 GB   ← 支配树完成
```

**18 分钟**，索引合计约 14 GB。这个耗时在预期内。

### 3. 报告生成（19:55 → 卡住）

```
19:55  ..._Leak_Suspects.zip        108 KB   ✅
19:55  ..._System_Overview.zip       89 KB   ✅
20:02  Top Components...                    ⏳
20:32  Top Components...                    ⏳ 还在跑
```

Top Components 跑了半小时没出来。这时候做了一个关键判断——**去看分析器自己的 GC 日志**，而不是傻等：

```
[3432.556s][info][gc] GC(37662) Pause Full (Allocation Failure) 17556M->17556M(21845M) 61.751ms
[3432.619s][info][gc] GC(37663) Pause Full (Allocation Failure) 17556M->17556M(21845M) 62.340ms
[3432.685s][info][gc] GC(37664) Pause Full (Allocation Failure) 17556M->17556M(21845M) 65.754ms
```

看三个数字就够了：

- `17556M->17556M`：每次 Full GC **一个字节都没回收**
- 已经触发了 **37,692 次** Full GC
- 耗时 `61ms` 却什么也没做

这是典型的 **GC 死循环**：堆被真实数据占满（17.5 GB 存活），再没有一丝可回收空间，JVM 只能不停重试。它**永远不会自己结束**。

**止损**：确认前两份报告已完整落盘（校验 zip 完整性）、索引齐全后，直接终止进程。不为了一个"按类聚合"的视图，把机器耗到底。

### 4. 读报告，拿结论

Leak Suspects 报告直接给出了持有链：

```
Thread "pool-30-thread-285"                      retained 8,884,606,368  (86.58%)
  └─ <Java Local> ArrayList @ 0x5b3c3c720        retained 8,884,490,296
       └─ elementData Object[354,836,040]        浅堆 1,419,344,176
            └─ 311,047,754 × IndexPosition       7.47 GB
```

线程栈：

```
BlackWhiteWordService.getWordIndexPositions(...)      ← BlackWhiteWordService.java:401
BlackWhiteWordService.whiteWordMatchV2(...)           ← :601
BlackWhiteWordService.whiteWordMatch(...)             ← :245
WordService.judgeIsBlackWordByBusinessCode(...)       ← :638
JiebaSegmenter.judgeIsBlackWordByCode(...)            ← :483
BlackWordInterceptImpl.intercept()                    ← :71
FutureTask.run()  ← ThreadPoolExecutor.runWorker
```

到这里，根因已经能写了。

## 换到大内存的远程 Linux 机器，跑得更全

本地那台 32 GB 的机器把结论跑出来了，但过程并不舒服：`-Xmx` 得压着给，Top Components 直接进了 GC 死循环，中途还要人守着看 GC 日志决定止损，开发机被吃得没法干活。

skill 全程是命令行，这正好是远程机器的主场。把 dump、MAT 和 skill 搬到一台**大内存的 Linux 机器**上，SSH 过去让它自己跑，本地开发电脑完全不受影响。同样的 dump，这次的完整时间线如下。

### 解析与索引阶段（20:22:07 → 20:38:13）

| 时间（精确到毫秒） | 关键动作 | 说明 |
|---|---|---|
| 20:22:07.562 | 分析任务启动 | 后台脚本开始执行 |
| 20:22:08.644 | MAT 打开 dump，开始 Parse | 日志首次记录 `Started opening dump` |
| 20:22:36.274 | 线程栈导出完成 | 生成 `heap-870-...threads`（4.0 MiB） |
| 解析完成 | 读出 349,412,009 个对象 | 随后移除 85,145 个 unreachable 对象，报告口径为 349,326,864 |
| 20:31:25.349 | `idx.index` 生成 | 2.48 GiB |
| 20:31:36.493 | `o2c.index` 生成 | 807 MiB |
| 20:31:45.633 | `a2s.index` 生成 | 148 MiB |
| 20:34:53.254 | `inbound.index` 生成 | 3.50 GiB |
| 20:34:59.042 | `outbound.index` 生成 | 3.19 GiB |
| 20:35:18.150 | `o2hprof.index` 生成 | 2.59 GiB |
| 20:35:19.662 | 主索引 `.index` 生成 | 49.1 MiB |
| 20:36:33.191 | `domIn.index` 生成 | 1.14 GiB |
| 20:37:30.107 | `o2ret.index` 生成 | 1.53 GiB |
| 20:38:12.783 | `domOut.index` 生成 | 2.78 GiB，索引阶段结束 |

索引合计约 **18 GiB**，**16 分钟**跑完。

### 三类报告生成阶段（20:38:41 → 20:55:43）

每次生成报告都会重新打开一次已解析的 dump（复用索引，不再解析 hprof）。

| 时间（精确到毫秒） | 关键动作 | 说明 / 耗时 |
|---|---|---|
| 20:38:41.371 | 启动 **Leak Suspects** 报告 | 重新打开已解析 dump |
| 20:41:21.445 | ✅ Leak Suspects 报告生成 | 119.2 KiB；耗时 **2 分 40 秒** |
| 20:41:23.850 | 启动 System Overview 报告 | 与上一进程间隔 2.4 秒 |
| 20:41:29.645 | ✅ System Overview 报告生成 | 93.6 KiB；耗时 **5.8 秒** |
| 20:41:30.967 | 启动 **Top Components** 报告 | 与上一进程间隔 1.3 秒 |
| 20:55:43.182 | ✅ Top Components 报告生成 | 428.2 KiB；耗时 **14 分 12 秒** |
| 20:55:44.550 | 脚本输出"分析完成"，报告归档 | 三份 zip 移入 `report/` |
| 20:55:44.692 | 后台任务进程退出 | 任务总耗时 **33 分 37 秒** |

重点是第三份报告：**Top Components 这次跑完了**。本地跑不动的"按类聚合"视图，在远程机器上只是慢（14 分钟），不再是死循环。三份报告全部拿到，任务总耗时 **33 分 37 秒**。

### 本地 vs 远程

| | 本地 Windows（34 GB 内存） | 远程 Linux（大内存） |
|---|---|---|
| 解析 + 索引 | 18 分钟 | 16 分钟 |
| Leak Suspects | ✅ | ✅ 2 分 40 秒 |
| System Overview | ✅ | ✅ 5.8 秒 |
| Top Components | ❌ GC 死循环，止损放弃 | ✅ 14 分 12 秒跑完 |
| 报告完整度 | 2/3 | 3/3 |
| 对本地的影响 | 开发机被吃满，没法干活 | SSH 挂着跑，本地无感 |

**结论：大 dump 的分析，直接上大内存的远程机器。** skill 天生命令行，天然适配 SSH 场景——不用装 GUI、可以后台挂着跑、SSH 断了也不影响。大内存换来的是更快、更全（第三份报告也能跑完）、以及不打扰本地开发。本地机器留着看小 dump 就够了。

## 数据说话

| 指标 | 值 |
|---|---|
| 已用堆 | 9.6 GB |
| 对象总数 | 349,326,943 |
| `IndexPosition` 对象数 | **311,047,755（占 89.05%）** |
| `IndexPosition` 浅堆 | 7.47 GB |
| 单个 `Object[354,836,040]` | 1.42 GB |
| 失控线程保留堆 | 8.88 GB（86.58%） |
| 其余 299 个同池线程 | 各约 240 KB |
| 线程总数 | 1,329 |
| JVM | OpenJDK 1.8.0_412（Temurin） |

**排除这 8.88 GB 之后**，剩下的 1.4 GB 主要是 jieba 分词词典（`JiebaSegmenter` + `DictSegment` + `WordDictionary` 约 1.1 GB）和 Redis 本地缓存（107 MB）——这些都是正常常驻开销，不用动。

## 判断与修复

**为什么是"单请求失控"而不是"泄漏"**：

- 持有者是线程的**局部变量**，不是静态集合或缓存
- 请求结束栈帧出栈，这 8.88 GB 就会释放
- 所以不会随时间累积，但单次请求就能把堆吃穿

分析报告出来后，我拿业务源码确认了。出事的就是这个方法，代码直接贴出来：

```java
/**
 * 获取词下标位置集合
 */
private List<IndexPosition> getWordIndexPositions(String content, String word) {
    int startPosition = 0;
    List<IndexPosition> blackWordIndexPositions = new ArrayList<>();
    while (true) {
        int index = StringUtils.indexOf(content, word, startPosition);
        if (index == -1) {
            break;
        }
        blackWordIndexPositions.add(new IndexPosition(index, index + word.length() - 1));
        startPosition = index + 1;
    }
    return blackWordIndexPositions;
}
```

先说 AI 推断错的部分：报告猜的是"循环游标不前进"。看这份代码就知道，游标其实一直在前进（`startPosition = index + 1`），只要 `word` 是正常字符串，`index` 必然严格递增，循环一定会走到 `-1` 退出。

但死循环确实存在，触发条件藏在边界里：**`word` 是空串的时候**。JDK 8 的 `String.indexOf("", fromIndex)` 有一个几乎没人会去背的语义——当 `fromIndex` 超过内容长度时，返回的不是 `-1`，而是 `content.length()`（OpenJDK 8 源码里写得很直白：`return targetCount == 0 ? sourceCount : -1`）。于是：

- `index` 永远等于 `content.length()`，永远不等于 `-1`，`while (true)` 永远 break 不出去
- 每一圈都往 ArrayList 里塞一个内容相同的 `IndexPosition(len, len - 1)`——连 end 都比 start 小
- 循环同时烧 CPU 和分配速率，几分钟就能堆出 3 亿多个对象

这和 dump 里的证据全部对上：3.11 亿个对象都是同一个值、只有这一个请求炸。

**为什么是现在、为什么突然出现**：追到业务变更点才清楚——业务最近新增了一个"去符号"的符号列表，分词命中的符号会被剔除，剔除之后一些分词结果直接变成了**空串**，空词就这样混进了匹配列表。也就是说，这个边界问题在代码里一直存在，只是以前从没有空词进来，直到这次业务变更把它踩了出来。这解释了所有现象：为什么以前跑了很久没事，为什么恰好在这一天炸，为什么只有这一个请求炸——只有它命中的符号剔除后产生了空词。

正常文本产生的位置数量是个位到万级，**3.11 亿**不可能是预期结果。

**修复建议**：

1. 词表入口过滤：加载黑词/白词时直接丢弃空串和纯空白项，从源头消灭空词
2. 循环内加防御：`word` 为空直接返回空集合，别让 `indexOf` 的边界语义有机会被踩到
3. 加硬上限：`if (positions.size() > MAX) break`——3.11 亿如果早上限，就不会 OOM



## AI 分析的边界

这是用下来最需要说清楚的一点：**AI 能把证据链组织得很清楚，但它不能替你把推断变成事实**。

这次报告里我明确写了置信度：

> "循环不前进"这一结论由"单线程单列表 3.11 亿对象 + 栈顶在 getWordIndexPositions"支撑，**属于强推断**；空词匹配只是最常见的一种解释，需要用源码确认。

因为 MAT 1.9 的标准报告**不提供对象字段级读取**，我看不到数组里那 3.11 亿个 `IndexPosition` 的字段值，无法直接验证"位置是否重复"。

事后我花了五分钟去看了源码（就是"判断与修复"里贴的那份），结果正好说明这条边界为什么重要：

- **猜对的**：出事的方法、无限分配的定性、"单请求触发"的判断、修复方向里的"空串直接短路返回"
- **猜错的**：机制。"游标不前进"不成立——游标一直在前进，真正的死循环条件是**空词 + JDK 8 `indexOf` 对空串永不返回 `-1`**。这个语义没人会去背，只有对着源码才能看出来

也就是说，AI 定位到了正确的函数和正确的问题类型，但对根因的猜测差了一层：照着"游标不前进"去改代码，问题还会再犯。好在看懂源码之后，那条"跑一次对象查询验证位置是否重复"的 30 分钟路线也不用走了——这份代码决定了 3.11 亿个对象全部是同一个值，比 MAT 能给的证据更硬。

**结论：AI 负责把 90% 的活干完并告诉你"还剩哪 10% 需要人确认"，而不是假装自己 100% 确定。**



