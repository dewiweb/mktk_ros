/* View renderers. Each view fetches via Api and renders into #view. */

const Views = (() => {
  const view = () => document.getElementById('view');

  function card(title, body) {
    return `<div class="card"><h3>${fmt.esc(title)}</h3><div class="card-body">${body}</div></div>`;
  }

  function table(headers, rows) {
    return `<table><thead><tr>${headers.map(h => `<th>${fmt.esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function kv(label, value) {
    return `<div class="kv"><span class="muted">${fmt.esc(label)}</span><b>${fmt.esc(value)}</b></div>`;
  }

  function badge(text, cls) {
    return `<span class="badge ${cls}">${fmt.esc(text)}</span>`;
  }

  /* ---------- Dashboard ---------- */
  async function dashboard() {
    const v = view();
    Loading.show(v);
    const [res, rboard, ifaces] = await Promise.all([
      apiCall(Api.get('/system/resource'), v),
      apiCall(Api.get('/system/routerboard'), v),
      apiCall(Api.get('/interface'), v),
    ]);
    if (!res) return;

    const up = (ifaces || []).filter(i => fmt.bool(i.running)).length;
    const total = (ifaces || []).length;

    v.innerHTML = `
      <div class="grid">
        ${card('System', `
          ${kv('Model', rboard?.model || '—')}
          ${kv('Board', rboard?.['board-name'] || '—')}
          ${kv('RouterOS', res.version || '—')}
          ${kv('Uptime', fmt.uptime(res.uptime))}
        `)}
        ${card('Resources', `
          ${kv('CPU', fmt.num(res['cpu-load'], 1) + ' %')}
          ${kv('Memory', fmt.bytes(res['free-memory']) + ' free of ' + fmt.bytes(res['total-memory']))}
          ${kv('Disk', fmt.bytes(res['free-hdd-space']) + ' free of ' + fmt.bytes(res['total-hdd-space']))}
          ${kv('Architecture', res['architecture-name'] || '—')}
        `)}
        ${card('Interfaces', `
          ${kv('Up', up)}
          ${kv('Total', total)}
          ${kv('SFP+ ports', (ifaces || []).filter(i => (i.name || '').startsWith('sfp')).length)}
        `)}
      </div>
      <div id="traffic-live"></div>
      <div class="hint">Interface rates update every 2 s while on this page.</div>
    `;
    startTrafficPoll('#traffic-live');
  }

  /* ---------- Live traffic (monitor-traffic) ---------- */
  let trafficTimer = null;
  function startTrafficPoll(selector) {
    stopTrafficPoll();
    const el = () => document.querySelector(selector);
    const tick = async () => {
      const target = el();
      if (!target) { stopTrafficPoll(); return; }
      const data = await apiCall(
        Api.exec('/interface/monitor-traffic', { 'once': '' })
      );
      renderTraffic(target, data);
    };
    tick();
    trafficTimer = setInterval(tick, 2000);
  }
  function stopTrafficPoll() {
    if (trafficTimer) { clearInterval(trafficTimer); trafficTimer = null; }
  }

  function renderTraffic(el, data) {
    if (!data) { el.innerHTML = ''; return; }
    const rows = (Array.isArray(data) ? data : [data]).map(r => `
      <tr>
        <td>${fmt.esc(r['name'] || r['interface'] || '')}</td>
        <td class="num">${fmt.bits(r['rx-bits-per-second'] ?? r['rx-bits-per-second-actual'] ?? r['rx'])}</td>
        <td class="num">${fmt.bits(r['tx-bits-per-second'] ?? r['tx-bits-per-second-actual'] ?? r['tx'])}</td>
      </tr>`).join('');
    el.innerHTML = card('Live Traffic', table(['Interface', 'RX', 'TX'], rows || '<tr><td colspan="3" class="muted">No data</td></tr>'));
  }

  /* ---------- Interfaces ---------- */
  async function interfaces() {
    const v = view();
    Loading.show(v);
    const ifaces = await apiCall(Api.get('/interface'), v);
    if (!ifaces) return;

    const rows = ifaces.map(i => `
      <tr>
        <td>${fmt.esc(i.name)}</td>
        <td>${fmt.esc(i.type)}</td>
        <td>${fmt.bool(i.running) ? badge('up', 'ok') : badge('down', 'off')}</td>
        <td>${fmt.bool(i.disabled) ? badge('disabled', 'off') : ''}</td>
        <td class="num">${fmt.bytes(i['rx-byte'])}</td>
        <td class="num">${fmt.bytes(i['tx-byte'])}</td>
        <td class="muted">${fmt.esc(i.comment || '')}</td>
      </tr>`).join('');

    v.innerHTML = card('Interfaces',
      table(['Name', 'Type', 'Status', '', 'RX total', 'TX total', 'Comment'], rows));
  }

  /* ---------- VLANs ---------- */
  async function vlans() {
    const v = view();
    Loading.show(v);
    const [vl, ifaces] = await Promise.all([
      apiCall(Api.get('/interface/vlan'), v),
      apiCall(Api.get('/interface'), v),
    ]);
    if (!vl) return;

    const rows = vl.map(x => `
      <tr>
        <td>${fmt.esc(x.name)}</td>
        <td class="num">${fmt.esc(x['vlan-id'])}</td>
        <td>${fmt.esc(x.interface)}</td>
        <td>${fmt.bool(x.running) ? badge('up', 'ok') : badge('down', 'off')}</td>
        <td class="muted">${fmt.esc(x.comment || '')}</td>
      </tr>`).join('');

    v.innerHTML = `
      ${card('VLANs', table(['Name', 'VLAN ID', 'Parent', 'Status', 'Comment'],
        rows || '<tr><td colspan="5" class="muted">No VLANs configured</td></tr>'))}
      <div class="hint">AV suggestion: tag AoIP / lighting / video-over-IP / infrastructure as separate VLANs.</div>
    `;
  }

  /* ---------- IPs & DHCP ---------- */
  async function network() {
    const v = view();
    Loading.show(v);
    const [addrs, leases, pools, arp] = await Promise.all([
      apiCall(Api.get('/ip/address'), v),
      apiCall(Api.get('/ip/dhcp-server/lease'), v),
      apiCall(Api.get('/ip/pool'), v),
      apiCall(Api.get('/ip/arp'), v),
    ]);
    if (!addrs) return;

    const addrRows = addrs.map(a => `
      <tr>
        <td>${fmt.esc(a.address)}</td>
        <td>${fmt.esc(a.network)}</td>
        <td>${fmt.esc(a['actual-interface'] || a.interface)}</td>
        <td>${fmt.bool(a.dynamic) ? badge('dynamic', 'info') : badge('static', '')}</td>
        <td class="muted">${fmt.esc(a.comment || '')}</td>
      </tr>`).join('');

    const leaseRows = (leases || []).map(l => `
      <tr>
        <td>${fmt.esc(l.address)}</td>
        <td>${fmt.esc(l['mac-address'])}</td>
        <td>${fmt.esc(l['host-name'] || '')}</td>
        <td>${fmt.esc(l['active-interface'] || '')}</td>
        <td>${fmt.esc(l['expires-after'] || l['lease-time'] || '')}</td>
        <td>${fmt.bool(l.dynamic) ? badge('dynamic', 'info') : badge('reserved', 'ok')}</td>
      </tr>`).join('');

    const arpRows = (arp || []).filter(a => fmt.bool(a.complete)).map(a => `
      <tr>
        <td>${fmt.esc(a.address)}</td>
        <td>${fmt.esc(a['mac-address'])}</td>
        <td>${fmt.esc(a.interface)}</td>
      </tr>`).join('');

    v.innerHTML = `
      ${card('IP Addresses', table(['Address', 'Network', 'Interface', 'Type', 'Comment'], addrRows))}
      ${card('DHCP Leases', table(['Address', 'MAC', 'Hostname', 'Interface', 'Expires', 'Type'],
        leaseRows || '<tr><td colspan="6" class="muted">No leases</td></tr>'))}
      ${card('ARP Table', table(['Address', 'MAC', 'Interface'], arpRows))}
    `;
  }

  /* ---------- Firewall ---------- */
  async function firewall() {
    const v = view();
    Loading.show(v);
    const [filters, nat] = await Promise.all([
      apiCall(Api.get('/ip/firewall/filter'), v),
      apiCall(Api.get('/ip/firewall/nat'), v),
    ]);
    if (!filters) return;

    const frows = filters.map(r => `
      <tr>
        <td>${fmt.esc(r.chain)}</td>
        <td>${fmt.esc(r.action)}</td>
        <td>${fmt.esc([r['src-address'], r['dst-address']].filter(Boolean).join(' → ') || 'any')}</td>
        <td>${fmt.esc(r.protocol || '')}</td>
        <td>${fmt.bool(r.disabled) ? badge('disabled', 'off') : badge('enabled', 'ok')}</td>
        <td class="muted">${fmt.esc(r.comment || '')}</td>
      </tr>`).join('');

    const nrows = (nat || []).map(r => `
      <tr>
        <td>${fmt.esc(r.chain)}</td>
        <td>${fmt.esc(r.action)}</td>
        <td>${fmt.esc(r['src-address'] || 'any')} → ${fmt.esc(r['to-addresses'] || r['to-ports'] || '')}</td>
        <td>${fmt.bool(r.disabled) ? badge('disabled', 'off') : badge('enabled', 'ok')}</td>
        <td class="muted">${fmt.esc(r.comment || '')}</td>
      </tr>`).join('');

    v.innerHTML = `
      ${card('Filter Rules', table(['Chain', 'Action', 'Src → Dst', 'Proto', 'State', 'Comment'],
        frows || '<tr><td colspan="6" class="muted">No filter rules</td></tr>'))}
      ${card('NAT', table(['Chain', 'Action', 'Mapping', 'State', 'Comment'],
        nrows || '<tr><td colspan="5" class="muted">No NAT rules</td></tr>'))}
    `;
  }

  /* ---------- System ---------- */
  async function system() {
    const v = view();
    Loading.show(v);
    const [res, rboard, ident, clock_, health] = await Promise.all([
      apiCall(Api.get('/system/resource'), v),
      apiCall(Api.get('/system/routerboard'), v),
      apiCall(Api.get('/system/identity'), v),
      apiCall(Api.get('/system/clock'), v),
      apiCall(Api.get('/system/health').catch(() => null), v),
    ]);
    if (!res) return;

    const healthKvs = health && !Array.isArray(health)
      ? Object.entries(health).map(([k, val]) => kv(k, val)).join('')
      : (Array.isArray(health) ? health.map(h => kv(h.name || '', h.value || '')).join('') : '<div class="muted">Not available on this model.</div>');

    v.innerHTML = `
      <div class="grid">
        ${card('Identity', `
          ${kv('Name', ident?.name || '—')}
          ${kv('Model', rboard?.model || '—')}
          ${kv('Serial', rboard?.['serial-number'] || '—')}
          ${kv('Firmware', rboard?.['current-firmware'] || '—')}
        `)}
        ${card('Clock', `
          ${kv('Time', (clock_?.date || '') + ' ' + (clock_?.time || ''))}
          ${kv('Timezone', clock_?.['time-zone-name'] || '—')}
        `)}
        ${card('Resources', `
          ${kv('CPU', fmt.num(res['cpu-load'], 1) + ' % of ' + (res['cpu-count'] || '?') + ' cores @ ' + (res['cpu-frequency'] || '?') + ' MHz')}
          ${kv('Memory', fmt.bytes(res['free-memory']) + ' / ' + fmt.bytes(res['total-memory']))}
          ${kv('Disk', fmt.bytes(res['free-hdd-space']) + ' / ' + fmt.bytes(res['total-hdd-space']))}
          ${kv('Uptime', fmt.uptime(res.uptime))}
        `)}
        ${card('Health', healthKvs)}
      </div>
    `;
  }

  return {
    dashboard, interfaces, vlans, network, firewall, system,
    stopTrafficPoll,
  };
})();
