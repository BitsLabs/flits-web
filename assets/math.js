/* Flits — render LaTeX in note bodies with KaTeX */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof renderMathInElement !== 'function') return;

  var scope = document.querySelector('main') || document.body;

  renderMathInElement(scope, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false }
    ],
    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    throwOnError: false
  });
});
