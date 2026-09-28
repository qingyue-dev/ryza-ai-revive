/* Game state (source: features/talk/models/game_states.dart +
   state_updated_reducer.dart + game_state_authority_mirror.dart).*/
   
(function (global) {
  'use strict';

  var KEY = 'ryza.game.v1';
  var APPLE_SLOTS = 5;
  
  var ITEMS = {
    emeralia: { name: 'Emeralia Grass', value: 12, kind: 'mat' },
    uni: { name: 'Uni', value: 18, kind: 'mat' },
    wasser: { name: 'Distilled Water', value: 6, kind: 'mat' },
    honey: { name: 'Forest Honey', value: 22, kind: 'mat' },
    shell: { name: 'Shining Seashell', value: 16, kind: 'mat' },
    ore: { name: 'Magic Ore Fragment', value: 30, kind: 'mat' },
    mushroom: { name: 'Vitality Mushroom', value: 20, kind: 'mat' },
    driftwood: { name: 'Driftwood', value: 25, kind: 'part' },
    ironwood: { name: 'Hard Ironwood Grain', value: 45, kind: 'part' },
    cloth: { name: 'Sailcloth Scrap', value: 35, kind: 'part' },
    bottle: { name: 'Healing Bottle', value: 60, kind: 'tool', stamina: 25 },
    bomb: { name: 'Bomb Bottle', value: 48, kind: 'tool', battle: 2 },
    charm: { name: 'Lucky Charm Ring', value: 90, kind: 'tool', battle: 3 },
    relic: { name: 'Ancient Relic', value: 150, kind: 'treasure' },
    apple: { name: 'Stamina Apple', value: 40, kind: 'tool', stamina: 999 }
  };
  
  function itemName(id) {
    var base = (ITEMS[id] && ITEMS[id].name) || id;
    return (window.I18n && I18n.tc) ? I18n.tc('item.' + id, base) : base;
  }
  function itemValue(id) { return (ITEMS[id] && ITEMS[id].value) || 10; }

  /* Bag sizes are the four official labels: talk.inventory.bag.* */
  var BAGS = { small: 6, normal: 12, large: 24, huge: 40 };
  var BAG_ORDER = ['small', 'normal', 'large', 'huge'];

  var BAG_UPGRADE_COST = { normal: 150, large: 600, huge: 1500 };

  var DEFAULTS = {
    exp_total: 0,
    stamina: -1,
    money: 30,
    bagYou: 'normal',
    bagRyza: 'normal',
    inventory: [
      { id: 'emeralia', count: 3 },
      { id: 'wasser', count: 2 }
    ],
    ryza_inventory: [
      { id: 'emeralia', count: 2 },
      { id: 'uni', count: 1 },
      { id: 'wasser', count: 3 },
      { id: 'honey', count: 1 }
    ],
    met_charas: [],
    met_pairs: [],
    memory: [],
    flags: {},
    sailed: false
  };

  function levelForExp(exp) {
    return 1 + Math.floor(Math.sqrt(Math.max(0, Number(exp) || 0) / 30));
  }

  function staminaMaxForExpTotal(exp) {
    return Math.min(140, 50 + levelForExp(exp) * 10);
  }
 
  function appleSize() { return Math.ceil(Game.max() / APPLE_SLOTS); }

  function sanitizeList(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (it) {
      if (!it) return;
      var id = typeof it === 'string' ? it : String(it.id || '');
      if (!id) return;
      var count = Math.max(1, Math.min(99, parseInt(it.count != null ? it.count : it.n, 10) || 1));
      var seen = null;
      out.forEach(function (x) { if (x.id === id) seen = x; });
      if (seen) seen.count = Math.min(99, seen.count + count);
      else out.push({ id: id, count: count });
    });
    return out;
  }

  function countOf(list, id) {
    var t = 0;
    list.forEach(function (x) { if (x.id === id) t += x.count; });
    return t;
  }

  var Game = {
    s: null,
    _subs: [],
    ITEMS: ITEMS,
    itemName: itemName,
    itemValue: itemValue,
    BAGS: BAGS,
    BAG_ORDER: BAG_ORDER,
    BAG_UPGRADE_COST: BAG_UPGRADE_COST,
    APPLE_SLOTS: APPLE_SLOTS,

    load: function () {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
      Game.s = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), raw || {});
      if (typeof Game.s.exp_total !== 'number' || !isFinite(Game.s.exp_total)) Game.s.exp_total = 0;
      if (typeof Game.s.money !== 'number' || !isFinite(Game.s.money)) Game.s.money = 0;
      Game.s.inventory = sanitizeList(Game.s.inventory);
      Game.s.ryza_inventory = sanitizeList(Game.s.ryza_inventory);
      Game.s.met_charas = Array.isArray(Game.s.met_charas) ? Game.s.met_charas : [];
      Game.s.met_pairs = Array.isArray(Game.s.met_pairs) ? Game.s.met_pairs : [];
      Game.s.memory = Array.isArray(Game.s.memory) ? Game.s.memory : [];
      Game.s.flags = (Game.s.flags && typeof Game.s.flags === 'object') ? Game.s.flags : {};
      Game.s.sailed = !!Game.s.sailed;
      if (!BAGS[Game.s.bagYou]) Game.s.bagYou = 'normal';
      if (!BAGS[Game.s.bagRyza]) Game.s.bagRyza = 'normal';
      if (Game.s.stamina < 0 || Game.s.stamina > Game.max()) Game.s.stamina = Game.max();
      return Game.s;
    },
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(Game.s)); } catch (e) {}
    },
    on: function (cb) { if (cb) Game._subs.push(cb); },
    emit: function (what) {
      Game._subs.forEach(function (cb) { try { cb(what); } catch (e) {} });
    },
    reset: function () {
      Game.s = JSON.parse(JSON.stringify(DEFAULTS));
      Game.s.stamina = Game.max();
      Game.save();
      Game.emit('reset');
    },

    /* ------------------------------------------------- cheat (stamina + gold only) */
    cheat: function () {
      if (window.CheatEngine) return CheatEngine.master();
      return !!(window.Config && Config.section('app').cheat);
    },
    cheatFreeBuy:  function () { return !!(window.CheatEngine && CheatEngine.freeBuy()); },
    cheatFreeQuest: function () { return !!(window.CheatEngine && CheatEngine.freeQuest()); },
    cheatCurrency: function () { return !!(window.CheatEngine && CheatEngine.unlimCurrency()); },
    cheatStamina: function () { return !!(window.CheatEngine && CheatEngine.unlimStamina()); },
    cheatMaxLv: function () { return !!(window.CheatEngine && CheatEngine.maxLevel()); },
    cheatMap: function () { return !!(window.CheatEngine && CheatEngine.unlockMap()); },

    /* -------------------------------------------------------- level curve */
    level: function () { return Game.cheatMaxLv() ? 99 : levelForExp(Game.s.exp_total); },
    max: function () { return staminaMaxForExpTotal(Game.s.exp_total); },
    expIntoLevel: function () {
      var e = Game.s.exp_total;
      var lower = 30 * Math.pow(Game.level() - 1, 2);
      var upper = 30 * Math.pow(Game.level(), 2);
      return { into: e - lower, span: Math.max(1, upper - lower) };
    },

    /* ----------------------------------------------------------- stamina */
    apples: function () {
      var size = appleSize();
      var filled = Math.ceil(Game.s.stamina / size);
      if (Game.cheat()) filled = APPLE_SLOTS;
      return { filled: Math.min(APPLE_SLOTS, filled), slots: APPLE_SLOTS, size: size };
    },
    turnCost: function (mode, style) {
      if (Game.cheat()) return 0;
      var c = 1;
      if (mode === 'story' || mode === 'immersive') c = 2;
      if (mode === 'asmr') c = 3;
      if (style !== 'text') c += 1;
      return c;
    },
    canAct: function (cost) {
      return Game.cheat() || Game.s.stamina >= Math.max(0, cost | 0);
    },
    spend: function (cost, reason) {
      cost = Math.max(0, cost | 0);
      if (!cost || Game.cheat() || Game.cheatFreeBuy()) return true;
      if (Game.s.stamina < cost) return false;
      Game.s.stamina -= cost;
      Game.save();
      Game.emit('stamina');
      return true;
    },
    restore: function (amount) {
      Game.s.stamina = Util.clamp(Game.s.stamina + (amount | 0), 0, Game.max());
      Game.save();
      Game.emit('stamina');
    },
    refill: function () {
      Game.s.stamina = Game.max();
      Game.save();
      Game.emit('stamina');
    },
    faint: function () { return !Game.cheat() && !Game.cheatStamina() && Game.s.stamina <= 0; },

    /* ---------------------------------------------------------- economy */
    addMoney: function (n) {
      n = Number(n) || 0;
      if ((Game.cheat() || Game.cheatStamina()) && n < 0) return;
      Game.s.money = Math.max(0, Math.round((Game.s.money || 0) + n));
      Game.save();
      Game.emit('money');
    },
    canPay: function (cost) {
      cost = Math.max(0, cost | 0);
      return Game.cheat() || Game.cheatCurrency() || Game.s.money >= cost;
    },
    addExp: function (n) {
      var before = Game.level();
      Game.s.exp_total = Math.max(0, Math.round((Game.s.exp_total || 0) + (Number(n) || 0)));
      var after = Game.level();
      if (after > before) {
        /* cap grows with level: give the new headroom (official feels the same) */
        Game.s.stamina = Util.clamp(Game.s.stamina + 10 * (after - before), 0, Game.max());
        Game.remember(I18n.tf ? I18n.tf('mem.lv', 'Lv{lv} reached!', { lv: after }) : 'Lv' + after + ' reached!');
      }
      Game.save();
      Game.emit('exp');
      return after > before;
    },

    /* ------------------------------------------------------------ bags */
    bagList: function (which) {
      return which === 'ryza' ? Game.s.ryza_inventory : Game.s.inventory;
    },
    bagCap: function (which) {
      return BAGS[which === 'ryza' ? Game.s.bagRyza : Game.s.bagYou] || BAGS.normal;
    },
    bagUsed: function (which) { return Game.bagList(which).length; },
    addItem: function (which, id, count) {
      id = String(id || '').trim();
      if (!id) return false;
      var list = Game.bagList(which);
      var slot = null;
      list.forEach(function (x) { if (x.id === id) slot = x; });
      if (slot) {
        slot.count = Math.min(99, slot.count + (count || 1));
      } else {
        if (list.length >= Game.bagCap(which)) {
          /* full bag: fold into any existing stack, else refuse */
          if (list.length) list[0].count = Math.min(99, list[0].count + (count || 1));
          else return false;
        } else {
          list.push({ id: id, count: count || 1 });
        }
      }
      Game.save();
      Game.emit('inventory');
      return true;
    },
    removeItem: function (which, id, count) {
      count = Math.max(1, count || 1);
      var list = Game.bagList(which);
      var have = countOf(list, id);
      if (have < count) return false;
      var left = count, out = [];
      list.forEach(function (x) {
        if (x.id === id && left > 0) {
          var take = Math.min(left, x.count);
          left -= take;
          if (x.count - take > 0) out.push({ id: x.id, count: x.count - take });
          return;
        }
        out.push(x);
      });
      if (which === 'ryza') Game.s.ryza_inventory = out; else Game.s.inventory = out;
      Game.save();
      Game.emit('inventory');
      return true;
    },
    countItem: function (which, id) { return countOf(Game.bagList(which), id); },
    upgradeBag: function (which) {
      var cur = which === 'ryza' ? Game.s.bagRyza : Game.s.bagYou;
      var idx = BAG_ORDER.indexOf(cur);
      if (idx < 0 || idx >= BAG_ORDER.length - 1) return false;
      var next = BAG_ORDER[idx + 1];
      var cost = BAG_UPGRADE_COST[next] || 0;
      if (!Game.canPay(cost)) return false;
      Game.addMoney(-cost);
      if (which === 'ryza') Game.s.bagRyza = next; else Game.s.bagYou = next;
      Game.save();
      Game.emit('inventory');
      return true;
    },

    /* ----------------------------------------------------- world / people */
    meetCharas: function (npcList, day) {
      var added = [];
      (npcList || []).forEach(function (n) {
        if (!n || !n.id) return;
        if (Game.s.met_charas.indexOf(n.id) === -1) {
          Game.s.met_charas.push(n.id);
          added.push(n.name || n.id);
        }
      });
      for (var i = 0; i < (npcList || []).length; i++) {
        for (var j = i + 1; j < npcList.length; j++) {
          var pair = [npcList[i].id, npcList[j].id].sort().join('|');
          if (Game.s.met_pairs.indexOf(pair) === -1) Game.s.met_pairs.push(pair);
        }
      }
      if (added.length) { Game.save(); Game.emit('met'); }
      return added;
    },
    remember: function (line) {
      line = String(line || '').trim();
      if (!line) return;
      Game.s.memory.push({ at: Date.now(), text: line.slice(0, 120) });
      if (Game.s.memory.length > 80) Game.s.memory = Game.s.memory.slice(-80);
      Game.save();
      Game.emit('memory');
    },

    /* ------------------------------------------------------- flag helpers */
    flag: function (k, dv) {
      var v = Game.s.flags[k];
      return v === undefined ? (dv || 0) : v;
    },
    setFlag: function (k, v) {
      Game.s.flags[k] = v;
      Game.save();
      Game.emit('flags');
    },

    /* ------------------------------------------------------------- reducer
       Accepts the recovered wire keys (aliases below) from either channel.
       Quest-level keys (`quest`) are re-routed through Quests.onQuestDelta
       when that module exists, so quest lifecycle stays in one place. */
    applyDelta: function (d, origin) {
      if (!d || typeof d !== 'object') return null;
      var applied = [];
      var num = function (v) {
        var n = Number(v);
        return isFinite(n) ? Math.round(n) : 0;
      };

      if (d.stamina_delta != null) {
        var sd = num(d.stamina_delta);
        if (sd > 0) { Game.restore(Math.min(sd, Game.max())); applied.push('stamina+' + sd); }
        else if (sd < 0 && !Game.cheat()) {
          Game.s.stamina = Util.clamp(Game.s.stamina + sd, 0, Game.max());
          Game.save(); Game.emit('stamina');
          applied.push('stamina' + sd);
        }
      }
      if (d.exp_delta != null) {
        Game.addExp(Util.clamp(num(d.exp_delta), -500, 500));
        applied.push('exp' + (num(d.exp_delta) >= 0 ? '+' : '') + num(d.exp_delta));
      }
      if (d.money_delta != null) {
        var md = Util.clamp(num(d.money_delta), -2000, 2000);
        Game.addMoney(md);
        applied.push('money' + (md >= 0 ? '+' : '') + md);
      }
      [['inventory_added', 'you'], ['ryza_inventory_added', 'ryza']].forEach(function (pair) {
        ((Array.isArray(d[pair[0]]) && d[pair[0]]) || []).forEach(function (it) {
          if (!it || (typeof it !== 'string' && typeof it !== 'object')) return;
          var id = typeof it === 'string' ? it : it.id;
          if (Game.addItem(pair[1], id, typeof it === 'object' ? it.count : 1)) {
            applied.push(pair[0] + ':' + id);
          }
        });
      });
      [['inventory_removed', 'you'], ['ryza_inventory_removed', 'ryza']].forEach(function (pair) {
        ((Array.isArray(d[pair[0]]) && d[pair[0]]) || []).forEach(function (it) {
          if (!it || (typeof it !== 'string' && typeof it !== 'object')) return;
          var id = typeof it === 'string' ? it : it.id;
          if (Game.removeItem(pair[1], id, typeof it === 'object' ? it.count : 1)) {
            applied.push(pair[0] + ':' + id);
          }
        });
      });
      if (Array.isArray(d.met_chara_add)) {
        Game.meetCharas(d.met_chara_add.map(function (x) {
          return typeof x === 'string' ? { id: x, name: x } : x;
        }));
        applied.push('met');
      }
      if (Array.isArray(d.memory_add)) {
        d.memory_add.forEach(function (m) { Game.remember(m); });
        applied.push('memory');
      }
      if (d.quest && window.Quests && Quests.onQuestDelta) {
        Quests.onQuestDelta(d.quest, origin || 'remote');
        applied.push('quest');
      }
      Game.emit('delta');
      return applied;
    },

    /* -------------------------------------------------------- prompt block */
    promptBlock: function () {
      var s = Game.s;
      var L = [];
      var invBrief = function (list) {
        if (!list.length) return '（空）';
        return list.map(function (x) { return itemName(x.id) + '×' + x.count; }).join('、');
      };
      L.push('## Game State');
      L.push('- Level ' + Game.level() + ' (Total EXP ' + s.exp_total + ')');
      L.push('- Stamina ' + (Game.cheat() ? '∞' : (s.stamina + '/' + Game.max())) + ': Decreases through activities and battles. If it reaches zero, I’ll pass out.');
      L.push('- Money ' + (Game.cheat() ? '∞' : (s.money + 'G')) + ' (Currency used in this world)');
      L.push('- Your Bag: ' + invBrief(s.inventory));
      L.push('- My Bag: ' + invBrief(s.ryza_inventory));
      L.push('- People Met: ' + s.met_charas.length);
      if (s.memory.length) {
        L.push('- Memories (Excerpt): ' + s.memory.slice(-6).map(function (m) { return m.text; }).join(' / '));
      }
      return L.join('\n');
    },

    /* Save-slot integration. */
    snapshot: function () { return JSON.parse(JSON.stringify(Game.s)); },
    restoreSnapshot: function (snap) {
      if (!snap) return;
      Game.s = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), snap);
      Game.save();
      Game.emit('reset');
    }
  };

  global.Game = Game;
})(window);
