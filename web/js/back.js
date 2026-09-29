/* Android back-button bridge. The app is a single page: every menu is a DOM */

(function (global) {
  'use strict';

  function visible(el) { return !!el && !el.classList.contains('hidden'); }
  
  function closeOverlay(id) {
    if (id === 'overlay-alarm') { App._dismissAlarm(); return true; }
    var el = document.getElementById(id);
    if (!visible(el)) return false;
    if (id === 'overlay-title') {
      var btn = document.getElementById('btn-title-start');
      if (btn && !btn.disabled) { btn.click(); return true; }
      return false;
    }
    if (id === 'overlay-onboard') { Onboarding.skip(); return true; }
    if (id === 'overlay-prologue') { Onboarding.prologueNext(); return true; }
    el.classList.add('hidden');
    return true;
  }

  function handleBack() {
    try {
      if (visible(document.getElementById('modal-scrim'))) {
        document.getElementById('modal-cancel').click();
        return true;
      }
      var OVS = ['overlay-alarm', 'overlay-faint', 'overlay-quest-clear', 'overlay-prologue', 'overlay-onboard', 'overlay-title'];
      for (var i = 0; i < OVS.length; i++) {
        if (visible(document.getElementById(OVS[i]))) return closeOverlay(OVS[i]);
      }
      var SHEETS = ['sheet-mode', 'sheet-inv', 'sheet-status', 'sheet-npc', 'sheet-lang'];
      for (var j = 0; j < SHEETS.length; j++) {
        var s = document.getElementById(SHEETS[j]);
        if (visible(s)) { s.classList.add('hidden'); return true; }
      }
      var side = document.getElementById('side-menu');
      if (side && side.classList.contains('open')) {
        side.classList.remove('open');
        return true;
      }
      var active = document.querySelector('.view.active');
      if (active && active.id !== 'view-talk' && active.id !== 'view-welcome') {
        App.showView('talk');
        return true;
      }
    } catch (e) {
      console.error('handleBack failed: ' + (e && e.message));
    }
    return false;
  }

  global.RyzaShell = global.RyzaShell || {};
  global.RyzaShell.handleBack = handleBack;
})(window);
