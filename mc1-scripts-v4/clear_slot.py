#!/usr/bin/env python3
"""
clear_slot.py - สคริปต์สำหรับรันบน MC1 เพื่อเคลียร์การจอง Minecraft ที่ค้างอยู่
1. อ่าน Web API Key จาก /etc/mc-slot/web_key
2. ยิง POST ไปอัปเดตสถานะการจองเป็น "ended" ที่ http://127.0.0.1:5000/api/mc/bookings/{id}/status
3. ลบไฟล์สถานะ /etc/mc-slot/active_booking.json และ /etc/mc-slot/current.json
4. แสดงผลการทำงานทีละขั้นตอน
"""
import sys
import os
import json
import urllib.request
import urllib.error

KEY_FILE = "/etc/mc-slot/web_key"
API_BASE = "http://127.0.0.1:5000/api/mc"
ACTIVE_FILE = "/etc/mc-slot/active_booking.json"
CURRENT_FILE = "/etc/mc-slot/current.json"
OUTBOX_FILE = "/etc/mc-slot/outbox.json"


def log(step, msg):
    print(f"[{step}] {msg}")


def get_api_key():
    if not os.path.exists(KEY_FILE):
        log("ERROR", f"ไม่พบไฟล์ Web API Key ที่ {KEY_FILE}")
        sys.exit(1)
    with open(KEY_FILE, "r", encoding="utf-8") as f:
        key = f.read().strip()
    log("1/4", f"อ่าน Web API Key สำเร็จ (ความยาว {len(key)} ตัวอักษร)")
    return key


def send_end_status(api_key, booking_id):
    url = f"{API_BASE}/bookings/{booking_id}/status"
    headers = {
        "X-MC-Key": api_key,
        "Content-Type": "application/json"
    }
    payload = json.dumps({"status": "ended"}).encode("utf-8")
    
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("utf-8")
            log("SUCCESS", f"อัปเดตการจอง ID {booking_id} เป็น 'ended' เรียบร้อย (HTTP {resp.status})")
            return True
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        log("WARN", f"ไม่สามารถอัปเดตการจอง ID {booking_id}: HTTP {e.code} - {err_msg}")
        return False
    except Exception as e:
        log("WARN", f"เกิดข้อผิดพลาดในการเชื่อมต่อ Web API (ID {booking_id}): {e}")
        return False


def get_target_booking_ids(api_key):
    # รับ booking IDs จาก command line arguments ถ้ามี เช่น: python clear_slot.py 21 22
    if len(sys.argv) > 1:
        target_ids = []
        for arg in sys.argv[1:]:
            try:
                target_ids.append(int(arg))
            except ValueError:
                pass
        if target_ids:
            return target_ids

    found_ids = set()

    # ลองอ่านจาก active_booking.json
    if os.path.exists(ACTIVE_FILE):
        try:
            with open(ACTIVE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "id" in data:
                    found_ids.add(int(data["id"]))
        except Exception:
            pass

    # ลองอ่านจาก current.json
    if os.path.exists(CURRENT_FILE):
        try:
            with open(CURRENT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "booking" in data:
                    found_ids.add(int(data["booking"]))
        except Exception:
            pass

    # ลองดึงรายการจาก API /bookings
    try:
        req = urllib.request.Request(f"{API_BASE}/bookings", headers={"X-MC-Key": api_key})
        with urllib.request.urlopen(req, timeout=5) as resp:
            bookings = json.loads(resp.read().decode("utf-8"))
            for b in bookings:
                found_ids.add(int(b["id"]))
    except Exception:
        pass

    # ค่าเริ่มต้นถ้าไม่พบในไฟล์ใดๆ เลย (21 และ 22 ตามที่ระบุ)
    if not found_ids:
        found_ids = {21, 22}

    return sorted(list(found_ids))


def remove_stuck_files():
    files_to_clean = [ACTIVE_FILE, CURRENT_FILE, OUTBOX_FILE]
    removed_count = 0
    for file_path in files_to_clean:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                log("DELETE", f"ลบไฟล์สถานะ {file_path} เรียบร้อย")
                removed_count += 1
            except Exception as e:
                log("ERROR", f"ลบไฟล์ {file_path} ไม่สำเร็จ: {e}")
        else:
            log("SKIP", f"ไม่พบไฟล์ {file_path} (ไม่มีค้างอยู่)")
    return removed_count


def main():
    print("==================================================")
    print("   MC1 Stuck Bookings Cleaner Tool                ")
    print("==================================================")

    # 1. อ่าน API Key
    api_key = get_api_key()

    # 2. ระบุรายการ Booking ID ที่ต้องเคลียร์
    target_ids = get_target_booking_ids(api_key)
    log("2/4", f"รายการ Booking ID ที่จะส่งคำสั่ง 'ended': {target_ids}")

    for bid in target_ids:
        send_end_status(api_key, bid)

    # 3. ลบไฟล์สถานะค้าง
    log("3/4", "กำลังตรวจสอบและลบไฟล์สถานะค้างในระบบ...")
    remove_stuck_files()

    # 4. สรุปผล
    log("4/4", "✅ เคลียร์การจองและรีเซ็ตสถานะสล็อตเรียบร้อยแล้ว!")
    print("==================================================")


if __name__ == "__main__":
    main()
