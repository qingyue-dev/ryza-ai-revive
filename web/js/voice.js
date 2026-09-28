/* Voice input: microphone → speech-to-text → gated transcript. */

(function (global) {
  'use strict';

  var DEFAULT_TAG = 'ja-JP';
  
  var COOLDOWN_MS = 800;
  var MAX_RAPID_RESTARTS = 5;

  var _sink = null, _speaker = null, _notice = null, _lang = null, _echo = null;
  var _barge = null;
  var _capture = null;
  var _enginePref = null;
  var _transcriberReady = null;
  var _webSpeechDead = false;

  var _want = false;
  var _rec = null;
  var _suppressedUntil = 0;
  var _restarts = 0;
  var _startedAt = 0;
  var _speakStartedAt = 0;
  var _bargeTimer = null;
  var _now = function () { return Date.now(); };

  function emit(text) { if (_sink) { try { _sink(text); } catch (e) {} } }
  function notice(msg, isErr) { if (_notice) { try { _notice(msg, !!isErr); } catch (e) {} } }
  function speaking() {
    if (!_speaker) return false;
    try { return !!_speaker(); } catch (e) { return false; }
  }

  function Ctor() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }

  function armCooldown() { _suppressedUntil = _now() + COOLDOWN_MS; }

  function accept(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return false;
    if (speaking()) { armCooldown(); return false; }
    if (_now() < _suppressedUntil) return false;
    if (_echo && _echo.looksLikeEcho && _echo.looksLikeEcho(t, _now())) return false;
    emit(t);
    return true;
  }

  function build() {
    var R = Ctor();
    if (!R) return null;
    var rec = new R();
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    try {
      rec.lang = (_lang && _lang()) || DEFAULT_TAG;
    } catch (e) { }

    rec.onresult = function (ev) {
      var res = ev && ev.results;
      if (!res) return;
      for (var i = (ev.resultIndex || 0); i < res.length; i++) {
        var r = res[i];
        if (!r || !r.isFinal) continue;
        accept(r[0] && (r[0].transcript != null ? r[0].transcript : r[0]));
      }
    };
    rec.onerror = function (ev) {
      var code = (ev && ev.error) || '';
      if (code === 'no-speech' || code === 'aborted') return;   /* normal */
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        Voice._want = _want = false;
        notice('mic.denied', true);
        Voice._emitState();
        return;
      }

      if (code === 'network' || code === 'language-not-supported') {
        _webSpeechDead = true;
        try { if (_rec) _rec.stop(); } catch (e) {}
        if (Voice.engine() === 'capture') {
          notice('mic.switched', false);
          var wasWant = _want;
          _want = false;
          if (wasWant) Voice.start();
          return;
        }
      }
      notice('mic.error:' + code, true);
    };

    rec.onspeechstart = function () { Voice._onSpeechStart(); };
    rec.onspeechend = function () { Voice._cancelBarge(); };
    rec.onend = function () {
      if (!_want) { Voice._emitState(); return; }
      var ranFor = _now() - _startedAt;
      if (ranFor < 400) _restarts++; else _restarts = 0;
      if (_restarts > MAX_RAPID_RESTARTS) {
        _want = false;
        notice('mic.unstable', true);
        Voice._emitState();
        return;
      }
      try { rec.start(); _startedAt = _now(); } catch (e) { _want = false; Voice._emitState(); }
    };
    return rec;
  }

  var Voice = {
    COOLDOWN_MS: COOLDOWN_MS,
    MAX_RAPID_RESTARTS: MAX_RAPID_RESTARTS,
    BARGE_CONFIRM_MS: 240,
    FIRST_SENTENCE_MS: 700,

    /* ------------------------------------------------------------- ports */
    setSink: function (fn) { _sink = (typeof fn === 'function') ? fn : null; },
    setSpeaker: function (fn) { _speaker = (typeof fn === 'function') ? fn : null; },
    setNotice: function (fn) { _notice = (typeof fn === 'function') ? fn : null; },
    setLang: function (fn) { _lang = (typeof fn === 'function') ? fn : null; },
    setEcho: function (mod) { _echo = mod || null; },
    setClock: function (fn) { _now = (typeof fn === 'function') ? fn : _now; },

    setBargeIn: function (fn) { _barge = (typeof fn === 'function') ? fn : null; },

    setCapture: function (mod) {
      _capture = mod || null;
      if (_capture && _capture.setSink) _capture.setSink(accept);
      if (_capture && _capture.setOnset) _capture.setOnset(function () { Voice._onSpeechStart(); });
    },
    setEngine: function (fn) { _enginePref = (typeof fn === 'function') ? fn : null; },

    setTranscriberReady: function (fn) { _transcriberReady = (typeof fn === 'function') ? fn : null; },

    engine: function () {
      var pref = (_enginePref && _enginePref()) || 'auto';
      var hasRec = !!Ctor() && !_webSpeechDead;
      var hasCap = !!(_capture && _capture.available && _capture.available()) && (!_transcriberReady || !!_transcriberReady());
      if (pref === 'webSpeech') return hasRec ? 'webSpeech' : null;
      if (pref === 'capture') return hasCap ? 'capture' : null;
      if (hasRec) return 'webSpeech';
      return hasCap ? 'capture' : null;
    },

    /* ------------------------------------------------------------- state */
    available: function () { return !!Voice.engine(); },
    isListening: function () { return !!_want; },
    suppressedUntil: function () { return _suppressedUntil; },

    start: function () {
      var eng = Voice.engine();
      if (!eng) { notice('mic.unsupported', true); return false; }
      if (_want) return true;
      _want = true;
      _restarts = 0;
      if (eng === 'capture') {
        _capture.start().then(function (okFlag) {
          if (!okFlag && _want) { _want = false; Voice._emitState(); }
        });
        Voice._emitState();
        return true;
      }
      try {
        _rec = _rec || build();
        _rec.start();
        _startedAt = _now();
      } catch (e) {
        _want = false;
        notice('mic.error:' + (e && e.message || e), true);
      }
      Voice._emitState();
      return _want;
    },

    stop: function () {
      _want = false;
      Voice._cancelBarge();
      try { if (_rec) _rec.stop(); } catch (e) { /* already stopped */ }
      try { if (_capture) _capture.stop(); } catch (e) { /* already stopped */ }
      Voice._emitState();
      return true;
    },

    toggle: function () { return Voice.isListening() ? Voice.stop() : Voice.start(); },

    noteAssistantSpeech: function (text) {
      var t = String(text == null ? '' : text);
      if (!t.trim()) return false;
      if (!_echo || typeof _echo.remember !== 'function') return false;
      try { _echo.remember(t, _now()); } catch (e) { return false; }
      return true;
    },

    noteAssistantSpeechEnded: function (reason) {
      Voice._cancelBarge();
      if (_want && reason !== 'user-barge-in') armCooldown();
      Voice._emitState();
    },

    noteAssistantSpeechStarted: function () { _speakStartedAt = _now(); },
    selfSpeechFor: function () { return _speakStartedAt ? (_now() - _speakStartedAt) : 0; },

    suppressFor: function (ms) {
      var until = _now() + Math.max(0, Number(ms) || 0);
      if (until > _suppressedUntil) _suppressedUntil = until;
    },

    /* ---------------------------------------------------------- internals */
    _accept: accept,

    _onSpeechStart: function () {
      if (!_barge) return;
      if (!speaking()) return;
      if (Voice.selfSpeechFor() < Voice.FIRST_SENTENCE_MS) return;
      if (_bargeTimer) return;
      _bargeTimer = setTimeout(function () {
        _bargeTimer = null;
        if (!speaking()) return;
        try { _barge(); } catch (e) { }
      }, Voice.BARGE_CONFIRM_MS);
    },
    _cancelBarge: function () {
      if (!_bargeTimer) return;
      clearTimeout(_bargeTimer);
      _bargeTimer = null;
    },
    _bargePending: function () { return !!_bargeTimer; },
    _stateListeners: [],
    _emitState: function () {
      Voice._stateListeners.slice().forEach(function (f) {
        try { f(Voice.isListening()); } catch (e) {}
      });
    },
    onState: function (fn) {
      if (typeof fn !== 'function') return function () {};
      Voice._stateListeners.push(fn);
      return function () {
        var i = Voice._stateListeners.indexOf(fn);
        if (i >= 0) Voice._stateListeners.splice(i, 1);
      };
    },
    _reset: function () {
      Voice._cancelBarge();
      _rec = null; _want = false; _suppressedUntil = 0; _restarts = 0;
    }
  };

  global.Voice = Voice;
})(typeof window !== 'undefined' ? window : globalThis);