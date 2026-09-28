/* Screen clothing vs atlas variant. No costume ids, no player-keyword lists. */

(function (global) {
  'use strict';

  var VARIANT = 'nsfw';
  
  var _sink = null;

  function apply(on) {
    Nsfw._on = !!on;
    if (_sink) {
      try { _sink(Nsfw._on ? VARIANT : 'default'); } catch (e) { }
    }
  }

  var Nsfw = {
    VARIANT: VARIANT,
    _on: false,
    setSink: function (fn) { _sink = (typeof fn === 'function') ? fn : null; },
    _enabled: true,
    active: function () { return !!Nsfw._on; },
    enabled: function () { return true; },
    apply: apply,
    restore: function () { apply(false); },
    setEnabled: function () { },
    reset: function () { apply(false); },
    screenFact: function () {
      return Nsfw._on ? 'Current screen：Her skin is visible (she has taken off her clothes).' : 'Current screen：I\'m wearing my usual clothes.';
    },
    onTurn: function (reply) {
      var flag = reply && typeof reply.nsfw === 'boolean' ? reply.nsfw : null;
      if (flag === true) apply(true);
      else if (flag === false) apply(false);
    }
  };

  global.Nsfw = Nsfw;
})(typeof window !== 'undefined' ? window : globalThis);
