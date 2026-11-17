#!/usr/bin/env python3
"""Dev mock for the RouterOS REST API.

Serves the SPA's static files AND answers /rest/* GET/POST requests with
plausible RB5009 data — lets you develop the UI without touching a router.

Usage:
    python3 scripts/mock-rest.py [port]     # default 8080
    # then open http://localhost:8080/index.html
    # any username/password is accepted except the pair  bad/bad  (401)

Only for local development. Values mimic RouterOS: everything is a string.
"""
import base64
import json
import random
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

UPLINK_EPOCH = time.time() - 86400 * 14 - 3600 * 7

# Deterministic-ish interface set: RB5009 = ether1-8 + sfp-sfpplus1, plus VLANs
IFACES = [
    {"name": "ether1", "type": "ether", "comment": "uplink"},
    {"name": "ether2", "type": "ether", "comment": "AoIP primary"},
    {"name": "ether3", "type": "ether", "comment": "AoIP secondary"},
    {"name": "ether4", "type": "ether", "comment": "lighting desk"},
    {"name": "ether5", "type": "ether", "comment": "video rack"},
    {"name": "ether6", "type": "ether", "comment": "spare"},
    {"name": "ether7", "type": "ether", "comment": ""},
    {"name": "ether8", "type": "ether", "comment": "management"},
    {"name": "sfp-sfpplus1", "type": "ether", "comment": "10G to core switch"},
]
RUNNING = {"ether1", "ether2", "ether3", "ether4", "ether5", "ether8", "sfp-sfpplus1"}

VLANS = [
    {"name": "vlan10-aoip-a", "vlan-id": "10", "interface": "bridge1", "comment": "Dante primary"},
    {"name": "vlan20-aoip-b", "vlan-id": "20", "interface": "bridge1", "comment": "Dante secondary"},
    {"name": "vlan30-light", "vlan-id": "30", "interface": "bridge1", "comment": "sACN/Art-Net"},
    {"name": "vlan40-video", "vlan-id": "40", "interface": "bridge1", "comment": "NDI / ST2110"},
    {"name": "vlan41-video2", "vlan-id": "41", "interface": "bridge1", "comment": "video backup"},
    {"name": "vlan99-infra", "vlan-id": "99", "interface": "bridge1", "comment": "management"},
]


def _iface_rows():
    out = []
    for i, f in enumerate(IFACES):
        up = f["name"] in RUNNING
        out.append({
            ".id": f"*{i+1:X}",
            "name": f["name"], "type": f["type"],
            "running": "true" if up else "false",
            "disabled": "false",
            "rx-byte": str(random.randint(10**8, 10**11)),
            "tx-byte": str(random.randint(10**8, 10**11)),
            "comment": f["comment"],
        })
    for i, v in enumerate(VLANS):
        out.append({
            ".id": f"*{100+i:X}", "name": v["name"], "type": "vlan",
            "running": "true", "disabled": "false",
            "rx-byte": str(random.randint(10**7, 10**10)),
            "tx-byte": str(random.randint(10**7, 10**10)),
            "comment": v["comment"],
        })
    return out


