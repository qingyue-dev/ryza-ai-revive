(function () {
  'use strict';
  function place(listSel, eggSel, modderSel) {
    var list = document.querySelector(listSel);
    if (!list) return;
    var egg = list.querySelector(eggSel), mod = list.querySelector(modderSel);
    if (egg && mod && egg.nextElementSibling !== mod && mod.previousElementSibling !== egg) list.insertBefore(egg, mod);
  }
  function run() {
    place('#drawer .drawer-list', '#li-easter', '.md-drawer-li');
    place('#side-menu', '#sm-easter', '#sm-modder');
  }
  function init() {
    run();
    var mo = new MutationObserver(run);
    ['#drawer .drawer-list', '#side-menu'].forEach(function (s) {
      var el = document.querySelector(s);
      if (el) mo.observe(el, { childList: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
