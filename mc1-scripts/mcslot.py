#!/usr/bin/env python3
"""mcslot v2 (MC1)
One slot at a time. Each customer account has its own world (w-user-<user_id>).
Each slot gets a new DigitalOcean Reserved IP that was never used before.

  sudo mcslot start <booking_id> <user_id>   open the customer's world, get a new IP
  sudo mcslot end                            kick everyone, save world, return the IP
  sudo mcslot status                         show the running slot
  sudo mcslot players                        print online player names, one per line
  sudo mcslot rcon <command> [...]           run Minecraft commands through RCON
"""
import datetime, json, os, re, socket, subprocess, sys, time, urllib.request, urllib.error

DROPLET_ID = 606881424
D = "/etc/mc-slot"
STATE = f"{D}/current.json"
USED = f"{D}/used_ips.txt"
SERVER = "/media/admin/01DD0E0A2A61B090/mcserver"
PROPS = f"{SERVER}/server.properties"
MCRCON = f"{SERVER}/mcrcon/mcrcon"
API = "https://api.digitalocean.com/v2"
ADMIN_WORLD = "world"
BAR = "mc:slot"


def log(*a):
    print(*a, flush=True)


# ---------- DigitalOcean Reserved IP ----------
def token():
    return open(f"{D}/do_token").read().strip()


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": "Bearer " + token(),
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"API error {e.code} {method} {path}: {e.read().decode()[:300]}")


def used():
    return set(open(USED).read().split()) if os.path.exists(USED) else set()


def wait_assigned(ip, want):
    for _ in range(40):
        try:
            d = api("GET", f"/reserved_ips/{ip}")["reserved_ip"].get("droplet")
        except SystemExit as e:
            if "404" in str(e):
                time.sleep(3)
                continue
            raise
        if (d is not None and d["id"] == DROPLET_ID) if want else d is None:
            return
        time.sleep(3)
    sys.exit(f"รอ {ip} นานเกินไป")


def release(ip):
    try:
        cur = api("GET", f"/reserved_ips/{ip}")["reserved_ip"].get("droplet")
    except SystemExit as e:
        if "404" in str(e):
            log("ไม่พบ", ip, "ในบัญชี (อาจคืนไปแล้ว)")
            return
        raise
    if cur is not None:
        api("POST", f"/reserved_ips/{ip}/actions", {"type": "unassign"})
        wait_assigned(ip, False)
    for _ in range(24):
        req = urllib.request.Request(f"{API}/reserved_ips/{ip}", method="DELETE",
                                     headers={"Authorization": "Bearer " + token()})
        try:
            urllib.request.urlopen(req, timeout=30)
            return
        except urllib.error.HTTPError as e:
            if e.code != 422:
                sys.exit(f"API error {e.code} DELETE {ip}: {e.read().decode()[:300]}")
        time.sleep(5)
    sys.exit(f"คืน {ip} ไม่สำเร็จภายใน 2 นาที")


def quiet_release(ip):
    try:
        release(ip)
    except SystemExit as e:
        log("คืน", ip, "ไม่สำเร็จ ต้องคืนเอง:", e)


def new_ip():
    for _ in range(5):
        ip = api("POST", "/reserved_ips", {"droplet_id": DROPLET_ID})["reserved_ip"]["ip"]
        seen = ip in used()
        with open(USED, "a") as f:
            f.write(ip + "\n")
        try:
            wait_assigned(ip, True)
        except BaseException:
            quiet_release(ip)
            raise
        if not seen:
            return ip
        log(f"ได้ {ip} ซึ่งเคยใช้แล้ว คืนแล้วขอใหม่")
        release(ip)
    sys.exit("ขอ IP ที่ไม่ซ้ำไม่ได้ใน 5 ครั้ง")


