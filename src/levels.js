(() => {
  'use strict';
  const B = (x, y, w, h, material = 'wood', extra = {}) => ({ x, y, w, h, material, ...extra });
  const P = (x, floor = 650, r = 20, hp = 100) => ({ x, y: floor - r, r, hp });
  const T = (x, top, w, h) => ({ x, y: top + h / 2, w, h, material: 'terrain', static: true });
  // Every beam rests on two posts, every pig has a floor. Coordinates share
  // exact supporting surfaces instead of relying on invisible setup settling.
  const room = (x, floor = 650, width = 160, height = 112, material = 'wood', roof = 'wood') => [
    B(x - width / 2 + 14, floor - height / 2, 26, height, material),
    B(x + width / 2 - 14, floor - height / 2, 26, height, material),
    B(x, floor - height - 12, width + 8, 24, roof)
  ];
  const hint = (step, title, text) => ({ step, title, text });

  window.GAME_LEVELS = [
    {
      name: 'Woodland Welcome', subtitle: 'ตัดฐานไม้ให้หลังคาถล่ม',
      birds: ['red', 'red', 'yellow'], par: 2, backdrop: 'meadow',
      tutorial: hint(1, 'เริ่มจากเสาด้านซ้าย', 'ลากนกถอยหลังแล้วปล่อย ยิงเสาไม้ด้านซ้ายให้หลังคาถล่มลงมา ถ้าเล็งยาก ลองปุ่มเล็งละเอียดด้านล่าง'),
      pigs: [P(830), P(830, 514)],
      blocks: room(830)
    },
    {
      name: 'Crystal Feet', subtitle: 'ฐานกระจกใต้หลังคาหนัก',
      birds: ['blue', 'red', 'yellow'], par: 2, backdrop: 'coast',
      tutorial: hint(2, 'กระจกแพ้นกฟ้า', 'กด Space หรือแตะสนามระหว่างบินเพื่อแยกร่าง แยกก่อนถึงเสากระจกเพื่อเปิดฐานหลายจุด'),
      pigs: [P(810), P(890), P(850, 500)],
      blocks: room(850, 650, 240, 126, 'glass', 'wood')
    },
    {
      name: 'Three Little Rooms', subtitle: 'สามห้อง สามเป้าหมาย',
      birds: ['blue', 'yellow', 'blue', 'red'], par: 3, backdrop: 'meadow',
      tutorial: hint(3, 'กวาดผ่านทั้งสามห้อง', 'ตัดเสากระจกให้หลังคากระแทกหมู แล้วใช้นกที่เหลือเก็บห้องถัดไป'),
      pigs: [P(710), P(890), P(1070)],
      blocks: [...room(710, 650, 128, 100, 'glass'), ...room(890, 650, 128, 100, 'glass'), ...room(1070, 650, 128, 100, 'glass')]
    },
    {
      name: 'High Perch', subtitle: 'ป้อมบนหน้าผา',
      birds: ['yellow', 'yellow', 'red', 'blue'], par: 2, backdrop: 'canyon',
      tutorial: hint(4, 'เร่งเข้าหาเป้าหมาย', 'เพิ่มมุมยิงเพื่อขึ้นหน้าผา ใช้ Boost ขณะนกกำลังพุ่งเข้าหาเสาไม้หรือหลังคา'),
      terrain: [T(990, 548, 360, 102)],
      pigs: [P(990, 548), P(1117, 548), P(990, 408)],
      blocks: room(990, 548, 220, 116, 'wood', 'glass')
    },
    {
      name: 'Fuse Lesson', subtitle: 'จุดชนวนแล้วดูลูกโซ่',
      birds: ['red', 'yellow', 'bomb'], par: 1, backdrop: 'sunset',
      tutorial: hint(5, 'เล็งลังแดงใบแรก', 'ยิง TNT หน้าป้อม ระเบิดจะส่งแรงต่อไปตามแนวฐาน ให้เวลาลูกโซ่ทำงานก่อนยิงนัดถัดไป'),
      pigs: [P(740), P(900), P(1060)],
      blocks: [
        ...room(740, 650, 112, 116), ...room(900, 650, 112, 116), ...room(1060, 650, 112, 116),
        B(660, 629, 42, 42, 'tnt'), B(820, 629, 42, 42, 'tnt'), B(980, 629, 42, 42, 'tnt'), B(1140, 629, 42, 42, 'tnt')
      ]
    },
    {
      name: 'Counterweight', subtitle: 'คานและจุดหมุน',
      birds: ['red', 'yellow', 'blue', 'red'], par: 2, backdrop: 'coast',
      tutorial: hint(6, 'พลิกคานจากด้านล่าง', 'คานยาววางบนฐานกลาง ยิงปลายด้านซ้ายให้คานหมุนไปกระแทกห้องขวา'),
      terrain: [T(835, 560, 46, 90)],
      pigs: [P(928), P(1090), P(1070, 510)],
      blocks: [
        B(835, 548, 286, 24, 'wood'),
        ...room(1070, 650, 172, 116, 'glass', 'wood')
      ]
    },
    {
      name: 'Stone Shell', subtitle: 'เจาะบังเกอร์หิน',
      birds: ['bomb', 'yellow', 'red', 'bomb'], par: 2, backdrop: 'canyon',
      tutorial: hint(7, 'ระเบิดใกล้กำแพง', 'พานกระเบิดเข้าใกล้บังเกอร์แล้วกดสกิล หรือรอชนแล้วระเบิดอัตโนมัติ หินทนแรงชนแต่แพ้ระเบิดใกล้ ๆ'),
      pigs: [P(866, 650, 20, 110), P(974, 650, 20, 110), P(920, 492)],
      blocks: [...room(920, 650, 286, 134, 'stone', 'stone'), B(920, 629, 42, 42, 'tnt')]
    },
    {
      name: 'Twin Collapse', subtitle: 'หอคู่เชื่อมสะพาน',
      birds: ['yellow', 'blue', 'bomb', 'red'], par: 2, backdrop: 'sunset',
      tutorial: hint(8, 'ล้มจากซ้ายไปขวา', 'ตัดฐานหอซ้ายให้คานเชื่อมดึงหอขวา TNT บนสะพานช่วยเปิดทาง'),
      pigs: [P(760), P(1060), P(760, 514), P(1060, 514)],
      blocks: [
        ...room(760, 650, 160, 112, 'glass'), ...room(1060, 650, 160, 112, 'wood'),
        ...room(760, 514, 140, 98), ...room(1060, 514, 140, 98, 'glass'),
        B(910, 380, 328, 24, 'wood'), B(910, 347, 42, 42, 'tnt')
      ]
    },
    {
      name: 'Needle Thread', subtitle: 'ผ่านช่องเข้าสู่คลัง TNT',
      birds: ['yellow', 'red', 'blue', 'bomb'], par: 2, backdrop: 'meadow',
      tutorial: hint(9, 'ยิงต่ำผ่านช่อง', 'ช่องอยู่ระหว่างพื้นกับแผ่นหินสูง เล็งนกให้ผ่านใต้แผ่นแล้วเร่งชน TNT หรือใช้วิถีสูงจัดการหมูด้านบน'),
      terrain: [T(754, 462, 100, 26)],
      pigs: [P(878), P(1058), P(754, 462)],
      blocks: [
        ...room(900, 650, 174, 112, 'glass'), ...room(1080, 650, 148, 112, 'wood'),
        B(920, 629, 38, 42, 'tnt'), B(1105, 629, 38, 42, 'tnt')
      ]
    },
    {
      name: 'The Last Fortress', subtitle: 'ชิงไข่คืนจากป้อมสุดท้าย',
      birds: ['blue', 'yellow', 'bomb', 'red', 'yellow', 'bomb'], par: 4, backdrop: 'finale',
      tutorial: hint(10, 'ใช้ทุกอย่างที่เรียนมา', 'เจาะกระจกซ้าย จุด TNT กลางป้อม แล้วใช้ระเบิดเก็บฝั่งหิน มีนก 6 ตัวให้วางแผน'),
      pigs: [P(704), P(704, 514), P(920), P(1130), P(1130, 514)],
      blocks: [
        ...room(704, 650, 144, 112, 'glass'), ...room(704, 514, 124, 98, 'wood'),
        ...room(920, 650, 160, 138, 'wood', 'stone'),
        ...room(1130, 650, 156, 112, 'stone'), ...room(1130, 514, 132, 98, 'glass'),
        B(812, 629, 40, 42, 'tnt'), B(1028, 629, 40, 42, 'tnt'), B(920, 467, 42, 42, 'tnt')
      ]
    }
  ];
})();
