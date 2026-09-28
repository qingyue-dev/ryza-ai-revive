/* Android keyboard handling.*/
   
(function (global) {
  'use strict';
  var IS_ANDROID = /Android/i.test(navigator.userAgent || '');
  if (!IS_ANDROID) return;

  var lastW = 0, full = 0, phone = null;

  function apply() {
    if (!phone) return;
    var h = window.innerHeight;
    var open = full && h < full - 40;
    if (open) {
      phone.style.height = full + 'px';
      phone.style.top = 'auto';
      phone.style.bottom = '0';
    } else {
      phone.style.height = '';
      phone.style.top = '';
      phone.style.bottom = '';
    }
  }

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    if (w !== lastW) {
      lastW = w; full = h;
    } else if (h >= full) {
      full = h;
    }
    apply();
  }

  function init() {
    phone = document.getElementById('phone');
    if (!phone) { setTimeout(init, 200); return; }
    lastW = window.innerWidth;
    full = window.innerHeight;
    global.addEventListener('resize', onResize);
    if (global.visualViewport) {
      global.visualViewport.addEventListener('resize', onResize);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})(window);
