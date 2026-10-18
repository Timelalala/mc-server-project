# HANDOVER: ระบบจองเซิร์ฟเวอร์ Minecraft

อัปเดตล่าสุด: 16 ต.ค. 2026
เอกสารนี้อธิบายระบบตามที่ทำงานจริง (ตรวจสอบแล้ว) ใช้ส่งต่องานให้คนหรือ AI ตัวถัดไป

> กติกาสำหรับผู้ช่วย/AI ที่อ่านไฟล์นี้: ตอบเป็นภาษาไทย ระบุทุกคำสั่งว่ารันที่เครื่องไหน
> ([Windows] / [MC1] / [MC2–MC4]) ทำทีละขั้นและรอผลก่อน backup ไฟล์ก่อนแก้เสมอ
> และห้ามแสดง key/รหัสผ่านเต็ม ๆ

---

## 1. ภาพรวม

```
ลูกค้า ──▶ เว็บจอง (React)  ──▶ backend (Express :5000)   [โน้ตบุ๊ก Windows]
                                      ▲
                     reverse SSH tunnel (MC1:127.0.0.1:5000 → Windows:5000)
                                      │
                                    MC1  (ตัวควบคุม + รัน Java Survival)
                 ┌────────────────────┼────────────────────┐
                MC2                  MC3                  MC4      (วงแลน 192.168.137.x)

ผู้เล่น ──▶ Reserved IP (DigitalOcean) ──WireGuard──▶ MC1 :25565 ──DNAT──▶ โหนด:พอร์ตเกม
```

- backend เข้าโหนดตรง ๆ ไม่ได้ (คนละวงแลน) **ทุกอย่างที่ต้องแตะโหนดต้องทำผ่าน MC1**
- MC1 คุยกับ backend ทาง `http://127.0.0.1:5000/api/mc/...` ผ่าน tunnel ด้วย header `X-MC-Key`

## 2. เครื่องและเครือข่าย

| เครื่อง | IP | หน้าที่ |
|---|---|---|
| Windows (LENOVO) | วง 172.29.93.x (Wi-Fi) | backend, frontend, Task Scheduler |
| MC1 (Pi, user `admin`) | wlan0 `172.29.93.15` (DHCP), bond0 `192.168.137.1`, wg0–wg3 | ตัวควบคุม, DHCP (dnsmasq) ของวง 137, รันเกม server 1 |
| MC2 | `192.168.137.11` (eth0) | RLCraft |
| MC3 | `192.168.137.12` (eth0) | RL Dregora |
| MC4 | `192.168.137.13` (eth0) | Pixelmon |

- dnsmasq บน MC1 จอง IP ไว้: mc2=.11, mc3=.12, mc4=.13, switch=.199
- ชื่อ `MC1.local` (mDNS) **ใช้ไม่ได้เสถียรบน Windows** ให้ใช้ IP `172.29.93.15` เป็นหลัก
- Wi-Fi ระหว่างโน้ตบุ๊กกับ MC1 สะดุดเป็นช่วง ๆ (tunnel ต่อใหม่เองได้)
- ค่า `ip` / `pi_host` ในตาราง `servers` ของฐานข้อมูล (192.168.1.x) **เป็นค่าเก่า ห้ามใช้**

## 3. เซิร์ฟเวอร์เกม (ตรงกับ /etc/mc-slot/nodes.json)

| server_id | เกม | เครื่อง | service | พอร์ตเกม | RCON |
|---|---|---|---|---|---|
| 1 | Java Survival | MC1 (local) | minecraft | 25565 | |
| 2 | RLCraft 1.12.2 | MC2 | rlcraft | 25566 | |
| 3 | RL Dregora 1.12.2 | MC3 | dregora | 25567 | 25577 |
| 4 | Pixelmon 1.16.5 | MC4 | pixelmon | 25568 | |

