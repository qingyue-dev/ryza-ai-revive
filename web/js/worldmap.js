/* worldmap.js — 世界地图（按官方形态重做）。*/

(function (global) {
  'use strict';

  var UI = 'assets/world_map/ui/';
  var AREAS = 'assets/world_map/areas/';
  var THUMBS = 'assets/world_map/area_thumbs/';
  var ICONS = 'assets/images/chara_icons/';

  var FIELDS = {
    'field_01_001': [0.73, 0.9, 2.35], 'field_01_002': [0.854, 0.647, 2.55],
    'field_01_003': [0.657, 0.508, 2.15], 'field_01_004': [0.524, 0.654, 2.35],
    'field_01_005': [0.4, 0.746, 2.15], 'field_01_006': [0.87, 0.41, 2.35],
    'field_01_007': [0.88, 0.12, 2.15], 'field_01_008': [0.645, 0.117, 2.15],
    'field_01_009': [0.445, 0.328, 2.15], 'field_01_010': [0.418, 0.133, 2.15],
    'field_01_011': [0.296, 0.431, 2.15], 'field_01_012': [0.24, 0.18, 2.15],
    'field_01_013': [0.193, 0.694, 2.15], 'field_01_014': [0.089, 0.785, 2.15],
    'field_02_001': [0.317, 0.24, 2.15], 'field_02_002': [0.541, 0.222, 2.15],
    'field_02_003': [0.283, 0.648, 2.15], 'field_02_004': [0.881, 0.365, 2.15],
    'field_02_005': [0.679, 0.66, 2.15], 'field_03_001': [0.573, 0.792, 2.15],
    'field_03_002': [0.621, 0.317, 2.15], 'field_03_003': [0.805, 0.784, 2.15],
    'field_03_004': [0.251, 0.645, 2.15], 'field_03_005': [0.235, 0.246, 2.15],
    'field_04_001': [0.473, 0.519, 2.15], 'field_04_002': [0.588, 0.867, 2.15],
    'field_04_003': [0.585, 0.258, 2.15], 'field_05_001': [0.483, 0.562, 2.15],
    'field_05_002': [0.124, 0.644, 2.15], 'field_05_003': [0.751, 0.511, 2.15],
    'field_05_004': [0.133, 0.846, 2.15], 'field_05_005': [0.36, 0.30, 2.15],
    'field_05_006': [0.60, 0.72, 2.15], 'field_05_007': [0.82, 0.30, 2.15],
    'field_05_008': [0.30, 0.86, 2.15], 'field_05_009': [0.66, 0.14, 2.15],
    'field_05_010': [0.18, 0.44, 2.15], 'field_01_015': [0.5, 0.5, 2.15]
  };
  var STAGES = {
    'stage_01_001_01': [-0.24, 0.06], 'stage_01_001_02': [-0.08, -0.83],
    'stage_01_001_04': [-0.84, -0.25], 'stage_01_001_05': [-0.84, 0.73],
    'stage_01_001_06': [0.09, 0.73], 'stage_01_001_08': [0.34, -0.15],
    'stage_01_002_01': [-0.25, 0.83], 'stage_01_002_02': [-1.29, 0.33],
    'stage_01_002_03': [0.3, -0.4], 'stage_01_001_09': [0.42, -0.52],
    'stage_01_001_10': [-0.3, 0.55], 'stage_01_002_04': [-0.6, -0.35]
  };

  var ZOOM_MIN = 1, ZOOM_MAX = 3.2, ZOOM_STEP = 0.35;

  var WorldMap = {
    mode: 'grid',
    level: 'area',
    areaId: '',
    fieldId: '',
    zoom: 1,
    panX: 0,
    panY: 0,
    _root: null,
    _onPickStage: null,
    _handlers: null,

    pins: FIELDS,
    stageOffsets: STAGES,

    setHandlers: function (opts) {
      this._handlers = opts || this._handlers;
      if (opts && opts.onPickStage) this._onPickStage = opts.onPickStage;
    },

    toggle: function () {
      this.mode = (this.mode === 'map') ? 'grid' : 'map';
      return this.mode;
    },

    areaOfStage: function (stageId) {
      var m = /^stage_(\d\d)_/.exec(String(stageId || ''));
      return m ? ('area_' + m[1]) : '';
    },
    
    /* 兜底布局 */
    _fallbackFieldPos: function (areaId, fieldId) {
      var fields = this.fieldsOf(areaId);
      var i = 0, n = fields.length;
      for (var k = 0; k < n; k++) if (fields[k].id === fieldId) { i = k; break; }
      var ang = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      return [0.5 + Math.cos(ang) * 0.16, 0.5 + Math.sin(ang) * 0.16, 2.15];
    },
    _fallbackStagePos: function (fieldId, stageId) {
      var list = this.stagesOf(fieldId);
      var i = 0, n = list.length;
      for (var k = 0; k < n; k++) if (list[k].id === stageId) { i = k; break; }
      var fp = FIELDS[fieldId] || this._fallbackFieldPos(this.areaId, fieldId);
      var ang = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      var r = 0.045 + 0.001 * (i % 4);
      return [fp[0] + Math.cos(ang) * r, fp[1] + Math.sin(ang) * r, fp[2] || 2.15];
    },

    coordSource: function (id) {
      if (FIELDS[id]) return 'calibrated';
      if (STAGES[id]) return 'calibrated';
      return 'layout';
    },

    fieldOfStage: function (stageId) {
      var m = /^stage_(\d\d_\d\d\d)_\d\d/.exec(String(stageId || ''));
      return m ? ('field_' + m[1]) : '';
    },

    world: function () { return global.World || null; },
    areas: function () {
      var w = this.world();
      return (w && w.areas && w.areas()) || [];
    },
    fieldsOf: function (areaId) {
      var list = this.areas();
      for (var i = 0; i < list.length; i++) if (list[i].id === areaId) return list[i].fields || [];
      return [];
    },
    stagesOf: function (fieldId) {
      var fs = this.fieldsOf(this.areaId);
      for (var i = 0; i < fs.length; i++) if (fs[i].id === fieldId) return fs[i].stages || [];
      return [];
    },
    label: function (id, fallback) {
      var w = this.world();
      if (w && w.placeLabel) {
        try { return w.placeLabel(id, fallback) || fallback || id; } catch (e) {}
      }
      return fallback || id;
    },
    locked: function (areaId) {
      var w = this.world();
      if (w && w.locked) {
        try { return !!w.locked(areaId); } catch (e) {}
      }
      return false;
    },

    npcsOfArea: function (areaId, day) {
      var w = this.world();
      var out = [];
      if (w && w.npcsInArea) {
        try { out = w.npcsInArea(areaId, day || 1) || []; } catch (e) {}
      }
      return out;
    },
    iconFor: function (npcId) {
      var w = this.world();
      if (w && w.iconFor) {
        try { return w.iconFor(npcId); } catch (e) {}
      }
      return ICONS + 'ryza.png';
    },

    /* 相机 */
    _apply: function () {
      var layer = this._root && this._root.querySelector('.wmp-layer');
      var map = this._root && this._root.querySelector('.wmp-map');
      if (!layer || !map) return;
      layer.style.transform = 'translate(' + this.panX + '%, ' + this.panY + '%) scale(' + this.zoom + ')';
      map.classList.toggle('focused', this.level === 'field');
    },
    _clampPan: function () {
      var lim = (this.zoom - 1) * 50;
      this.panX = Math.max(-lim, Math.min(lim, this.panX));
      this.panY = Math.max(-lim, Math.min(lim, this.panY));
    },
    focusField: function (fieldId) {
      var p = FIELDS[fieldId];
      if (!p) return;
      this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, p[2]));
      this.panX = (0.5 - p[0]) * 100 * this.zoom;
      this.panY = (0.5 - p[1]) * 100 * this.zoom;
      this._clampPan();
      this._apply();
    },
    zoomBy: function (delta) {
      this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom + delta));
      this._clampPan();
      this._apply();
    },
    reset: function () {
      this.zoom = 1; this.panX = 0; this.panY = 0;
      this._apply();
    },

    recenter: function (stageId) {
      var f = this.fieldOfStage(stageId);
      var p = FIELDS[f];
      if (p) { this.focusField(f); return; }
      this.reset();
    },

    /* 渲染 */
    render: function (root, state, handlers) {
      if (!root) return;
      this._root = root;
      if (handlers) this.setHandlers(handlers);
      var st = state || {};
      var stageId = st.stage || (global.Config && Config.section('state').stage) || 'stage_01_001_01';
      var areaId = this.areaId || this.areaOfStage(stageId);
      if (this.level === 'area') this.fieldId = '';
      if (this.level === 'field' && !this.fieldId) this.fieldId = this.fieldOfStage(stageId);
      this.areaId = areaId;

      root.innerHTML = '';
      if (this.mode === 'grid') { root.classList.remove('wmp-on'); return; }
      root.classList.add('wmp-on');

      var self = this;
      var day = st.day || 1;

      var map = document.createElement('div');
      map.className = 'wmp-map';
      var layer = document.createElement('div');
      layer.className = 'wmp-layer';
      var img = document.createElement('img');
      img.className = 'wmp-plate';
      img.alt = '';
      img.src = AREAS + (areaId || 'area_01') + '.jpg';
      layer.appendChild(img);

      var top = document.createElement('div');
      top.className = 'wmp-top';
      var here = st.stage || stageId;
      var hereName = this.label(here, (this.world() && World.find(here) || {}).stage);
      top.textContent = hereName;
      root.appendChild(top);

      /* ---- 标记 ---- */
      if (this.level === 'area') {
        this.fieldsOf(areaId).forEach(function (f) {
          var calibrated = !!FIELDS[f.id];
          var p = FIELDS[f.id] || self._fallbackFieldPos(areaId, f.id);
          var on = !!f.stages && f.stages.some(function (s2) { return s2.id === stageId; });
          var pin = document.createElement('button');
          pin.className = 'wmp-pin wmp-area-pin' + (on ? ' here' : '');
          pin.style.left = (p[0] * 100) + '%';
          pin.style.top = (p[1] * 100) + '%';
          pin.dataset.field = f.id;
          pin.dataset.calibrated = calibrated ? '1' : '0';
          pin.innerHTML = '<img class="wmp-mark" alt=""><span class="wmp-name"></span>';
          pin.querySelector('.wmp-mark').src = UI + 'field_pin.svg';
          pin.querySelector('.wmp-name').textContent = self.label(f.id, f.name);
          if (on) {
            var ring = document.createElement('img');
            ring.className = 'wmp-ring';
            ring.src = UI + 'field_pin_ring.svg';
            ring.alt = '';
            pin.appendChild(ring);
          }
          pin.onclick = function (ev) {
            ev.stopPropagation();
            if (self._handlers && self._handlers.onSelectField) {
              if (self._handlers.onSelectField(f.id) === false) return;
            }
            self.enterField(f.id, stageId);
          };
          layer.appendChild(pin);
        });
      } else {
        var stages = this.stagesOf(this.fieldId);
        var fp = FIELDS[this.fieldId];
        stages.forEach(function (s2) {
          var calibrated = !!STAGES[s2.id];
          var x, y;
          if (calibrated && fp) {
            x = fp[0] + STAGES[s2.id][0] * 0.08;
            y = fp[1] + STAGES[s2.id][1] * 0.08;
          } else {
            var fs = self._fallbackStagePos(self.fieldId, s2.id);
            x = fs[0]; y = fs[1];
          }
          if (x < 0.02 || x > 0.98 || y < 0.02 || y > 0.98) return;
          var pin = document.createElement('button');
          pin.className = 'wmp-pin wmp-stage-pin' + (s2.id === stageId ? ' here' : '');
          pin.style.left = (x * 100) + '%';
          pin.style.top = (y * 100) + '%';
          pin.dataset.stage = s2.id;
          pin.dataset.calibrated = calibrated ? '1' : '0';
          pin.innerHTML = '<img class="wmp-mark" alt=""><span class="wmp-name"></span>';
          pin.querySelector('.wmp-mark').src = UI + (s2.id === stageId ? 'field_pin.svg' : 'field_pin_inactive.svg');
          pin.querySelector('.wmp-name').textContent = self.label(s2.id, s2.name);
          pin.onclick = function (ev) {
            ev.stopPropagation();
            if (self._onPickStage) self._onPickStage(s2.id);
          };
          layer.appendChild(pin);
        });
      }

      var myField = this.fieldOfStage(stageId);
      var mp = FIELDS[myField];
      if (mp && (!this.fieldId || this.fieldId === myField)) {
        var me = document.createElement('div');
        me.className = 'wmp-me';
        me.style.left = (mp[0] * 100) + '%';
        me.style.top = (mp[1] * 100) + '%';
        me.innerHTML =
          '<span class="wmp-me-tag"><img class="wmp-me-badge" alt="">' +
          '<b class="wmp-me-text"></b></span>' +
          '<span class="wmp-me-face"><img alt=""></span>';
        me.querySelector('.wmp-me-badge').src = UI + 'current_location.svg';
        me.querySelector('.wmp-me-text').textContent =
          (global.I18n && I18n.t) ? I18n.t('world.current') : '目前位置';
        me.querySelector('.wmp-me-face img').src =
          me.querySelector('.wmp-me-face img').src || ICONS + 'ryza.png';
        layer.appendChild(me);
      }

      map.appendChild(layer);
      root.appendChild(map);

      var bar = document.createElement('div');
      bar.className = 'wmp-bar';
      var sel = document.createElement('button');
      sel.className = 'wmp-select';
      var curArea = this.areas().filter(function (a) { return a.id === areaId; })[0];
      var inField = this.level === 'field';
      sel.innerHTML = '<span class="wmp-sel-t"></span>';
      sel.querySelector('.wmp-sel-t').textContent = inField
        ? this.label(this.fieldId, (this.fieldsOf(areaId).filter(function (f) { return f.id === self.fieldId; })[0] || {}).name)
        : this.label(areaId, curArea ? curArea.name : areaId);
      if (inField) {
        sel.classList.add('back');
        sel.onclick = function () { self.leaveField(); };
      } else {
        sel.onclick = function () { self.areaSheet(root, st); };
      }
      bar.appendChild(sel);
      
      var btnList = document.createElement('button');
      btnList.className = 'wmp-list';
      btnList.textContent = (global.I18n && I18n.t) ? I18n.t('world.list') : '列表';
      btnList.title = btnList.textContent;
      btnList.onclick = function (ev) {
        ev.stopPropagation();
        if (self._handlers && self._handlers.onToggleList) self._handlers.onToggleList();
      };
      bar.appendChild(btnList);

      var btnMe = document.createElement('button');
      btnMe.className = 'wmp-locate';
      btnMe.textContent = (global.I18n && I18n.t) ? I18n.t('world.current') : '目前位置';
      btnMe.onclick = function () {
        if (self.level === 'field') self.recenter(stageId);
        else { self.areaId = self.areaOfStage(stageId); self.recenter(stageId); }
      };
      bar.appendChild(btnMe);
      root.appendChild(bar);

      /* ---- 缩放控件 ---- */
      var ctl = document.createElement('div');
      ctl.className = 'wmp-ctl';
      [['＋', ZOOM_STEP], ['－', -ZOOM_STEP], ['◎', 0]].forEach(function (pair) {
        var b = document.createElement('button');
        b.className = 'wmp-btn';
        b.textContent = pair[0];
        b.onclick = function (ev) {
          ev.stopPropagation();
          if (pair[1] === 0) self.reset(); else self.zoomBy(pair[1]);
        };
        ctl.appendChild(b);
      });
      root.appendChild(ctl);

      this._bindDrag(map);
      this._apply();
    },

    enterField: function (fieldId, stageId) {
      this.level = 'field';
      this.fieldId = fieldId;
      this.focusField(fieldId);
      this.render(this._root, { stage: stageId });
    },
    leaveField: function () {
      this.level = 'area';
      this.fieldId = '';
      this.reset();
      var st = global.Config ? Config.section('state') : {};
      this.render(this._root, { stage: st.stage, day: st.day });
    },

    /* 区域选择弹层 */
    areaSheet: function (root, st) {
      var self = this;
      var day = (st && st.day) || 1;
      var old = root.querySelector('.wmp-sheet');
      if (old) old.remove();

      var sheet = document.createElement('div');
      sheet.className = 'wmp-sheet';
      var head = document.createElement('div');
      head.className = 'wmp-sheet-head';
      head.textContent = (global.I18n && I18n.t) ? I18n.t('world.areas') : 'Select Area';
      sheet.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'wmp-sheet-grid';
      this.areas().forEach(function (a) {
        var locked = self.locked(a.id);
        var isHere = (a.id === (self.areaId || self.areaOfStage(st.stage)));
        var card = document.createElement('button');
        card.className = 'wmp-acard' + (locked ? ' locked' : '') + (isHere ? ' here' : '');
        var art = document.createElement('img');
        art.className = 'wmp-acard-art';
        art.alt = '';
        var thumbOk = ['area_01', 'area_02', 'area_03'].indexOf(a.id) !== -1;
        art.src = thumbOk ? (THUMBS + a.id + '.jpg') : (AREAS + a.id + '.jpg');
        card.appendChild(art);
        if (isHere) {
          var badge = document.createElement('span');
          badge.className = 'wmp-acard-badge';
          badge.textContent = (global.I18n && I18n.t) ? I18n.t('world.current') : 'Current location';
          card.appendChild(badge);
        }
        if (locked) {
          var lock = document.createElement('img');
          lock.className = 'wmp-acard-lock';
          lock.src = 'assets/welcome_mission/lock.svg';
          lock.alt = '';
          card.appendChild(lock);
        }
        var folks = self.npcsOfArea(a.id, day).slice(0, 6);
        if (folks.length) {
          var strip = document.createElement('span');
          strip.className = 'wmp-acard-folks';
          folks.forEach(function (n) {
            var im = document.createElement('img');
            im.alt = '';
            im.src = self.iconFor(n.id);
            im.onerror = function () { im.style.display = 'none'; };
            strip.appendChild(im);
          });
          card.appendChild(strip);
        }
        var nm = document.createElement('span');
        nm.className = 'wmp-acard-name';
        nm.textContent = self.label(a.id, a.name);
        card.appendChild(nm);
        card.onclick = function () {
          if (locked) return;
          self.areaId = a.id;
          self.level = 'area';
          self.fieldId = '';
          self.reset();
          sheet.remove();
          self.render(root, { stage: st.stage, day: day });
        };
        grid.appendChild(card);
      });
      sheet.appendChild(grid);

      sheet.addEventListener('click', function (ev) {
        if (ev.target === sheet) sheet.remove();
      });
      root.appendChild(sheet);
    },

    /* 拖动 */
    _bindDrag: function (view) {
      var self = this;
      var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      var pointers = {};
      var SLOP = 6;
      view.onpointerdown = function (ev) {
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        dragging = true; moved = false;
        sx = ev.clientX; sy = ev.clientY; ox = self.panX; oy = self.panY;
      };
      view.onpointermove = function (ev) {
        if (!dragging) return;
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (!moved) {
          moved = true;
          try { view.setPointerCapture && view.setPointerCapture(ev.pointerId); } catch (e) {}
        }
        var ids = Object.keys(pointers);
        if (ids.length >= 2) {
          var a = pointers[ids[0]], b = pointers[ids[1]];
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (self._pinchBase) {
            self.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, self._pinchZoom0 * (d / self._pinchBase)));
            self._clampPan(); self._apply();
          } else { self._pinchBase = d; self._pinchZoom0 = self.zoom; }
          return;
        }
        var w = view.clientWidth || 1, h = view.clientHeight || 1;
        self.panX = ox + dx / w * 100;
        self.panY = oy + dy / h * 100;
        self._clampPan();
        self._apply();
      };
      var end = function (ev) {
        delete pointers[ev.pointerId];
        if (!Object.keys(pointers).length) { dragging = false; self._pinchBase = 0; }
      };
      view.onpointerup = end;
      view.onpointercancel = end;
      view.onwheel = function (ev) {
        ev.preventDefault();
        self.zoomBy(ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
      };
    }
  };

  global.WorldMap = WorldMap;
})(window);
