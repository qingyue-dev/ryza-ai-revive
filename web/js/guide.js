/* RyzaChat:AI — Tutorial Sheet  · 青月 */

(function (global) {
  'use strict';

  function t(k, fb) {
    if (global.I18n && I18n.t) {
      var v = I18n.t(k);
      return (v && v !== k) ? v : (fb || k);
    }
    return fb || k;
  }

  /* Section definitions — s4 placeholder reserved for user's API tutorial */
  var SECTIONS = [
    { id: 'cheat',  titleKey: 'tutorial.s1.title', bodyKey: 'tutorial.s1.body' },
    { id: 'nsfw',   titleKey: 'tutorial.s2.title', bodyKey: 'tutorial.s2.body' },
    { id: 'update', titleKey: 'tutorial.s3.title', bodyKey: 'tutorial.s3.body' }
    /* { id: 'api', titleKey: 'tutorial.s4.title', bodyKey: 'tutorial.s4.body' } */
  ];

  /* ── Render tutorial accordion body ─────────────────────── */

  function _updateNextLabel(btn, idx) {
    btn.textContent = (idx === SECTIONS.length - 1)
      ? t('tutorial.close', 'Close section')
      : t('tutorial.next',  'Got it, next →');
  }

  function _readSection(idx) {
    /* Collapse this section */
    var item    = document.getElementById('tut-item-'    + idx);
    var content = document.getElementById('tut-content-' + idx);
    var chevron = document.getElementById('tut-chev-'    + idx);
    if (content) content.style.display = 'none';
    if (item)    item.classList.remove('tut-open');
    if (chevron) chevron.textContent = '▸';

    var next = idx + 1;

    if (next < SECTIONS.length) {
      /* Unlock + open next */
      var nItem    = document.getElementById('tut-item-'    + next);
      var nContent = document.getElementById('tut-content-' + next);
      var nChev    = document.getElementById('tut-chev-'    + next);
      var nLock    = document.getElementById('tut-lock-'    + next);
      var nBtn     = document.getElementById('tut-next-'    + next);
      if (nItem)    { nItem.classList.remove('tut-locked'); nItem.classList.add('tut-open'); }
      if (nContent) nContent.style.display = 'block';
      if (nChev)    nChev.textContent = '▾';
      if (nLock)    nLock.textContent = '📖';
      if (nBtn)     _updateNextLabel(nBtn, next);
      setTimeout(function () {
        var el = document.getElementById('tut-item-' + next);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      /* All sections read → show complete button */
      var doneWrap = document.getElementById('tut-done-wrap');
      if (doneWrap) {
        doneWrap.classList.remove('hidden');
        setTimeout(function () {
          doneWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
  }

  function _render() {
    var body = document.getElementById('tutorial-body');
    if (!body) return;
    body.innerHTML = '';

    SECTIONS.forEach(function (sec, idx) {
      var locked = idx > 0;

      var item = document.createElement('div');
      item.id        = 'tut-item-' + idx;
      item.className = 'tut-item ' + (locked ? 'tut-locked' : 'tut-open');

      /* Header */
      var hdr = document.createElement('button');
      hdr.type      = 'button';
      hdr.className = 'tut-hdr';
      hdr.id        = 'tut-hdr-' + idx;

      var lockIco = document.createElement('span');
      lockIco.className   = 'tut-lock-ico';
      lockIco.id          = 'tut-lock-' + idx;
      lockIco.textContent = locked ? '🔒' : '📖';

      var title = document.createElement('span');
      title.className   = 'tut-section-title';
      title.textContent = t(sec.titleKey);

      var chev = document.createElement('span');
      chev.className   = 'tut-chevron';
      chev.id          = 'tut-chev-' + idx;
      chev.textContent = locked ? '' : '▾';

      hdr.appendChild(lockIco);
      hdr.appendChild(title);
      hdr.appendChild(chev);

      /* Content */
      var content = document.createElement('div');
      content.className    = 'tut-content';
      content.id           = 'tut-content-' + idx;
      content.style.display = locked ? 'none' : 'block';

      var bodyText = document.createElement('div');
      bodyText.className = 'tut-body-text';
      bodyText.textContent = t(sec.bodyKey); /* pre-line via CSS, no innerHTML needed */
      content.appendChild(bodyText);

      var nextBtn = document.createElement('button');
      nextBtn.type      = 'button';
      nextBtn.className = 'btn primary tut-next-btn';
      nextBtn.id        = 'tut-next-' + idx;
      _updateNextLabel(nextBtn, idx);
      ;(function (i) { nextBtn.onclick = function () { _readSection(i); }; })(idx);
      content.appendChild(nextBtn);

      /* Header toggle (only when unlocked) */
      ;(function (i, it, ct, ch) {
        hdr.onclick = function () {
          if (it.classList.contains('tut-locked')) return;
          var open = ct.style.display !== 'none';
          ct.style.display = open ? 'none' : 'block';
          it.classList.toggle('tut-open', !open);
          ch.textContent = open ? '▸' : '▾';
        };
      })(idx, item, content, chev);

      item.appendChild(hdr);
      item.appendChild(content);
      body.appendChild(item);
    });

    /* Complete button (hidden until all sections read) */
    var doneWrap = document.createElement('div');
    doneWrap.className = 'tut-done-wrap hidden';
    doneWrap.id        = 'tut-done-wrap';

    var doneBtn = document.createElement('button');
    doneBtn.type      = 'button';
    doneBtn.className = 'btn primary';
    doneBtn.textContent = t('tutorial.complete', '✓ Complete tutorial');
    doneBtn.onclick = function () {
      var sheet = document.getElementById('sheet-tutorial');
      if (sheet) sheet.classList.add('hidden');
      if (global.App && App.toast) App.toast(t('tutorial.toast', 'Tutorial complete! You can revisit it from the menu.'));
    };
    doneWrap.appendChild(doneBtn);
    body.appendChild(doneWrap);
  }

  /* ── Public API ─────────────────────────────────────────── */

  var GuideTutorial = {

    /** Open tutorial sheet from drawer action */
    openTutorial: function () {
      /* Remove highlight on the drawer item */
      var tutItem = document.querySelector('[data-action="tutorial"]');
      if (tutItem) tutItem.classList.remove('guide-highlight');

      var sheet = document.getElementById('sheet-tutorial');
      if (!sheet) return;

      /* Re-render so i18n is always fresh */
      _render();

      /* Sync sheet title */
      var titleEl = sheet.querySelector('[data-i18n="tutorial.title"]');
      if (titleEl) titleEl.textContent = t('tutorial.title', 'Tutorial');

      sheet.classList.remove('hidden');
    }
  };

  global.GuideTutorial = GuideTutorial;

})(window);
