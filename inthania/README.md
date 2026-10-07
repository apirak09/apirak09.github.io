# INTHANIA — วิศวะผจญภัย

เกม 3D โลกเปิดเล่นคนเดียวในธีมวิศวะจุฬาฯ ฉบับย่อ ใช้ Three.js และโมเดล glTF ที่มีสิทธิ์ใช้งานชัดเจน

## เล่น

เปิด [INTHANIA](https://apirak09.github.io/inthania/) แล้วกดออกเดินทาง คุยกับพี่พิมที่หน้าลานเกียร์เพื่อเริ่มภารกิจ

ต้องใช้เบราว์เซอร์ที่เปิดใช้งาน WebGL 2 หากระบบปิดกราฟิก 3D เกมจะแจ้งสาเหตุบนหน้าจอ

- โลกต่อเนื่อง 5 เขต: ลานเกียร์ ป่าจามจุรี อุทยานร้อยปี เนินกังหัน สันเขาศิลา
- เดิน วิ่ง กระโดด ร่อน ปีน และว่ายน้ำ พร้อมความอึด
- ตัวละคร 6 แบบ ทีมสูงสุด 4 คน 2 ตัวละครเริ่มต้นเล่นเรื่องหลักได้
- โจมตี สกิล อัลติเมต และประสานพลังต่างสาย
- หุ่นลาดตระเวน 16 ตัว หีบ 20 หีบ สถานีวาร์ป 5 จุด บอส ATLAS 2 ระยะ
- อัญเชิญฟรี 1/10 ครั้ง พร้อมโอกาสและการันตีแสดงในเกม
- เพิ่มระดับ อัปเกรดด้วยแร่ บันทึกอัตโนมัติ สำรอง/นำเข้าเซฟ
- คีย์บอร์ด/เมาส์ และปุ่มสัมผัส แนวตั้ง/แนวนอน

## ควบคุม

| การกระทำ | ปุ่ม |
|---|---|
| เดิน / วิ่ง | WASD / Shift |
| กระโดด / ร่อนกลางอากาศ | Space |
| ปีนเนินชัน | C ค้างพร้อมเดิน |
| หมุนกล้อง / ซูม | ลากเมาส์ / ล้อเมาส์ |
| โจมตี / สกิล / อัลติเมต | J / E / Q |
| หลบ / ปฏิสัมพันธ์ | X / F |
| สลับทีม | 1–4 |
| แผนที่ / ทีม / อัญเชิญ | M / T / G |
| พักเกม / วิธีเล่น | Esc / H |

มือถือ: จอยซ้ายเดิน ปุ่มวิ่ง/ปีนกดค้าง ลากฉากหมุนกล้อง ใช้ปุ่มด้านขวาสำหรับต่อสู้และกระโดด

## Run locally

No dependency installation or build step is required. From the repository root run `python -m http.server 8000`, then visit `http://localhost:8000/inthania/`. Files must be served over HTTP; loading `index.html` using `file://` does not support ES modules correctly.

Run game rules tests using `node --test inthania/tests/state.test.js`. Game source modules are plain ES modules. `?qa=1` exposes the current game instance for the accompanying developer browser test; regular play does not expose it.

## ข้อมูลและขอบเขต

นี่เป็นต้นแบบขนาดเล็ก ไม่ใช่เกมขนาดหรือคุณภาพการผลิตเทียบเท่า Genshin 1.0 ภูเขาและภูมิประเทศรอบนอกเป็นโลกสมมติ ไม่ใช่ตำแหน่งจริงของจุฬาฯ ตัวละครเป็นเรื่องแต่ง ไม่มีการซื้อด้วยเงินจริง เซฟอยู่ในเบราว์เซอร์ของเครื่องนั้น

[Research](docs/RESEARCH.md) · [Model credits](docs/ASSETS.md) · [Quality checks](docs/QA.md)
