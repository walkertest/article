[toc]

# 问题背景
* 黑产发的引流文本，在审核管理平台上展示为方块，没办法进行审核
* 但实际上，用户在移动端又可以发布展示，同时mac端的浏览器也能够正常显示
* 字符文本复制出来，丢在企业微信中，windows也没办法显示.
* 黑产的初衷，可能不是为了绕过人的审核，而是绕过机器的检测，毕竟形近字攻击是业务安全的常见攻击手段.
* 字符文本：𖫐𖭙𐍒⅋𑇇𖭖𑫤𐍕           
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/2f791ba4c3384e8b9d3b3f9d8201c2ba.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/77549f7bb396421ea85f62a21875a5b0.png)

# unicode特殊形近字字符在windows上面无法展示的原因
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/df5e4f74d94947f3970403f9c23ba62c.png)

* 返回的unicode字符：\uD81A\uDED0\uD81A\uDF59\uD800\uDF52\uD804\uDDC7\uD81A\uDF56\uD806\uDEE4\uD800\uDF55
* utf-16编码中，可以将上述的代理对转换为码点，然后映射为真实的字符
* ![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/5ad9785f0b9b4ced9aec4106a543e2eb.png)

* ![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/dc8f7503db604a5eb62b2055db040743.png)

* 以u+10355为例，可以看到映射为形近字m (https://zi-hi.com/sp/uni/10355)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/63616750d9444c7581feea93323f1754.png)
* 经过调研发现，这些特殊的扩展的unicode字符，windows系统为了节约存储空间，没有默认安装全部字体，所以无法显示，而显示为了方块状.

# 怎么在windows上面展示
##  本地安装字体后浏览器显示
* 找到缺失的字体，上面的码点找到的字体信息中，已经有文字体系信息了，通过这个可以搜到需要的字体信息.
* 下载字体：https://fonts.google.com/noto，这里搜索下载即可，比如Permic:https://fonts.google.com/noto/specimen/Noto+Sans+Old+Permic?query=Old+Permic
* 安装字体流程，参考：https://support.microsoft.com/zh-cn/office/%E6%B7%BB%E5%8A%A0%E5%AD%97%E4%BD%93-b7c5f17c-4426-4b53-967f-455339c564c1
* html中使用新安装的字体：https://github.com/walkertest/FrontEndStudy/blob/main/font/uselocal.html
```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Old Permic 字体示例</title>
    <style>
        /* 应用字体 */
        .permic-text {
            font-family: 'Noto Sans Bassa Vah','Noto Sans Old Permic';
            font-size: 1.2em;
            line-height: 1.5;
        }
    </style>
</head>
<body>
<p class="permic-text">
    一|𖫐𖭙𐍒⅋𑇇𖭖𑫤𐍕 一一一一
</p>
</body>
</html>
```
* 效果如下，可以看到部分安装了字体并且引用了的，就会生效
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/87f678fad9044c9a9874e6bcf93789c7.png)
* 接下来的思路，会有两种：本地安装所有需要的字体/使用远程字体，其中本地安装所有字体，工作量相对较多，我们研究了第二种方式.
##  使用远程的字体库
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/7b7dffa10cd440ae866dff5a38353b28.png)
* google的noto项目就是为了显示所有的unicode区域字符，因此我们这里选用noto font.
* https://fonts.google.com/noto/fonts ,网址上很容易抓取到总量的210个字体，拼接到实例代码就很容易展示了.
* 或者从一些文档中提取出这里的字体名字：https://notofonts.github.io/noto-docs/specimen/
* 具体代码参考：[linkNotoFonts](https://github.com/walkertest/FrontEndStudy/blob/main/font/useGoogleNotoFont.html )![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/360f56ee71b841778e8f5595c780cd20.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/aff8ae482c504fcebe7bd5db6f4ff457.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3cb0b6e7e7874baea141895a7090714d.png)
### link返回过慢
* 将这一步请求，加载出来的css文件，放在本地.
* 具体参考：https://github.com/walkertest/FrontEndStudy/blob/main/font/useGoogleNotoFont1.html 
* ![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/8c1dc7c6de6143b09bbb4f27c64327ee.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3780aa0506934240b931ecd7b3769194.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/fcbe4674c98a418b975dd8c4f27f5ff8.png)

### 部分字体仍然无法显示问题
* todo
## 本地安装所有字体
* 收集所有字体文件
* 电脑批量安装字体脚本
* html使用本地字体
##  形近字转换
* 业务安全领域，是需要这个能力的
* 实现原理：从网上爬取unicode码点到图片的数据，然后标注映射为对应的形近字，这样就有了unicode到形近字的映射，当然在如今ai盛行的情况下，也可以通过ocr的能力去自动转换为形近字
* 效果：
* ![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/12721a89f0f4412ea7bedd76532a6a0c.png)
```
