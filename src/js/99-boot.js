/* ==========================================================================
   BOOT, and the ?selftest hook the tests drive in headless Chrome.
   ====================================================================== */
(function () {
  'use strict';
  var Deck = window.Deck;

  function selftest() {
    var report = { total: Deck.total, visited: 0, steps: 0, overflow: [], truncated: [], errors: [], widgetFailures: [], trackerTops: [], size: innerWidth + 'x' + innerHeight };
    var railTop = function () { return innerHeight - document.querySelector('.rail').offsetHeight; };
    function check(i, step) {
      var s = Deck.model[i].el, tag = (i + 1) + ' ' + Deck.model[i].title + ' step ' + step;
      if (s.scrollHeight > s.clientHeight + 2 || s.scrollWidth > s.clientWidth + 2) report.overflow.push(tag + ' scroll ' + (s.scrollHeight - s.clientHeight) + 'x' + (s.scrollWidth - s.clientWidth));
      /* scrollHeight misses content pushed above a centred column: check where children sit. */
      [].forEach.call(s.children, function (c) {
        if (c.classList.contains('notes')) return;
        var r = c.getBoundingClientRect();
        if (c.classList.contains('on') || !c.hasAttribute('data-s')) {
          if (r.height && (r.top < 2 || r.bottom > railTop() + 2 || r.right > innerWidth + 2)) report.overflow.push(tag + ' <' + c.tagName.toLowerCase() + '.' + c.className.split(' ')[0] + '> ' + Math.round(r.top) + '..' + Math.round(r.bottom));
        }
      });
      [].forEach.call(s.querySelectorAll('.pane.on > *'), function (c) {
        var r = c.getBoundingClientRect();
        if (c.classList.contains('on') || !c.hasAttribute('data-s')) {
          if (r.height && (r.top < 2 || r.bottom > railTop() + 2 || r.right > innerWidth + 2)) report.overflow.push(tag + ' pane child <' + c.tagName.toLowerCase() + '.' + c.className.split(' ')[0] + '> ' + Math.round(r.top) + '..' + Math.round(r.bottom));
        }
      });
      /* A code line that ends in an ellipsis has lost its point. */
      [].forEach.call(s.querySelectorAll('.l'), function (l) {
        if (l.closest('.pane.on') && l.offsetParent && l.scrollWidth > l.clientWidth + 1) report.truncated.push(tag + ': ' + l.textContent.slice(0, 50));
      });
      var tr = s.querySelector('.pane.on .tracker');
      if (tr) { var tt = Math.round(tr.getBoundingClientRect().top); if (report.trackerTops.indexOf(tt) < 0) report.trackerTops.push(tt); }
      report.steps++;
    }
    var i = 0;
    (function visit() {
      if (i >= Deck.total) {
        report.errors = Deck.errors.slice(); report.widgetFailures = Deck.failures.slice();
        document.documentElement.setAttribute('data-selftest', JSON.stringify(report));
        return;
      }
      Deck.go(i);
      Deck.setStep(0);
      var max = Deck.model[i].max, n = 0, dir = 1;
      (function stepper() {
        setTimeout(function () {
          check(i, n);
          if (dir === 1 && n < max) { n++; Deck.setStep(n); stepper(); }
          else if (dir === 1) { dir = -1; if (n > 0) { n--; Deck.setStep(n); stepper(); } else done(); }
          else if (n > 0) { n--; Deck.setStep(n); stepper(); }
          else done();
        }, 40);
      })();
      function done() { report.visited++; i++; visit(); }
    })();
  }

  /* ?walktest: press only the arrow keys through the whole deck and check that
     every view arrives fully revealed and none is skipped (view mode). */
  function walktest() {
    var out = { slideMode: [], viewMode: [], back: [], problems: [] };
    var key = function (k) { document.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true })); };
    function unrevealed() {
      var m = Deck.model[Deck.current()], p = m.panes[Deck.paneIndex()];
      return [].filter.call(p.querySelectorAll('[data-s]'), function (e) {
        return !e.classList.contains('on') && !e.closest('[data-widget]');
      }).length;
    }
    function snap(list, tag) {
      var c = Deck.current(), pi = Deck.paneIndex(), u = unrevealed();
      list.push(c + ':' + pi);
      if (u) out.problems.push(tag + ' slide ' + (c + 1) + ' pane ' + pi + ' has ' + u + ' hidden parts on arrival');
    }
    Deck.go(0); snap(out.slideMode, 'slide-mode');
    for (var i = 0; i < Deck.total - 1; i++) { key('ArrowRight'); snap(out.slideMode, 'slide-mode'); }
    Deck.go(0); key('v'); snap(out.viewMode, 'view-mode');
    for (var j = 0; j < 80; j++) { var before = Deck.current() + ':' + Deck.paneIndex(); key('ArrowRight'); var after = Deck.current() + ':' + Deck.paneIndex(); if (before === after) break; snap(out.viewMode, 'view-mode'); }
    for (var k2 = 0; k2 < 80; k2++) { var b2 = Deck.current() + ':' + Deck.paneIndex(); key('ArrowLeft'); var a2 = Deck.current() + ':' + Deck.paneIndex(); if (b2 === a2) break; snap(out.back, 'back'); }
    out.errors = Deck.errors.slice();
    document.documentElement.setAttribute('data-walktest', JSON.stringify(out));
  }

  var started = false;
  function go() {
    if (started) return; started = true;
    Deck.start();
    var st = new URLSearchParams(location.search).get('step');
    if (st !== null) Deck.setStep(parseInt(st, 10) || 0);
    var qp = new URLSearchParams(location.search);
    if (qp.has('selftest')) setTimeout(selftest, 100);
    if (qp.has('walktest')) setTimeout(walktest, 100);
  }
  /* Hold the first slide until the three voices have loaded, so the opening
     line does not reflow from a fallback face. Capped at 1.2s. */
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); setTimeout(go, 1200); } else go();
})();
