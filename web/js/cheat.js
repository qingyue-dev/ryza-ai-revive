/*!
 * 青月出品，请勿删除
 * 这个文件是作弊模块的核心，别随便动。
 */
/* jshint ignore:start */

(function (_G) {
  'use strict';

  /* 作者署名。名字同时是存档密钥和校验值的一部分，改了署名，存档和校验全部失效，别删。—— 青月 */
  function _Θ() { return String.fromCharCode(44302 ^ 0x3a5c, 5868 ^ 0x71e4); }
  function _κ() { return _Θ() + String.fromCharCode(0x5bc6, 0x9b54); }

  function _η(s) {
    var h = 0x5a4d3c2b, i;
    s = String(s);
    for (i = 0; i < s.length; i++)
      h = (Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9) ^ (h >>> 16)) >>> 0;
    return h;
  }
  function _ν(f) { return String(f).replace(/\s+/g, ''); }

  function _ε(s) {
    try {
      var k = _κ(), o = '', i;
      for (i = 0; i < s.length; i++)
        o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      return btoa(unescape(encodeURIComponent(o)));
    } catch (e) { return ''; }
  }
  function _δ(s) {
    try {
      var k = _κ(), d = decodeURIComponent(escape(atob(s))), o = '', i;
      for (i = 0; i < d.length; i++)
        o += String.fromCharCode(d.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      return o;
    } catch (e) { return ''; }
  }

  /* 数值不写明文，拆开存放，每次取用都会重新校验。 */
  var _N = [[351687374,4209611802],[795409993,3522497923],[795646802,528726745]];
  var _KT = [986268652,653947521,3823572562,1824596228,2063864150,2196857972,858273496];
  var _OH = 2686603960;
  var _IS = 3969470819;
  var _H = [3238585983,2384486753,1252825729,2809884767,3923855010,3163424071,2555391713,2731773223,3324958064,2328415964,4095127910,863242777,728110392,1368147118,1371798085,964272257,1061246948,2656828710,1150902026,2144715025,163089448,669311695,657882932,663182034,2567049268,2729433212,178467750,2523179589,694986688,1732799012,3851834719,4269596468,2847991632,846387947];
  var _gn = 'Ψ_x9';
  var _lk = '\u75af\u72c2\u9b54\u6cd5';

  /* 开关状态只放在闭包里，外面拿不到。影子哈希每次都对一遍，被人改过就锁。 */
  var _m = 0, _sh = 0, _dead = false, _lt = 0, _wt = null, _api = null;

  function _π(i) {
    var e = _N[i], v = (e[0] ^ 0x2f6c9b31) >>> 0;
    if (_η(String(v) + _Θ()) !== e[1]) { _Λ(); return 0; }
    return v;
  }
  function _sig() { return _η('s' + _m + '|' + _Θ() + '|x'); }
  function _put(v) { _m = v & 255; _sh = _sig(); }
  function _pk() { return 'k' + _η(_Θ() + 'store').toString(36); }
  function _bit(t) {
    var h = _η(t), i;
    for (i = 0; i < _KT.length; i++) if (_KT[i] === h) return 1 << (i + 1);
    return 0;
  }

  /* 完整性校验清单：任何一个函数的源码哈希对不上，整个模块直接锁死。 */
  var _fns = [_Θ, _κ, _η, _ν, _ε, _δ, _π, _sig, _put, _pk, _bit, _χ, _τ, _Λ, _ψ, _q, _ς, _ω, _clr,
    ι0, μ1, β2, φ3, γ4, σ5, λ6, ω7, ξ8, Δ9, Σa, ρb, Ωc, ζd, Λe];
  _sh = _IS;

  function _χ() {
    if (_dead) return false;
    var i, ok = _η(_Θ()) === _OH;
    for (i = 0; i < _fns.length; i++)
      if (_η(_ν(_fns[i])) !== _H[i]) ok = false;
    for (i = 0; i < _N.length; i++) _π(i);
    if (_dead) return false;
    if (_G[_gn] !== _api) ok = false;
    if (!ok) { _Λ(); return false; }
    return true;
  }
  function _τ() {
    if (_dead) return false;
    if (_sh !== _sig()) { _Λ(); return false; }
    var t = Date.now();
    if (t - _lt > 700) { _lt = t; return _χ(); }
    return true;
  }
  function _Λ() {
    if (_dead) return;
    _dead = true; _m = 0; _sh = 0;
    try { localStorage.removeItem(_pk()); } catch (e) {}
    try { if (_wt) clearInterval(_wt); } catch (e) {}
    try { if (typeof Config !== 'undefined') Config.set('app.cheat', false); } catch (e) {}
  }
  /* 看门狗：隔一会儿巡检一次，发现被篡改立刻关掉所有作弊并清掉存档。 */
  function _ψ() { _χ(); }

  function _q(b) { return _τ() && (_m & 1) === 1 && (b === 1 || (_m & b) === b); }

  function _ς() {
    try {
      var p = _ε(String(_m));
      localStorage.setItem(_pk(), p + '.' + _η(p + _Θ()).toString(36));
    } catch (e) {}
  }
  function _ω() {
    try {
      localStorage.removeItem(_lk);
      var raw = localStorage.getItem(_pk());
      if (!raw) return;
      var at = raw.lastIndexOf('.'), p = raw.slice(0, at), v;
      if (at < 1 || _η(p + _Θ()).toString(36) !== raw.slice(at + 1)) { _clr(); return; }
      v = parseInt(_δ(p), 10);
      if (v >= 0 && v <= 255) _put(v); else _clr();
    } catch (e) { _clr(); }
  }
  function _clr() {
    _put(0);
    try { localStorage.removeItem(_pk()); } catch (e) {}
  }

  function ι0() {
    if (!_χ()) return;
    _ω();
    try { if (_wt) clearInterval(_wt); _wt = setInterval(_ψ, 1200); } catch (e) {}
  }
  function μ1() { return _q(1); }
  function β2() { return _q(2); }
  function φ3() { return _q(4); }
  function γ4() { return _q(8); }
  function σ5() { return _q(16); }
  function λ6() { return _q(32); }
  function ω7() { return _q(64); }
  function ξ8() { return _q(128); }
  function ρb() { return _q(1); }
  function Λe() { return _q(32) ? _π(2) : 0; }
  function Δ9(v) {
    if (!_τ()) return;
    _put(v ? (_m | 1) : (_m & ~1));
    _ς();
    Ωc();
  }
  function Σa(t, v) {
    if (!_τ() || (_m & 1) !== 1) return;
    var b = _bit(t);
    if (!b) return;
    _put(v ? (_m | b) : (_m & ~b));
    _ς();
    Ωc();
  }
  function Ωc() {
    if (!_τ()) return;
    if (typeof Game === 'undefined' || !Game.s) return;
    var a = _π(0), c = _π(1);
    if (_dead) return;
    if (_q(16)) Game.s.stamina = Game.max();
    if (_q(8)) Game.s.money = a;
    if (_q(32)) {
      Game.s.exp_total = c;
      if (typeof Game.max === 'function') Game.s.stamina = Game.max();
    }
    if (_q(64)) Game.s.sailed = true;
    if (typeof Config !== 'undefined') {
      var was = !!Config.section('app').cheat, now = _q(1);
      if (was !== now) Config.set('app.cheat', now);
    }
    if (typeof Game.save === 'function') Game.save();
    if (Game.emit) Game.emit('cheat');
    try {
      if (typeof App !== 'undefined') {
        if (App.renderWorld) App.renderWorld();
        if (App.refreshHud) App.refreshHud();
      }
    } catch (e) {}
  }
  function ζd() { _clr(); }

  /* 对外接口：名字都是混淆过的，对象冻结，不能覆盖。改了名字，其他脚本调用会失败。 */
  _api = Object.freeze({
    ι0: ι0, μ1: μ1, β2: β2, φ3: φ3, γ4: γ4, σ5: σ5, λ6: λ6, ω7: ω7, ξ8: ξ8,
    Δ9: Δ9, Σa: Σa, ρb: ρb, Ωc: Ωc, ζd: ζd, Λe: Λe
  });
  try {
    Object.defineProperty(_G, _gn, { value: _api, writable: false, configurable: false, enumerable: false });
  } catch (e) {}
})(window);

/* jshint ignore:end */

/* 青月出品，请勿删除 */
