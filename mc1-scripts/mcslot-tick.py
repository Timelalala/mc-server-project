#!/usr/bin/env python3
"""mcslot-tick v2 (MC1), run every minute by mc-slot-tick.timer.
Reads confirmed bookings from the website, opens/ends slots with mcslot,
merges back-to-back slots of the same customer, and reports IP + online players back.
If the website cannot be reached, it keeps working from the last bookings it saw
and queues the reports until the website is back.
"""
import datetime, json, os, subprocess, urllib.request
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Bangkok")
D = "/etc/mc-slot"
ACTIVE, DONE, STATE = f"{D}/active_booking.json", f"{D}/done.json", f"{D}/current.json"
CACHE, OUTBOX = f"{D}/bookings_cache.json", f"{D}/outbox.json"
WEB = "http://127.0.0.1:5000/api/mc"
MCSLOT = "/usr/local/bin/mcslot"
MAX_TRIES = 3
BAR = "mc:slot"


def load(p, default):
    try:
        return json.load(open(p))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save(p, obj):
    json.dump(obj, open(p, "w"), ensure_ascii=False, indent=1)


def parse(t):
    return datetime.datetime.fromisoformat(t).replace(tzinfo=TZ)


# ---------- website ----------
def web(method, path, body=None):
    key = open(f"{D}/web_key").read().strip()
    req = urllib.request.Request(WEB + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-MC-Key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=8) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def bookings():
    try:
        data = web("GET", "/bookings")
        save(CACHE, data)
        return data
    except Exception as e:
        print("ติดต่อเว็บไม่ได้ ใช้ข้อมูลการจองล่าสุดที่จำไว้:", e)
        return load(CACHE, [])


def flush():
    box = load(OUTBOX, [])
    for i, item in enumerate(box):
        try:
            web("POST", f"/bookings/{item['id']}/status", item["body"])
        except Exception as e:
            print("ส่งสถานะให้เว็บไม่ได้ เก็บไว้ส่งรอบหน้า:", e)
            save(OUTBOX, box[i:])
            return
    save(OUTBOX, [])


def report(booking_id, body):
    box = load(OUTBOX, [])
    if body.get("status") == "online":  # keep only the newest "online" per booking
        box = [x for x in box if not (x["id"] == booking_id and x["body"].get("status") == "online")]
    box.append({"id": booking_id, "body": body})
    save(OUTBOX, box)
    flush()


# ---------- slot helpers ----------
def mc(*args):
    r = subprocess.run([MCSLOT, *args], capture_output=True, text=True)
    if r.stdout.strip():
        print(r.stdout.strip())
    if r.stderr.strip():
        print(r.stderr.strip())
    return r


def show_bar(active, now):
    end = parse(active["end"])
    start = parse(active["start"])
    total = max(1, int((end - start).total_seconds() // 60))
    left = max(0, int(((end - now).total_seconds() + 59) // 60))
    color = "green" if left > 10 else "yellow" if left > 5 else "red"
    subprocess.run([MCSLOT, "rcon",
                    f'bossbar add {BAR} {{"text":"Slot"}}',
                    f"bossbar set {BAR} max {total}",
                    f"bossbar set {BAR} value {min(left, total)}",
                    f"bossbar set {BAR} color {color}",
                    f'bossbar set {BAR} name {{"text":"Time left: {left} min (ends {end:%H:%M})"}}',
                    f"bossbar set {BAR} players @a",
                    f"bossbar set {BAR} visible true"], capture_output=True)


def main():
    now = datetime.datetime.now(TZ)
    flush()
    done = load(DONE, {})
    active = load(ACTIVE, None)
    books = bookings()

    if active:
        end = parse(active["end"])
        if now >= end:
            nxt = next((b for b in books
                        if str(b["id"]) not in done and str(b["id"]) != active["id"]
                        and b.get("user_id") == active["user_id"] and b["start"] == active["end"]), None)
            if nxt and os.path.exists(STATE):
                ip = load(STATE, {}).get("ip")
                report(active["id"], {"status": "ended"})
                done[active["id"]] = "merged"
                save(DONE, done)
                active = {"id": str(nxt["id"]), "user_id": nxt["user_id"],
                          "start": nxt["start"], "end": nxt["end"], "warned": False}
                save(ACTIVE, active)
                report(active["id"], {"status": "started", "ip": ip, "players": []})
                print("ต่อรอบให้ลูกค้าคนเดิม การจอง", active["id"], "ไม่ปิด server")
                show_bar(active, now)
                return
            ok = True
            if os.path.exists(STATE):
                ok = mc("end").returncode == 0
            if ok:
                report(active["id"], {"status": "ended"})
                done[active["id"]] = "ended"
                save(DONE, done)
                os.remove(ACTIVE)
                print("จบ slot การจอง", active["id"])
            else:
                print("จบ slot ไม่สำเร็จ จะลองใหม่นาทีหน้า")
            return
        names = mc("players").stdout.split()
        report(active["id"], {"status": "online", "players": names})
        show_bar(active, now)
        if (end - now).total_seconds() <= 300 and not active.get("warned"):
            subprocess.run([MCSLOT, "rcon", "say Your slot ends in 5 minutes."], capture_output=True)
            active["warned"] = True
            save(ACTIVE, active)
        return

    if os.path.exists(STATE):
        print("มี slot ที่เริ่มด้วยมืออยู่ ข้ามรอบนี้")
        return

    for b in books:
        bid = str(b["id"])
        if bid in done:
            continue
        if parse(b["start"]) <= now < parse(b["end"]):
            active = {"id": bid, "user_id": b["user_id"], "start": b["start"], "end": b["end"], "warned": False}
            save(ACTIVE, active)
            if mc("start", bid, str(b["user_id"])).returncode != 0:
                os.remove(ACTIVE)
                tries = done.get("tries:" + bid, 0) + 1
                done["tries:" + bid] = tries
                if tries >= MAX_TRIES:
                    done[bid] = "failed"
                    print("เริ่มการจอง", bid, "ไม่สำเร็จครบ", MAX_TRIES, "ครั้ง เลิกลอง")
                save(DONE, done)
            else:
                report(bid, {"status": "started", "ip": load(STATE, {}).get("ip"), "players": []})
                show_bar(active, now)
            return


main()
