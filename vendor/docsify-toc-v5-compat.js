/*
 * docsify-toc 1.1.0 的 docsify v5 兼容补丁。
 * 插件在 mounted 钩子里调用了 window.Docsify.dom.toggleClass，
 * 而 docsify 5.x 的 Docsify.dom 已不再导出该方法（会抛 TypeError，
 * 导致整个 TOC 不渲染）。这里补一个等价实现。
 * 该文件必须在 docsify.min.js 之后、docsify-toc.js 之前加载。
 */
(function () {
  var Docsify = window.Docsify;
  if (!Docsify || !Docsify.dom) return;
  if (typeof Docsify.dom.toggleClass === 'function') return;

  // Docsify.dom 是冻结对象（Object.isFrozen === true），不能直接挂方法，
  // 只能整体替换成一个带 toggleClass 的新对象。
  Docsify.dom = Object.assign({}, Docsify.dom, {
    toggleClass: function (el, op, className) {
      if (!el || !className) return el;
      if (op === 'add') el.classList.add(className);
      else if (op === 'remove') el.classList.remove(className);
      else if (op === 'toggle') el.classList.toggle(className);
      return el;
    },
  });
})();
