-- ระบบขอยืม/อนุมัติพัสดุ (ใช้รายการพัสดุของแผนกปกครอง)
CREATE TABLE loans (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id          TEXT NOT NULL UNIQUE,             -- เช่น LN-690924-8F3A
  borrower_name    TEXT NOT NULL,
  borrower_code    TEXT,                             -- รหัสประจำตัว 7 หลัก
  purpose          TEXT,
  due_date         TEXT,                             -- กำหนดส่งคืน
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','returned','rejected')),
  signature        TEXT,                             -- ลายเซ็นดิจิทัล (dataURL)
  note             TEXT,
  created_by       TEXT,
  created_by_name  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at      TEXT,
  approved_by      TEXT,
  returned_at      TEXT,
  returned_by      TEXT,
  return_signature TEXT,
  return_note      TEXT
);
CREATE INDEX idx_loans_status  ON loans(status);
CREATE INDEX idx_loans_created ON loans(created_at DESC);

-- รายการพัสดุในคำขอยืม (snapshot ชื่อ/รหัส/หน่วยตอนยืม)
CREATE TABLE loan_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id    INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name       TEXT NOT NULL,
  sku        TEXT,
  unit       TEXT,
  qty        REAL NOT NULL DEFAULT 1
);
CREATE INDEX idx_loan_items_loan ON loan_items(loan_id);