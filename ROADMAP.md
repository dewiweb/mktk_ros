# Development Plan — AV-Router UI

A dedicated, minimal web UI for MikroTik RouterOS 7 targeting AV/professional
production networks (AoIP, lighting, video-over-IP, infrastructure).

## Vision

WebFig exposes everything; AV operators need ~10% of it. This UI provides a
focused, always-correct view of a production AV network: which VLANs carry
which media, which devices are online, how much bandwidth each link uses —
with optional safe write actions (port bounce, VLAN assignment, DHCP lease
inspection).

## Architecture (fixed decisions)

- **Static SPA**, vanilla JS + CSS, no build step, no dependencies.
  Target < 50 KB total; must run on the router's own `www-ssl` service.
- **Router-hosted**: files live in `Files/avui/`, served same-origin as
  `/rest/*` — avoids CORS entirely and makes the UI an extension of RouterOS.
- **REST API** (`/rest/`) for all data; `POST` endpoints for writes/commands.
- **Auth**: HTTP Basic, dedicated limited `avui` user (group `avui`,
  policy `read,write,api,test`). Credentials in `sessionStorage` only.
- **Target hardware**: RB5009 (1 GB storage is irrelevant — app is ~40 KB).
  RouterOS ≥ 7.9; develop/test against 7.20+.

## Milestones

### M0 — Scaffold ✅ (done)
- [x] SPA shell, dark theme, hash router, login gate
- [x] REST client (`api.js`), read-only views (dashboard, interfaces,
      VLANs, IPs & DHCP, firewall, system)
- [x] `routeros-setup.rsc` (cert, www-ssl, restricted user, dirs)
- [x] `deploy.sh` (SCP upload)
- [x] README

### M1 — Verified on real hardware
- [ ] Deploy to RB5009, confirm all pages load and poll correctly
- [ ] Validate `monitor-traffic` REST shape (single vs. all interfaces);
      fall back to per-interface calls if needed
- [ ] Confirm `avui` group policies are sufficient for every endpoint used
      (adjust `read,write,api,test` if a 403 appears)
- [ ] Error handling pass: empty tables, missing `/system/health`, slow links

### M2 — AV-centric dashboard (the differentiator)
- [ ] **VLAN-role mapping**: configurable mapping file
      (`avui/config.json` in Files, editable via UI or by hand):
      `{"roles": {"aoip": [10,20], "lighting": [30], "video": [40,41], "infra": [1,99]}}`
- [ ] Dashboard groups interfaces by role, shows per-role aggregate
      bandwidth + status (green/amber/red)
- [ ] Per-port view: link status, negotiated speed, VLAN membership,
      RX/TX rate — the "is the Dante rig up?" glance
- [ ] Device table enriched: DHCP lease + ARP + hostname grouped by VLAN

### M3 — Safe write actions
- [ ] Port bounce (disable/enable interface) with confirm dialog
- [ ] Enable/disable VLAN, firewall rule, NAT rule toggles
- [ ] DHCP lease → make static reservation
- [ ] All writes behind an "Operator mode" toggle; read-only default
- [ ] Confirmation + audit: log action to RouterOS log via
      `/log add` (POST) if permitted

### M4 — Monitoring & polish
- [ ] Bandwidth sparklines (per interface, canvas, no libs)
- [ ] Polling backoff + pause when tab hidden (`visibilitychange`)
- [ ] i18n scaffold (en/fr)
- [ ] Keyboard nav + dark/light toggle
- [ ] Export config snapshot (JSON download of key endpoints)

### M5 — Optional upgrades (only if needed)
- [ ] **Container backend** (ROS ≥ 7.20): small proxy for WebSocket
      push / multi-router aggregation — only if polling proves limiting
- [ ] Binary API client (port 8728) for `monitor-traffic` streaming and
      lower latency — only if REST proves insufficient
- [ ] Multi-router support: sidebar router picker, per-router stored creds

## Engineering rules

- No build step, no npm, no CDN — everything must work from Files/ offline.
- Read-only by default; every write needs explicit confirmation + toast.
- All RouterOS values are strings — always go through `fmt.*` helpers.
- Never call REST as `admin`; always as the limited `avui` user.
- Keep views self-contained: one function per page, all DOM via
  `innerHTML` with `fmt.esc` on every dynamic value (XSS-safe).
- Deploy must stay a single script; `.rsc` setup must be idempotent.

## Testing

- Primary: deploy.sh against the RB5009, manual click-through per page.
- Dev loop without a router: `python3 scripts/mock-rest.py [port]` serves
  the static files plus a fake `/rest/*` (realistic RB5009 data, live
  jittered `monitor-traffic`, Basic-auth check). Any credentials work;
  `bad`/`bad` returns 401.
- Browser support: current Firefox/Chrome/Safari (AV operators use iPads too —
  keep touch targets ≥ 32 px).

## Out of scope (for now)

- Wireless/CAPsMAN (RB5009 has none; revisit if needed)
- Routing protocols, MPLS, VPN tunnels
- User management UI (stays in WebFig/CLI)
