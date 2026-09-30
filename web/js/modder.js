/*!
 * 青月出品，请勿删除
 * modder.js — 改版署名 & 完整性保护
 */
/* jshint ignore:start */

(function (_G) {
  'use strict';

  function _H(s) {
    var h = 0x5a4d3c2b, i;
    s = String(s);
    for (i = 0; i < s.length; i++)
      h = (Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9) ^ (h >>> 16)) >>> 0;
    return h;
  }

  function _dec(arr) {
    var seed = 0x51A7C3D9, i, k, out = '';
    for (i = 0; i < arr.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      k = (seed >>> 13) & 0xFF;
      out += String.fromCharCode(arr[i] ^ k);
    }
    return out;
  }

  var _Du = [27,58,165,47,83,4,174,249,213,128,66];
  var _Dn = [38712,26459];
  var _Dgh = [2,39,191,56,89,75,228,251,214,140,64,35,125,143,206,229,108,107,43,128,137,124,169,210,146,16,42,192,108,66];
  var _Dpm = [2,39,191,56,89,75,228,251,193,137,85,63,97,131,141,233,103,117,42,146,143,127,225,198,130,24,101,193,123,71,158,207,232,123,205,149,0,167,101,50,243,147,213,64,132,120,223,26,189,48];
  var _Dyt = [2,39,191,56,89,75,228,251,198,146,67,101,113,130,149,242,118,100,97,223,131,125,163,132,167,4,110,202,110,77,196,219,172,113,207,154];
  
  var _Hu = 2869574778;
  var _Hn = 2686603960;
  var _Hgh = 1534145619;
  var _Hpm = 3338711032;
  var _Hyt = 3450493621;

  var _SZ_REF = 26675;

  var _IMG_ANIME = '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';
  var _IMG_CAT   = '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';

  var _dead = false;
  var _api = null;

  function _verify() {
    if (_dead) return false;
    var u = _dec(_Du);
    var n = _dec(_Dn);
    var gh = _dec(_Dgh);
    var pm = _dec(_Dpm);
    var yt = _dec(_Dyt);
    if (_H(u)  !== _Hu  ||
        _H(n)  !== _Hn  ||
        _H(gh) !== _Hgh ||
        _H(pm) !== _Hpm ||
        _H(yt) !== _Hyt) {
      _kill();
      return false;
    }
    if (_G['_mdAPI'] !== _api) { _kill(); return false; }
    return true;
  }

  function _kill() {
    if (_dead) return;
    _dead = true;
  }

  function _render(container) {
    if (!_verify()) {
      container.innerHTML = '<p style="color:#e06666;font-size:13px;text-align:center;padding:24px 0">⚠ 数据完整性校验失败</p>';
      return;
    }
    var u = _dec(_Du);
    var n = _dec(_Dn);
    var gh = _dec(_Dgh);
    var pm = _dec(_Dpm);
    var yt = _dec(_Dyt);

    var wrap = document.createElement('div');
    wrap.className = 'md-wrap';

    var bannerWrap = document.createElement('div');
    bannerWrap.className = 'md-banner-wrap';

    var bannerImg = document.createElement('img');
    bannerImg.className = 'md-banner-img';
    bannerImg.src = 'data:image/webp;base64,' + _IMG_ANIME;
    bannerImg.alt = '';
    bannerWrap.appendChild(bannerImg);

    var avatarFloat = document.createElement('div');
    avatarFloat.className = 'md-avatar-float';
    var avatarCircle = document.createElement('img');
    avatarCircle.className = 'md-avatar-circle';
    avatarCircle.src = 'data:image/webp;base64,' + _IMG_CAT;
    avatarCircle.alt = n;
    avatarFloat.appendChild(avatarCircle);
    bannerWrap.appendChild(avatarFloat);
    wrap.appendChild(bannerWrap);

    var nameSection = document.createElement('div');
    nameSection.className = 'md-name-section';
    var nameEl = document.createElement('span');
    nameEl.className = 'md-name';
    nameEl.textContent = n;
    var userEl = document.createElement('span');
    userEl.className = 'md-user';
    userEl.textContent = '@' + u;
    nameSection.appendChild(nameEl);
    nameSection.appendChild(userEl);
    wrap.appendChild(nameSection);

    var tag = document.createElement('p');
    tag.className = 'md-tag';
    tag.textContent = '此版本由 ' + n + ' 修改，请勿二次分发';
    wrap.appendChild(tag);

    var links = [
      { icon: '🐱', label: 'GitHub', url: gh },
      { icon: '🏆', label: 'Platinmods', url: pm },
      { icon: '▶', label: 'YouTube', url: yt },
    ];

    var list = document.createElement('div');
    list.className = 'md-links';
    links.forEach(function (item) {
      var row = document.createElement('a');
      row.className = 'md-link-row';
      row.href = item.url;
      row.target = '_blank';
      row.rel = 'noopener noreferrer';

      var ico = document.createElement('span');
      ico.className = 'md-link-ico';
      ico.textContent = item.icon;

      var lbl = document.createElement('span');
      lbl.className = 'md-link-lbl';
      lbl.textContent = item.label;

      var urlSpan = document.createElement('span');
      urlSpan.className = 'md-link-url';
      urlSpan.textContent = item.url.replace('https://', '');

      row.appendChild(ico);
      var txt = document.createElement('div');
      txt.appendChild(lbl);
      txt.appendChild(urlSpan);
      row.appendChild(txt);

      list.appendChild(row);
    });
    wrap.appendChild(list);

    container.innerHTML = '';
    container.appendChild(wrap);
  }

  function _open() {
    var sheet = document.getElementById('sheet-modder');
    var body  = document.getElementById('md-body');
    if (!sheet || !body) return;
    _render(body);
    sheet.classList.remove('hidden');
  }

  function _close() {
    var sheet = document.getElementById('sheet-modder');
    if (sheet) sheet.classList.add('hidden');
  }

  _api = Object.freeze({ open: _open, close: _close });

  try {
    Object.defineProperty(_G, '_mdAPI', {
      value: _api, writable: false, configurable: false, enumerable: false
    });
  } catch (e) {}

  function _bindClose() {
    var btn = document.getElementById('md-close-btn');
    if (btn) btn.onclick = _close;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bindClose);
  } else {
    _bindClose();
  }

})(window);

/* jshint ignore:end */
/* 青月出品，请勿删除 */
