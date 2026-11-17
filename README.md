# AV-Router UI

A minimal, dedicated web UI for MikroTik RouterOS 7 — built for AV/professional
production networks (AoIP, lighting, video-over-IP, infrastructure VLANs).
Alternative to WebFig: fewer pages, only what an AV operator needs.

## How it works

- Static SPA (vanilla JS, no build, ~30 KB) served **from the router itself**
  (`Files/avui/` via the `www-ssl` service).
- Talks to the built-in **REST API** (`/rest/*`, same origin → no CORS issues).
- Credentials: HTTP Basic auth, stored in `sessionStorage` only (per-tab,
  never written to disk).

```
Browser ──https://router/avui/index.html──> RouterOS www-ssl (static files)
Browser ──https://router/rest/...─────────> RouterOS REST API (Basic auth)
```

## Install

1. **Router side** — run once in a terminal (Winbox/WebFig → New Terminal):
   ```
   /import file-name=routeros-setup.rsc
   ```
   (upload `setup/routeros-setup.rsc` to Files first, or paste its contents).
   It creates: a self-signed TLS cert, enables `www-ssl`, a limited `avui`
   user, and the `Files/avui/` directory. Edit `ROUTERIP`/`APIPASS` first.

2. **Deploy the UI** from your workstation:
   ```sh
   ROUTER_IP=192.168.88.1 ROUTER_USER=admin ./scripts/deploy.sh
   ```

3. Open `https://<router-ip>/avui/index.html`, log in as `avui`.

## Pages

| Page | REST endpoints | Shows |
|---|---|---|
| Dashboard | `system/resource`, `system/routerboard`, `interface`, `interface/monitor-traffic` | health, uptime, live RX/TX |
| Interfaces | `interface` | status, counters, comments |
| VLANs | `interface/vlan` | VID ↔ parent mapping — your AoIP/lighting/video VLANs |
| IPs & DHCP | `ip/address`, `ip/dhcp-server/lease`, `ip/arp` | subnets, connected devices |
| Firewall | `ip/firewall/filter`, `ip/firewall/nat` | read-only rule review |
| System | `system/*` | identity, clock, health sensors |

## Notes

- Read-mostly by design. Writes go through `Api.exec()` (POST = run command) —
  add them deliberately.
- `www` (HTTP) works too but sends credentials in cleartext — use `www-ssl`.
- RouterOS ≥ 7.9 recommended. Developed/tested target: RB5009.
