[TOC]


# 问题背景
* 一个多项目的仓库，历史分支没有及时清理，有1600+的分支数量，导致在构建的时候拉取分支非常慢，所以就出现一个问题：怎么批量清理远程的分支.
* 原则：不要删除master分支&&保留最近5个月内的分支&&merged分支可删除；过程分批可控制风险；效率高；

# 方法一：gitlab的清理功能
* gitlab提供了清理单个分支，并且确认的功能，如果分支数少量的话还好，1600+很难搞
* 提供了清理已经merge状态的分支的功能，这个挺好使.
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/f2857bd6f13b4a798cd8bdf715c36a46.png)

# 方法二：git命令
* 整体思路：按照提交时间倒序拉取所有的远程分支名字   --> 处理分支名字  --> 调用批量删除远程分支的指令


## 1.按照提交时间倒序拉取所有的远程分支名字
```
* git branch -r ，查看全部远程的分支
* git branch -r  --sort committerdate --format '%(committerdate:short) %(refname:short)' > sort-branch.txt， 按照最后提交时间排序分支
```

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/06492cc94afb4794a718e8499f5fb0cc.png)

## 2.处理分支名字
```
过滤掉时间信息和origin/前缀： cat sort-branch.txt | awk '{print $2}' | sed 's/origin\///g' > sed.txt
```
* 特殊字符的分支加引号，才可以提交
* 用nodepad将分支名字处理好后，放在一行中即可.


## 3. 远程批量删除
```
git push origin --delete 'branch-a' 'branch-b' 'branch-c'
```

## 4.远程分支和本地分支的数据同步
* 不同步的话，会有远程gitlab删除状态的分支在本地中仍然存在的.
```
git remote prune origin
```

## 5.单个脚本搞定
* 本人未测试，理论可行
````
git branch -r | grep  'name' | sed 's/origin\///g' | xargs -I {} git push origin :{}
````

# 总结
* 最终高效删除了仓库的1600多个分支，构建问题有效解决