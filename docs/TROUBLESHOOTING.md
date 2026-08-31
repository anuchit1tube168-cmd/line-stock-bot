# แก้ปัญหาที่พบบ่อย

> เคล็ดลับ: ถ้าใช้ AI agent อยู่ ให้วางข้อความ error ทั้งก้อนให้มันดู พร้อมบอกว่าทำขั้นไหนอยู่
> ไฟล์ `CLAUDE.md` มีตารางอาการเสียให้ AI อ่านอยู่แล้ว

## ตอนติดตั้ง

**`npm install` ขึ้น ERESOLVE could not resolve**
เวอร์ชัน `@cloudflare/workers-types` ไม่ตรงกับที่ wrangler ต้องการ
ดูในข้อความ error ว่ามันขอเวอร์ชันไหน แล้วแก้ใน `package.json` ให้ตรง จากนั้น `npm install` ใหม่

**`npx wrangler d1 create` ขึ้น Authentication error**
ยังไม่ได้ล็อกอิน → `npx wrangler login` (ต้องเปิดเบราว์เซอร์ยืนยัน)

**deploy แล้วขึ้น `Couldn't find a D1 DB with the name or binding`**
ยังไม่ได้ใส่ `database_id` ใน `wrangler.jsonc` หรือใส่ผิดตัว

## หน้าแดชบอร์ด (LIFF)

**ค้างที่หน้า "กำลังเชื่อมต่อ LINE…"**
- `LIFF_ID` ใน `wrangler.jsonc` ผิดหรือว่าง → แก้แล้ว `npm run deploy` ใหม่
- Endpoint URL ที่ตั้งไว้ใน LIFF ไม่ตรงกับ URL จริงของ worker
- เช็คได้ด้วย `curl https://<URL ของคุณ>/api/config` ต้องเห็น `liffId` ที่ถูกต้อง

**ขึ้น "เซสชันหมดอายุ กรุณาเปิดแอปใหม่อีกครั้ง"**
ตอนสร้าง LIFF ไม่ได้ติ๊ก scope **`openid`** → กลับไปติ๊กใน LINE Console แล้วปิดเปิดแอปใหม่

**ขึ้น "ไม่ได้รับ ID token"**
สาเหตุเดียวกับข้างบน (ขาด `openid`)

**หน้าเว็บโหลดแต่ข้อมูลว่างเปล่า**
ฐานข้อมูลยังไม่มีข้อมูล → `npm run db:seed` หรือเพิ่มคลัง/สินค้าเองในแท็บตั้งค่า

**เปิดในคอมแล้วหน้าเพี้ยน**
หน้านี้ออกแบบมาสำหรับมือถือ (ความกว้าง ~430px) เปิดในคอมได้แต่จะเห็นเป็นคอลัมน์แคบกลางจอ

## บอท LINE

**กด Verify webhook แล้วไม่ผ่าน (401)**
`LINE_CHANNEL_SECRET` ไม่ตรงกับ channel นั้น
```bash
npx wrangler secret put LINE_CHANNEL_SECRET   # ใส่ใหม่ให้ตรง
```
ทดสอบเองก่อนได้ตามวิธีในข้อ 5 ของ [SETUP-MANUAL.md](SETUP-MANUAL.md)

**บอทเงียบ ไม่ตอบอะไรเลย**
1. เปิดสวิตช์ **Use webhook** แล้วหรือยัง
2. `npm run tail` แล้วลองพิมพ์หาบอท ดูว่ามี request เข้ามาไหม
   - ไม่มี request → webhook ยังไม่ถูกเรียก (ดูข้อ 1 หรือ URL ผิด)
   - มี request แต่ log ขึ้น `LINE API error /message/reply 401` → `LINE_CHANNEL_ACCESS_TOKEN` ผิด

**บอทตอบ 2 ข้อความซ้อนกัน**
ยังไม่ปิด Auto-reply → LINE Console แท็บ Messaging API → Auto-reply messages → Edit → ปิด

**บอทตอบว่า "ไม่พบสินค้าที่ตรงกับ ..."**
ยังไม่มีสินค้าในระบบ หรือพิมพ์ชื่อไม่ตรง ลองพิมพ์คำสั้นลง เช่น `ปากกา` แทน `ปากกาลูกลื่นสีน้ำเงิน`

**กดปุ่มในการ์ดแล้วขึ้น "รายการนี้หมดอายุแล้ว"**
ร่างรายการมีอายุ 10 นาที เริ่มคำสั่งใหม่ได้เลย
(หรือเป็นการ์ดเก่าที่เลื่อนขึ้นไปหาแล้วกด — ระบบเก็บร่างได้ทีละ 1 รายการต่อคน)

## ริชเมนู

**สคริปต์ขึ้น `หา LIFF_ID ไม่เจอ`**
ยังไม่ได้ใส่ `LIFF_ID` ใน `wrangler.jsonc` หรือส่งมาทาง `LIFF_ID=xxx ./richmenu/deploy-richmenu.sh`

**ขึ้น error เรื่อง Chrome หรือรูปไม่ถูกสร้าง**
แก้ตัวแปร `CHROME` ในสคริปต์ให้ชี้ path ของ Chrome บนเครื่องคุณ
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Linux: `/usr/bin/google-chrome` หรือ `/usr/bin/chromium`
- Windows (Git Bash): `/c/Program Files/Google/Chrome/Application/chrome.exe`

**ติดตั้งเมนูแล้วแต่ไม่เห็นในแชท**
ปิดห้องแชทแล้วเปิดใหม่ หรือปิด-เปิดแอป LINE (ริชเมนูมีแคชฝั่งแอป)

## ฐานข้อมูล

**อยากล้างข้อมูลทั้งหมดเริ่มใหม่**
```bash
npx wrangler d1 execute line-stock --remote --command \
  "DELETE FROM movements; DELETE FROM stock_levels; DELETE FROM products; DELETE FROM locations;"
```
⚠️ ลบแล้วกู้ไม่ได้ — ควร export ออกก่อนถ้ามีข้อมูลจริง

**อยาก export ข้อมูลออกมา**
```bash
npx wrangler d1 export line-stock --remote --output backup.sql
```

**ต้องการเพิ่มตาราง/คอลัมน์**
สร้างไฟล์ใหม่ใน `migrations/` เช่น `0002_add_price.sql` แล้ว `npm run db:migrate`
อย่าแก้ไฟล์ `0001_init.sql` ที่รันไปแล้ว
