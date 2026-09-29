/* Quest engine */
   
(function (global) {
  'use strict';

  /* definitions */
  var CHAIN = [
    { no: 1, type: 'talk', title: 'Start With A Conversation',
    desc: 'Talk with Ryza and get to know each other better.',
    goal: 'Talk with Ryza 4 times', need: 4, cost: 1 },

    { no: 2, type: 'explore', title: 'Explore Every Corner Of The Island',
    desc: 'Open the world map and travel to a different location.',
    goal: 'Travel to a different stage 2 times', need: 2, cost: 2 },

    { no: 3, type: 'gather', title: 'An Adventure For Gathering Materials',
    desc: 'Gather materials for your adventure and fill your bag with supplies.',
    goal: 'Collect 3 materials', need: 3, cost: 3 },

    { no: 4, type: 'craft', title: 'Your First Synthesis',
    desc: 'Use the materials you gathered and try synthesis together with me!',
    goal: 'Successfully complete synthesis 1 time', need: 1, cost: 3 },

    { no: 5, type: 'battle', title: 'Monsters Blocking The Way',
    desc: 'A monster has appeared along the way. Use your synthesized items and fight your way through.',
    goal: 'Win 1 battle', need: 1, cost: 4 },

    { no: 6, type: 'shop', title: 'Run A Shop For A Day',
    desc: 'Put your unwanted items up for sale and earn some pocket money.',
    goal: 'Sell an item at the shop', need: 1, cost: 4 },

    { no: 7, type: 'build', title: 'Gather Ship Materials And Build A Ship',
    desc: '“First, we need to get a ship.” Apparently, it requires 4 different parts.',
    goal: 'Collect all 4 ship parts', need: 4, cost: 5 },

    { no: 8, type: 'sail', title: 'Set Sail And Explore Freely',
    desc: 'Complete the ship and sail beyond Kurken Island! The world map will be unlocked.',
    goal: 'Set sail with 200G', need: 1, cost: 2 }
  ];

  var TYPE_ICON = {
    talk: 'chara', explore: 'world_map', gather: 'bag', craft: 'cauldron',
    battle: 'fire', shop: 'shop', build: 'asterisk', sail: 'quest_map_ai'
  };

  var PRAISES = [
    'Amazing, congratulations on completing the quest!',
    'Let’s do our best on the next quest too!',
    'Amazing! What kind of adventure should we have next?'
  ];

  /* Side-quest pool (fallback + 「Let Ryza think of one」*/
  var POOL = [
    { type: 'craft',   title: 'A New Recipe', desc: 'Come up with a synthesis we have never made before together with Ryza.', goal: 'Successfully complete synthesis 1 time', need: 1, cost: 3 },

    { type: 'gather', title: 'Materials From The Water Source', desc: 'Search for new materials around the Water Source Cliffs.', goal: 'Collect 2 materials', need: 2, cost: 3 },

    { type: 'explore', title: 'Let’s Go See The Stars', desc: 'Walk together to the Stargazing Heights in the Kark Isles at night.', goal: 'Travel to a nighttime stage', need: 1, cost: 2 },

    { type: 'battle',  title: 'Residents Of The Abandoned Village', desc: 'Defeat whatever gets in our way in the forgotten abandoned village.', goal: 'Win 1 battle', need: 1, cost: 4 },

    { type: 'shop', title: 'A Day Of Traveling Sales', desc: 'Why don’t we try doing a little business at the harbor plaza?', goal: 'Sell an item at the shop', need: 1, cost: 4 },

    { type: 'talk', title: 'Remembering The Past', desc: 'Take some time to remember the day we first met.', goal: 'Talk with Ryza 3 times', need: 3, cost: 1 },

    { type: 'gather', title: 'Looking For A Snack', desc: 'Gather ingredients for something sweet and make a snack for me.', goal: 'Collect 2 materials', need: 2, cost: 2 },

    { type: 'explore', title: 'Exploring The Ruins', desc: 'Let’s explore together all the way to the depths of the Sealed Sanctuary.', goal: 'Travel to a different stage', need: 1, cost: 3 }
  ];

  /* Deterministic action tables — so the game plays with no LLM key. */
  var AREA_LOOT = {
    area_01: ['emeralia', 'uni', 'wasser', 'honey', 'shell', 'mushroom', 'driftwood'],
    area_02: ['ore', 'wasser', 'shell', 'ironwood', 'emeralia'],
    area_03: ['honey', 'mushroom', 'ironwood', 'emeralia', 'cloth'],
    area_04: ['ore', 'cloth', 'charm', 'mushroom'],
    area_05: ['relic', 'cloth', 'ore', 'ironwood']
  };
  var RECIPES = [
    { out: 'bottle', name: 'Healing Bottle', in: [['emeralia', 1], ['wasser', 1]] },
    { out: 'bomb', name: 'Bomb Bottle', in: [['uni', 1], ['wasser', 1], ['ore', 1]] },
    { out: 'charm', name: 'Lucky Charm Ring', in: [['relic', 1], ['cloth', 1]] }
  ];
  var PART_ITEMS = ['driftwood', 'ironwood', 'cloth', 'ore'];
  var PART_NAMES = {
    driftwood: 'Ship Keel Timber',
    ironwood: 'Sturdy Mast Wood',
    cloth: 'Large Sailcloth',
    ore: 'Magic Stone Fastener'
  };
  var MONSTERS = [
    { i: 1, name: 'Fluffy', area: 1 },
    { i: 2, name: 'Big Horn', area: 1 },
    { i: 3, name: 'Lava Crab', area: 2 },
    { i: 4, name: 'Forest Guardian', area: 3 },
    { i: 5, name: 'Ancient Ruins Guardian', area: 4 },
    { i: 6, name: 'Frostfall Dragon', area: 5 }
  ];

  function itemName(id) { return Game.itemName(id); }
  function nowQuest() { return Game.s.quest || null; }
  function setQuest(q) { Game.s.quest = q; Game.save(); Game.emit('quest'); }
  function L(key, fb) { return (window.I18n && I18n.tc) ? I18n.tc(key, fb) : fb; }
  function TF(key, fb, map) {
    return (window.I18n && I18n.tf) ? I18n.tf(key, fb, map) : fb;
  }

  /* host-injected ports */
  var _celebrate = null;
  var _present = null;
  var _generate = null;
  var _notice = null;
  var _navigate = null;

  function celebrate() {
    if (!_celebrate) return;
    try { _celebrate(); } catch (e) { }
  }

  function notify(msg, isErr) {
    if (!_notice) return;
    try { _notice(msg, !!isErr); } catch (e) { }
  }

  var Quests = {
    PRAISES: PRAISES,
    CHAIN: CHAIN,

    /* lifecycle */
    ensure: function () {
      if (!Game.s.quest) Quests.startNo(Game.flag('quest_no', 0) + 1 || 1);
      return Game.s.quest;
    },
    active: function () { return Game.s.quest || null; },
    isSide: function (q) { q = q || nowQuest(); return !!q && q.no > 8; },

    startNo: function (no) {
      var def = CHAIN[no - 1];
      var q;
      if (def) {
        q = JSON.parse(JSON.stringify(def));
        q.k = 'q.' + no;
      } else {
        q = JSON.parse(JSON.stringify(POOL[Math.floor(Math.random() * POOL.length)]));
        q.k = 'pq.' + (1 + Math.floor(Math.random() * POOL.length));
        q.no = 100 + (Game.flag('side_done', 0));
        q.type = q.type || 'talk';
      }
      q.step = 0;
      q.complete = false;
      q.side = no > 8;
      q.obstacle = Quests._obstacle(q);
      q.reward = { exp: 30 + Math.min(no, 8) * 15, money: 20 + Math.min(no, 8) * 20 };
      Game.setFlag('quest_no', no);
      setQuest(q);
      return q;
    },

    /* live text (re-resolves when the UI language changes). */
    keyOf: function (q) {
      if (!q) return '';
      if (q.k) return q.k;
      return q.side ? '' : 'q.' + q.no;
    },
    titleOf: function (q) { return q ? L(Quests.keyOf(q) + '.title', q.title) : ''; },
    descOf: function (q) { return q ? L(Quests.keyOf(q) + '.desc', q.desc) : ''; },
    goalOf: function (q) { return q ? L(Quests.keyOf(q) + '.goal', q.goal) : ''; },
    generate: function (useLLM) {
      if (!useLLM || !window.Config || !Config.section('llm').apiKey) {
        var q = Quests.startNo(9);
        return Promise.resolve(q);
      }
      if (typeof _generate !== 'function') {
        return Promise.resolve(Quests.startNo(9));
      }
      return _generate([], [
        'Generate one RPG quest to play with Ryza.',
        'Output ONLY the following JSON (no explanation):',
        '{"type":"talk|explore|gather|craft|battle|shop","title":"...","desc":"...","goal":"...","need":2,"cost":3}',
        'type must be exactly one of: talk/explore/gather/craft/battle/shop.',
        'need is 2-5, cost is 1-5.',
        'Write title/desc/goal in ' + ((window.I18n && I18n.LANG_NAMES && window.Langs) ? (I18n.LANG_NAMES[Langs.llm()] || Langs.llm()) : 'English') + '. If the user has been writing in a different language, use that language instead.'
      ].join('\n'), { mode: 'chat', style: 'text', standalone: true }).then(function (r) {
        var m = /\{[\s\S]*\}/.exec(r.text || '');
        if (!m) throw new Error('bad quest json');
        var j = JSON.parse(m[0]);
        var qq = Quests.startNo(9);
        qq.type = (j.type && TYPE_ICON[j.type]) ? j.type : 'talk';
        qq.title = String(j.title || qq.title).slice(0, 40);
        qq.desc = String(j.desc || '').slice(0, 120);
        qq.goal = String(j.goal || qq.goal).slice(0, 60);
        qq.need = Util.clamp(parseInt(j.need, 10) || 2, 1, 8);
        qq.cost = Util.clamp(parseInt(j.cost, 10) || 3, 1, 6);
        qq.obstacle = Quests._obstacle(qq);
        setQuest(qq);
        return qq;
      }).catch(function () { return Quests.startNo(9); });
    },

    _obstacle: function (q) {
      var byType = {
        gather: 'It seems you have to go a little deeper to find good materials.',
        craft: 'Mixing ingredients is prone to failure, so let\'s gather plenty of materials beforehand.',
        battle: 'Oh, if a strong one shows up, you can run away... probably.',
        shop: 'It\'s uncertain whether it will sell, but we won\'t know unless we try!',
        build: 'All the parts are huge, and it doesn\'t look like we can carry them all in one trip.',
        explore: 'The roads have been looking a bit strange lately.',
        talk: '',
        sail: 'We need funds to set sail. Let\'s earn some money at the shop.'
      };
      var fb = byType[q.type] || '';
      return L('qobs.' + q.type, fb);
    },

    /* progression */
    progressEvent: function (what, amount) {
      var q = nowQuest();
      if (!q || q.complete) return null;
      var hit =
        (what === 'talk'   && q.type === 'talk') ||
        (what === 'explore'&& q.type === 'explore');
      if (!hit) return null;
      q.step = Math.min(q.need, (q.step | 0) + (amount || 1));
      if (q.step >= q.need) return Quests.clear();
      setQuest(q);
      return q;
    },

    onQuestDelta: function (d, origin) {
      if (!d || typeof d !== 'object') return null;
      var q = nowQuest();
      if (!q) { Quests.ensure(); q = nowQuest(); }
      var touched = false;
      if (d.step_add != null) {
        q.step = Util.clamp((q.step | 0) + (parseInt(d.step_add, 10) || 0), 0, q.need);
        touched = true;
      }
      if (d.progress != null && d.step_add == null) {
        q.step = Util.clamp(parseInt(d.progress, 10) || 0, 0, q.need);
        touched = true;
      }
      ['desc', 'goal', 'obstacle', 'activity'].forEach(function (k) {
        if (typeof d[k] === 'string' && d[k]) { q[k === 'activity' ? 'activity' : k] = d[k].slice(0, 160); touched = true; }
      });
      if (touched) setQuest(q);
      if (d.complete === true || q.step >= q.need) {
        if (!q.complete) Quests.clear();
      }
      return q;
    },

    clear: function () {
      var q = nowQuest();
      if (!q || q.complete) return q;
      q.complete = true;
      var reward = q.reward || { exp: 30, money: 20 };
      Game.addExp(reward.exp);
      Game.addMoney(reward.money);
      Game.remember(TF('mem.cleared', '「{title}」Clear！ +{exp}EXP / +{money}G',
        { title: Quests.titleOf(q), exp: reward.exp, money: reward.money }));
      var log = Game.s.flags.quest_log || [];
      log.push({ no: q.no, type: q.type, title: q.title, at: Date.now() });
      if (log.length > 40) log = log.slice(-40);
      Game.s.flags.quest_log = log;
      if (q.no > 8) Game.setFlag('side_done', Game.flag('side_done', 0) + 1);
      setQuest(q);
      celebrate();
      Quests.showClear(q);
      if (q.no === 8) Game.s.sailed = true;
      Game.save();
      Quests._pendingAdvance = true;
      return q;
    },

    /* Called from App after the clear overlay is acknowledged. */
    takeNext: function () {
      if (!Quests._pendingAdvance) { Quests.ensure(); return nowQuest(); }
      Quests._pendingAdvance = false;
      var prev = nowQuest();
      var no = prev ? prev.no + 1 : 1;
      if (no > 8) return Quests.startNo(9);
      return Quests.startNo(no);
    },

    pendingAdvance: function () { return !!Quests._pendingAdvance; },

    /* action engine */
    doAction: function (actType, ctx) {
      var q = nowQuest();
      ctx = ctx || {};
      if (!q || q.complete) return { ok: false, line: L('qact.noquest', 'There are no quests right now. Let\'s have you come up with a new theme.') };
      /* 免费任务作弊：不消耗体力 */
      var _freeStam = !!(window.Game && Game.cheatFreeQuest && Game.cheatFreeQuest());
      if (!_freeStam && !Game.canAct(q.cost)) return { ok: false, faint: true, line: L('qact.hungry', '……I\'m hungry. I want to go to a safe place and sleep before I pass out.…') };

      var match = (actType || q.type);
      if (match !== q.type) return { ok: false, line: L('qact.mismatch', 'Did you want to do something different from the current quest?') };
      if (!_freeStam && !Game.spend(q.cost, 'quest')) return { ok: false, faint: true, line: 'I don\'t have enough stamina.…' };
      var fn = Quests['act_' + q.type];
      var res = fn ? fn(q, ctx) : { ok: false, line: 'It seems like it\'s not possible yet.' };
      if (res && res.ok) {
        setQuest(q);
        if (q.step >= q.need && !q.complete) Quests.clear();
      }
      Game.emit('quest');
      return res;
    },

    act_talk: function (q) {
      return { ok: false, line: L('qact.talk.hint', 'This is a quest that progresses through conversation. Talk to me?') };
    },
    act_explore: function (q) {
      return { ok: false, line: L('qact.explore.hint', 'It progresses each time you move off the world map.') };
    },
    act_gather: function (q) {
      var area = ctx_area(q);
      var table = AREA_LOOT[area] || AREA_LOOT.area_01;
      var got = [];
      var n = 1 + (Math.random() < 0.45 ? 1 : 0);
      for (var i = 0; i < n; i++) {
        var id = table[Math.floor(Math.random() * table.length)];
        if (Game.addItem('you', id, 1)) got.push(itemName(id));
      }
      if (!got.length) return { ok: false, line: L('qact.gather.full', 'My bag is overflowing... I need to sell some things I don\'t need to fit everything in.') };
      q.step = Math.min(q.need, (q.step | 0) + got.length);
      Game.addExp(6);
      var done = q.step >= q.need;
      var tail = done ? L('qact.gather.done', 'This is enough!') : TF('qact.gather.more', 'Only {n} more to go!', { n: q.need - q.step });
      return { ok: true, done: done,
        line: TF('qact.gather.ok', 'Yay, I got {items}! {tail}', { items: got.join('、'), tail: tail }) };
    },
    act_craft: function (q) {
      var made = null, fail = null;
      for (var i = 0; i < RECIPES.length; i++) {
        var r = RECIPES[i];
        var haveAll = r.in.every(function (pair) {
          return Game.countItem('you', pair[0]) >= pair[1];
        });
        if (haveAll) { made = r; break; }
        if (!fail) fail = r;
      }
      if (!made) {
        var need = fail ? fail.in.map(function (p) { return itemName(p[0]) + '×' + p[1]; }).join('、') : itemName('emeralia');
        return { ok: false, refund: true, line: TF('qact.craft.lack', 'Hmm, it looks like we\'re missing {need}. Let\'s go collect some.', { need: need }) };
      }
      made.in.forEach(function (pair) { Game.removeItem('you', pair[0], pair[1]); });
      Game.addItem('you', made.out, 1);
      q.step = Math.min(q.need, (q.step | 0) + 1);
      Game.addExp(14);
      return { ok: true, done: q.step >= q.need,
        line: TF('qact.craft.ok', 'Ready... Done! {item}! Haven\'t I gotten better at compounding?', { item: itemName(made.out) }) };
    },
    act_battle: function (q) {
      var area = Number(/area_(\d+)/.exec(ctx_area(q))[1]) || 1;
      var mobs = MONSTERS.filter(function (m) { return m.area === area; });
      var mi = Math.floor(Math.random() * (mobs.length || MONSTERS.length));
      var mob = (mobs.length ? mobs : MONSTERS)[mi];
      var mobName = TF('mob.' + mob.i, mob.name, {});
      var odds = 0.30 + 0.06 * Game.level();
      var tools = [];
      ['bomb', 'charm', 'bottle'].forEach(function (t) {
        var n = Game.countItem('you', t);
        if (t === 'bomb' && n > 0) { odds += 0.18; tools.push(itemName('bomb')); Game.removeItem('you', t, 1); }
        else if (t === 'charm' && n > 0) { odds += 0.12; }
        else if (t === 'bottle' && n > 0 && Game.s.stamina < Game.max() / 2) {
          Game.removeItem('you', t, 1); Game.restore(Game.ITEMS.bottle.stamina); tools.push(itemName('bottle'));
        }
      });
      var win = Math.random() < Util.clamp(odds, 0.1, 0.92);
      if (win) {
        var money = 20 + Math.floor(Math.random() * 40) + area * 10;
        Game.addMoney(money);
        Game.addExp(18 + area * 8);
        q.step = Math.min(q.need, (q.step | 0) + 1);
        return { ok: true, done: q.step >= q.need,
          line: TF('qact.battle.win', 'Yay, I defeated the {mob}! It dropped {money}G. {tools}', { mob: mobName, money: money, tools: tools.length ? '（' + tools.join('・') + '）' : '' }) };
      }
      Game.addExp(5);
      return { ok: false, spent: true, done: false,
        line: TF('qact.battle.lose', 'Ugh... {mob} is too strong. I\'ll try again.', { mob: mobName }) };
    },
    act_shop: function (q) {
      var list = Game.s.inventory.slice().sort(function (a, b) {
        return itemValue(a.id) - itemValue(b.id);
      });
      var sold = [], take = 0;
      for (var i = 0; i < list.length && sold.length < 3; i++) {
        var it = list[i];
        if ((Game.ITEMS[it.id] || {}).kind !== 'mat') continue;
        var n = Math.min(it.count, 2);
        if (!Game.removeItem('you', it.id, n)) continue;
        take += n * Math.round(itemValue(it.id) * (1 + Math.random() * 0.6));
        sold.push(itemName(it.id) + '×' + n);
      }
      if (!sold.length) return { ok: false, refund: true, line: L('qact.shop.empty', 'I don\'t have any inventory to sell... Should I go gather some materials?') };
      Game.addMoney(take);
      Game.addExp(16);
      q.step = Math.min(q.need, (q.step | 0) + 1);
      return { ok: true, done: q.step >= q.need,
        line: TF('qact.shop.ok', 'Open for business! We sold {items} and earned +{money}G. Maybe we\'re talented!', { items: sold.join('、'), money: take }) };
    },
    act_build: function (q) {
      var partsDone = Game.flag('ship_parts', 0);
      if (partsDone >= 4) return { ok: false, line: L('qact.build.done', 'All the parts are ready! Next up is "Let\'s travel freely by ship!"') };
      var want = PART_ITEMS[partsDone];
      var have = Game.countItem('you', want) + Game.countItem('ryza', want);
      if (have <= 0) {
        return { ok: false, refund: true,
          line: TF('qact.build.lack', 'It looks like shipbuilding requires {part} ({item}). I\'ll go find some!', { part: L('part.' + want, PART_NAMES[want]), item: itemName(want) }) };
      }
      if (!Game.removeItem('you', want, 1)) Game.removeItem('ryza', want, 1);
      Game.setFlag('ship_parts', partsDone + 1);
      Game.addExp(12);
      q.step = Math.min(q.need, partsDone + 1);
      return { ok: true, done: q.step >= q.need,
        line: TF('qact.build.ok', '「{part}」Attached! The ship is starting to take shape. Just {n} more to go!', { part: L('part.' + want, PART_NAMES[want]), n: 4 - q.step }) };
    },
    act_sail: function (q) {
      if (Game.flag('ship_parts', 0) < 4) {
        return { ok: false, refund: true, line: L('qact.sail.parts', 'We still don\'t have enough parts! Let\'s get back to the shipbuilding quest.') };
      }
      if (!Game.canPay(200)) {
        return { ok: false, refund: true, line: L('qact.sail.money', 'It seems we need 200G to set sail. Let\'s open a shop and make some money!') };
      }
      Game.addMoney(-200);
      q.step = q.need;
      var cleared = Quests.clear();
      return { ok: true, done: true, sail: true, quest: cleared,
        line: L('qact.sail.ok', 'It\'s time to depart! Leaving Kuken Island behind, I embark on a journey of freedom. The door to the world has opened!') };
    },

    /* refund */
    refundAction: function (res) {
      if (res && !res.ok && !res.spent && !res.faint) {
        var q = nowQuest();
        if (q) Game.restore(q.cost);
      }
    },

    /* sheet UI */
    setCelebrate: function (fn) { _celebrate = (typeof fn === 'function') ? fn : null; },
    setPresenter: function (fn) { _present = (typeof fn === 'function') ? fn : null; },
    setGenerator: function (fn) { _generate = (typeof fn === 'function') ? fn : null; },
    setNotice: function (fn) { _notice = (typeof fn === 'function') ? fn : null; },
    setNavigator: function (fn) { _navigate = (typeof fn === 'function') ? fn : null; },

    render: function (root, hooks) {
      if (!root) return;
      root.innerHTML = '';
      var q = Quests.ensure();
      var card = document.createElement('div');
      card.className = 'qcard';
      var icon = 'assets/icons/' + (TYPE_ICON[q.type] || 'quest') + '.svg';
      card.innerHTML =
        '<div class="qcard-top"><img class="qico" alt="">' +
        '<div class="qhead"><div class="qtitle"></div><div class="qno"></div></div></div>' +
        '<div class="qdesc"></div>' +
        '<div class="qgoal"><span class="qgoal-t"></span><span class="qgoal-v"></span></div>' +
        '<div class="qobs"></div>' +
        '<div class="qbar"><i></i></div>' +
        '<div class="qacts"></div>';
      card.querySelector('.qico').src = icon;
      card.querySelector('.qtitle').textContent = Quests.titleOf(q);
      card.querySelector('.qno').textContent = q.no <= 8 ? (I18n.t('quest.no') + ' ' + q.no + ' / 8' + (q.side ? '' : '')) : I18n.t('quest.side');
      card.querySelector('.qdesc').textContent = Quests.descOf(q);
      card.querySelector('.qgoal-t').textContent = I18n.t('quest.goal') + '：';
      card.querySelector('.qgoal-v').textContent = Quests.goalOf(q) + '（' + (q.step | 0) + '/' + q.need + '）';
      card.querySelector('.qobs').textContent = L('qobs.' + q.type, q.obstacle || '');
      card.querySelector('.qbar i').style.width = Math.round(((q.step | 0) / Math.max(1, q.need)) * 100) + '%';

      var acts = card.querySelector('.qacts');
      var actLabel = I18n.t('quest.act.' + q.type);
      if (actLabel.indexOf('quest.act.') === 0) actLabel = '';
      if (!q.complete && actLabel) {
        var act = document.createElement('button');
        act.className = 'mini-btn primary';
        
        /* 同上，按钮上显示 FREE */
        var _isFreeQ = !!(window.Game && Game.cheatFreeQuest && Game.cheatFreeQuest());
        act.textContent = actLabel + (_isFreeQ ? '（FREE ✨）' : '（' + I18n.t('quest.cost') + ' ' + q.cost + '）');
        act.onclick = function () {
          var res = Quests.doAction(q.type, hooks || {});
          Quests.refundAction(res);
          if (res && _present) { try { _present(res); } catch (e) { } }
          Quests.render(root, hooks);
          if (Quests.pendingAdvance() && hooks && hooks.cleared) hooks.cleared(nowQuest());
        };
        acts.appendChild(act);
      }
      if (Quests.isSide(q) || q.no >= 8) {
        var gen = document.createElement('button');
        gen.className = 'mini-btn';
        gen.textContent = I18n.t('quest.auto');
        gen.onclick = function () {
          var hasKey = !!(window.Config && Config.section('llm').apiKey);
          if (hasKey) notify(I18n.t('toast.questGen'));
          Quests.generate(hasKey).then(function () {
            notify(I18n.t('quest.newOk') + '「' + Quests.titleOf(Quests.active()) + '」');
            Quests.render(root, hooks);
          });
        };
        acts.appendChild(gen);
      }
      root.appendChild(card);

      if (q.no >= 7 && !Game.s.sailed) {
        var ship = document.createElement('div');
        ship.className = 'qship';
        var parts = Game.flag('ship_parts', 0);
        ship.innerHTML = '<span>' + I18n.t('quest.ship') + '</span>' +
          PART_ITEMS.map(function (_, i) {
            return '<img alt="" src="assets/icons/' + (i < parts ? 'check' : 'lock') + '.svg">';
          }).join('');
        root.appendChild(ship);
      }

      /* History list. */
      var log = (Game.s.flags.quest_log || []).slice(-6).reverse();
      if (log.length) {
        var h = document.createElement('div');
        h.className = 'qhist-title';
        h.textContent = I18n.t('quest.history');
        root.appendChild(h);
        log.forEach(function (x) {
          var row = document.createElement('div');
          row.className = 'qhist';
          row.innerHTML = '<img alt="" src="assets/icons/quest_clear_icon.svg"><span></span>';
          row.querySelector('span').textContent =
            x.no <= 8 ? L('q.' + x.no + '.title', x.title) : x.title;
          root.appendChild(row);
        });
      }
    },

    showClear: function (q) {
      var ov = document.getElementById('overlay-quest-clear');
      if (!ov) return;
      ov.classList.remove('hidden');
      var t = ov.querySelector('.qc-title');
      if (t) t.textContent = (q && q.title) || '';
      var p = ov.querySelector('.qc-praise');
      if (p) {
        var pi = Math.floor(Math.random() * PRAISES.length);
        p.textContent = L('pr.' + pi, PRAISES[pi]);
      }
    },

    /* prompt block */
    promptBlock: function () {
      var q = Quests.ensure();
      var L = [];
      L.push('## Quest (We\'ll share the progress. Let me know in <state> when you complete it.)');
      L.push('- No.' + q.no + '「' + Quests.titleOf(q) + '」kind=' + q.type);
      L.push('  Goal：' + Quests.goalOf(q) + '（progress ' + (q.step | 0) + '/' + q.need + '）');
      L.push('  Detail：' + Quests.descOf(q) + (q.obstacle ? ' / hindrance：' + q.obstacle : ''));
      if (!Game.s.sailed) {
        L.push('- I\'m still on Kuken Island. The rest of the world map is locked until the ship (No. 8) is built.');
        L.push('- Shipbuilding parts：' + Game.flag('ship_parts', 0) + '/4。');
      } else {
        L.push('- I\'ve acquired a ship and set sail around the world. I can go to any area.');
      }
      return L.join('\n');
    }
  };

  function ctx_area() {
    var st = (window.Config && Config.section('state')) || {};
    var m = /^stage_(\d\d)_/.exec(st.stage || 'stage_01_001_04');
    return m ? ('area_' + m[1]) : 'area_01';
  }
  function itemValue(id) { return Game.itemValue(id); }

  /* welcome mission board */
  var WM_MISSION_TEXT = {
    mission_clear: { ja: 'ミッションを3つクリアしよう', zh: '完成 3 次任务', en: 'Achieve mission 3 times' },
    touch: { ja: 'ライザを触ってみる', zh: '摸一下莱莎', en: 'Touch Ryza' },
    talk: { ja: 'キャラと5回会話してみよう', zh: '与角色对话 5 次', en: 'Talk with a character 5 times' },
    login_bonus: { ja: 'ログインボーナスを受け取ろう', zh: '领取登录奖励', en: 'Get a logged in bonus' }
  };

  var WM_GROUPS = [
    { id: 'crf_msng_001', title: 'Step 1', day: 0,
      missions: [
        { id: 'crf_msn_001_0001', activity: 'mission_clear', need: 3 },
        { id: 'crf_msn_001_0002', activity: 'touch', need: 1 },
        { id: 'crf_msn_001_0003', activity: 'talk', need: 5 },
        { id: 'crf_msn_001_0004', activity: 'login_bonus', need: 1 }
      ] },
    { id: 'crf_msng_002', title: 'Step 2', day: 3,
      missions: [
        { id: 'crf_msn_002_0001', activity: 'mission_clear', need: 3 },
        { id: 'crf_msn_002_0002', activity: 'touch', need: 1 },
        { id: 'crf_msn_002_0003', activity: 'talk', need: 5 },
        { id: 'crf_msn_002_0004', activity: 'login_bonus', need: 3 }
      ] },
    { id: 'crf_msng_003', title: 'Step 3', day: 5,
      missions: [
        { id: 'crf_msn_003_0001', activity: 'mission_clear', need: 3 },
        { id: 'crf_msn_003_0002', activity: 'touch', need: 1 },
        { id: 'crf_msn_003_0003', activity: 'talk', need: 5 },
        { id: 'crf_msn_003_0004', activity: 'login_bonus', need: 5 }
      ] }
  ];

  /* Local equivalent of the official 4 points -> 100 voice_token. */
  var WM_GROUP_REWARD = { money: 300, exp: 40 };
  var WM_ICON = {
    mission_clear: 'icon_scroll', touch: 'sparkle',
    talk: 'icon_scroll', login_bonus: 'icon_chest'
  };

  var Welcome = {
    groups: WM_GROUPS,
    isOpen: function (g) { return Welcome.dayCount() >= g.day; },

    activity: function (kind) {
      var s = Game.s;
      if (!s.welcome_activity) s.welcome_activity = {};
      return Number(s.welcome_activity[kind] || 0);
    },

    mark: function (kind, count) {
      var n = Math.max(1, Number(count) || 1);
      var s = Game.s;
      if (!s.welcome_activity) s.welcome_activity = {};
      s.welcome_activity[kind] = Number(s.welcome_activity[kind] || 0) + n;
      Game.save();
      Game.emit('welcome');
      return s.welcome_activity[kind];
    },

    milestone: function (id) {
      var w = Config.section('state').welcome || {};
      if (w[id]) return;
      Config.set('state.welcome.' + id, true);
    },
    milestoneDone: function (id) {
      return !!(Config.section('state').welcome && Config.section('state').welcome[id]);
    },

    dayCount: function () {
      try { return Number(Config.section('state').welcome_day || 0); } catch (e) { return 0; }
    },
    bumpDay: function (n) {
      var cur = Welcome.dayCount();
      var next = Math.max(cur, Number(n) || 0);
      if (next !== cur) Config.set('state.welcome_day', next);
      return next;
    },

    missionDone: function (m) { return Welcome.activity(m.activity) >= m.need; },
    groupDone: function (g) {
      return g.missions.every(function (m) { return Welcome.missionDone(m); });
    },
    groupClaimed: function (g) {
      var c = Config.section('state').welcome_claimed || {};
      return !!c[g.id];
    },
    claimGroup: function (g) {
      if (!Welcome.groupDone(g) || Welcome.groupClaimed(g)) return null;
      var c = Config.section('state').welcome_claimed || {};
      c[g.id] = true;
      Config.set('state.welcome_claimed', c);
      Game.addMoney(WM_GROUP_REWARD.money);
      Game.addExp(WM_GROUP_REWARD.exp);
      Game.remember(TF('mem.wm', 'Welcome mission "{title}" cleared!', { title: g.title }));
      return WM_GROUP_REWARD;
    },

    render: function (root) {
      root.innerHTML = '';
      var hero = document.createElement('div');
      hero.className = 'wm-hero';
      hero.innerHTML = '<h3></h3><p></p>';
      hero.querySelector('h3').textContent = I18n.t('wm.title');
      hero.querySelector('p').textContent = I18n.t('wm.sub');
      root.appendChild(hero);

      var day = Welcome.dayCount();
      var lang = 'zh';
      try { lang = I18n.lang() || 'zh'; } catch (e) {}
      var list = document.createElement('div');
      list.className = 'wm-groups';

      WM_GROUPS.forEach(function (g) {
        var open = day >= g.day;
        var done = Welcome.groupDone(g);
        var box = document.createElement('div');
        box.className = 'wm-group' + (open ? '' : ' locked') + (done ? ' clear' : '');

        var head = document.createElement('div');
        head.className = 'wm-group-head';
        head.innerHTML = '<span class="wm-group-title"></span><span class="wm-group-day"></span>';
        head.querySelector('.wm-group-title').textContent = g.title;
        head.querySelector('.wm-group-day').textContent = open ? (done ? 'Completed' : 'in progress') : ('The ' + g.day + ' sky widening');
        box.appendChild(head);

        var grid = document.createElement('div');
        grid.className = 'wm-grid';
        g.missions.forEach(function (m) {
          var got = Welcome.activity(m.activity);
          var md = Welcome.missionDone(m);
          var tile = document.createElement('div');
          tile.className = 'wm-tile' + (md ? ' clear' : (open ? ' active' : ' locked'));
          tile.innerHTML = '<img class="wm-base" alt=""><img class="wm-ico" alt="">' + '<div class="wm-cap"></div><div class="wm-prog"></div>';
          tile.querySelector('.wm-base').src = 'assets/welcome_mission/' +
            (md ? 'tile_base_clear.svg' : (open ? 'tile_base_active.svg' : 'tile_base_locked.svg'));
          tile.querySelector('.wm-ico').src = 'assets/welcome_mission/' + WM_ICON[m.activity] + '.svg';
          var txt = WM_MISSION_TEXT[m.activity] || { ja: m.id, zh: m.id };
          tile.querySelector('.wm-cap').textContent = txt[lang] || txt.zh || txt.ja;
          tile.querySelector('.wm-prog').textContent = Math.min(got, m.need) + ' / ' + m.need;
          tile.title = txt.ja;
          grid.appendChild(tile);
        });
        box.appendChild(grid);

        if (open && done && !Welcome.groupClaimed(g)) {
          var btn = document.createElement('button');
          btn.className = 'wm-claim';
          btn.textContent = 'receive';
          btn.onclick = function () {
            var r = Welcome.claimGroup(g);
            if (r) { Welcome.render(root); if (_present) { try { _present(r); } catch (e) {} } }
          };
          box.appendChild(btn);
        } else if (Welcome.groupClaimed(g)) {
          var tag = document.createElement('div');
          tag.className = 'wm-claimed';
          tag.textContent = '受け取り済み';
          box.appendChild(tag);
        }
        list.appendChild(box);
      });

      root.appendChild(list);
    }
  };

  global.Quests = Quests;
  global.Welcome = Welcome;
})(window);
