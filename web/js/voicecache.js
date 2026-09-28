/* voicecache.js — 语音片段缓存（重播 / 收藏用）。*/

(function (global) {
  'use strict';

  var DB = 'ryza_voice';
  var STORE = 'clips';
  var DEFAULT_BUDGET = 8 * 1024 * 1024;
  var DEFAULT_KEEP = 40;
  var META_KEY = 'ryza.voicefav.v1';

  var _db = null;
  var _protect = null;

  function hasIdb() { return typeof indexedDB !== 'undefined'; }

  function open() {
    if (_db) return Promise.resolve(_db);
    if (!hasIdb()) return Promise.reject(new Error('no indexedDB'));
    return new Promise(function (res, rej) {
      var req;
      try { req = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: 'key' });
          os.createIndex('at', 'at', { unique: false });
        }
      };
      req.onsuccess = function () { _db = req.result; res(_db); };
      req.onerror = function () { rej(req.error); };
    });
  }

  function tx(mode) {
    return open().then(function (db) { return db.transaction(STORE, mode).objectStore(STORE); });
  }

  function favs() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setFavs(o) {
    try { localStorage.setItem(META_KEY, JSON.stringify(o)); } catch (e) {}
  }

  function isFav(key) { return !!favs()[key]; }

  function evict(budget, keep) {
    return tx('readwrite').then(function (store) {
      return new Promise(function (res) {
        var all = [];
        var cur = store.openCursor();
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { all.push(c.value); c.continue(); return; }
          all.sort(function (a, b) { return (a.at || 0) - (b.at || 0); }); 
          var total = all.reduce(function (s, x) { return s + (x.bytes || 0); }, 0);
          var victims = [];
          for (var i = 0; i < all.length && (total > budget || all.length - victims.length > keep); i++) {
            var x = all[i];
            if (isFav(x.key)) continue;
            if (total <= budget && (all.length - victims.length) <= keep) break;
            total -= (x.bytes || 0);
            victims.push(x.key);
          }
          var n = 0;
          victims.forEach(function (k) {
            var d = store.delete(k);
            d.onsuccess = function () { n++; };
          });
          setTimeout(function () { res({ evicted: victims.length }); }, 0);
        };
        cur.onerror = function () { res({ evicted: 0 }); };
      });
    }).catch(function () { return { evicted: 0 }; });
  }

  var VoiceCache = {
    DEFAULT_BUDGET: DEFAULT_BUDGET,
    DEFAULT_KEEP: DEFAULT_KEEP,

    setProtector: function (fn) { _protect = (typeof fn === 'function') ? fn : null; },

    put: function (key, blob, meta) {
      if (!key || !blob || !hasIdb()) return Promise.resolve(false);
      var bytes = blob.size != null ? blob.size : (blob.byteLength || 0);
      var rec = {
        key: String(key),
        at: Date.now(),
        bytes: bytes,
        text: String((meta && meta.text) || '').slice(0, 400),
        url: String((meta && meta.url) || ''),
        blob: blob
      };
      return tx('readwrite').then(function (store) {
        return new Promise(function (res, rej) {
          var p = store.put(rec);
          p.onsuccess = function () { res(rec); };
          p.onerror = function () { rej(p.error); };
        });
      }).then(function () {
        return evict(DEFAULT_BUDGET, DEFAULT_KEEP).then(function () { return true; });
      }).catch(function () { return false; });
    },

    get: function (key) {
      return tx('readonly').then(function (store) {
        return new Promise(function (res) {
          var g = store.get(String(key));
          g.onsuccess = function () { res(g.result || null); };
          g.onerror = function () { res(null); };
        });
      }).catch(function () { return null; });
    },

    list: function () {
      return tx('readonly').then(function (store) {
        return new Promise(function (res) {
          var out = [];
          var cur = store.openCursor();
          cur.onsuccess = function () {
            var c = cur.result;
            if (!c) {
              out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
              return res(out);
            }
            var v = c.value;
            out.push({ key: v.key, at: v.at, bytes: v.bytes, text: v.text, fav: isFav(v.key) });
            c.continue();
          };
          cur.onerror = function () { res([]); };
        });
      }).catch(function () { return []; });
    },

    urlFor: function (key) {
      return VoiceCache.get(key).then(function (rec) {
        if (!rec || !rec.blob) return null;
        try { return URL.createObjectURL(rec.blob); } catch (e) { return null; }
      });
    },

    toggleFav: function (key) {
      var f = favs();
      if (f[key]) delete f[key]; else f[key] = 1;
      setFavs(f);
      return !!f[key];
    },

    clear: function (force) {
      return tx('readwrite').then(function (store) {
        return new Promise(function (res) {
          var cur = store.openCursor();
          var n = 0;
          cur.onsuccess = function () {
            var c = cur.result;
            if (!c) return res({ cleared: n });
            var v = c.value;
            if (force || !isFav(v.key)) { store.delete(v.key); n++; }
            c.continue();
          };
          cur.onerror = function () { res({ cleared: n }); };
        });
      }).catch(function () { return { cleared: 0 }; });
    },

    stats: function () {
      return VoiceCache.list().then(function (l) {
        return {
          count: l.length,
          bytes: l.reduce(function (s, x) { return s + (x.bytes || 0); }, 0),
          favs: l.filter(function (x) { return x.fav; }).length,
          budget: DEFAULT_BUDGET
        };
      });
    }
  };

  global.VoiceCache = VoiceCache;
})(typeof window !== 'undefined' ? window : globalThis);
