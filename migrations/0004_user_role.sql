-- แยกสิทธิ์ผู้ใช้: admin (ผู้ดูแล) / staff (เจ้าหน้าที่) / student (นักศึกษา)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin','staff','student'));

-- ผู้ใช้เดิมทั้งหมด (เจ้าของระบบ/ทีมติดตั้ง) เป็นผู้ดูแลก่อน
UPDATE users SET role = 'admin';