- ทุก service ตั้ง `disabled` (ไม่เปิดเองตอนบูต) tick หรือ agent เป็นคนสั่ง start/stop
- ผู้เล่นใส่แค่ IP ไม่ต้องใส่พอร์ต (MC1 DNAT พอร์ต 25565 → พอร์ตจริงของโหนด)

## 4. ขั้นตอนการจอง (อัตโนมัติ)

1. ลูกค้าจองและจ่ายเงิน → `bookings.status = confirmed`
2. `mcslot-tick` (MC1, ทุกนาที) ดึง `GET /api/mc/bookings`
3. ถึงเวลา → เปิดเวิลด์ `w-user-<user_id>` บนโหนด, ขอ Reserved IP, ทำ route/DNAT
4. ส่ง `POST /api/mc/bookings/:id/status {status:"started", ip}` → เว็บแสดง IP ให้ลูกค้า
5. ระหว่าง slot ส่ง `online` + รายชื่อผู้เล่นทุกนาที
6. หมดเวลา → ปิดเกม, คืน IP, ส่ง `ended`
7. ถ้าส่งเว็บไม่ได้ จะเก็บไว้ใน `/etc/mc-slot/outbox.json` แล้วส่งซ้ำ

## 5. ส่วนประกอบ

### Windows
โปรเจกต์: `C:\Users\LENOVO\.gemini\antigravity\scratch\mc-server-project`

| ส่วน | รายละเอียด |
|---|---|
| `mc-server-backend` | Express + MySQL + Socket.IO พอร์ต 5000 |
| `mc-server-frontend` | React/Vite หน้าแอดมินเซิร์ฟเวอร์ = `src/pages/admin/Servers.jsx` |
| `automation\mc-backend.ps1` | รัน `node server.js` และเปิดใหม่เองเมื่อดับ |
| `automation\mc-tunnel.ps1` | `ssh -R 5000:127.0.0.1:5000 admin@MC1` ต่อใหม่เองเมื่อหลุด |
| `monitoring\start-monitoring.ps1` | รัน Prometheus (9090) + Grafana (3000) + SSH Proxy (1080) เพื่อ Live Embed Traffic บนเว็บ |
| `monitoring\stop-monitoring.ps1` | ปิดระบบ Prometheus, Grafana และ Proxy ทั้งหมด |
| Task Scheduler | `MC mc-backend`, `MC mc-tunnel` เริ่มตอนล็อกอิน (ซ่อนหน้าต่าง) |
| พลังงาน | เสียบปลั๊กแล้วไม่ sleep, พับจอไม่ทำอะไร **ต้องเสียบปลั๊กตลอด** |

- **ห้ามรัน `npm start` / `npm run dev` ซ้อน** task จะชนพอร์ต 5000
- รีสตาร์ท backend หลังแก้โค้ด (task เปิดใหม่ให้ใน ~5 วินาที):
  `Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000 -State Listen).OwningProcess`

### MC1 (สำเนาทุกไฟล์อยู่ที่ `mc1-scripts-v4\installed-mc1\`)

| ไฟล์ | หน้าที่ |
|---|---|
| `/usr/local/bin/mcslot` | เปิด/ปิด slot, Reserved IP (DigitalOcean), route, ssh key `/root/.ssh/mcnode_key` |
| `/usr/local/bin/mcslot-tick` + `mc-slot-tick.timer` | ตัวจัดตารางทุกนาที (flush() patch แล้ว: ทิ้งรายการที่ได้ 400/404/409/422) |
| `/usr/local/bin/mc-node-health` + `.timer` | วัด CPU/RAM/อุณหภูมิ/throttle/สถานะเกม ทุก 15 วิ → `POST /api/mc/nodes/health` |
| `/usr/local/bin/mc-node-agent` + `.service` | ดึงคำสั่งจากปุ่มแอดมินทุก 3 วิ → `systemctl start/stop/restart` บนโหนด |
| `/usr/local/bin/mc-backup` | backup ทุกเที่ยงคืน (cron ของ root) |
| `/etc/mc-slot/` | `web_key`, `nodes.json`, `outbox.json`, `active_booking.json` ฯลฯ (**ไม่อยู่ใน repo** มีความลับ) |
| `/etc/ssh/sshd_config.d/keepalive.conf` | ปล่อยพอร์ต tunnel เร็วเมื่อหลุด |

