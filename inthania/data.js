export const VERSION = '1.0.0';
export const SAVE_KEY = 'inthania-expedition-v1';
export const WORLD_SIZE = 520;
export const HEROES = [
  { id:'in', name:'อิน', title:'ผู้ควบคุมปฏิกิริยา', dept:'วิศวกรรมเคมี', element:'chem', symbol:'Δ', color:'#dc708d', model:'mage', rarity:4, attack:22, hp:210, skill:'พัลส์ปฏิกิริยา', burst:'สมดุลพลิกผัน', desc:'กระจายพลังปฏิกิริยา แล้วสลับไปใช้ไฟฟ้าเพื่อเร่งปฏิกิริยาบนศัตรู', starter:true },
  { id:'nam', name:'นาม', title:'นักเดินทางแห่งวงจร', dept:'วิศวกรรมไฟฟ้า', element:'volt', symbol:'ϟ', color:'#efd26e', model:'rogue', rarity:4, attack:24, hp:190, skill:'อาร์กไฟฟ้า', burst:'โครงข่ายสายฟ้า', desc:'ปล่อยไฟฟ้ารอบตัว เมื่อตามหลังพลังเคมีจะเกิดการเร่งปฏิกิริยา', starter:true },
  { id:'pha', name:'ผา', title:'ผู้พิทักษ์โครงสร้าง', dept:'วิศวกรรมโยธา', element:'geo', symbol:'▱', color:'#a7c7ad', model:'knight', rarity:4, attack:26, hp:270, skill:'กำแพงแรงเฉือน', burst:'ฐานรากสะเทือน', desc:'สกิลสร้างเกราะรับความเสียหาย เหมาะกับการเผชิญหน้าบอส' },
  { id:'byte', name:'ไบต์', title:'ผู้ถอดรหัสขอบฟ้า', dept:'วิศวกรรมคอมพิวเตอร์', element:'code', symbol:'⌘', color:'#a5b7ee', model:'rogue', rarity:4, attack:28, hp:185, skill:'ดีบักสนาม', burst:'โอเวอร์คล็อก', desc:'โจมตีพื้นฐานรวดเร็ว สกิลดีบักรีเซ็ตช่วงพักเพื่อโจมตีต่อทันที' },
  { id:'mek', name:'เมฆ', title:'หัวใจกลจักร', dept:'วิศวกรรมเครื่องกล', element:'mech', symbol:'⚙', color:'#e5a773', model:'barbarian', rarity:5, attack:34, hp:245, skill:'เทอร์โบแรงบิด', burst:'เครื่องจักรนิรันดร์', desc:'พลังแรงบิดรุนแรง เมื่อใช้ร่วมกับโยธาจะเกิดการส่งผ่านแรง' },
  { id:'risa', name:'ริสา', title:'แสงเหนือสสาร', dept:'วิศวกรรมนิวเคลียร์', element:'atom', symbol:'✧', color:'#9ed9d3', model:'mage', rarity:5, attack:32, hp:220, skill:'สนามอนุภาค', burst:'ฟิวชันแห่งรุ่งอรุณ', desc:'ปล่อยพลังอนุภาค และฟื้นฟูพลังชีวิตเมื่อใช้อัลติเมต' },
];
export const REGIONS = [
  { id:'campus', name:'ลานเกียร์', sub:'ศูนย์กลางอินทาเนีย', x:0,z:20, color:'#d58d9f', icon:'⚙', fact:'ลานเกียร์เป็นพื้นที่จริงของคณะวิศวกรรมศาสตร์ จุฬาฯ ส่วนอาคารและผังในเกมออกแบบใหม่เพื่อการเล่น', source:'https://www.cp.eng.chula.ac.th/contact' },
  { id:'forest', name:'ป่าจามจุรี', sub:'ผืนป่าและลำน้ำบนเนิน', x:-135,z:-100, color:'#80ae82', icon:'♧', fact:'จามจุรีเป็นต้นไม้สัญลักษณ์ของจุฬาฯ ชื่อเขตนี้นำมาขยายเป็นป่าในโลกสมมติ', source:'https://sustainability.chula.ac.th/th/report/2702/' },
  { id:'wetland', name:'อุทยานร้อยปี', sub:'พื้นที่ชุ่มน้ำและสะพาน', x:135,z:115, color:'#7eb6c5', icon:'≈', fact:'อุทยาน 100 ปี จุฬาฯ ใช้แนวคิดป่าในเมืองและโครงสร้างพื้นฐานสีเขียวเพื่อจัดการน้ำ เขตนี้เป็นการตีความในเกม', source:'https://www.chula.ac.th/services/cu-centenary-park/' },
  { id:'wind', name:'เนินกังหัน', sub:'ทุ่งสูงและหน้าผาลม', x:-145,z:135, color:'#d6be87', icon:'≋', fact:'ภูมิประเทศสมมติ ใช้พลังงานลมและการเปลี่ยนรูปพลังงานเป็นแนวคิดของพื้นที่', source:'https://www.eng.chula.ac.th/th/departments' },
  { id:'mountain', name:'สันเขาศิลา', sub:'เทือกเขาหิมะและแกนกลจักร', x:140,z:-145, color:'#a4b9d4', icon:'△', fact:'ภูเขา หิมะ และบอสเป็นเรื่องสมมติ ไม่ใช่ภูมิประเทศจริงของมหาวิทยาลัย', source:'https://www.eng.chula.ac.th/th/departments' },
];
export const PUZZLES = {
  forest:{question:'ที่สภาวะคงตัว น้ำเข้า 12 kg/s และทางออกแรก 9 kg/s ทางออกที่สองควรเป็นเท่าไร?', answers:['3 kg/s','9 kg/s','21 kg/s'], correct:0, hint:'ใช้สมดุลมวล: อัตราเข้า = อัตราออก เมื่อไม่มีการสะสม', explanation:'12 = 9 + 3 kg/s จึงรักษาสมดุลมวลของสถานีได้'},
  wetland:{question:'ปั๊มน้ำใช้วงจร 10 V กับความต้านทาน 5 Ω กระแสไฟฟ้าเป็นเท่าไร?', answers:['0.5 A','2 A','50 A'],correct:1,hint:'กฎของโอห์ม I = V / R',explanation:'I = 10 / 5 = 2 A วงจรพร้อมขับปั๊มน้ำ'},
  wind:{question:'แรง 4 kN ตั้งฉากกับแขนยาว 2 m ทำให้เกิดแรงบิดเท่าไร?',answers:['2 kN·m','6 kN·m','8 kN·m'],correct:2,hint:'แรงบิด = แรง × ระยะตั้งฉาก',explanation:'4 × 2 = 8 kN·m กังหันเริ่มส่งกำลังไปยังโครงข่าย'},
};
export const REACTIONS = { 'chem+volt':{name:'เร่งปฏิกิริยา',mult:1.8}, 'geo+mech':{name:'ส่งผ่านแรง',mult:2}, default:{name:'ประสานพลัง',mult:1.4} };
export const getHero = id => HEROES.find(h=>h.id===id) || HEROES[0];
export const levelCost = level => 6 + level*4;
export const maxHP = (hero,level) => hero.hp + (level-1)*24;
export const attackPower = (hero,level,rank=0) => hero.attack + (level-1)*4 + rank*2;
