/*!
 * ╔════════════════════════════════╗
 * ║  RyzaChat Cheat Engine  —  Made by 青月              
 * ║  Protected · Do Not Modify    
 * ╚════════════════════════════════╝
 */
/* jshint ignore:start */

(function (_G) {
  'use strict';

  var _κ = '\u9752\u6708\u5bc6\u9b54';
  var _ρ = '\u75af\u72c2\u9b54\u6cd5';

  function _ε(s) {
    try {
      var o = '';
      for (var i = 0; i < s.length; i++)
        o += String.fromCharCode(s.charCodeAt(i) ^ _κ.charCodeAt(i % _κ.length));
      return btoa(unescape(encodeURIComponent(o)));
    } catch (e) { return ''; }
  }
  function _δ(s) {
    try {
      var d = decodeURIComponent(escape(atob(s)));
      var o = '';
      for (var i = 0; i < d.length; i++)
        o += String.fromCharCode(d.charCodeAt(i) ^ _κ.charCodeAt(i % _κ.length));
      return o;
    } catch (e) { return null; }
  }

  function _η(s) {
    var h = 0x5a4d3c2b;
    for (var _i = 0; _i < s.length; _i++)
      h = (Math.imul(h ^ s.charCodeAt(_i), 0x9e3779b9) ^ (h >>> 16)) >>> 0;
    return h;
  }
  
  var _σ = null;
  
  function _seal(fn) {
    var src = String(fn);
    _σ = _η(src.slice(0, 128) + src.slice(-64));
  }
  
  function _ok(fn) {
    if (_σ === null) return true;
    var src = String(fn);
    return _σ === _η(src.slice(0, 128) + src.slice(-64));
  }

  var _μ = {
    _α: false,
    _β: false,
    _γ: false,
    _ζ: false,
    _θ: false,
    _λ: false,
    _ξ: false,
    _ψ: false 
  };

  // ── Persistence ───
  function _save() {
    try {
      localStorage.setItem(_ρ, _ε(JSON.stringify(_μ)));
    } catch (e) {}
  }
  function _load() {
    try {
      var raw = localStorage.getItem(_ρ);
      if (!raw) return;
      var parsed = JSON.parse(_δ(raw));
      if (parsed && typeof parsed === 'object') {
        Object.keys(_μ).forEach(function (k) {
          if (typeof parsed[k] === 'boolean') _μ[k] = parsed[k];
        });
      }
    } catch (e) { _clear(); }
  }
  function _clear() {
    Object.keys(_μ).forEach(function (k) { _μ[k] = false; });
    try { localStorage.removeItem(_ρ); } catch (e) {}
  }

  // ── Public API ─────
  var CheatEngine = {
 
    init: function () {
      _load();
      _seal(CheatEngine.init);
    },

    master: function () { return !!_μ._α; },
    freeBuy: function () { return !!_μ._α && !!_μ._β; },
    freeQuest: function () { return !!_μ._α && !!_μ._ψ; },
    unlimCurrency: function () { return !!_μ._α && !!_μ._γ; },
    unlimStamina: function () { return !!_μ._α && !!_μ._ζ; },
    maxLevel: function () { return !!_μ._α && !!_μ._θ; },
    unlockMap: function () { return !!_μ._α && !!_μ._λ; },
    others: function () { return !!_μ._α && !!_μ._ξ; },

    setMaster: function (v) {
      _μ._α = !!v;
      if (!_μ._α) {
      }
      _save();
      CheatEngine._apply();
    },
    setSub: function (key, v) {
      if (!_μ._α) return;
      var map = { freeBuy: '_β', freeQuest: '_ψ', unlimCurrency: '_γ', unlimStamina: '_ζ', maxLevel: '_θ', unlockMap: '_λ', others: '_ξ' };
      var k = map[key];
      if (!k) return;
      _μ[k] = !!v;
      _save();
      CheatEngine._apply();
    },

    raw: function () {
      return {
        master: !!_μ._α,
        freeBuy: !!_μ._β,
        freeQuest: !!_μ._ψ,
        unlimCurrency: !!_μ._γ,
        unlimStamina: !!_μ._ζ,
        maxLevel: !!_μ._θ,
        unlockMap: !!_μ._λ,
        others: !!_μ._ξ
      };
    },

    _apply: function () {
      if (typeof Game === 'undefined' || !Game.s) return;

      if (CheatEngine.unlimStamina()) {
        Game.s.stamina = Game.max();
      }

      if (CheatEngine.unlimCurrency()) {
        Game.s.money = 999999999;
      }

      if (CheatEngine.maxLevel()) {
        Game.s.exp_total = 288120;
        if (typeof Game.max === 'function') Game.s.stamina = Game.max();
      }

      if (CheatEngine.unlockMap()) {
        Game.s.sailed = true;
      }

      if (typeof Config !== 'undefined') {
        var wasCheat = !!Config.section('app').cheat;
        var nowCheat = CheatEngine.master();
        if (wasCheat !== nowCheat) {
          Config.set('app.cheat', nowCheat);
        }
      }

      if (typeof Game.save === 'function') Game.save();
      if (typeof Game !== 'undefined' && Game.emit) Game.emit('cheat');
      try {
        if (typeof App !== 'undefined') {
          if (App.renderWorld) App.renderWorld();
          if (App.refreshHud) App.refreshHud();
        }
      } catch (e) {}
    },

    reset: _clear
  };

  _seal(CheatEngine._apply);

  _G.CheatEngine = CheatEngine;
})(window);

/* jshint ignore:end */

/* Made by 青月 · 青月出品，必属精品 */