คำสั่งลัดของ user admin: `ssh mc2|mc3|mc4` และ `allnodes '<คำสั่ง>'` (สั่งทุกโหนด)

### โหนด (MC2–MC4)
- MC2, MC3, MC4 มีอะแดปเตอร์ USB-LAN (`35b5:3500`) เสียบอยู่ ถูกตัดทุกครั้งที่บูตด้วย
  `/etc/udev/rules.d/99-no-usb-lan.rules` (ถอดออกได้เลยเมื่อมีคนไปที่เครื่อง)
  สาเหตุของเกมหลุด/โหนดหาย 15 ต.ค.: อะแดปเตอร์ตอบ ARP แทน IP ของ eth0 → IP ชน → eth0 ไม่ได้ IP
- ARP เข้มงวด `/etc/sysctl.d/99-arp-strict.conf` (arp_ignore=1, arp_announce=2)
- eth0 ใช้ IP static (.11 / .12 / .13) ผ่าน NetworkManager ไม่พึ่ง DHCP (ทดสอบรีบูต MC3 แล้วผ่าน)
- MC3, MC4 ยังมีไฟล์ `/etc/NetworkManager/conf.d/99-no-eth1.conf` จากการแก้รอบแรก (ไม่มีผลเสีย)
- ทางสำรองเมื่อ IPv4 ใช้ไม่ได้: [MC1] `ping -6 -c2 -I bond0 ff02::1; ip -6 neigh show dev bond0`
  แล้ว `ssh 'mc3@fe80::...%bond0'`
- journal บันทึกลงดิสก์แล้วทุกเครื่อง (ดูรอบบูตก่อนหน้า: `sudo journalctl -b -1`)
- timezone ทุกเครื่อง = Asia/Bangkok
- คำสั่ง `sysctl` ไม่อยู่ใน PATH ของ user ธรรมดา ใช้ `sudo sysctl` หรืออ่าน `/proc/sys/...`
- UFW เปิดพอร์ต `9100/tcp` สำหรับ prometheus-node-exporter ให้วง `192.168.137.0/24` แล้วทุกเครื่อง (MC1-MC4)

## 6. API

| Method | Path | Auth | ใช้โดย |
|---|---|---|---|
| GET | `/api/mc/bookings` | X-MC-Key | mcslot-tick |
| POST | `/api/mc/bookings/:id/status` | X-MC-Key | mcslot-tick (`started`/`online`/`ended`) |
| POST | `/api/mc/nodes/health` | X-MC-Key | mc-node-health |
| GET | `/api/mc/commands/next` | X-MC-Key | mc-node-agent |
| POST | `/api/mc/commands/:id/result` | X-MC-Key | mc-node-agent |
| GET | `/api/admin/nodes/health` | admin JWT | Servers.jsx |
| POST | `/api/admin/servers/:id/start\|stop\|restart` | admin JWT | Servers.jsx (คิวคำสั่ง, กันหยุดตอนมีลูกค้าเล่น เว้นแต่ `force:true`) |
| GET | `/api/admin/nodes/commands` | admin JWT | Servers.jsx |

Socket.IO ส่งแค่สัญญาณ (`booking-slot-update`, `nodes-health-updated`, `node-command-updated`)
ข้อมูลจริงต้องดึงผ่าน API ที่ล็อกอิน **ห้ามส่ง IP ภายใน/ข้อมูลเครื่องทาง socket**

ข้อมูล health และคิวคำสั่งเก็บใน memory ของ backend (รีสตาร์ทแล้วหาย กลับมาเองภายใน 15 วิ)

