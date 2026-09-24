/* ============================================================
   ระบบยืม-คืนพัสดุ (หน้า /borrow) — หน้าเว็บหลักสำหรับนักเรียน
   - ล็อกอิน LINE (LIFF ตัวที่ 2)
   - เลือกพัสดุหลายรายการจากฐานกลาง (D1 เดียวกับสต๊อก)
   - กรอกแบบฟอร์ม + ลายเซ็นดิจิทัล → ส่งคำขอยืม
   - ดูสถานะคำขอของตัวเอง
   ============================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  config: null,
  idToken: null,
  me: null,
  products: [],
  cart: [],           // [{ productId, qty }]
  sig: null,
  tab: 'catalog',
};

/* ที่เก็บรูปภาพพัสดุของระบบเดิม (rtafnc-supplies บน Cloudflare) */
const IMAGE_BASE = 'https://rtafnc-supplies.anuchit1tube168.workers.dev/images/';

const LOAN_STATUS = {
  pending:   { label: 'รออนุมัติ', cls: 'pending' },
  active:    { label: 'กำลังยืม', cls: 'active' },
  returned:  { label: 'ส่งคืนแล้ว', cls: 'returned' },
  rejected:  { label: 'ไม่อนุมัติ', cls: 'rejected' },
};

/* ------------------------------------------------------------ helpers */

const fmt = (n) => {
  const v = Math.round((Number(n) || 0) * 1000) / 1000;
  return v.toLocaleString('th-TH', { maximumFractionDigits: 3 });
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function stockClass(qty, min) {
  if (qty <= 0) return 'out';
  if (min > 0 && qty <= min) return 'low';
  return 'ok';
}

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind ? 'toast--' + kind : ''}`;
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 260);
  }, 2800);
}

async function api(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (state.idToken) headers.authorization = `Bearer ${state.idToken}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // ล็อกอิน LINE หมดอายุ → ปลดล็อก + ขอล็อกอินใหม่เพื่อขอ token ใหม่เอง
    if (res.status === 401 && /เซสชันหมดอายุ/.test(data.error || '')) {
      try {
        if (typeof liff !== 'undefined' && liff.isLoggedIn()) liff.logout();
      } catch { /* ไม่เป็นไร */ }
      if (typeof liff !== 'undefined') liff.login({ redirectUri: location.href });
      throw new Error('ล็อกอินใหม่…');
    }
    throw new Error(data.error || `เกิดข้อผิดพลาด (${res.status})`);
  }
  return data;
}

/* --------------------------------------------------------- bootstrap */

async function boot() {
  try {
    state.config = await fetch('/api/config').then((r) => r.json());

    if (!state.config.borrowLiffId) {
      $('#viewBoot').hidden = true;
      $('#viewNoLiff').hidden = false;
      return;
    }

    await liff.init({ liffId: state.config.borrowLiffId });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: location.href });
      return;
    }
    state.idToken = liff.getIDToken();
    if (!state.idToken) throw new Error('ไม่ได้รับ ID token — ตรวจสอบว่าเปิด scope "openid" ใน LIFF แล้ว');

    state.me = await api('/me');
    paintHeader();
    $('#viewBoot').hidden = true;
    $('#viewApp').hidden = false;

    await Promise.all([loadProducts(), loadMyLoans()]);
  } catch (err) {
    console.error('boot error', err);
    $('#viewBoot').hidden = true;
    if (!$('#viewApp').hidden) return; // หน้าหลักใช้ได้แล้ว — ไม่อำพราง
    $('#viewLogin').hidden = false;
    $('#headChip').textContent = 'ล็อกอินใหม่';
  }
}

function paintHeader() {
  const role = state.me?.role === 'admin' ? 'ผู้ดูแลระบบ' : state.me?.role === 'staff' ? 'เจ้าหน้าที่' : 'นักศึกษา';
  $('#meName').textContent = state.me?.name || '';
  $('#meRole').textContent = role;
  $('#headChip').textContent = 'ยินดีต้อนรับ';
  $('#headChip').classList.add('chip--ok');

  // เติมชื่อจาก LINE ให้อัตโนมัติ (ผู้ใช้แก้ได้)
  $('#fName').value = state.me?.name || '';
  $('#fName').setAttribute('placeholder', state.me?.name ? 'แก้ชื่อได้ถ้าต้องการ' : 'เช่น พลฯ สมชาย ใจดี');
}

function handleLogin() {
  if (typeof liff !== 'undefined') liff.login({ redirectUri: location.href });
}

function doLogout() {
  try {
    if (typeof liff !== 'undefined') liff.logout();
  } catch { /* ไม่เป็นไร */ }
  location.reload();
}

/* ------------------------------------------------------------ products */

async function loadProducts() {
  try {
    state.products = await api('/products?limit=300');
  } catch (err) {
    toast(err.message, 'err');
    state.products = [];
  }
  renderCatalog();
}