DATA = {
    "/system/identity": {"name": "av-core-rb5009"},
    "/interface": _iface_rows(),
    "/interface/vlan": [
        {".id": f"*{i+1:X}", "name": v["name"], "vlan-id": v["vlan-id"],
         "interface": v["interface"], "running": "true", "disabled": "false",
         "comment": v["comment"]}
        for i, v in enumerate(VLANS)
    ],
    "/system/routerboard": {
        "model": "RB5009UG+S+", "board-name": "RB5009UG+S+",
        "serial-number": "HEF40ABCD12", "current-firmware": "7.20.4",
        "upgrade-firmware": "7.20.4", "routerboard": "true",
    },
    "/system/clock": {
        "date": time.strftime("%b/%d/%Y").lower(),
        "time": time.strftime("%H:%M:%S"),
        "time-zone-name": "Europe/Paris", "gmt-offset": "+01:00",
    },
    "/system/health": {
        "voltage": "24.2", "temperature": "42", "cpu-temperature": "55",
    },
    "/ip/address": [
        {".id": "*1", "address": "192.168.88.1/24", "network": "192.168.88.0",
         "interface": "bridge1", "actual-interface": "bridge1",
         "dynamic": "false", "disabled": "false", "comment": "mgmt"},
        {".id": "*2", "address": "10.10.10.1/24", "network": "10.10.10.0",
         "interface": "vlan10-aoip-a", "actual-interface": "vlan10-aoip-a",
         "dynamic": "false", "disabled": "false", "comment": "Dante A"},
        {".id": "*3", "address": "10.20.20.1/24", "network": "10.20.20.0",
         "interface": "vlan20-aoip-b", "actual-interface": "vlan20-aoip-b",
         "dynamic": "false", "disabled": "false", "comment": "Dante B"},
        {".id": "*4", "address": "10.30.30.1/24", "network": "10.30.30.0",
         "interface": "vlan30-light", "actual-interface": "vlan30-light",
         "dynamic": "false", "disabled": "false", "comment": "lighting"},
        {".id": "*5", "address": "10.40.40.1/24", "network": "10.40.40.0",
         "interface": "vlan40-video", "actual-interface": "vlan40-video",
         "dynamic": "false", "disabled": "false", "comment": "video"},
        {".id": "*6", "address": "10.99.99.1/24", "network": "10.99.99.0",
         "interface": "vlan99-infra", "actual-interface": "vlan99-infra",
         "dynamic": "false", "disabled": "false", "comment": "infra"},
    ],
    "/ip/pool": [
        {".id": "*1", "name": "dhcp-aoip-a", "ranges": "10.10.10.100-10.10.10.199"},
        {".id": "*2", "name": "dhcp-light", "ranges": "10.30.30.100-10.30.30.199"},
    ],
    "/ip/dhcp-server/lease": [
        {".id": "*1", "address": "10.10.10.101", "mac-address": "B8:27:EB:D1:00:01",
         "host-name": "dante-mixer-01", "active-interface": "vlan10-aoip-a",
         "expires-after": "45m12s", "dynamic": "true", "status": "bound"},
        {".id": "*2", "address": "10.10.10.102", "mac-address": "B8:27:EB:D1:00:02",
         "host-name": "dante-stagebox-01", "active-interface": "vlan10-aoip-a",
         "expires-after": "51m03s", "dynamic": "true", "status": "bound"},
        {".id": "*3", "address": "10.30.30.105", "mac-address": "00:1A:79:L1:00:10",
         "host-name": "grandma-onpc", "active-interface": "vlan30-light",
         "expires-after": "1h02m", "dynamic": "false", "status": "bound"},
        {".id": "*4", "address": "10.40.40.55", "mac-address": "DC:A6:32:V1:00:20",
         "host-name": "ndi-encoder-01", "active-interface": "vlan40-video",
         "expires-after": "38m44s", "dynamic": "true", "status": "bound"},
    ],
    "/ip/arp": [
        {"address": "10.10.10.101", "mac-address": "B8:27:EB:D1:00:01",
         "interface": "vlan10-aoip-a", "complete": "true", "dynamic": "true"},
        {"address": "10.10.10.102", "mac-address": "B8:27:EB:D1:00:02",
         "interface": "vlan10-aoip-a", "complete": "true", "dynamic": "true"},
        {"address": "10.30.30.105", "mac-address": "00:1A:79:L1:00:10",
         "interface": "vlan30-light", "complete": "true", "dynamic": "true"},
        {"address": "10.40.40.55", "mac-address": "DC:A6:32:V1:00:20",
         "interface": "vlan40-video", "complete": "true", "dynamic": "true"},
        {"address": "10.40.40.77", "mac-address": "",
         "interface": "vlan40-video", "complete": "false", "dynamic": "true"},
    ],
    "/ip/firewall/filter": [
        {".id": "*1", "chain": "input", "action": "accept",
         "src-address": "10.99.99.0/24", "protocol": "tcp",
         "disabled": "false", "comment": "mgmt to router"},
        {".id": "*2", "chain": "forward", "action": "accept",
         "src-address": "10.10.10.0/24", "dst-address": "10.20.20.0/24",
         "protocol": "udp", "disabled": "false",
         "comment": "Dante A<->B (multicast/flows)"},
        {".id": "*3", "chain": "forward", "action": "drop",
         "src-address": "10.30.30.0/24", "dst-address": "10.40.40.0/24",
         "disabled": "false", "comment": "isolate lighting from video"},
        {".id": "*4", "chain": "input", "action": "drop",
         "src-address": "0.0.0.0/0", "disabled": "false", "comment": "drop all"},
    ],
    "/ip/firewall/nat": [
        {".id": "*1", "chain": "srcnat", "action": "masquerade",
         "src-address": "192.168.88.0/24", "out-interface": "ether1",
         "disabled": "false", "comment": "mgmt internet"},
    ],
}

