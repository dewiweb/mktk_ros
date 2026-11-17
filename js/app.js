/* App shell: hash router + auth gate + chrome. */
(() => {
  const routes = {
    dashboard: { title: 'Dashboard', fn: Views.dashboard },
    interfaces: { title: 'Interfaces', fn: Views.interfaces },
    vlans: { title: 'VLANs', fn: Views.vlans },
    network: { title: 'IPs & DHCP', fn: Views.network },
    firewall: { title: 'Firewall', fn: Views.firewall },
    system: { title: 'System', fn: Views.system },
  };
  const DEFAULT = 'dashboard';

  const $ = (s) => document.querySelector(s);

  function showLogin() {
    $('#login').classList.remove('hidden');
    $('#app').classList.add('hidden');
  }
  function showApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    loadIdentity();
    navigate();
  }

  async function loadIdentity() {
    const ident = await apiCall(Api.get('/system/identity'));
    if (ident) $('#identity').textContent = ident.name || 'router';
  }

  function navigate() {
    const hash = (location.hash || '#/dashboard').replace('#/', '');
    const route = routes[hash] || routes[DEFAULT];
    Views.stopTrafficPoll();
    document.querySelectorAll('#nav a').forEach(a =>
      a.classList.toggle('active', a.dataset.route === (routes[hash] ? hash : DEFAULT)));
    $('#page-title').textContent = route.title;
    route.fn();
  }

  function clock() {
    $('#clock').textContent = new Date().toLocaleTimeString();
  }

  // Login form: store creds, verify with a cheap call, then show app.
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = $('#login-user').value.trim();
    const pass = $('#login-pass').value;
    $('#login-error').textContent = '';
    Api.setCreds(user, pass);
    const ok = await apiCall(Api.get('/system/identity'));
    if (ok) {
      showApp();
    } else {
      Api.clearCreds();
      $('#login-error').textContent = 'Login failed — check credentials and www-ssl.';
    }
  });

  $('#logout').addEventListener('click', () => {
    Api.clearCreds();
    Views.stopTrafficPoll();
    showLogin();
  });

  $('#refresh').addEventListener('click', navigate);
  window.addEventListener('hashchange', () => { if (Api.hasCreds()) navigate(); });
  setInterval(clock, 1000); clock();

  // Boot: if we already have creds (same tab session), go straight in.
  if (Api.hasCreds()) showApp(); else showLogin();
})();