function renderCatalog() {
  const q = ($('#searchInput').value || '').trim().toLowerCase();
  const list = state.products.filter((p) =>
    !q ||
    String(p.name || '').toLowerCase().includes(q) ||
    String(p.sku || '').toLowerCase().includes(q) ||
    String(p.category || '').toLowerCase().includes(q),
  );

  const host = $('#catalog');
  if (!list.length) {
    host.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="empty__icon">🔍</div><p>ไม่พบพัสดุ${q ? 'ที่ค้นหา' : ''}</p></div>`;
    return;
  }

  host.innerHTML = list
    .map((p) => {
      const qty = Number(p.total_qty) || 0;
      const qtyCls = stockClass(qty, Number(p.min_qty) || 0);
      const inCart = state.cart.find((c) => c.productId === p.id);
      const img = p.image
        ? `<img src="${IMAGE_BASE + encodeURIComponent(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()" />`
        : '📦';
      return `
      <div class="card">
        <div class="card__img">${img}</div>
        <div class="card__body">
          <div class="card__name">${esc(p.name)}</div>
          <div class="card__sku">รหัส ${esc(p.sku || '-')}</div>
          <div class="card__qty qty-${qtyCls}">
            คงเหลือ ${fmt(qty)} ${esc(p.unit || 'ชิ้น')}
          </div>
          <div class="card__foot">
            <button class="btn" type="button" onclick="addToCart(${p.id})"
              ${qty <= 0 ? 'disabled' : ''}>
              ${qty <= 0 ? 'หมด' : inCart ? 'เพิ่มอีก +' : 'ขอยืม +'}
            </button>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

/* ---------------------------------------------------------------- cart */

function addToCart(productId) {
  const p = state.products.find((x) => x.id === productId);
  if (!p) return;
  const qty = Number(p.total_qty) || 0;
  if (qty <= 0) return;
  const row = state.cart.find((c) => c.productId === productId);
  if (row) row.qty++;
  else state.cart.push({ productId, qty: 1 });
  updateCartBar();
  renderCatalog();
}

function cartQty() { return state.cart.reduce((s, c) => s + c.qty, 0); }

function updateCartBar() {
  const n = cartQty();
  $('#cartBar').hidden = n === 0;
  $('#cartCount').textContent = n;
}

function cartProduct(row) {
  return state.products.find((p) => p.id === row.productId);
}

function openCartSheet() {
  if (!state.cart.length) return;
  const host = $('#cartList');
  host.innerHTML = state.cart
    .map((row) => {
      const p = cartProduct(row);
      if (!p) return '';
      const left = Math.max(0, (Number(p.total_qty) || 0) - row.qty + 1);
      const img = p.image
        ? `<img src="${IMAGE_BASE + encodeURIComponent(p.image)}" alt="" loading="lazy" onerror="this.parentElement.textContent='📦'" />`
        : '📦';
      return `
      <div class="cart-row">
        <div class="cart-row__thumb">${img}</div>
        <div class="cart-row__info">
          <div class="cart-row__name">${esc(p.name)}</div>
          <div class="cart-row__sku">คงเหลืออีก ${fmt(left)} ${esc(p.unit || 'ชิ้น')}</div>
        </div>
        <div class="stepper">
          <button type="button" onclick="changeQty(${row.productId},-1)">−</button>
          <b>${row.qty}</b>
          <button type="button" onclick="changeQty(${row.productId},1)">+</button>
        </div>
        <button class="cart-row__del" type="button" onclick="removeItem(${row.productId})" title="เอาออก">🗑</button>
      </div>`;
    })
    .join('');
  $('#sheetCart').hidden = false;
}

function changeQty(productId, delta) {
  const row = state.cart.find((c) => c.productId === productId);
  if (!row) return;
  const p = cartProduct(row);
  const maxQty = p ? Math.max(Number(p.total_qty) || 0, row.qty) : Infinity;
  row.qty += delta;
  if (row.qty < 1) row.qty = 1;
  if (row.qty > maxQty) { row.qty = maxQty; toast(`ยืมได้ไม่เกินคงเหลือ (${fmt(maxQty)})`, 'err'); }
  updateCartBar();
  openCartSheet();
}

function removeItem(productId) {
  state.cart = state.cart.filter((c) => c.productId !== productId);
  updateCartBar();
  renderCatalog();
  openCartSheet();
}

/* ---------------------------------------------------------------- form */

function goForm() {
  if (!state.cart.length) return;
  closeSheets();
  // สรุปยอด
  $('#formSummary').innerHTML = `
    <h4>รายการขอยืม ${state.cart.length} รายการ</h4>
    ${state.cart
      .map((row) => {
        const p = cartProduct(row);
        return `<div class="formsum__item"><span>${esc(p ? p.name : '?')}</span><b>× ${row.qty}</b></div>`;
      })
      .join('')}`;

  $('#sheetForm').hidden = false;
  // ตั้งค่าวันส่งคืนเริ่มต้น = 7 วันข้างหน้า
  if (!$('#fDue').value) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    $('#fDue').value = d.toISOString().slice(0, 10);
  }
  setTimeout(() => { state.sig = initSigPad($('#sigCanvas')); }, 80);
}

function clearSig() {
  if (state.sig) state.sig.clear();
  $('#sigHint').textContent = 'เซ็นในกรอบข้างบน';
}

async function submitLoan() {
  const name = $('#fName').value.trim();
  const code = $('#fCode').value.trim();
  const due = $('#fDue').value;
  const purpose = $('#fPurpose').value.trim();

  if (!name) return toast('กรุณาระบุชื่อผู้ขอยืม', 'err');
  if (!/^\d{7}$/.test(code)) return toast('กรุณากรอกรหัสประจำตัว 7 หลัก (ตัวเลขเท่านั้น)', 'err');
  if (!due) return toast('กรุณาเลือกกำหนดส่งคืน', 'err');
  if (!state.sig || !state.sig.hasDrawn()) return toast('กรุณาเซ็นลายเซ็นดิจิทัลก่อนส่ง', 'err');

  const submitBtn = $('#btnSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังส่ง…';

  try {
    const loan = await api('/loans', {
      method: 'POST',
      body: JSON.stringify({
        borrowerName: name,
        borrowerCode: code,
        dueDate: due,
        purpose,
        signature: state.sig.dataURL(),
        items: state.cart.map((r) => ({ productId: r.productId, qty: r.qty })),
      }),
    });
    toast(`ส่งคำขอยืม ${loan.loan_id} เรียบร้อย — รอเจ้าหน้าที่อนุมัติ`, 'ok');
    state.cart = [];
    updateCartBar();
    closeSheets();
    switchTab('mine');
    await loadMyLoans();
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'ส่งคำขอยืม ✓';
  }
}

/* -------------------------------------------------------------- sheets */

function closeSheets() {
  $('#sheetCart').hidden = true;
  $('#sheetForm').hidden = true;
}

/* ----------------------------------------------------------- my loans */

async function loadMyLoans() {
  const host = $('#myLoans');
  host.innerHTML = `<div class="empty"><div class="spinner" style="margin:0 auto"></div><p>กำลังโหลด…</p></div>`;
  let loans = [];
  try {
    loans = await api('/loans?mine=1');
  } catch (err) {
    toast(err.message, 'err');
  }

  if (!loans.length) {
    host.innerHTML = `<div class="empty">
      <div class="empty__icon">🗂️</div>
      <h2>ยังไม่มีคำขอยืม</h2>
      <p>กลับไปที่แท็บ "รายการพัสดุ" แล้วกดขอยืมได้เลย</p></div>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  host.innerHTML = loans
    .map((l) => {
      const st = LOAN_STATUS[l.status] || { label: l.status, cls: 'pending' };
      const overdue = l.status === 'active' && l.due_date && l.due_date < today;
      const items = (l.items || [])
        .map(
          (it) =>
            `<li><span>${esc(it.name)}${it.sku ? ` <span class="muted">(${esc(it.sku)})</span>` : ''}</span><b>× ${fmt(it.qty)}</b></li>`,
        )
        .join('');
      return `
      <div class="loan-card">
        <div class="loan-card__top">
          <span class="loan-card__id">${esc(l.loan_id)}</span>
          <span class="badge badge--${st.cls}">${st.label}</span>
        </div>
        <div class="loan-card__date">ยื่นเมื่อ ${esc(String(l.created_at || '').replace('T', ' ').slice(0, 16))}</div>
        <ul class="loan-card__items">${items}</ul>
        <div class="loan-card__meta">
          ${l.due_date ? `<span class="loan-card__due">กำหนดส่งคืน: ${esc(l.due_date)}</span>` : ''}
          ${overdue ? `<span class="loan-card__overdue">⚠ เกินกำหนดส่งคืนแล้ว</span>` : ''}
          ${l.purpose ? `<span>ภารกิจ: ${esc(l.purpose)}</span>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

/* -------------------------------------------------------------- tabs */

function switchTab(tab) {
  state.tab = tab;
  $$('.tab').forEach((t) => t.classList.toggle('tab--on', t.dataset.tab === tab));
  $('#tabCatalog').hidden = tab !== 'catalog';
  $('#tabMine').hidden = tab !== 'mine';
}

/* ------------------------------------------------------------ sig pad */

function initSigPad(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width) * dpr;
  canvas.height = Math.max(1, rect.height) * dpr;
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0F172A';
  let drawing = false;
  let hasDrawn = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    hasDrawn = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    $('#sigHint').textContent = '✓ ลงนามแล้ว';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const stop = () => (drawing = false);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.style.backgroundColor = '#ffffff';
  const pad = {
    hasDrawn: () => hasDrawn,
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
      canvas.style.backgroundColor = '#ffffff';
    },
    dataURL: () => canvas.toDataURL('image/png'),
  };
  state.sig = pad;
  return pad;
}

/* ----------------------------------------------------------------- run */

boot();