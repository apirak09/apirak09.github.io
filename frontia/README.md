# Cinematic Play 0.7

เว็บนิยาย AI/roleplay ภาษาไทยแบบ mobile-first โทนดำ–ทอง รันบน GitHub Pages โดยไม่ต้อง build frontend ดูวิธีเชื่อม Codex และ deploy ได้ใน [คู่มือ Backend](../frontia-backend/README.md)

## เรื่องต้นแบบ: สัญญาณเที่ยงคืน

แอปเปิดเล่นเรื่องเดียวก่อน ผู้เล่นอ่านข้อความทีละช็อต ในหนึ่งการตอบจะมี 4–7 ช็อตที่เปลี่ยนภาพฉากระหว่างชานชาลา อุโมงค์ และห้องควบคุม เปลี่ยนตัวละครและสีหน้า แล้วจึงให้เลือกตอบหรือพิมพ์เอง ภาพฉากสามภาพและภาพตัวละครสามคนคนละสี่สีหน้าอยู่ใน `assets/midnight/` และ precache เพื่ออ่านออฟไลน์ ตัวอย่างที่ไม่ต้องเชื่อม AI มีฉากเปิดกับอีกสองช่วงการเล่น; หลังจากนั้นต้องใช้ Backend และ Codex

สถานะฉากมีเวลาในเรื่อง เบาะแสที่พบ และความสัมพันธ์กับมีนา ธารา อรุณ โดยมีข้อมูลผลฉากกำกับและบันทึกพร้อมตำแหน่งช็อตที่อ่านค้าง ไฟล์ `stories.mjs` ระบุ cast, สถานที่, เบาะแส, ฉากเปิด และ demo; `shared.mjs` ตรวจรหัสภาพและตัวละครกับรายการที่อนุญาต ก่อนส่งหรือเก็บเซฟ เรื่องเก่าทั้งสามยังอยู่ในประวัติหากมีเซฟเดิม เปิดอ่าน/สำรองได้ แต่ยังไม่เปิดให้เริ่มหรือสร้างฉากต่อ

## ความน่าเชื่อถือของระบบ

- เซฟเก่าไม่ถูกลบหรือรวมทับกัน แชตเป็นทางลัดเข้าตัวละครในเรื่องเดียว บันทึก/สถานที่/สถานะ/เมนูใช้งานได้
- ระบุโหมดตัวอย่างชัดเจน ไม่แอบใช้ฉากสำเร็จรูปเมื่อ Backend ผิดพลาด กดซ้ำไม่สร้างฉากซ้อน มีปุ่มยกเลิกและรักษาข้อความร่างเมื่อส่งไม่สำเร็จ
- เซฟหลักใช้ IndexedDB พร้อมตรวจการเขียนชนจากหลายแท็บ localStorage เป็น fallback เมื่อยังไม่เคยใช้ฐานข้อมูลหลัก บันทึกไม่สำเร็จจะหยุดและเปิดทางสำรองข้อมูล
- ซิงก์แบบ three-way merge และ revision compare-and-swap ไม่ตัดสินจากนาฬิกาเครื่อง เรื่องเดียวกันชนให้เลือกเองและสำรองทั้งสองก่อนซิงก์
- สำรองก่อน reset/import/restore มี export/import ที่ไม่รวม credential และ tombstone ป้องกันเซฟก่อนเริ่มใหม่กลับมาเองจากอุปกรณ์เก่า
- ร่างภาษาไทยหลายบรรทัด, Ctrl/⌘ + Enter, safe-area, ปุ่มสัมผัส 44 px, reduced motion, focus indicator และ dialog ที่ใช้คีย์บอร์ดได้
- PWA มีไอคอนและ manifest เก็บ app shell พร้อมภาพเรื่องต้นแบบ ไม่ cache API หรือข้ามไปลบ cache ของโปรเจกต์อื่นบน origin เดียวกัน
- Backend แยก persistence/HTTP/Codex bridge เพิ่ม validation, bounded requests, atomic saves, cancellation, timeout, dynamic model list และ runtime ที่ลดสิทธิ์

## โครงสร้าง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `app.js` | Controller, navigation, requests, drafts, auth, recovery |
| `ui.mjs`, `styles.css`, `reader.css`, `assets/midnight/` | หน้าตา ภาพฉาก ภาพสีหน้า และ responsive layout |
| `stories.mjs` | ข้อมูลเรื่องและฉากตัวอย่างภาษาไทย |
| `shared.mjs` | Validation, migration, save contract และ merge ร่วมกับ Backend |
| `storage.mjs` | IndexedDB, fallback, revision check และ local backups |
| `sync.mjs` | คิวซิงก์และ conflict handling |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline app shell และการติดตั้ง |

## การย้ายเซฟ

ข้อมูลต้นฉบับ v4/v5 ใน localStorage ไม่ถูกลบ เซฟใหม่แปลงเฉพาะฉาก/ประวัติที่มีอยู่จริง เซฟ v2 รุ่นก่อนยังเปิดอ่านต่อได้; ฉากเดิมที่ไม่มีลำดับภาพจะแสดงเป็นช็อตเดียวก่อนขยับเข้าสู่ฉาก AI รุ่นใหม่ เวอร์ชันเดิมเก็บฉากล่าสุดเพียงชุดเดียว จึงกู้ฉากที่ไม่เคยเก็บแยกเรื่องไม่ได้ ควร export สำรองก่อนอัปเดต Backend และปิดแท็บรุ่นเก่าที่เปิดอยู่

อ่านออฟไลน์ได้หลังเปิดแอปออนไลน์สำเร็จอย่างน้อยครั้งหนึ่ง AI ต้องใช้อินเทอร์เน็ตและ Backend ที่พร้อม ข้อมูลใน browser ไม่ใช่ backup ถาวร: การล้างข้อมูลเว็บ/ถอนติดตั้ง/โหมดส่วนตัวอาจลบข้อมูล ควรใช้ cloud sync และ export ร่วมกัน

## ตรวจซ้ำ

จาก root repository:

```bash
cd frontia-backend
npm ci
npm test
```

ชุดทดสอบอัตโนมัติไม่แทนการตรวจอุปกรณ์จริง ยังต้องลอง Safari/iOS และ Android แบบติดตั้ง PWA, คีย์บอร์ดไทย, offline/reconnect และบัญชี Codex บน Backend ที่ deploy แล้ว โดยไม่ใส่รหัสผ่านหรือ token ใน repository

ดู static layout fixtures ได้ด้วย `node tests/preview.mjs /absolute/path/to/preview.html` จาก `frontia-backend/` ไฟล์นี้ใช้ข้อมูลตัวอย่างและไม่เชื่อม Backend
