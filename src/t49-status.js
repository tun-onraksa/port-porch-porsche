// Terminal49 status light in the top bar.
// Terminal49 is a request/response API, not a live connection: we ask, it answers.
// - On load we ask our own server route (/api/track, GET) whether it is deployed and holds the key.
//   Green = ready to send real requests. Amber = route found but no key. Grey = no server (opened as a file
//   or on a static host).
// - Each successful live tracking request (Dashboard, "Track another box") flashes the light and records
//   when it happened. The dashboard frame shares that through localStorage.
(function () {
  const bar = document.querySelector('.workspace-toolbar .toolbar-spacer');
  if (!bar) return;
  document.head.insertAdjacentHTML('beforeend', '<style>'
    + '.t49-status{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font-size:12px;font-weight:500;text-decoration:none;white-space:nowrap;margin-right:6px}'
    + '.t49-status:hover{color:var(--ink);border-color:var(--muted)}'
    + '.t49-status i{width:8px;height:8px;border-radius:50%;background:#9aa5b1;flex-shrink:0}'
    + '.t49-status[data-state=ready] i{background:#1f9d55;box-shadow:0 0 0 3px #1f9d5526}'
    + '.t49-status[data-state=nokey] i{background:#b7791f}'
    + '.t49-status.t49-flash i{animation:t49flash 1.4s ease-out 2}'
    + '@keyframes t49flash{0%{box-shadow:0 0 0 0 #1f9d5599}100%{box-shadow:0 0 0 10px #1f9d5500}}'
    + '@media(prefers-reduced-motion:reduce){.t49-status.t49-flash i{animation:none}}'
    + '@media(max-width:760px){.t49-status span{display:none}.t49-status{padding:0 8px}}'
    + '</style>');
  const el = document.createElement('a');
  el.className = 't49-status';
  el.href = '#p-gate';
  el.innerHTML = '<i aria-hidden="true"></i><span>Terminal49</span>';
  bar.after(el);

  let state = 'checking', last = null;
  const read = () => { try { return JSON.parse(localStorage.getItem('t49:last') || 'null'); } catch { return null; } };
  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  function paint() {
    last = read();
    const text = {
      checking: 'Terminal49 API · checking',
      ready: 'Terminal49 API ready: real tracking requests can be sent',
      nokey: 'Terminal49 route found, but the server has no API key',
      offline: 'Terminal49 API not reachable from this copy (needs the deployed server)',
    }[state];
    el.dataset.state = state;
    el.title = text + (last ? `. Last request ${time(last.at)} · ${last.status || 'pending'} · ${last.id}` : '. No request sent yet this session.');
    el.setAttribute('aria-label', el.title);
    el.querySelector('span').textContent = state === 'ready' ? (last ? `Terminal49 · ${time(last.at)}` : 'Terminal49') : state === 'nokey' ? 'Terminal49 · no key' : state === 'offline' ? 'Terminal49 · offline' : 'Terminal49';
  }
  function flash() { el.classList.remove('t49-flash'); void el.offsetWidth; el.classList.add('t49-flash'); }

  paint();
  if (location.protocol === 'file:') { state = 'offline'; paint(); }
  else fetch('/api/track', { method: 'GET', cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => { state = j && j.ok ? (j.configured ? 'ready' : 'nokey') : 'offline'; paint(); })
    .catch(() => { state = 'offline'; paint(); });

  addEventListener('storage', (e) => { if (e.key === 't49:last') { paint(); flash(); } });
})();
