[toc]

# 查看僵尸进程& kill僵尸进程
```
ps -ef | grep defunct
第三列为僵尸进程的父进程
kill掉即可
```


# 复制服务器指定行数到另外一个文件
* 使用vim来操作实现
* 打开两个文件：vim a.log b.log
* 显示行数： :set nu
* 选中指定行数并复制： 100,200 y，或者 输入v切换为可视模式，然后移动光标进行选中内容，然后按y复制即可.
* 切到下一个文件： :n
* 按p将复制的内容，粘贴到b.log文件中即可.

# tcpdump抓包
* tcpdump -X port 17989
* -X 表示同时使用十六进制和 ASCII 字符串打印报文的全部数据
* tcpdump -X port 17890 -n | grep -C 20 "taf-client", grep的时候，可以指定匹配到的前后行数，方便看完整报文
* tcpdump -Anlps0 dst port 17989 | grep -C 20 "mediaChannel"  > tracking.dump, -A 可以输出更多的ASICC，输出为一行，方便根据内容去抓包

## flags含义
```
F : FIN - 结束; 结束会话
S : SYN - 同步; 表示开始会话请求
R : RST - 复位;中断一个连接
P : PUSH - 推送; 数据包立即发送
A/. : ACK - 应答 (实际抓包的. 表示ACK报文)
```

# linux上的大文件怎么传输到本地
- 问题背景：linux上的堆文件7.6GB，大于xshell的sz的传输大小限制（4GB），会导致无法传输，类似的还有其他大文件
- 解决思路：1.分割成小文件传输然后合并复原；2.压缩变小传输；3.ftp
- 这里优先建议第一种方案，因为方案的压缩耗时可能较久，ftp可能又比较麻烦（依赖ftp服务器和客户端）

## 方案一：分割传输后复原
- 分割并传输：split -b 100M detail.log detailtest && sz detailtest*
- windows复原：copy /b detailtest* detail.log
- 特别强调：需要退化到cmd模式，而不是powershell中秩序，因为ps中copy 不支持/b的二进制复原模式

## 方案二：压缩后传输
- 压缩命令：tar -czvf archive.tar.gz yourFileName


# windows怎么快速打开powershell
- 安全shift+右键，就可以快速在当前目录中打开ps
- ps怎么变成cmd窗口：ps命令行中输入cmd即可.