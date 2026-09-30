/* crfstore.js — Local Outfit (CRF) Import.*/

(function (global) {
  'use strict';

  var DB = 'ryza_crf';
  var STORE = 'outfits';
  var META_KEY = 'ryza.crf.imported.v1';
  var MAX_BYTES = 64 * 1024 * 1024;
  var MAX_ENTRIES = 64;

  var _db = null;
  var _urls = {};

  /* ---------------------------------------------------------------- idb */
  function open() {
    if (_db) return Promise.resolve(_db);
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is not available'));
    return new Promise(function (res, rej) {
      var req;
      try { req = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { _db = req.result; res(_db); };
      req.onerror = function () { rej(req.error); };
    });
  }

  function tx(mode) {
    return open().then(function (db) {
      return db.transaction(STORE, mode).objectStore(STORE);
    });
  }

  function meta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '[]'); } catch (e) { return []; }
  }
  function setMeta(list) {
    try { localStorage.setItem(META_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ---------------------------------------------------------------- zip*/
  function u16(dv, o) { return dv.getUint16(o, true); }
  function u32(dv, o) { return dv.getUint32(o, true); }

  function readZip(buf) {
    var dv = new DataView(buf);
    var eocd = -1;
    for (var i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) {
      if (u32(dv, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP file');
    var count = u16(dv, eocd + 10);
    var cdOff = u32(dv, eocd + 16);
    if (count > MAX_ENTRIES) throw new Error('Too many ZIP entries (limit: ' + MAX_ENTRIES + ')');
    var out = [];
    var p = cdOff;
    for (var n = 0; n < count; n++) {
      if (u32(dv, p) !== 0x02014b50) throw new Error('Corrupted ZIP directory');
      var method = u16(dv, p + 10);
      var size = u32(dv, p + 24);
      var nameLen = u16(dv, p + 28);
      var extraLen = u16(dv, p + 30);
      var commentLen = u16(dv, p + 32);
      var localOff = u32(dv, p + 42);
      var name = '';
      for (var k = 0; k < nameLen; k++) name += String.fromCharCode(dv.getUint8(p + 46 + k));
      out.push({ name: name, method: method, size: size, localOff: localOff });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { entries: out, dv: dv, buf: buf };
  }

  async function entryBytes(zip, e) {
    var dv = zip.dv;
    var p = e.localOff;
    if (u32(dv, p) !== 0x04034b50) throw new Error('Corrupted ZIP local header');
    var nameLen = u16(dv, p + 26);
    var extraLen = u16(dv, p + 28);
    var start = p + 30 + nameLen + extraLen;
    var slice = zip.buf.slice(start, start + e.size);
    if (e.method === 0) return new Uint8Array(slice);
    if (e.method !== 8) throw new Error('Unsupported compression method: ' + e.method);
    if (typeof DecompressionStream === 'undefined') throw new Error('Decompression is not supported in this environment');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([slice]).stream().pipeThrough(ds);
    var ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }

  /* Path safety + whitelist (aligned with AgentAtelierR's rules) */
  function safeName(path) {
    var p = String(path || '').replace(/\\/g, '/');
    if (p.startsWith('/') || p.indexOf(':') >= 0) throw new Error('ZIP contains an absolute path');
    var parts = p.split('/');
    for (var i = 0; i < parts.length; i++) if (parts[i] === '..') throw new Error('ZIP contains a .. path');
    return parts[parts.length - 1];
  }
  var OK_EXT = /\.(atlas|png|skel|json)$/i;

  /* Skeleton version: Spine 4.2 binary header contains an 8-byte hash + varint version string */
  function skeletonVersionOk(bytes) {
    if (!bytes || bytes.length < 14) return false;
    var len = bytes[8];
    if (!(len >= 4 && len <= 32)) return false;
    var s = '';
    for (var i = 0; i < len; i++) s += String.fromCharCode(bytes[9 + i]);
    return s.indexOf('4.2.') === 0;
  }

  /* PNG dimensions (only reads IHDR) */
  function pngSize(bytes) {
    if (!bytes || bytes.length < 24) return null;
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }

  /* Validate and normalize an imported package. Returns { id, files: {name: Uint8Array} } */
  function validate(files) {
    var names = Object.keys(files);
    var atlases = names.filter(function (n) { return /\.atlas$/i.test(n); });
    if (atlases.length !== 1) throw new Error('Exactly 1 .atlas file is required (single-page atlas)');
    var base = atlases[0].replace(/\.atlas$/i, '');
    ['png', 'skel', 'json'].forEach(function (ext) {
      var want = (ext === 'json') ? base + '_gesture.json' : base + '.' + ext;
      if (!files[want]) throw new Error('Missing ' + want);
    });
    var atlasText = new TextDecoder().decode(files[base + '.atlas']);
    var pageLines = atlasText.split(/\r?\n/).filter(function (l) {
      return /\.png\s*$/i.test(l.trim());
    });
    if (pageLines.length !== 1) throw new Error('Only single-page atlases are supported');
    if (pageLines[0].trim() !== base + '.png') throw new Error('Atlas texture name does not match the PNG filename');

    var declared = /^size:\s*(\d+)\s*,\s*(\d+)/m.exec(atlasText);
    if (!declared) throw new Error('Atlas is missing a size declaration');
    var png = pngSize(files[base + '.png']);
    if (!png) throw new Error('Texture is not a valid PNG');
    if (png.w !== Number(declared[1]) || png.h !== Number(declared[2])) {
      throw new Error('PNG dimensions ' + png.w + 'x' + png.h + ' do not match the atlas declaration ' + declared[1] + 'x' + declared[2]);
    }
    if (!skeletonVersionOk(files[base + '.skel'])) throw new Error('Only Spine 4.2 skeletons are supported');
    var gesture;
    try { gesture = JSON.parse(new TextDecoder().decode(files[base + '_gesture.json'])); }
    catch (e) { throw new Error('Gesture table is not valid JSON'); }
    if (!gesture || !gesture.emotionalGesture) throw new Error('Gesture table is missing emotionalGesture');

    var id = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'imported';
    return { id: id, base: base, files: files, gesture: gesture };
  }

  /* ---------------------------------------------------------------- api */
  var CrfStore = {
    MAX_BYTES: MAX_BYTES,
    MAX_ENTRIES: MAX_ENTRIES,

    parseZip: function (buf) { return readZip(buf); },
    validate: validate,
    skeletonVersionOk: skeletonVersionOk,
    pngSize: pngSize,
    safeName: safeName,

    list: function () { return meta(); },

    importZip: function (input) {
      return Promise.resolve().then(function () {
        if (input && typeof input.arrayBuffer === 'function') return input.arrayBuffer();
        return input;
      }).then(function (buf) {
        var ab = (buf instanceof ArrayBuffer) ? buf : buf.buffer;
        if (ab.byteLength > MAX_BYTES) throw new Error('ZIP exceeds 64MB');
        var zip = readZip(ab);
        var picked = [];
        var total = 0;
        zip.entries.forEach(function (e) {
          var name = safeName(e.name);
          if (!OK_EXT.test(name)) return;
          if (picked.some(function (p) { return p.name === name; })) {
            throw new Error('Duplicate file in ZIP: ' + name);
          }
          total += e.size;
          if (total > MAX_BYTES) throw new Error('Extracted contents exceed 64MB');
          picked.push({ name: name, entry: e });
        });
        if (!picked.length) throw new Error('ZIP contains no usable files');
        return Promise.all(picked.map(function (p) {
          return entryBytes(zip, p.entry).then(function (b) { return { name: p.name, bytes: b }; });
        }));
      }).then(function (list) {
        var files = {};
        list.forEach(function (x) { files[x.name] = x.bytes; });
        var v = validate(files);
        return tx('readwrite').then(function (store) {
          return new Promise(function (res, rej) {
            var rec = { id: v.id, base: v.base, files: {}, preview: null };
            Object.keys(files).forEach(function (n) {
              rec.files[n] = new Blob([files[n]]);
            });
            var put = store.put(rec);
            put.onsuccess = function () { res(v); };
            put.onerror = function () { rej(put.error); };
          });
        }).then(function (v2) {
          var m = meta().filter(function (x) { return x.id !== v.id; });
          m.push({ id: v.id, base: v.base, imported: true, addedAt: Date.now() });
          setMeta(m);
          return v;
        });
      });
    },

    remove: function (id) {
      return tx('readwrite').then(function (store) {
        return new Promise(function (res) {
          var del = store.delete(id);
          del.onsuccess = function () { res(); };
          del.onerror = function () { res(); };
        });
      }).then(function () {
        setMeta(meta().filter(function (x) { return x.id !== id; }));
        Object.keys(_urls[id] || {}).forEach(function (k) {
          try { URL.revokeObjectURL(_urls[id][k]); } catch (e) {}
        });
        delete _urls[id];
      });
    },

    /* Get an imported outfit (including file blobs) */
    get: function (id) {
      return tx('readonly').then(function (store) {
        return new Promise(function (res, rej) {
          var g = store.get(id);
          g.onsuccess = function () { res(g.result || null); };
          g.onerror = function () { rej(g.error); };
        });
      });
    },

    /* Rendering-layer port: provide the atlas texture as a blob URL for an imported outfit. */
    pageUrl: function (skinId, pageName) {
      var m = meta();
      var hit = null;
      for (var i = 0; i < m.length; i++) if (m[i].id === skinId) hit = m[i];
      if (!hit) return Promise.resolve(null);
      _urls[skinId] = _urls[skinId] || {};
      if (_urls[skinId][pageName]) return Promise.resolve(_urls[skinId][pageName]);
      return CrfStore.get(skinId).then(function (rec) {
        if (!rec || !rec.files) return null;
        var f = rec.files[pageName] || rec.files[rec.base + '.png'];
        if (!f) return null;
        var url = URL.createObjectURL(f);
        _urls[skinId][pageName] = url;
        return url;
      });
    },

    /* Register an imported outfit as a skins.json-style entry for the renderer to parse the skeleton */
    entryFor: function (rec) {
      var base = rec.base;
      _urls[rec.id] = _urls[rec.id] || {};
      function urlOf(name) {
        if (!_urls[rec.id][name]) {
          var f = rec.files[name];
          if (!f) return null;
          _urls[rec.id][name] = URL.createObjectURL(f);
        }
        return _urls[rec.id][name];
      }
      return {
        id: rec.id,
        chr: 'crf_chr_002',
        hasSpine: true,
        imported: true,
        preview: urlOf(base + '.png'),
        skel: urlOf(base + '.skel'),
        atlas: urlOf(base + '.atlas'),
        gesture: urlOf(base + '_gesture.json')
      };
    },

    /* Register imported outfits in Avatar's skin table on startup */
    entries: function () {
      var ids = meta().map(function (x) { return x.id; });
      if (!ids.length) return Promise.resolve([]);
      return Promise.all(ids.map(function (id) {
        return CrfStore.get(id).then(function (rec) {
          return rec ? CrfStore.entryFor(rec) : null;
        });
      })).then(function (list) {
        return list.filter(Boolean);
      });
    }
  };

  global.CrfStore = CrfStore;
})(window);