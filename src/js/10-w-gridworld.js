/* Tabular Q-learning on a 7 x 5 grid. A TOY: a lookup table of numbers.
   LLM training uses policy gradients instead, but the loop is the same:
   act, get a reward, adjust, repeat. Seeded, so every rehearsal converges
   the same way. */
(function () {
  'use strict';
  var Deck = window.Deck;
  var W = 7, H = 5, CELL = 76;
  var MAP = [
    '. . . . . . G',
    '. # # . . . .',
    '. . . . P # .',
    '. # . . . . .',
    'S . . P . . .'
  ].map(function (r) { return r.split(' '); });
  var DIRS = [[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']];
  var ARROW = ['M0 -9 V9 M-5 -4 L0 -9 L5 -4', 'M-9 0 H9 M4 -5 L9 0 L4 5', 'M0 -9 V9 M-5 4 L0 9 L5 4', 'M-9 0 H9 M-4 -5 L-9 0 L-4 5'];

  Deck.widgets.gridworld = function (host) {
    var rng, Q, pos, episode, steps, ret, hist, eps, autoplay = false, speed = 1, showPath = false, lastEp;
    var ALPHA = 0.5, GAMMA = 0.95;

    host.classList.add('gw');
    host.innerHTML =
      '<div class="gw-board"></div>' +
      '<div class="gw-side">' +
      '<div class="gw-stats"><div><span class="k">episode</span><b data-o="ep">0</b></div><div><span class="k">moves this episode</span><b data-o="st">0</b></div><div><span class="k">exploring</span><b data-o="eps">30%</b></div><div><span class="k">last result</span><b data-o="last">none</b></div></div>' +
      '<div class="gw-hist"><div class="k">moves per episode (lower is better)</div><svg data-o="hist" viewBox="0 0 300 70" preserveAspectRatio="none"></svg></div>' +
      '<div class="ctrl"><button class="btn" data-a="step">Move once</button><button class="btn primary" data-a="play">Run</button><button class="btn" data-a="path" aria-pressed="false">Show learned path</button><button class="btn" data-a="reset">Reset</button></div>' +
      '<div class="ctrl"><label>speed <input type="range" min="1" max="5" value="1" data-a="speed" aria-label="speed"><output data-o="spd">1x</output></label></div>' +
      '<p class="gw-rules"><b class="good">Goal +1</b>. <b class="bad">Red cell -1</b>, and the episode ends. Every move costs 0.02. The agent has no map. Colour shows what it currently believes a cell is worth.</p>' +
      '</div>';
    var board = host.querySelector('.gw-board');
    var out = function (k) { return host.querySelector('[data-o=' + k + ']'); };
    var svg = Deck.svg('svg', { viewBox: '0 0 ' + W * CELL + ' ' + H * CELL, 'aria-label': 'Grid world with a learning agent' }, board);
    var cells = [], arrows = [], texts = [];
    var gCells = Deck.svg('g', {}, svg), gArrows = Deck.svg('g', {}, svg), gPath = Deck.svg('g', {}, svg);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var t = MAP[y][x], i = y * W + x;
      var r = Deck.svg('rect', { x: x * CELL + 2, y: y * CELL + 2, width: CELL - 4, height: CELL - 4, rx: 7, 'class': 'gw-c' + (t === '#' ? ' wall' : '') }, gCells);
      cells[i] = r;
      if (t === 'G' || t === 'P' || t === 'S') {
        var tx = Deck.svg('text', { x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, 'class': 'gw-t ' + t }, gCells);
        tx.textContent = t === 'G' ? '+1' : (t === 'P' ? '-1' : 'start');
      }
      if (t === '.' || t === 'S') {
        var a = Deck.svg('path', { d: '', 'class': 'gw-ar', transform: 'translate(' + (x * CELL + CELL / 2) + ',' + (y * CELL + CELL / 2 + (t === 'S' ? 14 : 0)) + ')' }, gArrows);
        arrows[i] = a;
      }
    }
    var dot = Deck.svg('circle', { r: 13, 'class': 'gw-agent' }, svg);
    var pathLine = Deck.svg('polyline', { 'class': 'gw-path', points: '' }, gPath);

    function cell(x, y) { return (MAP[y] || [])[x]; }
    function q(s) { return Q[s] || (Q[s] = [0, 0, 0, 0]); }
    function reset() {
      rng = Deck.rng(11); Q = {}; pos = [0, 4]; episode = 0; steps = 0; ret = 0; hist = []; eps = 0.3; lastEp = 'none';
      autoplay = false; showPath = false; paint();
    }
    function maxIdx(arr) { var b = 0, ties = []; arr.forEach(function (v, i) { if (v > arr[b] + 1e-9) { b = i; ties = []; } }); arr.forEach(function (v, i) { if (Math.abs(v - arr[b]) < 1e-9) ties.push(i); }); return ties[Math.floor(rng() * ties.length)]; }
    function move() {
      var s = pos[1] * W + pos[0], a = rng() < eps ? Math.floor(rng() * 4) : maxIdx(q(s));
      var nx = pos[0] + DIRS[a][0], ny = pos[1] + DIRS[a][1], reward = -0.02, done = false;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || cell(nx, ny) === '#') { nx = pos[0]; ny = pos[1]; }
      var t = cell(nx, ny);
      if (t === 'G') { reward = 1; done = true; } else if (t === 'P') { reward = -1; done = true; }
      var s2 = ny * W + nx, best = done ? 0 : Math.max.apply(null, q(s2));
      q(s)[a] += ALPHA * (reward + GAMMA * best - q(s)[a]);
      pos = [nx, ny]; steps++; ret += reward;
      if (done || steps >= 300) {
        episode++; hist.push(steps); lastEp = t === 'G' ? 'reached the goal' : (t === 'P' ? 'hit a red cell' : 'ran out of moves');
        out('last').className = t === 'G' ? 'good' : 'bad';
        pos = [0, 4]; steps = 0; ret = 0; eps = Math.max(0.05, 0.3 - episode * 0.006);
      }
    }
    function greedyPath() {
      var p = [0, 4], pts = [], seen = {};
      for (var n = 0; n < 40; n++) {
        pts.push([p[0] * CELL + CELL / 2, p[1] * CELL + CELL / 2]);
        var s = p[1] * W + p[0]; if (seen[s]) return []; seen[s] = 1;
        var qs = q(s), a = qs.indexOf(Math.max.apply(null, qs));
        if (Math.max.apply(null, qs) === 0 && Math.min.apply(null, qs) === 0) return [];
        var nx = p[0] + DIRS[a][0], ny = p[1] + DIRS[a][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || cell(nx, ny) === '#') return [];
        p = [nx, ny];
        var t = cell(nx, ny);
        if (t === 'G') { pts.push([p[0] * CELL + CELL / 2, p[1] * CELL + CELL / 2]); return pts; }
        if (t === 'P') return [];
      }
      return [];
    }
    function paint() {
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var i = y * W + x, t = MAP[y][x], r = cells[i];
        if (t === '#') continue;
        if (t === 'G') { r.style.fill = 'var(--alfred-color-success-subtle)'; r.style.stroke = 'var(--alfred-color-success)'; continue; }
        if (t === 'P') { r.style.fill = 'var(--alfred-color-danger-subtle)'; r.style.stroke = 'var(--alfred-color-danger)'; continue; }
        var qs = Q[i] || [0, 0, 0, 0], v = Math.max.apply(null, qs);
        var a = Math.min(0.85, Math.abs(v) * 0.9);
        r.style.fill = v >= 0 ? 'rgba(84,192,114,' + a.toFixed(3) + ')' : 'rgba(247,113,101,' + a.toFixed(3) + ')';
        r.style.stroke = '';
        var ar = arrows[i];
        if (ar) {
          if (Q[i] && Math.max.apply(null, qs) !== Math.min.apply(null, qs)) { ar.setAttribute('d', ARROW[qs.indexOf(v)]); ar.style.opacity = 0.9; } else { ar.setAttribute('d', ''); }
        }
      }
      dot.setAttribute('cx', pos[0] * CELL + CELL / 2); dot.setAttribute('cy', pos[1] * CELL + CELL / 2);
      out('ep').textContent = episode; out('st').textContent = steps; out('eps').textContent = Math.round(eps * 100) + '%';
      out('last').textContent = lastEp;
      var pts = showPath ? greedyPath() : [];
      pathLine.setAttribute('points', pts.map(function (p) { return p.join(','); }).join(' '));
      var h = out('hist'); h.innerHTML = '';
      var recent = hist.slice(-60), mx = Math.max(20, Math.max.apply(null, recent.concat([1])));
      recent.forEach(function (v, i) { Deck.svg('rect', { x: i * (300 / 60), y: 70 - (v / mx) * 68, width: 300 / 60 - 1, height: (v / mx) * 68, fill: v <= 14 ? 'var(--alfred-color-success)' : 'var(--alfred-color-evidence)' }, h); });
      host.querySelector('[data-a=play]').textContent = autoplay ? 'Pause' : 'Run';
      host.querySelector('[data-a=path]').setAttribute('aria-pressed', showPath);
    }
    var loop = Deck.loop(function () {
      if (!autoplay) return;
      var n = [1, 3, 8, 30, 120][speed - 1];
      for (var i = 0; i < n; i++) move();
      paint();
    }, 12);
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'step') { move(); paint(); } else if (a === 'play') { autoplay = !autoplay; paint(); }
      else if (a === 'reset') { reset(); } else if (a === 'path') { showPath = !showPath; paint(); }
    });
    host.querySelector('[data-a=speed]').addEventListener('input', function (e) { speed = +e.target.value; out('spd').textContent = ['1x', '3x', '8x', '30x', '120x'][speed - 1]; });
    reset();
    return {
      reset: reset,
      enter: function () { loop.start(); },
      leave: function () { loop.stop(); autoplay = false; },
      step: function (n) {
        /* 1 explain, 2 run, 3 fast, 4 learned path */
        var sp = host.querySelector('[data-a=speed]');
        if (n <= 1) { reset(); autoplay = false; speed = 1; sp.value = 1; out('spd').textContent = '1x'; paint(); return; }
        if (n === 2) { if (episode > 0 && showPath) { showPath = false; } autoplay = !Deck.reduced(); speed = Math.max(speed, 2); sp.value = speed; out('spd').textContent = ['1x', '3x', '8x', '30x', '120x'][speed - 1]; }
        if (n === 3) { autoplay = true; speed = 4; sp.value = 4; out('spd').textContent = '30x'; }
        if (n >= 4) {
          if (episode < 80) { for (var i = 0; i < 4000 && episode < 80; i++) move(); }
          autoplay = false; showPath = true;
        }
        if (Deck.reduced() && n >= 2) { for (var j = 0; j < 4000 && episode < 80; j++) move(); autoplay = false; }
        paint();
      }
    };
  };
})();
