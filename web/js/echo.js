/* Text-level echo suppression for voice input.*/

(function (global) {
  'use strict';

  var LOOKBACK_MS = 20000;
  var LOOKBACK_CHARS = 1200;
  var MIN_TRANSCRIPT_CHARS = 6;
  var MIN_WINDOW_CHARS = 10;
  var THRESHOLD = 0.88;

  var _recent = [];
  
  function normalize(s) {
    var out = '';
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (/[\p{L}\p{N}]/u.test(c)) out += c.toLowerCase();
    }
    return out;
  }

  function lcsRatio(a, b) {
    if (!a.length || !b.length) return 0;
    var prev = new Uint32Array(b.length + 1);
    var cur = new Uint32Array(b.length + 1);
    for (var i = 1; i <= a.length; i++) {
      for (var j = 1; j <= b.length; j++) {
        cur[j] = (a.charCodeAt(i - 1) === b.charCodeAt(j - 1))
          ? prev[j - 1] + 1
          : (prev[j] > cur[j - 1] ? prev[j] : cur[j - 1]);
      }
      var t = prev; prev = cur; cur = t;
      cur.fill(0);
    }
    return (2 * prev[b.length]) / (a.length + b.length);
  }

  function recentText(now) {
    var cut = now - LOOKBACK_MS;
    var buf = '';
    for (var i = _recent.length - 1; i >= 0; i--) {
      if (_recent[i].at < cut) break;
      buf = _recent[i].text + '\n' + buf;
      if (buf.length >= LOOKBACK_CHARS) break;
    }
    if (buf.length > LOOKBACK_CHARS) buf = buf.slice(buf.length - LOOKBACK_CHARS);
    return buf;
  }

  function similar(enough, hay) {
    if (lcsRatio(enough, normalize(hay)) >= THRESHOLD) return true;
    var n = enough.length;
    var win = Math.max(MIN_WINDOW_CHARS, n);
    if (hay.length <= win) return false;
    var step = Math.max(1, Math.floor(n / 4));
    for (var i = 0; i + win <= hay.length; i += step) {
      if (lcsRatio(enough, hay.slice(i, i + win)) >= THRESHOLD) return true;
    }
    return false;
  }

  var Echo = {
    LOOKBACK_MS: LOOKBACK_MS,
    LOOKBACK_CHARS: LOOKBACK_CHARS,
    MIN_TRANSCRIPT_CHARS: MIN_TRANSCRIPT_CHARS,
    THRESHOLD: THRESHOLD,

    remember: function (text, now) {
      var t = String(text == null ? '' : text).trim();
      if (!t) return;
      _recent.push({ text: t, at: now != null ? Number(now) : Date.now() });
      var cut = (_recent[_recent.length - 1].at) - LOOKBACK_MS;
      while (_recent.length && _recent[0].at < cut) _recent.shift();
    },

    looksLikeEcho: function (transcript, now) {
      var n = normalize(transcript);
      if (n.length < MIN_TRANSCRIPT_CHARS) return false;
      var hay = normalize(recentText(now != null ? Number(now) : Date.now()));
      if (hay.length < MIN_WINDOW_CHARS) return false;
      return similar(n, hay);
    },

    reset: function () { _recent.length = 0; },
    recentCount: function () { return _recent.length; },

    _normalize: normalize,
    _lcsRatio: lcsRatio
  };

  global.Echo = Echo;
})(typeof window !== 'undefined' ? window : globalThis);