# ---------- Minecraft server ----------
def prop(key):
    for line in open(PROPS, encoding="utf-8"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return ""


def set_props(values):
    lines = open(PROPS, encoding="utf-8").read().splitlines()
    out, seen = [], set()
    for line in lines:
        k = line.split("=", 1)[0]
        if k in values:
            out.append(f"{k}={values[k]}")
            seen.add(k)
        else:
            out.append(line)
    for k, v in values.items():
        if k not in seen:
            out.append(f"{k}={v}")
    open(PROPS, "w", encoding="utf-8").write("\n".join(out) + "\n")


def rcon(*cmds):
    return subprocess.run([MCRCON, "-H", "127.0.0.1", "-P", prop("rcon.port") or "25575",
                           "-p", prop("rcon.password"), *cmds],
                          capture_output=True, text=True, timeout=30)


def server_active():
    return subprocess.run(["systemctl", "is-active", "--quiet", "minecraft"]).returncode == 0


def server(action):
    subprocess.run(["systemctl", action, "minecraft"], check=True, timeout=180)


def wait_ready(limit=300):
    t0 = time.time()
    while time.time() - t0 < limit:
        try:
            with socket.create_connection(("127.0.0.1", 25565), timeout=2):
                pass
            if rcon("list").returncode == 0:
                return time.time() - t0
        except (OSError, subprocess.SubprocessError):
            pass
        time.sleep(3)
    sys.exit("server ไม่พร้อมภายใน 5 นาที")


def open_world(user_id):
    world = f"w-user-{int(user_id)}"
    if server_active():
        server("stop")
    set_props({"level-name": world, "white-list": "false", "enforce-whitelist": "false"})
    server("start")
    secs = wait_ready()
    log(f"เปิดโลก {world} แล้ว ใช้เวลา {secs:.0f} วินาที")
    return world


def close_world():
    if server_active():
        try:
            rcon(f"bossbar remove {BAR}", "say Your slot has ended. Thank you for playing!",
                 "kick @a Your slot has ended")
        except subprocess.SubprocessError:
            pass
        time.sleep(2)
        server("stop")
    set_props({"level-name": ADMIN_WORLD, "white-list": "true", "enforce-whitelist": "true"})


def players():
    text = re.sub(r"\x1b\[[0-9;]*m|\u00a7.", "", rcon("list").stdout)
    if ":" not in text:
        return []
    names = [n.strip() for n in text.split(":", 1)[1].replace("\n", ",").split(",")]
    return [n for n in names if re.fullmatch(r"[A-Za-z0-9_]{1,16}", n)]


# ---------- commands ----------
def start(booking_id, user_id):
    if os.path.exists(STATE):
        sys.exit("มี slot ทำงานอยู่แล้ว ต้องจบก่อนด้วย: sudo mcslot end")
    world = open_world(user_id)
    try:
        ip = new_ip()
    except BaseException:
        close_world()
        raise
    json.dump({"ip": ip, "booking": str(booking_id), "user_id": int(user_id), "world": world,
               "start": datetime.datetime.now().isoformat(timespec="seconds")}, open(STATE, "w"))
    log(f"เริ่ม slot แล้ว ให้ลูกค้าต่อที่ {ip}")


def end():
    if not os.path.exists(STATE):
        sys.exit("ไม่มี slot ที่ทำงานอยู่")
    s = json.load(open(STATE))
    close_world()
    release(s["ip"])
    os.remove(STATE)
    log(f"จบ slot แล้ว คืน {s['ip']} เรียบร้อย")


def main():
    cmd = sys.argv[1:] or ["help"]
    if cmd[0] == "start" and len(cmd) == 3:
        start(cmd[1], cmd[2])
    elif cmd[0] == "end":
        end()
    elif cmd[0] == "status":
        print(json.load(open(STATE)) if os.path.exists(STATE) else "ไม่มี slot ทำงานอยู่")
    elif cmd[0] == "players":
        print("\n".join(players()))
    elif cmd[0] == "rcon" and len(cmd) > 1:
        r = rcon(*cmd[1:])
        print(r.stdout, end="")
        sys.exit(r.returncode)
    else:
        print(__doc__)


main()
