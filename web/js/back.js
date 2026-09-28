/* Android back-button bridge. The app is a single page: every menu is a DOM
   overlay (side menu, sheets, modals, full-screen views), so WebView history is
   empty and the back key used to quit the app instead of closing the open menu.
   MainActivity.onBackPressed() calls RyzaShell.handleBack(); returning true
   means "a layer consumed it, stay in the app", false means "nothing open,
   exit". Desktop/browser builds never call this (window.RyzaShell is set here
   only for discovery — the caller is the Android Activity).

   Order matters: whatever opened last closes first. Modals sit above sheets,
   sheets above the side menu, and full-screen views above the talk screen —
   the talk screen itself is the base layer and never closes on back. */
(function (global) {
  'use strict';

  function visible(el) { return !!el && !el.classList.contains('hidden'); }

  /* overlay-alarm and overlay-faint need their own dismissal so the alarm
     sound and the talking state stop with them, not just the div hiding. */
  function closeOverlay(id) {
    if (id === 'overlay-alarm') { App._dismissAlarm(); return true; }
    var el = document.getElementById(id);
    if (!visible(el)) return false;
    if (id === 'overlay-title') {
      /* the title screen's own start button already unhides the game; calling
         it keeps the sound unlock + onboarding chain intact */
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
      /* 1. modal forms (confirm dialogs) sit on top of everything */
      if (visible(document.getElementById('modal-scrim'))) {
        document.getElementById('modal-cancel').click();
        return true;
      }
      /* 2. blocking overlays, highest stakes first: alarm ring and the
         stamina-faint screen must not be dismissed by accident-tap logic,
         but an explicit back is an explicit dismiss */
      var OVS = ['overlay-alarm', 'overlay-faint', 'overlay-quest-clear',
                 'overlay-prologue', 'overlay-onboard', 'overlay-title'];
      for (var i = 0; i < OVS.length; i++) {
        if (visible(document.getElementById(OVS[i]))) return closeOverlay(OVS[i]);
      }
      /* 3. bottom sheets (mode / inventory / status / npc / language) */
      var SHEETS = ['sheet-mode', 'sheet-inv', 'sheet-status', 'sheet-npc', 'sheet-lang'];
      for (var j = 0; j < SHEETS.length; j++) {
        var s = document.getElementById(SHEETS[j]);
        if (visible(s)) { s.classList.add('hidden'); return true; }
      }
      /* 4. the right-side menu */
      var side = document.getElementById('side-menu');
      if (side && side.classList.contains('open')) {
        side.classList.remove('open');
        return true;
      }
      /* 5. full-screen views (settings / world / quest / daily / chara /
         skin / memory / welcome) return to the talk screen rather than
         exiting; view-talk is the base layer and is intentionally absent */
      var active = document.querySelector('.view.active');
      if (active && active.id !== 'view-talk' && active.id !== 'view-welcome') {
        App.showView('talk');
        return true;
      }
    } catch (e) {
      /* a broken layer must not turn the back key into a "never exits" trap:
         fall through to false so the Activity quits */
      console.error('handleBack failed: ' + (e && e.message));
    }
    return false;
  }

  global.RyzaShell = global.RyzaShell || {};
  global.RyzaShell.handleBack = handleBack;
})(window);
