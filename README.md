# Mini Angry Birds v14 — 100 Level GitHub Build

เปิด `index.html` ได้ตรง ๆ หรือเอา repository นี้ขึ้น GitHub Pages ได้เลย

## โครงสร้างไฟล์

```text
index.html
src/styles.css
src/game.js
src/levels/levels-001-025.js
src/levels/levels-026-050.js
src/levels/levels-051-075.js
src/levels/levels-076-100.js
LEVEL_DESIGN_NOTES.md
```

## วิธีแก้ด่าน

แก้เฉพาะไฟล์ใน `src/levels/` ได้เลย แต่ละด่านเป็น object แบบนี้:

```js
{
  name: 'Granite Lock',
  birds: ['yellow','red','bomb','blue','red'],
  three: 2,
  two: 4,
  pigs: [{ x: 632, y: 484, r: 15, hp: 1 }],
  blocks: [{ x: 560, y: 364, w: 34, h: 136, material: 'stone', angle: 0 }]
}
```

- `material`: `wood`, `stone`, `ice`, `tnt`
- `angle`: radians; optional
- ทุกด่านปลดล็อกตั้งแต่เริ่ม
- ดาวและคะแนนดีที่สุดยังเก็บด้วย `localStorage` แยกตามด่าน

## Design target

v14 เน้นด่านหนักกว่า v12 มากขึ้น โดยเฉพาะหินหนัก / stone shell / separated pig rooms / protected TNT เพื่อไม่ให้ยิงนัดเดียวแล้วถล่มหมดง่าย ๆ
