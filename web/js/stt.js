/* Speech input that does not depend on the browser's cloud recogniser. */

(function (global) {
  'use strict';

  /* constants */
  var BOOTSTRAP_ONSET = 0.35;
  var MIN_ONSET = 0.20; 
  var MAX_ONSET = 0.65; 
  var BASELINE_ALPHA = 0.05; 
  var MIN_SPEECH_MS = 200;
  var CANDIDATE_SILENCE_MS = 300;
  var PRE_ROLL_MS = 700; 
  var TRAILING_MS = 400; 
  var TARGET_RATE = 16000;
  var FRAME_MS = 50; 

  /* state */
  var _transcribe = null;
  var _notice = null;
  var _sink = null;
  var _lang = null;
  var _ononset = null;
  var _now = function () { return Date.now(); };

  var _want = false;
  var _stream = null, _ctx = null, _node = null, _src = null;
  var _rate = TARGET_RATE;
  var _pcm = [];
  var _pcmSamples = 0;
  var _ringLimit = 0;
  var _speaking = false;
  var _voicedSince = 0;
  var _silentSince = 0;
  var _sentAt = 0;
  var _busy = false;
  var _level = 0;
  var _baseline = 0;

  function emit(text) { if (_sink) { try { _sink(text); } catch (e) {} } }
  function notice(code, isErr) { if (_notice) { try { _notice(code, !!isErr); } catch (e) {} } }
  function lang() {
    try { return (_lang && _lang()) || 'ja'; } catch (e) { return 'ja'; }
  }

  /* pure helpers */
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function frameLevel(frame, isInt16) {
    if (!frame || !frame.length) return 0;
    var sum = 0, i, v;
    for (i = 0; i < frame.length; i++) {
      v = isInt16 ? (frame[i] / 32768) : frame[i];
      sum += v * v;
    }

    return clamp01(Math.sqrt(sum / frame.length) * Math.SQRT2);
  }

  function int16(frame) {
    var out = new Int16Array(frame.length), i, v;
    for (i = 0; i < frame.length; i++) {
      v = frame[i];
      v = v < -1 ? -1 : (v > 1 ? 1 : v);
      out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return out;
  }

  function wavBlob(frames, rate) {
    var total = 0, i;
    for (i = 0; i < frames.length; i++) total += frames[i].length;
    var buf = new ArrayBuffer(44 + total * 2);
    var view = new DataView(buf);
    function str(off, s) { for (var j = 0; j < s.length; j++) view.setUint8(off + j, s.charCodeAt(j)); }
    str(0, 'RIFF');
    view.setUint32(4, 36 + total * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);         
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, total * 2, true);
    var off = 44;
    for (i = 0; i < frames.length; i++) {
      var f = frames[i];
      for (var k = 0; k < f.length; k++, off += 2) view.setInt16(off, f[k], true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  /* gate (pure) */
  function feedLevel(level, now) {
    level = clamp01(Number(level) || 0);
    _level = level;
    if (!_speaking || level < _baseline) {
      _baseline = _baseline * (1 - BASELINE_ALPHA) + level * BASELINE_ALPHA;
    }
    var threshold = _baseline > 0 ? Util.clamp(_baseline * 2.2, MIN_ONSET, MAX_ONSET) : BOOTSTRAP_ONSET;
    var voiced = level >= threshold;

    if (voiced) {
      if (!_speaking) {
        if (!_voicedSince) _voicedSince = now;
        if (now - _voicedSince >= MIN_SPEECH_MS) {
          _speaking = true;
          _silentSince = 0;
          if (_ononset) { try { _ononset(); } catch (e) {} }
        }
      } else {
        _silentSince = 0;
      }
      return null;
    }

    /* Not voiced. */
    if (!_speaking) { _voicedSince = 0; return null; }
    if (!_silentSince) { _silentSince = now; return null; }
    if (now - _silentSince < CANDIDATE_SILENCE_MS) return null;
    return closeUtterance(now);
  }

  function closeUtterance(now) {
    var keepFrom = Math.max(0, Math.round(PRE_ROLL_MS / FRAME_MS));
    var take = _pcm.slice(Math.max(0, _pcm.length - keepFrom - Math.round(TRAILING_MS / FRAME_MS)));
    _speaking = false;
    _voicedSince = 0;
    _silentSince = 0;
    if (!take.length) return null;
    var blob = wavBlob(take, _rate);
    _sentAt = now;
    if (!_transcribe) { notice('mic.noTranscriber', true); return null; }
    if (_busy) return null;
    _busy = true;
    var opts = { lang: lang() };
    Promise.resolve()
      .then(function () { return _transcribe(blob, opts); })
      .then(function (text) {
        _busy = false;
        var t = String(text == null ? '' : text).trim();
        if (!t) { notice('mic.empty', false); return; }
        emit(t);
      })
      .catch(function (e) {
        _busy = false;
        notice('mic.error:' + ((e && e.message) || e), true);
      });
    return blob;
  }

  function pushFrame(frame, isInt16) {
    _pcm.push(isInt16 ? frame : int16(frame));
    _pcmSamples += _pcm.length ? _pcm[_pcm.length - 1].length : 0;
    var limit = Math.round((PRE_ROLL_MS + TRAILING_MS + CANDIDATE_SILENCE_MS * 2) / FRAME_MS) + 4;
    while (_pcm.length > limit) {
      _pcmSamples -= _pcm.shift().length;
    }
  }

  /* capture */
  var WORKLET_SRC = [
    'class RyzaTap extends AudioWorkletProcessor {',
    '  process(inputs) {',
    '    const ch = inputs[0] && inputs[0][0];',
    '    if (ch) this.port.postMessage(ch.slice(0));',
    '    return true;',
    '  }',
    '}',
    'registerProcessor("ryza-tap", RyzaTap);'
  ].join('\n');

  function startCapture() {
    var md = global.navigator && global.navigator.mediaDevices;
    if (!md || !md.getUserMedia) return Promise.reject(new Error('NO_MIC_API'));
    return md.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    }).then(function (stream) {
      _stream = stream;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) throw new Error('NO_AUDIO_CTX');

      try { _ctx = new AC({ sampleRate: TARGET_RATE }); } catch (e) { _ctx = new AC(); }
      _rate = _ctx.sampleRate || TARGET_RATE;
      _src = _ctx.createMediaStreamSource(stream);

      var worklet = _ctx.audioWorklet && global.AudioWorkletNode;
      if (!worklet) return startScriptProcessor();

      var url = global.URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      return _ctx.audioWorklet.addModule(url).then(function () {
        global.URL.revokeObjectURL(url);
        _node = new global.AudioWorkletNode(_ctx, 'ryza-tap');
        _node.port.onmessage = function (ev) { onFrame(ev.data); };
        _src.connect(_node);

        var mute = _ctx.createGain();
        mute.gain.value = 0;
        _node.connect(mute);
        mute.connect(_ctx.destination);
        return true;
      }).catch(function () {
        global.URL.revokeObjectURL(url);
        return startScriptProcessor();
      });
    });
  }

  function startScriptProcessor() {
    if (!_ctx.createScriptProcessor) return Promise.reject(new Error('NO_AUDIO_TAP'));
    _node = _ctx.createScriptProcessor(2048, 1, 1);
    _node.onaudioprocess = function (ev) {
      onFrame(ev.inputBuffer.getChannelData(0));
    };
    _src.connect(_node);
    var mute = _ctx.createGain();
    mute.gain.value = 0;
    _node.connect(mute);
    mute.connect(_ctx.destination);
    return Promise.resolve(true);
  }

  var _lastTick = 0;

  function onFrame(channel) {
    if (!_want || !channel) return;
    pushFrame(channel, false);
    var now = _now();
    if (_lastTick && now - _lastTick < FRAME_MS) return;
    _lastTick = now;
    feedLevel(frameLevel(channel, false), now);
  }

  function teardown() {
    _lastTick = 0;
    _speaking = false;
    _voicedSince = 0;
    _silentSince = 0;
    _pcm = [];
    _pcmSamples = 0;
    _busy = false;
    try { if (_node) { _node.port && (_node.port.onmessage = null); _node.onaudioprocess = null; _node.disconnect(); } } catch (e) {}
    try { if (_src) _src.disconnect(); } catch (e) {}
    try { if (_ctx) _ctx.close(); } catch (e) {}
    try { if (_stream) _stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    _node = null; _src = null; _ctx = null; _stream = null;
  }

  var Stt = {
    MIN_SPEECH_MS: MIN_SPEECH_MS,
    CANDIDATE_SILENCE_MS: CANDIDATE_SILENCE_MS,
    TARGET_RATE: TARGET_RATE,

    /* ports */
    setTranscriber: function (fn) { _transcribe = (typeof fn === 'function') ? fn : null; },
    setNotice: function (fn) { _notice = (typeof fn === 'function') ? fn : null; },
    setSink: function (fn) { _sink = (typeof fn === 'function') ? fn : null; },
    setLang: function (fn) { _lang = (typeof fn === 'function') ? fn : null; },
    setClock: function (fn) { _now = (typeof fn === 'function') ? fn : _now; },
    setOnset: function (fn) { _ononset = (typeof fn === 'function') ? fn : null; },

    /* state */
    available: function () {
      var md = global.navigator && global.navigator.mediaDevices;
      return !!(md && md.getUserMedia);
    },
    isListening: function () { return !!_want; },
    isSpeaking: function () { return !!_speaking; },
    level: function () { return _level; },
    baseline: function () { return _baseline; },

    start: function () {
      if (_want) return Promise.resolve(true);
      if (!Stt.available()) { notice('mic.unsupported', true); return Promise.resolve(false); }
      _want = true;
      return startCapture().then(function () {
        notice('mic.on', false);
        return true;
      }).catch(function (e) {
        _want = false;
        teardown();
        var name = (e && e.name) || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') notice('mic.denied', true);
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') notice('mic.nodevice', true);
        else notice('mic.error:' + name + ':' + ((e && e.message) || e), true);
        return false;
      });
    },

    stop: function () {
      _want = false;
      teardown();
      notice('mic.off', false);
      return true;
    },

    toggle: function () { return Stt.isListening() ? Stt.stop() : Stt.start(); },

    /* exposed for tests */
    _feedLevel: feedLevel,
    _pushFrame: pushFrame,
    _frameLevel: frameLevel,
    _wavBlob: wavBlob,
    _close: closeUtterance,
    _state: function () {
      return {
        speaking: _speaking, busy: _busy, frames: _pcm.length,
        samples: _pcmSamples, sentAt: _sentAt, want: _want
      };
    },
    _reset: function () {
      _lastTick = 0; _speaking = false; _voicedSince = 0; _silentSince = 0;
      _pcm = []; _pcmSamples = 0; _busy = false; _want = false;
      _level = 0; _baseline = 0; _rate = TARGET_RATE;
    }
  };

  global.Stt = Stt;
})(typeof window !== 'undefined' ? window : globalThis);
