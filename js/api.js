/* RouterOS REST API client.
 * Served same-origin from the router's www-ssl service, so no CORS issues.
 * Credentials are kept in sessionStorage only (cleared when the tab closes).
 */
const Api = (() => {
  const BASE = '/rest';
  const KEY = 'avrouter.auth';

  function creds() {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
  }
  function setCreds(user, pass) {
    sessionStorage.setItem(KEY, JSON.stringify({ user, pass }));
  }
  function clearCreds() { sessionStorage.removeItem(KEY); }

  function authHeader() {
    const c = creds();
    if (!c) return {};
    return { Authorization: 'Basic ' + btoa(c.user + ':' + c.pass) };
  }

  async function request(method, path, body) {
    const opts = {
      method,
      headers: { ...authHeader(), Accept: 'application/json' },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, opts);
    if (!res.ok) {
      const e = new Error(res.status === 401 || res.status === 403
        ? 'unauthorized' : 'HTTP ' + res.status);
      e.status = res.status;
      throw e;
    }
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    patch: (path, body) => request('PATCH', path, body ?? {}),
    put: (path, body) => request('PUT', path, body ?? {}),
    del: (path) => request('DELETE', path),
    hasCreds: () => !!creds(),
    setCreds,
    clearCreds,
    // Escape hatch: run a RouterOS console command (POST = execute).
    // path is the REST path (slashes), args is the command args object.
    exec: (path, args = {}) => request('POST', path, args),
  };
})();

/* Helpers — RouterOS returns every value as a string. */
const fmt = {
  num(v, d = 0) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n.toFixed(d) : '—';
  },
  bytes(v) {
    let x = parseFloat(v);
    if (!Number.isFinite(x)) return '—';
    const u = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let i = 0;
    while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
    return x.toFixed(i ? 1 : 0) + ' ' + u[i];
  },
  bits(v) {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' Gbps';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' Mbps';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + ' Kbps';
    return n.toFixed(0) + ' bps';
  },
  uptime(v) {
    // RouterOS returns strings like "2d20h12m20s" — pass those through.
    if (typeof v === 'string' && /[dhms]/.test(v)) return v;
    const sec = parseInt(v, 10);
    if (!Number.isFinite(sec)) return '—';
    const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24,
          m = Math.floor(sec / 60) % 60, s = sec % 60;
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  },
  bool(v) { return v === 'true' || v === true; },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
};

const Toast = {
  show(msg, kind = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  },
};

const Loading = {
  show(container, msg = 'Loading…') {
    container.innerHTML = `<div class="loading">${fmt.esc(msg)}</div>`;
  },
};

// Wrap an Api promise: render errors into the view and handle auth expiry.
async function apiCall(promise, container) {
  try {
    return await promise;
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      Api.clearCreds();
      document.getElementById('login').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
    } else {
      if (container) Loading.show(container, 'Error: ' + e.message);
      Toast.show(e.message, 'error');
    }
    return null;
  }
}