## 7. คู่มือแก้ปัญหา

| อาการ | ตรวจ | แก้ |
|---|---|---|
| หน้าเว็บค้าง "กำลังเปิด server" | [MC1] `sudo ss -lntp 'sport = :5000'` ต้องเห็น sshd | ไม่เห็น = tunnel หลุด: [Windows] ดู `automation\mc-tunnel.log` |
| หน้าแอดมินขึ้น "ไม่มีข้อมูลล่าสุด" | เหมือนข้างบน + [MC1] `journalctl -u mc-node-health -n 5` | |
| tick error ซ้ำทุกนาที | [MC1] `journalctl -u mc-slot-tick --since -30min` และ `cat /etc/mc-slot/outbox.json` | `Connection refused` = tunnel/backend; 400 ซ้ำ = รายการเสียในคิว |
| ปุ่ม Start/Stop ค้าง "รอ MC1 รับคำสั่ง" | [MC1] `journalctl -u mc-node-agent -f` | `systemctl restart mc-node-agent` |
| ผู้เล่นหลุดพร้อมกัน / โหนดหาย | [MC1] `ping 192.168.137.1x` และ `ip neigh` | MAC ต้องเป็นของ eth0 (2c:cf:67:...) ถ้าเป็น ec:9a:0c:... = อะแดปเตอร์ USB กลับมา ดูกฎ udev |
| เกมกระตุก/chunk หาย | หน้าแอดมิน: อุณหภูมิ, ป้าย "ร้อน" | ระบายความร้อน, ลด view-distance |
| backend เปิดไม่ขึ้น | [Windows] `Get-NetTCPConnection -LocalPort 5000 -State Listen` | ดู error จากการรัน `node server.js` ด้วยมือ (ปิด task ก่อน) |

ความหมาย log ของ mcslot-tick: `ให้ลูกค้าต่อที่ x.x.x.x` = เปิด slot สำเร็จ, ชื่อผู้เล่นเปล่า ๆ = รายชื่อคนออนไลน์ (ปกติ)

## 8. ติดตั้งคืน MC1 (ถ้าต้องลงใหม่)

