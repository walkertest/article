# docsify构建博客

## 初始化
- docsify init

## 修改index.html
- 修改目录结构、搜索以及皮肤
```
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

    <!-- Core Theme -->
    <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@5/dist/themes/core.min.css">

    
    <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify-sidebar-collapse/dist/sidebar.css" />
    <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@5/dist/themes/addons/core-dark.min.css" />


  </head>
  <body class="loading">
    <div id="app"></div>

    <!-- Configuration -->
    <script>
      window.$docsify = {
        //...
        loadSidebar: true,
        sidebarDisplayLevel: 1,
        subMaxLevel: 4, // 层级

              // darklight-theme 专属配置
        // darklightTheme: {
        //   siteFont: "Source Sans Pro, Helvetica Neue", // 全局字体
        //   defaultTheme: 'light',                      // 默认主题，可设置为 'light' 或 'dark'
        //   codeFontFamily: 'Roboto Mono, Monaco, courier, monospace', // 代码块字体
        //   bodyFontSize: '15px'                        // 正文文字大小
        // },
      };
    </script>

    <!-- Docsify.js -->
    <script src="//cdn.jsdelivr.net/npm/docsify@5"></script>


    <script src="//cdn.jsdelivr.net/npm/docsify-sidebar-collapse/dist/docsify-sidebar-collapse.min.js"></script>
    <script src="//cdn.jsdelivr.net/npm/docsify@5/dist/plugins/search.min.js"></script>



  </body>
</html>
```

## 编辑目录结构
- 新建文件：_sidebar.md
- 整理对应的博客目录


## github部署
- 打开 GitHub 仓库页面，点击 Settings
- 左侧菜单找到 Pages
- 在 Source 部分：
    - 选择 Deploy from a branch
    - Branch 选择 main，目录选择
    - 点击 Save

## gitlab部署
- 新建文件.gitlab-ci.yml
```
pages:
  stage: deploy
  script:
    - mkdir .public
    - cp -r * .public
    - mv .public public
  artifacts:
    paths:
      - public
  only:
    - master
```
- 推动到远程仓库即可
- 在Settings → Pages 中可以看到访问地址


## 新增博客
- 创建markdown的文件
- 在目录中增加索引即可


## QA
- 文章的第一个标题不显示:https://github.com/iPeng6/docsify-sidebar-collapse/issues/23