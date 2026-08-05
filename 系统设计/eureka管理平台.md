
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [项目背景](#%E9%A1%B9%E7%9B%AE%E8%83%8C%E6%99%AF)
- [简单使用](#%E7%AE%80%E5%8D%95%E4%BD%BF%E7%94%A8)
- [交互流程](#%E4%BA%A4%E4%BA%92%E6%B5%81%E7%A8%8B)
  - [技术关键点](#%E6%8A%80%E6%9C%AF%E5%85%B3%E9%94%AE%E7%82%B9)
- [具体使用](#%E5%85%B7%E4%BD%93%E4%BD%BF%E7%94%A8)
  - [访问地址](#%E8%AE%BF%E9%97%AE%E5%9C%B0%E5%9D%80)
  - [部署](#%E9%83%A8%E7%BD%B2)
    - [后端部署](#%E5%90%8E%E7%AB%AF%E9%83%A8%E7%BD%B2)
    - [前端部署](#%E5%89%8D%E7%AB%AF%E9%83%A8%E7%BD%B2)
- [参考](#%E5%8F%82%E8%80%83)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


# 项目背景
- eureka是一个springcloud较为通用流行的服务注册发现中心
- eureka目前仅仅配套了查询页面，没有配套摘除节点流量和放节点流量的功能
- 而在实际排查或者处理问题过程中，会频繁需要使用摘除流量保存节点现场的功能
- 上面就是这个项目产生的背景:eureka-admin
- 项目没有太多难点，主要是全栈这块：前端web和后端都有
- [源码](https://github.com/walkertest/eureka-admin)

# 简单使用
- 选择集群
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/2dcd32300f304c289362cf0bbe1797f6.png#pic_center)

- 选择环境
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/e1ea9e427e50494bb83c6ed1daa9aea4.png#pic_center)

- 查询服务列表/刷新页面
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/7da6a997fae84885af187eef810a02a3.png#pic_center)

- 搜索eureka上服务节点列表（服务名、ip、状态）（纯前端实现）
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3e049e8016bf4eefae15f5270dbd498d.png#pic_center)

- 批量摘除节点流量和放节点流量
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/85c99d222e054b2bb8ee38e497a0fa43.png#pic_center)

- 查询总的服务数量
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/614578f9167348399b7cdb7447e5d56e.png#pic_center)

- 跳转到eureka自带的管理界面
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3cf4dcac8dc54889aa59added8d101c3.png#pic_center)


# 交互流程
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/52cc52753a3e47c39030647fe513afc3.png#pic_center)


## 技术关键点
- springboot 3.4.5  && jdk25
- api实现而不是eurkea client(降低依赖更加灵活，解决一些多集群的查询问题)
- 配置化实现多集群的选择能力
- 前端框架：nextjs/react/npm/nodejs

# 具体使用
## 访问地址
- 本地访问：http://127.0.0.1:11112

## 部署
### 后端部署
- 配置好使用业务方自己的eureka集群配置
- 配置区分测试环境和线上环境
- 运行jar包即可

### 前端部署
- cd eureka-admin-nextjs
- npm install
- npm run build
- npm run dev/ npm run start即可


# 参考
- eureka server库：https://github.com/Netflix/eureka
- api:https://github.com/Netflix/eureka/wiki/Eureka-REST-operations
- 开源eureka admin：https://github.com/SpringCloud/eureka-admin