1. คัดลอกไฟล์จาก `mc1-scripts-v4\installed-mc1\` กลับไปที่ `/usr/local/bin/` (chmod 755)
   และ `/etc/systemd/system/` แล้ว `systemctl daemon-reload`
2. สร้าง `/etc/mc-slot/` ใหม่: `web_key` (= `MC_API_KEY` ใน backend `.env`), `nodes.json`
3. ssh key `/root/.ssh/mcnode_key` ต้องเข้าโหนดได้ (sudo ไม่ถามรหัส)
4. `systemctl enable --now mc-slot-tick.timer mc-node-health.timer mc-node-agent`

## 9. ประวัติการแก้ (15–16 ต.ค. 2026)

1. tunnel เดิมชี้ IP เก่า `10.252.74.15` → เปลี่ยนเป็น MC1 ปัจจุบัน + automation ต่อใหม่เอง
2. outbox มีรายการทดสอบ `test-booking-id-1` ขวางคิว → ล้าง + patch `flush()`
3. MC2/MC3/MC4 อะแดปเตอร์ USB-LAN แย่ง IP ของ eth0 จน MC3 หลุดจากระบบ → ตัดอะแดปเตอร์ด้วย udev,
   ARP เข้มงวด, IP static (กู้ MC3 ผ่าน IPv6 link-local)
4. ตั้ง journal ถาวร, timezone ตรงกัน, ทุก service เกม `disabled` ตอนบูต
5. หน้าแอดมิน: ค่า CPU/RAM ตายตัว → ค่าจริงจาก `mc-node-health` (ทุก 15 วิ)
6. ปุ่ม Start/Stop/Restart: เดิม SSH ตรงจาก backend + โหมด "แกล้งสำเร็จ" → คิวคำสั่งผ่าน `mc-node-agent`
7. ลบ `SSH_USER_*`, `SSH_PASS_*` ออกจาก `.env` (เหลือ `SSH_HOST_*` เพราะ rconService ยังใช้)
8. พบ MC3/MC4 ร้อนจนเคยถูก throttle (`0xe0000`), MC4 รีบูตเองหนึ่งครั้ง (ไม่ทราบสาเหตุ)

## 10. งานที่เหลือ

1. **ระบายความร้อน**: ติด Active Cooler MC2, MC4 และเช็กพัดลม MC3 (ตอนว่าง 60–70°C สูงเกินไป)
2. **ความปลอดภัยตามขอบเขต 1.3.3**: UFW ยังไม่มี, Fail2Ban มีแค่ MC1, rsyslog ปิด, `mc-backup` ไม่ใช้ rsync
3. **Players เป็น 0 ตลอด / kick, whitelist, broadcast ใช้ไม่ได้จริง**: `rconService.js` ต่อ RCON
   จากโน้ตบุ๊กซึ่งต่อไม่ถึงโหนด และมีโหมด simulation ซ่อนอยู่ → ให้ `mc-node-health` อ่านผู้เล่นผ่าน RCON
   บน MC1 และส่งคำสั่ง RCON ผ่านคิวของ agent
4. **ขอบเขตที่ยังขาด**: รหัสผ่าน/whitelist ให้ลูกค้า, แอดมินจัดการเซิร์ฟเวอร์และแก้/ลบการจอง,
   เพิ่ม/แก้ผู้ใช้, สถานะ Online/Offline ฝั่งลูกค้า
5. **ปุ่ม Backup**: ✅ เชื่อมต่อแล้ว (หน้าเว็บส่งเข้าคิว `nodeCommandController` -> `mc-node-agent` สั่ง `mc-backup <id>` รองรับทั้งโหนด local และ remote)
6. **ผลทดลองบทที่ 4**: วัด Trunking (bond0) และ Tunneling (WireGuard) ก่อน-หลัง ด้วย iperf3/ping
7. **IP ของ MC1 คงที่**: จอง `172.29.93.15` ที่เราเตอร์/hotspot หรือใช้สาย LAN
8. **เปลี่ยนรหัสผ่าน user บนโหนด** ที่เคยอยู่ใน `.env` เป็นข้อความธรรมดา
9. ข้อมูลเก่า: IP 192.168.1.x ในตาราง servers, RAM ตายตัว '3.5' ใน `ServerStatus.jsx`
10. Task Scheduler เริ่มตอนล็อกอินเท่านั้น (Windows รีสตาร์ทเองแล้วต้องมีคนล็อกอิน)
11. ระยะยาว: ย้าย backend + MySQL ไปเครื่องที่เปิดตลอด (เช่น MC1) เลิกพึ่งโน้ตบุ๊กและ tunnel

## 11. ข้อห้าม

- ห้ามแก้ไฟล์ใน `/etc/mc-slot/` ด้วยมือ ยกเว้นล้างรายการเสียใน `outbox.json` (backup ก่อน)
- ห้ามยิง status `started` ด้วยมือ ถ้า tick ยังไม่ได้เปิด slot และได้ Reserved IP จริง
- ห้ามสร้าง `/api/server-status` หรือ API สถานะแยก ใช้ `/api/mc/...` และ `/api/admin/nodes/...`
- ห้ามใช้ IP `10.252.74.15` หรือ `192.168.1.x`
- ห้ามรัน backend/tunnel ด้วยมือซ้อนกับ Task Scheduler
- ห้ามลบกฎ udev / ARP / IP static บนโหนด และห้ามตั้ง service เกมเป็น `enabled`
- ห้ามเปลี่ยนรูปแบบ JSON ของ `/api/mc/*` โดยไม่แก้สคริปต์บน MC1 ให้ตรงกัน