# Per-interface traffic profile (bps) for monitor-traffic realism
TRAFFIC_PROFILE = {
    "ether1": (200_000_000, 80_000_000),
    "ether2": (450_000_000, 420_000_000),   # Dante primary — busy
    "ether3": (40_000_000, 38_000_000),
    "ether4": (150_000_000, 20_000_000),    # sACN floods
    "ether5": (1_800_000_000, 50_000_000),  # video-over-IP heavy RX
    "ether8": (5_000_000, 12_000_000),
    "sfp-sfpplus1": (2_300_000_000, 900_000_000),
}
DEFAULT_TRAFFIC = (1_000_000, 500_000)


def jitter(v):
    return int(v * random.uniform(0.85, 1.15))


def monitor_traffic(body):
    name = body.get("interface") if isinstance(body, dict) else None
    rows = []
    for f in IFACES:
        if name and f["name"] != name:
            continue
        up = f["name"] in RUNNING
        rx, tx = TRAFFIC_PROFILE.get(f["name"], DEFAULT_TRAFFIC)
        rows.append({
            "name": f["name"],
            "rx-bits-per-second": str(jitter(rx) if up else 0),
            "tx-bits-per-second": str(jitter(tx) if up else 0),
            "rx-packets-per-second": str(random.randint(100, 90000) if up else 0),
            "tx-packets-per-second": str(random.randint(100, 90000) if up else 0),
        })
    if name:
        return rows[0] if rows else {}
    return rows


def _ros_uptime(secs):
    # RouterOS format: "2d20h12m20s"
    d, rem = divmod(secs, 86400)
    h, rem = divmod(rem, 3600)
    m, s = divmod(rem, 60)
    out = ""
    if d: out += f"{d}d"
    if h: out += f"{h}h"
    if m: out += f"{m}m"
    return out + f"{s}s"


def system_resource():
    return {
        "uptime": _ros_uptime(int(time.time() - UPLINK_EPOCH)),
        "version": "7.20.4 (stable)",
        "architecture-name": "arm64",
        "cpu": "ARM64", "cpu-count": "4", "cpu-frequency": "1400",
        "cpu-load": str(random.randint(4, 35)),
        "free-memory": str(random.randint(800_000_000, 950_000_000)),
        "total-memory": "1073741824",
        "free-hdd-space": str(random.randint(900_000_000, 1_000_000_000)),
        "total-hdd-space": "1073741824",
        "board-name": "RB5009UG+S+", "platform": "MikroTik",
    }


class Handler(BaseHTTPRequestHandler):
    def _auth_ok(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Basic "):
            return False
        try:
            decoded = base64.b64decode(auth[6:]).decode()
            return decoded != "bad:bad"
        except Exception:
            return False

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _rest_path(self):
        # strip /rest prefix and query string
        p = self.path.split("?", 1)[0]
        if p.startswith("/rest"):
            return p[5:] or "/"
        return None

    def do_GET(self):
        rp = self._rest_path()
        if rp is None:
            return self._serve_static()
        if not self._auth_ok():
            return self._send_json({"message": "Unauthorized"}, 401)
        if rp == "/system/resource":
            return self._send_json(system_resource())
        if rp in DATA:
            return self._send_json(DATA[rp])
        return self._send_json({"detail": f"mock: no data for {rp}"}, 404)

    def do_POST(self):
        rp = self._rest_path()
        if rp is None:
            return self._send_json({"detail": "not found"}, 404)
        if not self._auth_ok():
            return self._send_json({"message": "Unauthorized"}, 401)
        length = int(self.headers.get("Content-Length") or 0)
        body = {}
        if length:
            try:
                body = json.loads(self.rfile.read(length))
            except Exception:
                body = {}
        if rp == "/interface/monitor-traffic":
            return self._send_json(monitor_traffic(body))
        return self._send_json({"mock": "post accepted", "path": rp, "args": body})

    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_GET

    def _serve_static(self):
        p = self.path.split("?", 1)[0]
        if p == "/":
            p = "/index.html"
        f = (ROOT / p.lstrip("/")).resolve()
        if not str(f).startswith(str(ROOT)) or not f.is_file():
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"not found")
            return
        ctype = {
            ".html": "text/html", ".css": "text/css",
            ".js": "application/javascript", ".json": "application/json",
            ".svg": "image/svg+xml",
        }.get(f.suffix, "application/octet-stream")
        body = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # quieter logs
        sys.stderr.write(f"  {self.address_string()} {fmt % args}\n")


if __name__ == "__main__":
    print(f"AV-Router dev mock on http://localhost:{PORT}")
    print(f"  UI:   http://localhost:{PORT}/index.html")
    print(f"  REST: http://localhost:{PORT}/rest/system/identity")
    print("  (any credentials work; bad/bad returns 401)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
