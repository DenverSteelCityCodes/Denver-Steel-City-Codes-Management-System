// Mockup behaviour shared by every screen. Fictional data; nothing is saved.
// Theme: ?theme=dark|light wins, then the viewer's last choice, then the OS setting.
(function () {
  var q = new URLSearchParams(location.search).get('theme');
  var stored = null;
  try { stored = localStorage.getItem('scc-mock-theme'); } catch (e) { /* private mode */ }
  var dark = q ? q === 'dark' : stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();

document.addEventListener('DOMContentLoaded', function () {
  if (window.lucide) window.lucide.createIcons({ attrs: { class: 'icon', 'aria-hidden': 'true' } });

  // Keep links inside the mockup carrying the theme the viewer is looking at.
  var q = new URLSearchParams(location.search).get('theme');
  if (q) document.querySelectorAll('a[href$=".html"], a[href*=".html#"]').forEach(function (a) {
    var u = new URL(a.getAttribute('href'), location.href); u.searchParams.set('theme', q); a.href = u.href;
  });

  // Disclosure buttons: aria-controls + aria-expanded, any number per page.
  document.querySelectorAll('[data-toggle]').forEach(function (btn) {
    var target = document.getElementById(btn.getAttribute('data-toggle'));
    if (!target) return;
    btn.setAttribute('aria-controls', target.id);
    btn.setAttribute('aria-expanded', String(!target.hidden));
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      target.hidden = !target.hidden;
      btn.setAttribute('aria-expanded', String(!target.hidden));
      if (!target.hidden) { var f = target.querySelector('[autofocus], button, a, input, select, textarea'); if (f) f.focus(); }
    });
  });

  // Avatar menu: inline popover; Esc and outside click close it; focus returns to the avatar.
  document.querySelectorAll('[data-menu]').forEach(function (btn) {
    var menu = document.getElementById(btn.getAttribute('data-menu'));
    if (!menu) return;
    btn.setAttribute('aria-expanded', 'false');
    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden) { var f = menu.querySelector('a, button, input'); if (f) f.focus(); }
    });
    document.addEventListener('click', function (ev) { if (!menu.hidden && !menu.contains(ev.target)) close(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
  });

  // Dark mode switch inside the avatar menu.
  document.querySelectorAll('[data-theme-switch]').forEach(function (input) {
    input.checked = document.documentElement.dataset.theme === 'dark';
    input.addEventListener('change', function () {
      var t = input.checked ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem('scc-mock-theme', t); } catch (e) { /* private mode */ }
    });
  });

  // Segmented controls: one pressed at a time. Optional data-show targets panels by id.
  document.querySelectorAll('[data-seg]').forEach(function (group) {
    var items = group.querySelectorAll('button');
    items.forEach(function (b) {
      b.addEventListener('click', function () {
        items.forEach(function (o) {
          var on = o === b;
          o.setAttribute(o.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed', String(on));
          var id = o.getAttribute('data-show'); if (id) { var p = document.getElementById(id); if (p) p.hidden = !on; }
        });
      });
    });
  });

  // Roll-call style toggles: Mark present -> Present -> Absent -> Present. Updates a counter with a flap.
  document.querySelectorAll('[data-mark]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('[data-camper]');
      var state = btn.getAttribute('data-mark');
      var next = state === 'none' ? 'present' : state === 'present' ? 'absent' : 'present';
      btn.setAttribute('data-mark', next);
      btn.innerHTML = next === 'present' ? '<i data-lucide="check"></i> Present' : '<i data-lucide="x"></i> Absent';
      btn.className = 'btn ' + (next === 'present' ? 'mark mark--present' : 'mark mark--absent');
      if (row) row.setAttribute('data-state', next);
      if (window.lucide) window.lucide.createIcons({ attrs: { class: 'icon', 'aria-hidden': 'true' } });
      updateCount();
    });
  });
  function updateCount() {
    var out = document.querySelector('[data-count]'); if (!out) return;
    var total = document.querySelectorAll('[data-camper]').length;
    var present = document.querySelectorAll('[data-camper][data-state="present"]').length;
    flap(out, present + '/' + total);
  }
  window.sccFlap = flap;
  function flap(el, text) {
    if (el.textContent === text) return;
    el.classList.remove('is-flipping'); void el.offsetWidth; el.classList.add('is-flipping');
    setTimeout(function () { el.textContent = text; }, 80);
  }

  // "Mark all present": marks every unmarked row, keeps anything already marked.
  document.querySelectorAll('[data-mark-all]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-mark="none"]').forEach(function (b) { b.click(); });
      var wrap = btn.closest('[data-mark-all-wrap]'); if (wrap) wrap.hidden = true;
    });
  });
});
