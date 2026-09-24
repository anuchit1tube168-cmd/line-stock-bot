export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  /** Messaging API — ใช้ตรวจลายเซ็น webhook */
  LINE_CHANNEL_SECRET: string;
  /** Messaging API — ใช้ตอบกลับ/ส่งข้อความ */
  LINE_CHANNEL_ACCESS_TOKEN: string;
  /** LINE Login channel id ของ LIFF — ใช้ตรวจ ID token */
  LINE_LOGIN_CHANNEL_ID: string;
  LIFF_ID: string;
  /** LIFF app ของหน้า "ยืม/คืน" สำหรับนักเรียน (ระบบหลัก) */
  BORROW_LIFF_ID?: string;

  ENVIRONMENT?: string;
  DEV_LINE_USER_ID?: string;
  DEV_LINE_DISPLAY_NAME?: string;
}

export type MovementType = 'issue' | 'receive' | 'adjust' | 'transfer_out' | 'transfer_in';
export type ActionType = 'issue' | 'receive' | 'adjust' | 'transfer';

export type LoanStatus = 'pending' | 'active' | 'returned' | 'rejected';

export type Role = 'admin' | 'staff' | 'student';

export interface LoanItemRow {
  id: number;
  loan_id: string;
  product_id: number;
  name: string;
  sku: string | null;
  unit: string | null;
  qty: number;
  image?: string | null;
}

export interface LoanRow {
  id: number;
  loan_id: string;
  borrower_name: string;
  borrower_code: string | null;
  purpose: string | null;
  due_date: string | null;
  status: LoanStatus;
  signature: string | null;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  returned_at: string | null;
  returned_by: string | null;
  return_signature: string | null;
  return_note: string | null;
  items?: LoanItemRow[];
}

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  category: string | null;
  unit: string;
  min_qty: number;
  note: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  code: string;
  name: string;
  is_default: number;
  active: number;
}

export interface Actor {
  lineUserId: string | null;
  name: string | null;
  source: 'line' | 'liff' | 'system';
}

export interface DraftPayload {
  action: ActionType;
  query: string;
  productId?: number;
  locationId?: number;
  toLocationId?: number;
  qty?: number;
  note?: string;
  /** true = ผู้ใช้แค่ต้องการดูข้อมูลสินค้า ไม่ได้ทำรายการ */
  view?: boolean;
}

export type DraftStep = 'pick_product' | 'pick_location' | 'pick_to_location' | 'ask_qty' | 'confirm';

export interface Draft {
  lineUserId: string;
  token: string;
  step: DraftStep;
  payload: DraftPayload;
}
