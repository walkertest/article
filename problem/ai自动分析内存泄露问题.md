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

`dump-analyzer` 是一个把 MAT 命令行用法固化下来的 skill，核心只有两件事：

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

**最可能的代码问题**：`getWordIndexPositions` 的循环游标不前进。典型形态是：

```java
int from = 0;
while ((from = text.indexOf(word, from)) >= 0) {
    positions.add(new IndexPosition(from, ...));
    // from 没有严格递增 → 命中同一个位置 → 死循环 + 无限分配
}
```

正常文本产生的位置数量是个位到万级，**3.11 亿**不可能是预期结果。

**修复建议**：

1. 保证游标严格前进：`from = match + Math.max(1, word.length())`
2. 空串 / 零长度匹配直接短路返回
3. 加硬上限：`if (positions.size() > MAX) break`——3.11 亿如果早上限，就不会 OOM

## 踩到的坑

这几个坑跟"AI 会不会分析"无关，跟**工具链本身**有关，值得单独记一笔。

**1. 大 dump 卡在分析器自己的 GC 上**

不是业务 JVM 的问题，是 MAT 的问题。判断依据就是 GC 日志里 `X->X` 的零回收。**遇到这种情况必须止损**，等下去只会浪费时间。

好在前两份报告和全部索引已经落盘，终止后不影响结论。

**2. MAT 1.9 没有 `org.eclipse.mat.api:query` 报告**

新版本 MAT 支持的 `query` 报告模板，1.9 里不存在，直接报 `SAXParseException: 前言中不允许有内容`。老版本只有 `suspects` / `overview` / `top_components` / `compare` 四个。

**3. skill 里的 HTML 页码会漂移**

skill 让你读 `pages/23.html` 拿第二个嫌疑点，实测这次是 `pages/24.html`。**纯数字页码随 dump 内容变化**，按名字命名的（`System_Overview2.html`、`Class_Histogram7.html`）才可靠。

**4. 索引检查用错了文件名**

skill 里写 `if [ ! -f "${DUMP_FILE}.index" ]`，而 MAT 实际生成的是 `heap-870.index`（去掉 `.hprof`）。结果每次都误判"没建索引"。

## AI 分析的边界

这是用下来最需要说清楚的一点：**AI 能把证据链组织得很清楚，但它不能替你把推断变成事实**。

这次报告里我明确写了置信度：

> "循环不前进"这一结论由"单线程单列表 3.11 亿对象 + 栈顶在 getWordIndexPositions"支撑，**属于强推断**；空词匹配只是最常见的一种解释，需要用源码确认。

因为 MAT 1.9 的标准报告**不提供对象字段级读取**，我看不到数组里那 3.11 亿个 `IndexPosition` 的字段值，无法直接验证"位置是否重复"。

要把推断变成证实，只有两条路：

- **看源码**第 401 行（最快，5 分钟）
- **跑一次对象查询**，读 `Object[354836040]` 的头尾样本，看位置是否集中在同一区间（需要再花约 30 分钟，且有再次 GC 死循环的风险）

**结论：AI 负责把 90% 的活干完并告诉你"还剩哪 10% 需要人确认"，而不是假装自己 100% 确定。**

## 沉淀成 checklist

以后再遇到大 dump，按这个顺序走：

1. **先量尺寸**：文件大小、格式、dump 时间、机器内存、磁盘余量
2. **定内存预算**：不要迷信默认值。MAT 首解析要算支配树，内存需求跟**对象数**强相关，不是文件字节数
3. **看分析器的 GC 日志**：出现 `X->X` 零回收 + 高频 Full GC，立刻止损，别等
4. **先确保索引落盘**：索引比报告重要。有索引就能反复跑轻量查询，没有就要从头再来
5. **优先读 Leak Suspects**：它直接给持有链和线程栈，是信息密度最高的报告
6. **区分"泄漏"和"失控分配"**：看持有者是静态集合/缓存，还是线程局部变量
7. **报告里写清置信度**：哪些是计算出来的，哪些是推断的，剩下什么没验证

## 附：本次产物

| 内容 | 路径 |
|---|---|
| 原始 dump | `F:\javadump\textaudit\heap-870-20261116-115908.hprof\` |
| MAT 索引（约 14 GB） | 同上目录，可复用 |
| Leak Suspects 报告 | 同上目录 `..._Leak_Suspects.zip` / `.html` |
| System Overview 报告 | 同上目录 `..._System_Overview.zip` / `.html` |
| 完整分析报告 | `heap-870-20261116-115908-分析报告.md` |
| 解析日志 / GC 日志 | `parse.log`、`analyzer-gc.log` |

整个过程中**没有把 dump 上传到任何地方**，全程在本机完成。
