## 分类以及作用


## 线程尽量不用
- 避免内存瓶颈


## 守护线程
- 关闭能力
- 避免spark等调用方的任务没办法优雅退出
- dubbo使用AwaitingNonWebApplicationListener这个里面开启唯一一个非守护线程，去决定dubbo服务一直运行
- tomcat待研究

## 命名规范