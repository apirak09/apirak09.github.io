# Cinematic Play — Backend 0.6

Backend ส่วนตัวสำหรับ [Cinematic Play](https://apirak09.github.io/frontia/) ใช้ Node.js 22+ และ Codex app-server ผ่าน JSON-RPC stdio เก็บข้อมูลล็อกอินและเซฟบนดิสก์ของเซิร์ฟเวอร์ ไม่ส่ง token ไปไว้ใน frontend

GitHub Pages รัน Backend ไม่ได้ ต้องมีเครื่องที่รัน process ต่อเนื่อง มี persistent disk และ HTTPS การใช้ AI ขึ้นกับสิทธิ์บัญชี โมเดล และโควตา Codex ไม่ได้หมายความว่าใช้งานได้ฟรีหรือไม่จำกัด

## ติดตั้งด้วย Docker Compose

ใช้ clone ที่มีทั้ง `frontia/` และ `frontia-backend/` เพราะใช้สัญญาข้อมูลร่วมกัน:

```bash
cd frontia-backend
cp .env.example .env
chmod 600 .env
# แก้ DOMAIN เป็นโดเมนที่ชี้มาที่เครื่องนี้
# ตั้ง APP_PASSWORD เป็นรหัสสุ่มยาวอย่างน้อย 16 ตัวอักษร
docker compose up -d --build
```

เปิด inbound TCP 80/443 ให้ Caddy ออกใบรับรอง TLS แล้วเข้าหน้าเว็บ → ตั้งค่า → ใส่ `https://DOMAIN` และรหัสผ่าน → ทดสอบ Backend → เชื่อม ChatGPT ใส่ device code เฉพาะบนหน้า OpenAI ที่แอปเปิดให้ ไม่ใช่ใน GitHub หรือแชต

เครื่อง Oracle Ubuntu ที่เตรียมแล้วใช้ `sudo bash deploy-oracle.sh` ได้ สคริปต์ติดตั้ง Docker หากยังไม่มี สร้าง `.env` เฉพาะครั้งแรก และใช้ชื่อ nip.io จาก public IPv4 ต้องเปิด Security List/NSG ด้วย ตรวจเงื่อนไขและค่าใช้จ่ายผู้ให้บริการเองก่อนสร้างเครื่อง สคริปต์ไม่สร้าง VM ให้

รหัสผ่านอยู่ใน `.env` ซึ่งต้องเก็บเป็นความลับ ไม่พิมพ์ลง deployment log ถ้ามี `.env` หรือ volumes อยู่แล้ว สคริปต์จะเก็บของเดิมไว้

## อัปเดตจากเวอร์ชันเดิม

1. Export เซฟจากหน้าเว็บ และสำรอง volumes `workspace_data` / `codex_data` แบบเข้ารหัสหรือเก็บในที่จำกัดสิทธิ์ โดย `codex_data` มี credential
2. ปิดแท็บ/PWA รุ่นเก่าที่เปิดค้าง เพื่อไม่ให้ client เก่าเล่นต่อระหว่างย้ายข้อมูล
3. ดึงโค้ดจาก root repository แล้ว build ใหม่:

```bash
git pull --ff-only
cd frontia-backend
docker compose up -d --build
docker compose ps
```

4. เปิดหน้าเว็บรุ่นใหม่ กดอัปเดตถ้ามีข้อความแจ้ง แล้วทดสอบ Backend และซิงก์อีกครั้ง

อย่าใช้ `docker compose down -v`: จะลบเซฟและข้อมูลล็อกอินถาวร ชื่อ volumes เดิมยังใช้ต่อได้ entrypoint เปลี่ยน ownership ให้ผู้ใช้ `node` ก่อนรันแอปโดยไม่ลบข้อมูล

Frontend 0.6 ต้องใช้ save protocol 2 จาก Backend 0.6 ถ้า Backend ยังเก่า แอปจะเก็บข้อมูลในเครื่องและแจ้งให้อัปเดต โดยไม่ส่งเซฟไปทับแบบไม่ตรวจ revision ส่วน client เก่าที่ไม่มี `expectedRevision` ได้รับ HTTP 428

เซฟ Backend version 1 แปลงเมื่ออ่านและเก็บต้นฉบับ `.bak` ก่อนเขียนครั้งถัดไป ระบบเก่ามีฉากล่าสุดรวมกันชุดเดียว ไม่สามารถสร้างประวัติแยกเรื่องที่ไม่เคยบันทึกกลับคืนได้

## การเก็บข้อมูลและข้อจำกัด

- ใช้ Backend **หนึ่ง instance ต่อไฟล์เซฟ** เป็นแอปผู้ใช้คนเดียว รหัสผ่านเดียวไม่ใช่ระบบหลายบัญชี ไม่รองรับ replicas ที่แชร์ไฟล์เดียวกัน
- `/data/workspace/cinematic-save.json` เก็บเซฟ และ `.bak` เก็บก่อนการเขียนล่าสุดหนึ่งรุ่น ใช้ temp file, fsync, atomic rename และ revision compare-and-swap
- เซฟเสียหายตอบ 503 และไม่ถูกแทนด้วยเซฟว่าง ต้องสำรองไฟล์เสียก่อนกู้จาก `.bak` หรือไฟล์ export ที่ตรวจแล้ว
- เซฟไม่เกิน 8 MiB ประวัติไม่เกิน 1,500 ฉากต่อเรื่อง ข้อความผู้เล่นไม่เกิน 4,000 ตัวอักษร
- ส่ง 12 ฉากล่าสุดและสรุปความทรงจำสะสมให้ AI ประวัติเต็มยังอยู่ในเซฟ ไม่รับประกันว่าโมเดลจะจำทุกเหตุการณ์ถูกต้อง
- สร้างฉากครั้งละหนึ่งคำขอ จำผลคำขอที่สำเร็จแล้ว 10 นาทีในหน่วยความจำเพื่อกัน request ID ซ้ำ การ restart ล้าง cache นี้
- `/health` ตรวจ HTTP server ไม่ใช่หลักฐานว่าล็อกอิน Codex แล้วหรือโควตายังเหลือ

```bash
curl https://YOUR-BACKEND/health
# {"ok":true,"protocol":2,"version":"0.6.0"}
```

## ความปลอดภัยและ Codex

- Docker pin `@openai/codex@0.155.1` ซึ่งใช้ตรวจ JSON schema แล้ว อัปเดต CLI อย่างตั้งใจและรัน regression tests ก่อนเปลี่ยน pin
- โฮสต์/container ต้องรองรับ sandbox ของ Codex ด้วย ในเครื่องทดสอบรอบนี้ initialize/account RPC ทำงาน แต่การเริ่ม thread ถูกระบบปฏิเสธที่ `bwrap`/network namespace จึงยังไม่ยืนยัน Docker/AI end-to-end ห้ามแก้ด้วยการปิด sandbox, ใช้ privileged container หรือเปิด approval อัตโนมัติ ควรตรวจความเข้ากันได้บนโฮสต์ปลายทางที่ตั้งใจใช้งาน
- ใช้ device-code login ของ Codex โดยตรง รายชื่อโมเดลมาจาก `model/list` ไม่รับประกันชื่อโมเดลเฉพาะกับทุกบัญชี
- แยก `CODEX_HOME` และ workspace จากโปรเจกต์อื่น อย่าใส่ MCP, plugins, secrets หรือไฟล์ส่วนตัวอื่นลงในสองโฟลเดอร์นี้
- process แอปรันเป็น `node` ใน container ไม่ส่ง `APP_PASSWORD` เข้า environment ของ Codex
- ใช้ ephemeral thread, read-only sandbox, ปิด network ของ turn, shell/unified-exec/web search/apps และปฏิเสธคำขอ approval/tool ที่ส่งกลับมา ข้อความ prompt เป็นชั้นเสริม ไม่ใช่มาตรการเดียว
- คำตอบต้องตรง JSON schema และผ่าน validation อีกชั้น แยก stream ตาม thread/turn ถอด listeners เมื่อจบ ล้มเหลว ยกเลิก หรือ timeout
- อนุญาต origin ตรงกับ `ALLOWED_ORIGIN` (คั่น comma ได้) ค่าเริ่มต้น `https://apirak09.github.io`; localhost ต้องเปิด `ALLOW_LOCAL_ORIGIN=true` สำหรับพัฒนา
- CORS ไม่ใช่การยืนยันตัวตน ทุก private API ต้องมี `x-app-password` และใช้ HTTPS ภายนอกเครื่องเดียวกัน
- รหัสผ่านที่เลือกจำใน browser และเซฟอ่านได้โดยสคริปต์บน origin เดียวกัน โปรเจกต์ GitHub Pages หลาย path จึงไม่ใช่ขอบเขตความปลอดภัยแยกกัน
- ไม่บันทึก request body, ฉาก, password หรือ token ลง application log ห้าม commit `.env`, `auth.json`, `data/` หรือไฟล์สำรองจริง

อ้างอิง: [Codex authentication](https://developers.openai.com/codex/auth/) · [App-server protocol](https://developers.openai.com/codex/app-server/)

## พัฒนาและทดสอบ

```bash
cd frontia-backend
npm ci
npm test
```

Tests ใช้ HTTP server ในเครื่อง, IndexedDB จำลอง, DOM จำลอง และ subprocess fixture ของ JSON-RPC **ไม่เรียก AI จริง ไม่ใช้ credential และไม่ทับเซฟจริง** ครอบคลุม migration, sync conflict, หลายแท็บ, recovery, ภาษาไทย, การกดซ้ำ, auth/CORS, validation, stream, cancellation และ service-worker scope

หากรัน Backend โดยไม่ใช้ Docker ให้ติดตั้ง Codex รุ่นที่ระบุข้างต้น ตั้ง `APP_PASSWORD` ใน environment แล้วรัน `npm start` ค่า default เก็บข้อมูลถาวรใต้ `frontia-backend/data/` ใช้ `FRONTIA_WORKSPACE`, `CODEX_HOME`, `FRONTIA_SAVE_FILE`, `PORT`, `HOST` และ `CODEX_BIN` เปลี่ยนได้

ทดสอบ frontend โดย serve root repository ด้วย static HTTP server ที่รองรับ `.mjs` แล้วเปิด `/frontia/` อย่าเปิด `index.html` ด้วย `file://` การทดสอบ PWA ต้องผ่าน HTTPS หรือ localhost

ยังต้องตรวจบน Safari/iOS และ Android จริง รวมถึง device login, AI generation และ cloud sync บน Backend ที่ deploy แล้ว ชุดทดสอบจำลองไม่ยืนยันสิทธิ์บัญชีหรือความพร้อมของเซิร์ฟเวอร์จริง
