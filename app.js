"use strict";
/* CSDL MINH CHỨNG – TỰ ĐÁNH GIÁ CTĐT THẠC SĨ NGÀNH LUẬT HP&LHC
   GitHub Pages + Firebase (dự án phuc-nguyen-library: Auth, Firestore) + Google Drive (lưu tệp).
   Firestore: kd_cfg/main · kd_tc/{mã tiêu chí} · kd_cc/{CC-xx} · kd_mc/{id} · kd_tv/{email} · kd_log · kd_rules_v */
const C = window.KD_CONFIG;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER = "application/vnd.google-apps.folder";
const TT = { CHUA: "Chưa có", CHO: "Đã tải – chờ rà soát", DAT: "Đạt", BOSUNG: "Cần bổ sung", BO: "Không dùng" };
const DS_TT = [TT.CHUA, TT.CHO, TT.DAT, TT.BOSUNG, TT.BO];
const VAI = { xem: "Chỉ xem", thanhvien: "Thành viên (tải lên)", thuky: "Ban Thư ký" };

firebase.initializeApp(C.FIREBASE);
const auth = firebase.auth(), db = firebase.firestore();
const S = { user: null, admin: false, role: "", tv: null, cfg: null, tc: [], cc: [], mc: [], tvList: [], tab: "tc", tcSel: "1.1", q: "",
  tok: null, tokExp: 0, rulesOk: null, unsub: [], loaded: false };
const app = document.getElementById("app");

/* ---------- tiện ích ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const em = () => (S.user && S.user.email || "").toLowerCase();
const now = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
function busy(t) { let b = document.getElementById("busy"); if (!t) { if (b) b.remove(); return; } if (!b) { b = document.createElement("div"); b.id = "busy"; b.className = "busy"; document.body.appendChild(b); } b.textContent = t; }
const canUp = () => S.role === "thanhvien" || S.role === "thuky";
const isTk = () => S.role === "thuky";
function isAdminUser(u) { return !!u && (u.uid === C.ADMIN_UID || (!!u.email && u.emailVerified !== false && C.ADMIN_EMAILS.includes(u.email.toLowerCase()))); }
function errMsg(e) {
  const c = e && e.code || "";
  if (c === "permission-denied") return "Không đủ quyền thực hiện thao tác này (hoặc quy tắc dữ liệu chưa cập nhật).";
  if (c === "auth/popup-blocked") return "Trình duyệt chặn cửa sổ đăng nhập — cho phép cửa sổ bật lên rồi bấm lại.";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "Cửa sổ đăng nhập đã đóng.";
  return (e && e.message) || String(e);
}
async function log(viec, id, chiTiet) {
  try { await db.collection("kd_log").add({ t: Date.now(), tg: now(), email: em(), ten: S.tv && S.tv.ten || S.user.displayName || "", viec, id: id || "", chiTiet: String(chiTiet || "").slice(0, 500) }); } catch (e) { /* nhật ký không chặn thao tác */ }
}
function nguoi() { return (S.tv && S.tv.ten) || (S.user && S.user.displayName) || em(); }

/* ---------- Đăng nhập ---------- */
const ACCT_DOMAIN = "taikhoan.kd";
const isTkAcct = () => em().endsWith("@" + ACCT_DOMAIN);
const tenDN = e => String(e || "").endsWith("@" + ACCT_DOMAIN) ? String(e).split("@")[0] : "";
function provider(scopeDrive) {
  const p = new firebase.auth.GoogleAuthProvider();
  if (scopeDrive) p.addScope(DRIVE_SCOPE);
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}
function saveTok(t, sec) { S.tok = t || null; S.tokExp = t ? Date.now() + ((sec || 3500) - 120) * 1000 : 0; }
async function login() {
  const errBox = document.getElementById("lgErr");
  try {
    const r = await auth.signInWithPopup(provider(true));
    if (r.credential && r.credential.accessToken) saveTok(r.credential.accessToken);
  } catch (e) { if (errBox) errBox.textContent = errMsg(e); }
}
async function loginTk() {
  const errBox = document.getElementById("lgErr");
  const u = (document.getElementById("lgUser").value || "").trim().toLowerCase(), p = document.getElementById("lgPass").value || "";
  if (!u || !p) { errBox.textContent = "Nhập tên đăng nhập và mật khẩu."; return; }
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) { errBox.textContent = "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch."; return; }
  errBox.textContent = ""; busy("Đang đăng nhập…");
  try { await auth.signInWithEmailAndPassword(u + "@" + ACCT_DOMAIN, p); }
  catch (e) {
    busy();
    const c = e && e.code || "";
    errBox.textContent = /wrong-password|user-not-found|invalid-credential|invalid-login/.test(c) ? "Tên đăng nhập hoặc mật khẩu không đúng." : c === "auth/too-many-requests" ? "Nhập sai nhiều lần, thử lại sau ít phút." : errMsg(e);
  }
}
function renderLogin(msg) {
  app.innerHTML = `<div class="login"><h2>CSDL minh chứng</h2>
    <div class="meta">Tự đánh giá CTĐT thạc sĩ ngành Luật Hiến pháp và Luật Hành chính (định hướng ứng dụng) – Học viện Hành chính và Quản trị công · Thông tư 04/2025/TT-BGDĐT</div>
    <label>Tên đăng nhập</label><input type="text" id="lgUser" autocomplete="username" placeholder="Do Ban Thư ký cấp">
    <label>Mật khẩu</label><input type="password" id="lgPass" autocomplete="current-password" style="width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font:inherit">
    <div class="err" id="lgErr">${esc(msg || "")}</div>
    <div class="row" style="justify-content:flex-start"><button class="b pri" id="lgTk">Đăng nhập</button>
      <span class="meta" style="margin:4px 6px">hoặc</span><button class="b" id="lgBtn">Đăng nhập bằng Google</button>
      ${S.user ? `<button class="b" id="lgOut">Thoát ${esc(em())}</button>` : ""}</div>
    <div class="meta" style="margin-top:10px">Đăng nhập Google dành cho người được cấp quyền bằng Gmail hoặc đã liên kết Gmail trong mục Tài khoản. Lần đầu Google có thể báo “ứng dụng chưa được xác minh”: bấm <b>Nâng cao</b> → <b>Đi tới…</b>.</div></div>`;
  document.getElementById("lgBtn").onclick = login;
  document.getElementById("lgTk").onclick = loginTk;
  document.getElementById("lgPass").onkeydown = e => { if (e.key === "Enter") loginTk(); };
  const o = document.getElementById("lgOut"); if (o) o.onclick = () => auth.signOut();
}

auth.onAuthStateChanged(async u => {
  S.unsub.forEach(f => f()); S.unsub = []; S.loaded = false;
  S.user = u; S.admin = isAdminUser(u); S.tv = null; S.role = ""; saveTok(S.tok && u ? S.tok : null, 3500);
  if (!u) return renderLogin();
  busy("Đang kiểm tra quyền…");
  try {
    let tv = null;
    try { const d = await db.collection("kd_tv").doc(em()).get(); tv = d.exists ? d.data() : null; }
    catch (e) { if (!S.admin) throw e; }
    if (S.admin) S.role = "thuky";
    else if (tv && !tv.khoa) S.role = tv.vai || "xem";
    else { busy(); return renderLogin(isTkAcct() ? "Tài khoản đã bị khóa. Liên hệ Ban Thư ký." : "Tài khoản Google " + u.email + " chưa được Ban Thư ký cấp quyền (hoặc đã bị khóa)."); }
    S.tv = tv;
    await start();
  } catch (e) { busy(); renderLogin(errMsg(e)); }
});

/* ---------- Nạp dữ liệu ---------- */
async function start() {
  if (S.admin) { S.rulesOk = await rsProbe(C.RULES_V); if (S.rulesOk === false) { busy(); S.tab = "cd"; return render(); } }
  const cfg = await db.collection("kd_cfg").doc("main").get();
  S.cfg = cfg.exists ? cfg.data() : null;
  if (!S.cfg) { busy(); if (S.admin) { S.tab = "cd"; return render(); } return renderLogin("Hệ thống chưa được quản trị khởi tạo."); }
  const tc = await db.collection("kd_tc").get();
  S.tc = tc.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => cmpMa(a.ma, b.ma));
  S.unsub.push(db.collection("kd_cc").onSnapshot(s => { S.cc = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => a.tt - b.tt); if (S.loaded) renderMain(); }, e => busy(errMsg(e))));
  S.unsub.push(db.collection("kd_kho").onSnapshot(s => { S.kho = s.docs.map(d => Object.assign({ id: d.id }, d.data())); S.khoLoi = ""; if (S.loaded && S.tab === "kc") renderMain(); },
    e => { S.kho = []; S.khoLoi = errMsg(e); }));
  S.unsub.push(db.collection("kd_mc").onSnapshot(s => {
    S.mc = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
    const first = !S.loaded; S.loaded = true; busy();
    if (first) render(); else renderMain();
  }, e => busy(errMsg(e))));
}
const cmpMa = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); return (x[0] - y[0]) || (x[1] - y[1]); };
const efOf = r => Number(String(r.ma || "").split(".").pop()) || 0;

/* ---------- Dẫn xuất ---------- */
const tcOf = ma => S.tc.find(t => t.ma === ma);
const mcOf = ma => S.mc.filter(r => r.tieuChi === ma && r.loai === "MC").sort((a, b) => efOf(a) - efOf(b));
const kids = id => S.mc.filter(r => r.cha === id).sort((a, b) => (a.taoLuc || 0) - (b.taoLuc || 0));
/* Minh chứng dùng chung: dòng B có goc = id dòng A → B dùng tệp, văn bản, trạng thái của A (mã hóa một lần) */
function goc(r) { let x = r, n = 0; while (x && x.goc && n < 6) { const y = S.mc.find(z => z.id === x.goc); if (!y || y === r) break; x = y; n++; } return x; }
const phu = id => S.mc.filter(r => r.goc === id && r.loai === "MC");
const coTep = r => { const g = goc(r); return !!g.link || kids(g.id).some(k => !!k.link); };
function tienDo(ma) {
  const m = mcOf(ma).filter(r => r.trangThai !== TT.BO);
  return { co: m.filter(coTep).length, tong: m.length, dat: m.filter(r => goc(r).trangThai === TT.DAT).length };
}
/* Nhận diện trùng lặp: so khớp tên (bỏ dấu, bỏ từ nối) và số hiệu văn bản */
const STOPW = new Set("cua va cac ve cho theo voi trong duoc co tu den nhung mot la hoac thuc hien nhu tai tren bang ban hanh nam".split(" "));
const normVN = x => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9/]+/g, " ").trim();
const MEMO = new Map();
const memo = (k, f) => { if (!MEMO.has(k)) { if (MEMO.size > 5000) MEMO.clear(); MEMO.set(k, f()); } return MEMO.get(k); };
const VIET_TAT = [["de cuong chi tiet hoc phan", "dccthp"], ["de cuong hoc phan", "dccthp"], ["chuong trinh dao tao", "ctdt"], ["chuan dau ra", "cdr"], ["giang vien", "gv"],
  ["nghien cuu vien", "ncv"], ["nguoi hoc", "nh"], ["ben lien quan", "blq"], ["co so dao tao", "csdt"], ["co so vat chat", "csvc"], ["nghien cuu khoa hoc", "nckh"],
  ["co so du lieu", "csdl"], ["khung trinh do quoc gia", "ktqg"], ["giao duc dai hoc", "gddh"], ["cong nghe thong tin", "cntt"]];
const vietTat = x => VIET_TAT.reduce((a, [k, v]) => a.replace(new RegExp("\\b" + k + "\\b", "g"), v), x);
const tokSet = x => memo("t" + x, () => new Set(vietTat(normVN(x)).split(" ").filter(w => w.length > 1 && !STOPW.has(w))));
const soHieu = x => memo("s" + x, () => (normVN(x).match(/\b\d{1,5}\/[a-z0-9/-]*[a-z][a-z0-9/-]*/g) || []));
function tuongDong(a, b) {
  const A = new Set([...soHieu(a.soNgay), ...soHieu(a.ten)]), B = [...soHieu(b.soNgay), ...soHieu(b.ten)];
  if (B.some(x => A.has(x))) return 1;
  let best = 0;
  [a.ten, a.tenGoiY].filter(Boolean).forEach(ta => [b.ten, b.tenGoiY].filter(Boolean).forEach(tb => {
    const X = tokSet(ta), Y = tokSet(tb); if (X.size < 3 || Y.size < 3) return;
    let i = 0; X.forEach(w => { if (Y.has(w)) i++; });
    best = Math.max(best, (i / (X.size + Y.size - i) + i / Math.min(X.size, Y.size)) / 2);
  }));
  return best;
}
const NGUONG_TRUNG = 0.75;
/* Gợi ý cho một minh chứng chưa có tệp: minh chứng ở tiêu chí khác đã có tệp, tên/số hiệu tương đồng */
function goiYTrung(r, lim) {
  if (r.loai !== "MC" || r.goc || coTep(r) || r.trangThai === TT.BO) return [];
  const bo = new Set(r.khongTrung || []);
  return S.mc.filter(x => x.loai === "MC" && x.id !== r.id && !x.goc && x.tieuChi !== r.tieuChi && !bo.has(x.id) && x.trangThai !== TT.BO && coTep(x))
    .map(x => ({ x, d: tuongDong(r, x) })).filter(o => o.d >= NGUONG_TRUNG).sort((p, q) => q.d - p.d).slice(0, lim || 3);
}
async function noiMinhChung(r, dich) {
  const g = goc(dich);
  if (g.id === r.id) throw new Error("Không thể nối minh chứng với chính nó.");
  if (r.link || kids(r.id).length) throw new Error("Minh chứng này đã có tệp/văn bản riêng. Gỡ tệp hoặc chuyển văn bản trước khi nối, hoặc nối theo chiều ngược lại.");
  const b = db.batch();
  b.update(db.collection("kd_mc").doc(r.id), { goc: g.id });
  phu(r.id).forEach(x => b.update(db.collection("kd_mc").doc(x.id), { goc: g.id }));
  await b.commit();
  await log("Nối dùng chung", r.id, `${r.ma} → ${g.ma} (${g.tieuChi})`);
}
function tienDoStd(n) { const o = { co: 0, tong: 0, dat: 0 }; S.tc.filter(t => t.tieuChuan === n).forEach(t => { const p = tienDo(t.ma); o.co += p.co; o.tong += p.tong; o.dat += p.dat; }); return o; }
const stCls = s => "st st" + Math.max(0, DS_TT.indexOf(s));

/* ---------- Khung ---------- */
function render() {
  const tabs = [["tc", "Tiêu chí & minh chứng"], ["kc", "Kho chung"], ["th", "Danh mục tổng"], ["cc", "Căn cứ pháp lý"]];
  if (isTk()) tabs.push(["tv", "Thành viên"]);
  if (S.admin) tabs.push(["cd", "Cài đặt"]);
  tabs.push(["tk", "Tài khoản của tôi"]);
  const ready = S.loaded;
  app.innerHTML = `<header><h1>CSDL minh chứng – TĐG CTĐT thạc sĩ ngành Luật HP&amp;LHC<small>Thông tư 04/2025/TT-BGDĐT · 8 tiêu chuẩn · 52 tiêu chí · giai đoạn 01/9/2023 – 30/8/2026</small></h1>
    <span class="who">${esc(nguoi())} · ${S.admin ? "Quản trị" : esc(VAI[S.role] || S.role)}</span>
    ${S.cfg && S.cfg.rootUrl ? `<a class="b" style="background:#fff;text-decoration:none" href="${esc(S.cfg.rootUrl)}" target="_blank" rel="noopener">Thư mục Drive</a>` : ""}
    <button class="b" id="lo" style="background:#fff">Đăng xuất</button></header>
    <nav>${tabs.filter(t => ready || t[0] === "cd" || t[0] === "tk").map(t => `<button data-t="${t[0]}" class="${S.tab === t[0] ? "on" : ""}">${t[1]}</button>`).join("")}
    ${ready ? `<input id="q" placeholder="Tìm minh chứng, văn bản, mã…" value="${esc(S.q)}">` : ""}</nav><main id="main"></main>`;
  app.querySelectorAll("nav button").forEach(b => b.onclick = () => { S.tab = b.dataset.t; S.q = ""; render(); });
  document.getElementById("lo").onclick = () => auth.signOut();
  const q = document.getElementById("q"); if (q) q.oninput = () => { S.q = q.value; renderMain(); };
  renderMain();
}
function renderMain() {
  const m = document.getElementById("main"); if (!m) return;
  if (S.tab === "cd") return renderCaiDat(m);
  if (S.tab === "tk") return renderTaiKhoan(m);
  if (!S.loaded) { m.innerHTML = `<section class="content">Đang tải dữ liệu…</section>`; return; }
  if (S.q.trim()) return renderSearch(m);
  if (S.tab === "cc") return renderCanCu(m);
  if (S.tab === "th") return renderTongHop(m);
  if (S.tab === "tv") return renderThanhVien(m);
  if (S.tab === "kc") return renderKho(m);
  renderTieuChiTab(m);
}

/* ---------- Tab tiêu chí ---------- */
function renderTieuChiTab(m) {
  let side = "", last = 0;
  S.tc.forEach(t => {
    if (t.tieuChuan !== last) {
      last = t.tieuChuan; const p = tienDoStd(last);
      side += `<a class="std${S.tcSel === "TC" + last ? " on" : ""}" data-tc="TC${last}" title="Xem toàn bộ tiêu chuẩn ${last}"><span class="n">Tiêu chuẩn ${last}. ${esc(t.tenTieuChuan)}</span><span class="p">${p.co}/${p.tong}</span></a>`;
    }
    const p = tienDo(t.ma);
    side += `<a data-tc="${esc(t.ma)}" class="${S.tcSel === t.ma ? "on" : ""}"><b>${esc(t.ma)}</b><span class="n">${t.dieuKien ? '<span class="badge">ĐK</span>' : ""}</span><span class="p">${p.co}/${p.tong}</span></a>`;
  });
  m.innerHTML = `<aside>${side}</aside><section class="content" id="sec"></section>`;
  m.querySelectorAll("aside a").forEach(a => a.onclick = () => { S.tcSel = a.dataset.tc; renderMain(); if (window.scrollY > 0) window.scrollTo(0, 0); });
  const sec = document.getElementById("sec");
  if (/^TC\d$/.test(S.tcSel)) {
    const n = Number(S.tcSel.slice(2)), list = S.tc.filter(t => t.tieuChuan === n), p = tienDoStd(n), pc = p.tong ? Math.round(p.co * 100 / p.tong) : 0;
    sec.innerHTML = `<h2>Tiêu chuẩn ${n}. ${esc(list[0] ? list[0].tenTieuChuan : "")}</h2>
      <div class="meta">${esc(list[0] ? list[0].nhom : "")} · Hạn: ${esc(list[0] ? list[0].han : "")} · ${list.length} tiêu chí · Có tệp ${p.co}/${p.tong} minh chứng (${pc}%) · Đạt ${p.dat}</div>
      <div class="bar" style="max-width:420px"><i style="width:${pc}%"></i></div>
      <div class="meta">Chuyển nhanh: ${list.map(t => `<a class="f" href="#k${esc(t.ma)}" data-jump="${esc(t.ma)}">${esc(t.ma)}</a>`).join(" · ")}</div>
      ${list.map(t => `<div id="k${esc(t.ma)}" style="margin-top:22px;padding-top:10px;border-top:2px solid var(--navy)">${critBlock(t, false)}</div>`).join("")}`;
    sec.querySelectorAll("[data-jump]").forEach(a => a.onclick = e => { e.preventDefault(); const el = document.getElementById("k" + a.dataset.jump); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth" }); });
  } else {
    const t = tcOf(S.tcSel);
    if (!t) { sec.textContent = "Không có dữ liệu."; return; }
    sec.innerHTML = `<div class="meta"><a class="f" href="#" data-std="TC${t.tieuChuan}">← Xem toàn bộ Tiêu chuẩn ${t.tieuChuan}</a></div>` + critBlock(t, true);
    sec.querySelector("[data-std]").onclick = e => { e.preventDefault(); S.tcSel = e.target.dataset.std; renderMain(); };
  }
  bindActions(sec);
}
function critBlock(t, single) {
  const p = tienDo(t.ma), li = (arr, tag) => `<${tag}>${(arr || []).map(x => `<li>${esc(x)}</li>`).join("")}</${tag}>`;
  return `<h2 style="${single ? "" : "font-size:16px"}">Tiêu chí ${esc(t.ma)} ${t.dieuKien ? '<span class="badge">Tiêu chí điều kiện</span>' : ""}</h2>
    <div style="font-weight:600;margin-bottom:4px">${esc(t.ten)}</div>
    <div class="meta">${single ? `Tiêu chuẩn ${t.tieuChuan}. ${esc(t.tenTieuChuan)} · ${esc(t.nhom)} · Hạn: ${esc(t.han)} · ` : ""}Có tệp ${p.co}/${p.tong} minh chứng · Đạt ${p.dat}</div>
    <details><summary>Yêu cầu của tiêu chí (Phụ lục II TT 04/2025)</summary>${li(t.yeuCau, "ol")}</details>
    <details><summary>Minh chứng gợi ý (Phụ lục II TT 04/2025)</summary>${li(t.goiY, "ul")}</details>
    ${tableMC(mcOf(t.ma))}
    ${isTk() ? `<div class="row" style="justify-content:flex-start;margin-top:8px"><button class="b pri" data-a="newmc" data-tc="${esc(t.ma)}">+ Thêm minh chứng cho tiêu chí ${esc(t.ma)}</button></div>` : ""}`;
}
function tableMC(mcs) {
  let h = `<table><thead><tr><th style="width:110px">Mã minh chứng</th><th>Tên minh chứng / văn bản</th><th style="width:150px">Số, ngày ban hành / thời điểm</th><th style="width:130px">Nơi ban hành</th><th style="width:90px">Dùng chung</th><th style="width:50px">Tệp</th><th style="width:120px">Trạng thái</th><th style="width:220px">Ghi chú / Tải lên</th></tr></thead><tbody>`;
  mcs.forEach(r => { h += rowHtml(r, true); const g = goc(r); kids(g.id).forEach(k => { h += rowHtml(k, false, g !== r); }); });
  return h + "</tbody></table>";
}
function rowHtml(r, isMc, quaNoi) {
  const id = esc(r.id), g = isMc ? goc(r) : r, noi = isMc && g !== r;
  let act = "";
  if (canUp() && !quaNoi) {
    if (isMc && !g.link && !kids(g.id).length) act += `<button class="b pri" data-a="gan" data-id="${esc(g.id)}">⬆ Tải tệp</button>`;
    if (isMc) act += `<button class="b" data-a="them" data-id="${esc(g.id)}">+ Văn bản</button>`;
    act += `<button class="b" data-a="sua" data-id="${id}">Sửa</button>`;
    if (isMc) act += noi ? `<button class="b" data-a="bonoi" data-id="${id}">Bỏ nối</button>` : (!r.link && !kids(r.id).length ? `<button class="b" data-a="noi" data-id="${id}">⇄ Nối</button>` : "");
  }
  if (isTk() && !quaNoi) {
    act += `<button class="b" data-a="ra" data-id="${esc(g.id)}">Rà soát</button>`;
    if (g.link) act += `<button class="b red" data-a="go" data-id="${esc(g.id)}">Gỡ tệp</button>`;
    if (!isMc) act += `<button class="b red" data-a="xoa" data-id="${id}">Xóa</button>`;
  }
  const dsPhu = isMc && !noi ? phu(r.id).map(x => x.tieuChi) : [];
  const dungChung = [r.dungChung, dsPhu.length ? "⇄ " + dsPhu.join("; ") : ""].filter(Boolean).join(" ");
  const tenGY = isMc && r.tenGoiY && r.tenGoiY !== r.ten ? `<div class="meta" style="margin:2px 0 0;font-size:11.5px">Gợi ý PL II: ${esc(r.tenGoiY)}</div>` : "";
  const noiInfo = noi ? `<div style="margin-top:3px;font-size:12.5px;color:var(--blue)">⇄ Dùng chung minh chứng <b>${esc(g.ma)}</b> (tiêu chí <a class="f" href="#" data-go2="${esc(g.tieuChi)}">${esc(g.tieuChi)}</a>) – ${esc(g.ten)}</div>` : "";
  const gy = isMc && canUp() && !noi ? goiYTrung(r, 2) : [];
  const gyHtml = gy.length ? `<div style="margin-top:4px;font-size:12px;background:#fff8e6;border:1px dashed var(--warn);border-radius:6px;padding:3px 6px">Có thể trùng với ${gy.map(o => `<b>${esc(o.x.ma)}</b> (${esc(o.x.tieuChi)}) đã có tệp <button class="b" data-a="noinhanh" data-id="${id}" data-dich="${esc(o.x.id)}">Nối</button>`).join(" · ")} <button class="b" data-a="ktrung" data-id="${id}" data-dich="${esc(gy.map(o => o.x.id).join(","))}">Không trùng</button></div>` : "";
  const st = isMc ? g.trangThai : r.trangThai;
  return `<tr class="${isMc ? "mc" : "tp"}${st === TT.BO || r.trangThai === TT.BO ? " bo" : ""}">
    <td class="ma">${noi ? `<s style="opacity:.55">${esc(r.ma)}</s><br>${esc(g.ma)}` : esc(r.ma || "")}</td>
    <td class="ten">${esc(r.ten)}${tenGY}${noiInfo}${!noi && r.nguoi ? `<div class="meta" style="margin:2px 0 0;font-size:11.5px">${esc(r.nguoi)} · ${esc(r.tg)}</div>` : ""}${gyHtml}</td>
    <td>${esc(noi ? g.soNgay : r.soNgay)}</td><td>${esc(noi ? g.noi : r.noi)}</td><td>${esc(dungChung)}</td>
    <td>${g.link ? `<a class="f" href="${esc(g.link)}" target="_blank" rel="noopener">Mở</a>` : ""}</td>
    <td><span class="${stCls(st)}">${esc(st || "")}</span></td>
    <td><div class="act">${act}</div>${g.ghiChu ? `<div class="note">${esc(g.ghiChu)}</div>` : ""}</td></tr>`;
}

/* ---------- Căn cứ ---------- */
function renderCanCu(m) {
  let h = `<section class="content"><h2>Hệ thống văn bản căn cứ</h2><div class="meta">Mở bản đọc trực tuyến, hoặc tải bản chính thức (PDF có dấu) để cả Hội đồng dùng chung.</div>
    <table><thead><tr><th style="width:36px">TT</th><th>Văn bản</th><th style="width:150px">Số hiệu, ngày</th><th style="width:200px">Hiệu lực / tình trạng</th><th>Dùng cho</th><th style="width:60px">Đọc</th><th style="width:150px">Bản chính thức</th></tr></thead><tbody>`;
  S.cc.forEach(r => {
    const id = esc(r.id);
    let f = r.link ? `<a class="f" href="${esc(r.link)}" target="_blank" rel="noopener">Mở tệp</a>` : "";
    if (canUp() && (!r.link || isTk())) f += ` <button class="b pri" data-a="cc" data-id="${id}">⬆ Tải</button>`;
    if (r.link && isTk()) f += ` <button class="b red" data-a="gocc" data-id="${id}">Gỡ</button>`;
    h += `<tr><td>${r.tt}</td><td><b>${esc(r.loai)}</b> ${esc(r.ten)}</td><td>${esc(r.so)}<br>${esc(r.ngay)}</td><td>${esc(r.hieuLuc)}</td><td>${esc(r.dungCho)}</td>
      <td>${r.doc ? `<a class="f" href="${esc(r.doc)}" target="_blank" rel="noopener">Đọc</a>` : ""}</td><td>${f}</td></tr>`;
  });
  m.innerHTML = h + "</tbody></table></section>";
  bindActions(m);
}

/* ---------- Danh mục tổng ---------- */
const TINH = { thieu: "Chưa tải lên", cho: "Chờ rà soát", bosung: "Cần bổ sung", dat: "Đạt", bo: "Không dùng" };
function tinhTrang(r) {
  if (r.trangThai === TT.BO) return "bo";
  const g = goc(r);
  if (g.trangThai === TT.BOSUNG) return "bosung";
  if (!coTep(r)) return "thieu";
  return g.trangThai === TT.DAT ? "dat" : "cho";
}
const TINH_CLS = { thieu: "st st3", cho: "st st1", bosung: "st st3", dat: "st st2", bo: "st st4" };
function locDanhMuc() {
  const F = S.loc;
  return S.tc.filter(t => (!F.std || String(t.tieuChuan) === F.std) && (!F.dk || t.dieuKien) && (!F.nhom || t.nhom === F.nhom))
    .map(t => ({ t, rows: mcOf(t.ma).filter(r => { const k = tinhTrang(r); return F.tt === "all" ? k !== "bo" : k === F.tt; }) }))
    .filter(g => g.rows.length);
}
function renderTongHop(m) {
  S.loc = S.loc || { std: "", tt: "thieu", dk: false, nhom: "" };
  const F = S.loc, all = S.mc.filter(r => r.loai === "MC"), dem = {};
  Object.keys(TINH).forEach(k => dem[k] = 0); all.forEach(r => dem[tinhTrang(r)]++);
  const std = {};
  S.tc.forEach(t => { const p = tienDo(t.ma), k = t.tieuChuan; std[k] = std[k] || { ten: t.tenTieuChuan, nhom: t.nhom, co: 0, tong: 0, dat: 0 }; std[k].co += p.co; std[k].tong += p.tong; std[k].dat += p.dat; });
  const nhoms = [...new Set(S.tc.map(t => t.nhom))];
  const groups = locDanhMuc(), n = groups.reduce((a, g) => a + g.rows.length, 0);
  let h = `<section class="content"><h2>Danh mục tổng minh chứng</h2>
    <div class="cards">${Object.keys(std).map(k => { const s = std[k], pc = s.tong ? Math.round(s.co * 100 / s.tong) : 0;
      return `<div class="card" data-std="${k}" style="cursor:pointer;${F.std === k ? "border-color:var(--blue);box-shadow:0 0 0 2px var(--pale)" : ""}"><b>Tiêu chuẩn ${k}</b> <span class="meta">· ${esc(s.nhom)}</span><div style="font-size:12.5px">${esc(s.ten)}</div><div class="bar"><i style="width:${pc}%"></i></div><div class="meta" style="margin:0">Có tệp ${s.co}/${s.tong} (${pc}%) · Đạt ${s.dat} · <b style="color:var(--bad)">thiếu ${s.tong - s.co}</b></div></div>`; }).join("")}</div>
    <div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <div><label>Tình trạng</label><select id="lTt"><option value="all">Tất cả (${all.length - dem.bo})</option>${["thieu", "cho", "bosung", "dat", "bo"].map(k => `<option value="${k}"${F.tt === k ? " selected" : ""}>${TINH[k]} (${dem[k]})</option>`).join("")}</select></div>
      <div><label>Tiêu chuẩn</label><select id="lStd"><option value="">Tất cả</option>${Object.keys(std).map(k => `<option value="${k}"${F.std === k ? " selected" : ""}>Tiêu chuẩn ${k}</option>`).join("")}</select></div>
      <div><label>Nhóm phụ trách</label><select id="lNhom"><option value="">Tất cả</option>${nhoms.map(x => `<option${F.nhom === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
      <label style="display:flex;gap:6px;align-items:center;margin:0 0 8px"><input type="checkbox" id="lDk"${F.dk ? " checked" : ""}> Chỉ 10 tiêu chí điều kiện</label>
      <div style="margin-left:auto" class="act"><button class="b" id="csvLoc">⬇ Xuất danh sách đang lọc</button><button class="b pri" id="csv">⬇ Xuất toàn bộ danh mục</button></div></div>
    ${goiYPanel()}
    <div class="meta">Đang hiện <b>${n}</b> minh chứng${F.tt !== "all" ? ` “${TINH[F.tt]}”` : ""} thuộc ${groups.length} tiêu chí. Bấm mã tiêu chí để mở và tải tệp.</div>
    <table><thead><tr><th style="width:70px">Tiêu chí</th><th style="width:110px">Mã minh chứng</th><th>Tên minh chứng</th><th style="width:80px">Văn bản</th><th style="width:130px">Tình trạng</th><th style="width:170px">Người tải / thời gian</th><th style="width:180px">Ghi chú rà soát</th></tr></thead><tbody>`;
  groups.forEach(g => {
    h += `<tr class="mc"><td colspan="7"><a class="f" href="#" data-go="${esc(g.t.ma)}">Tiêu chí ${esc(g.t.ma)}</a> ${g.t.dieuKien ? '<span class="badge">ĐK</span>' : ""} <span class="meta">– ${esc(g.t.ten)} · ${g.rows.length} minh chứng</span></td></tr>`;
    g.rows.forEach(r => {
      const o = goc(r), k = tinhTrang(r), vb = kids(o.id).length, ng = o.nguoi ? o.nguoi + " · " + o.tg : (kids(o.id).filter(x => x.nguoi).map(x => x.nguoi).slice(-1)[0] || "");
      const gy = k === "thieu" ? goiYTrung(r, 1) : [];
      h += `<tr><td>${esc(r.tieuChi)}</td><td class="ma" style="font-weight:600">${esc(o.ma)}${o !== r ? `<div class="meta" style="font-weight:400;font-size:11.5px">dùng chung ${esc(o.tieuChi)}</div>` : ""}</td><td>${esc(r.ten)}${gy.length ? `<div style="font-size:12px;color:var(--warn)">≈ có thể trùng ${esc(gy[0].x.ma)} (${esc(gy[0].x.tieuChi)}) đã có tệp</div>` : ""}</td><td>${o.link ? '<a class="f" href="' + esc(o.link) + '" target="_blank" rel="noopener">Mở</a>' : ""}${vb ? ` ${vb} VB` : ""}</td><td><span class="${TINH_CLS[k]}">${TINH[k]}</span></td><td style="font-size:12.5px">${esc(ng)}</td><td class="note" style="font-size:12.5px">${esc(o.ghiChu)}</td></tr>`;
    });
  });
  if (!groups.length) h += `<tr><td colspan="7" class="meta">Không có minh chứng nào khớp bộ lọc.</td></tr>`;
  m.innerHTML = h + "</tbody></table></section>";
  const set = (k, v) => { F[k] = v; renderMain(); };
  document.getElementById("lTt").onchange = e => set("tt", e.target.value);
  document.getElementById("lStd").onchange = e => set("std", e.target.value);
  document.getElementById("lNhom").onchange = e => set("nhom", e.target.value);
  document.getElementById("lDk").onchange = e => set("dk", e.target.checked);
  m.querySelectorAll(".card[data-std]").forEach(c => c.onclick = () => set("std", F.std === c.dataset.std ? "" : c.dataset.std));
  m.querySelectorAll("[data-go]").forEach(d => d.onclick = e => { e.preventDefault(); S.tab = "tc"; S.tcSel = d.dataset.go; render(); });
  document.getElementById("csv").onclick = () => exportCsv(false);
  document.getElementById("csvLoc").onclick = () => exportCsv(true);
  const gb = document.getElementById("gyBox"); if (gb) gb.ontoggle = () => { S.moGY = gb.open; };
  bindActions(m);
}
function goiYPanel() {
  if (!canUp()) return "";
  const ds = S.mc.filter(r => r.loai === "MC").map(r => ({ r, gy: goiYTrung(r, 1) })).filter(o => o.gy.length)
    .sort((a, b) => cmpMa(a.r.tieuChi, b.r.tieuChi) || efOf(a.r) - efOf(b.r));
  if (!ds.length) return "";
  return `<details class="panel" style="border-color:var(--warn)"${S.moGY ? " open" : ""} id="gyBox"><summary><b>${ds.length} minh chứng chưa có tệp có thể trùng với minh chứng đã tải ở tiêu chí khác</b> – nối để dùng chung một mã, tải một lần</summary>
    <table style="margin-top:8px"><thead><tr><th style="width:150px">Minh chứng chưa có tệp</th><th>Tên</th><th style="width:150px">Trùng với (đã có tệp)</th><th>Tên</th><th style="width:60px">Khớp</th><th style="width:160px"></th></tr></thead><tbody>
    ${ds.map(({ r, gy }) => `<tr><td><b>${esc(r.ma)}</b> (${esc(r.tieuChi)})</td><td>${esc(r.ten)}</td><td><b>${esc(gy[0].x.ma)}</b> (${esc(gy[0].x.tieuChi)})</td><td>${esc(gy[0].x.ten)}</td><td>${Math.round(gy[0].d * 100)}%</td>
      <td><div class="act"><button class="b pri" data-a="noinhanh" data-id="${esc(r.id)}" data-dich="${esc(gy[0].x.id)}">Nối</button><button class="b" data-a="ktrung" data-id="${esc(r.id)}" data-dich="${esc(gy[0].x.id)}">Không trùng</button></div></td></tr>`).join("")}
    </tbody></table></details>`;
}
function exportCsv(loc) {
  const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const L = [["Số TT", "Mã minh chứng", "Tên minh chứng", "Số, ngày ban hành / Thời điểm khảo sát", "Nơi ban hành", "Dùng chung với tiêu chí", "Link tệp", "Tình trạng", "Ghi chú rà soát"]];
  let last = 0, stt = 0;
  const groups = loc ? locDanhMuc() : S.tc.map(t => ({ t, rows: mcOf(t.ma).filter(r => r.trangThai !== TT.BO) }));
  groups.forEach(({ t, rows }) => {
    if (t.tieuChuan !== last) { last = t.tieuChuan; L.push(["", "", `Tiêu chuẩn ${t.tieuChuan}. ${t.tenTieuChuan}`]); }
    L.push(["", "", `Tiêu chí ${t.ma}. ${t.ten}`]);
    rows.forEach(r => {
      const o = goc(r);
      if (o !== r) { L.push([++stt, o.ma, r.ten, o.soNgay, o.noi, `Dùng chung với tiêu chí ${o.tieuChi}`, o.link, TINH[tinhTrang(r)], o.ghiChu]); return; }
      const dc = [r.dungChung, phu(r.id).map(x => x.tieuChi).join("; ")].filter(Boolean).join("; ");
      L.push([++stt, r.ma, r.ten, r.soNgay, r.noi, dc, r.link, TINH[tinhTrang(r)], r.ghiChu]);
      kids(r.id).filter(k => k.trangThai !== TT.BO).forEach(k => L.push(["", "", k.ten, k.soNgay, k.noi, k.dungChung, k.link, k.trangThai, k.ghiChu]));
    });
  });
  const blob = new Blob(["﻿" + L.map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = loc ? "Minh_chung_dang_loc.csv" : "Danh_muc_minh_chung_ThS_LHPLHC.csv"; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- Tìm kiếm ---------- */
function renderSearch(m) {
  const q = S.q.trim().toLowerCase();
  const hits = S.mc.filter(r => [r.ma, r.ten, r.soNgay, r.noi].join(" ").toLowerCase().includes(q)).slice(0, 200);
  let h = `<section class="content"><h2>Kết quả tìm “${esc(S.q)}”: ${hits.length}</h2>`;
  hits.forEach(r => { h += `<div class="hit" data-go="${esc(r.tieuChi)}"><b>${esc(r.tieuChi)}</b> · ${esc(r.ma || "(văn bản thành phần)")} – ${esc(r.ten)} <span class="${stCls(r.trangThai)}">${esc(r.trangThai)}</span></div>`; });
  m.innerHTML = h + "</section>";
  m.querySelectorAll("[data-go]").forEach(d => d.onclick = () => { S.tab = "tc"; S.tcSel = d.dataset.go; S.q = ""; render(); });
}

/* ---------- Thành viên (Ban Thư ký) ---------- */
async function loadTv() { const s = await db.collection("kd_tv").get(); S.tvList = s.docs.map(d => Object.assign({ email: d.id }, d.data())).sort((a, b) => String(a.ten).localeCompare(String(b.ten), "vi")); }
const NHOM = ["Hội đồng TĐG", "Ban Thư ký", "Nhóm 1 (TC 1–2)", "Nhóm 2 (TC 3–4)", "Nhóm 3 (TC 5)", "Nhóm 4 (TC 6)", "Nhóm 5 (TC 7)", "Nhóm 6 (TC 8)", "Khác"];
const okEm = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || "");
const okUser = u => /^[a-z0-9._-]{3,40}$/.test(u || "");
const randPw = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let p = ""; const r = new Uint32Array(8); (window.crypto || crypto).getRandomValues(r); r.forEach(x => p += a[x % a.length]); return p; };
const driveRole = v => v === "xem" ? "reader" : "writer";
/* Tạo tài khoản tên đăng nhập bằng một phiên Firebase phụ để không đăng xuất người đang thao tác */
async function taoTaiKhoan(user, pw) {
  const a2 = firebase.apps.find(x => x.name === "kd-acct") || firebase.initializeApp(C.FIREBASE, "kd-acct");
  const au = a2.auth();
  try { await au.createUserWithEmailAndPassword(user + "@" + ACCT_DOMAIN, pw); }
  catch (e) {
    if (e && e.code === "auth/email-already-in-use") throw new Error(`Tên đăng nhập “${user}” đã được dùng — chọn tên khác.`);
    if (e && e.code === "auth/operation-not-allowed") throw new Error("Dự án Firebase chưa bật đăng nhập Email/Mật khẩu (Authentication → Sign-in method).");
    throw e;
  } finally { try { await au.signOut(); } catch (x) { /* bỏ qua */ } }
}
async function themThanhVien(r) {
  const id = r.loai === "tk" ? r.user + "@" + ACCT_DOMAIN : r.email;
  if (S.tvList.some(t => t.email === id)) throw new Error((r.user || r.email) + " đã có trong danh sách — dùng nút Sửa ở dòng đó.");
  if (r.loai === "tk") await taoTaiKhoan(r.user, r.pw);
  const gmail = r.loai === "tk" ? (r.gmail || "") : r.email;
  await db.collection("kd_tv").doc(id).set({ ten: r.ten, chucVu: r.chucVu || "", vai: r.vai, nhom: r.nhom || "", khoa: false, tg: now(), boi: em(),
    loai: r.loai, mkBanDau: r.loai === "tk" ? r.pw : "", gmail, gmailTT: gmail ? "duyet" : "", gmailTg: gmail ? now() : "" });
  if (gmail) await shareUser(gmail, driveRole(r.vai));
  await log("Thêm thành viên", id, r.vai);
}
async function renderThanhVien(m) {
  m.innerHTML = `<section class="content">Đang tải danh sách…</section>`;
  try { await loadTv(); } catch (e) { m.innerHTML = `<section class="content"><div class="err">${esc(errMsg(e))}</div></section>`; return; }
  if (S.tab !== "tv") return;
  const cho = S.tvList.filter(t => t.gmailTT === "cho" && !t.khoa);
  let h = `<section class="content"><h2>Thành viên được truy cập</h2>
    <div class="meta">Cấp <b>tên đăng nhập + mật khẩu</b> (không cần Gmail để vào xem, nhập thông tin, thêm văn bản bằng link) hoặc cấp thẳng bằng <b>Gmail</b>. Muốn tải tệp lên phải có Gmail được duyệt: hệ thống chia sẻ thư mục minh chứng trên Drive cho Gmail đó.</div>
    ${cho.length ? `<div class="panel" style="border-color:var(--warn)"><b>${cho.length} Gmail chờ duyệt</b> – ${cho.map(t => `${esc(t.ten)} (${esc(t.gmail)}) <button class="b pri" data-tv="duyet" data-em="${esc(t.email)}">Duyệt</button>`).join(" · ")}</div>` : ""}
    <div class="panel"><b>Thêm người</b>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0 12px">
        <div><label>Loại tài khoản *</label><select id="tvLoai"><option value="tk">Tên đăng nhập + mật khẩu</option><option value="gg">Gmail (đăng nhập Google)</option></select></div>
        <div class="fTk"><label>Tên đăng nhập *</label><input type="text" id="tvUser" placeholder="vd: hangvtt" autocomplete="off"></div>
        <div class="fTk"><label>Mật khẩu ban đầu *</label><input type="text" id="tvPw" value="${randPw()}" autocomplete="off"></div>
        <div><label id="tvEmLb">Gmail để tải tệp (không bắt buộc)</label><input type="text" id="tvEm" placeholder="nguyenvana@gmail.com" autocomplete="off"></div>
        <div><label>Họ và tên *</label><input type="text" id="tvTen" placeholder="Nguyễn Văn A"></div>
        <div><label>Chức vụ, đơn vị</label><input type="text" id="tvCv" placeholder="Giảng viên, Khoa Luật"></div>
        <div><label>Vai *</label><select id="tvVai">${Object.keys(VAI).map(k => `<option value="${k}"${k === "thanhvien" ? " selected" : ""}>${VAI[k]}</option>`).join("")}</select></div>
        <div><label>Nhóm công tác</label><select id="tvNhom"><option value=""></option>${NHOM.map(n => `<option>${n}</option>`).join("")}</select></div>
      </div>
      <div class="err" id="tvErr"></div>
      <div class="row" style="justify-content:flex-start"><button class="b pri" id="tvAdd">Thêm thành viên</button></div>
      <details style="margin:8px 0 0"><summary>Dán nhiều người một lần (từ Excel)</summary>
        <div class="meta" style="margin-top:6px">Mỗi dòng một người, các cột cách nhau bằng Tab (dán thẳng từ Excel) hoặc dấu |: <b>Tên đăng nhập hoặc Gmail</b> | Họ và tên | Vai (thanhvien, thuky, xem) | Nhóm | Chức vụ, đơn vị. Cột đầu là tên đăng nhập thì hệ thống tự đặt mật khẩu ban đầu (xem ở bảng dưới).</div>
        <textarea id="tvBulk" rows="5"></textarea>
        <div class="row" style="justify-content:flex-start"><button class="b" id="tvBulkAdd">Thêm danh sách</button></div></details></div>
    <table><thead><tr><th>Đăng nhập</th><th>Họ và tên</th><th>Chức vụ, đơn vị</th><th>Vai</th><th>Nhóm</th><th>Gmail tải tệp</th><th>Mật khẩu ban đầu</th><th>Tình trạng</th><th style="width:150px"></th></tr></thead><tbody>`;
  S.tvList.forEach(t => {
    const gm = t.gmail ? `${esc(t.gmail)}<br>${t.gmailTT === "duyet" ? '<span class="ok">đã duyệt</span>' : `<span class="no">chờ duyệt</span> <button class="b pri" data-tv="duyet" data-em="${esc(t.email)}">Duyệt</button>`}` : '<span class="meta">chưa có</span>';
    h += `<tr><td><b>${esc(tenDN(t.email) || t.email)}</b></td><td>${esc(t.ten)}</td><td>${esc(t.chucVu)}</td><td>${esc(VAI[t.vai] || t.vai)}</td><td>${esc(t.nhom)}</td><td>${gm}</td>
      <td>${t.mkBanDau ? `<code>${esc(t.mkBanDau)}</code>` : (t.loai === "tk" ? '<span class="meta">đã đổi</span>' : "")}</td>
      <td>${t.khoa ? '<span class="no">Đã khóa</span>' : '<span class="ok">Đang dùng</span>'}</td>
      <td><div class="act"><button class="b" data-tv="vai" data-em="${esc(t.email)}">Sửa</button><button class="b ${t.khoa ? "" : "red"}" data-tv="khoa" data-em="${esc(t.email)}">${t.khoa ? "Mở khóa" : "Khóa"}</button></div></td></tr>`;
  });
  m.innerHTML = h + "</tbody></table></section>";
  const box = document.getElementById("tvErr");
  const doiLoai = () => { const tk = val(m, "tvLoai") === "tk"; m.querySelectorAll(".fTk").forEach(x => x.style.display = tk ? "" : "none"); document.getElementById("tvEmLb").textContent = tk ? "Gmail để tải tệp (không bắt buộc)" : "Gmail *"; };
  document.getElementById("tvLoai").onchange = doiLoai; doiLoai();
  const run = async (rows, btn) => {
    btn.disabled = true; box.textContent = "";
    try { for (let i = 0; i < rows.length; i++) { busy(`Đang thêm ${i + 1}/${rows.length}: ${rows[i].user || rows[i].email}`); await themThanhVien(rows[i]); } busy(); renderMain(); }
    catch (e) { busy(); btn.disabled = false; box.textContent = errMsg(e); try { await loadTv(); } catch (x) { /* */ } }
  };
  document.getElementById("tvAdd").onclick = () => {
    const loai = val(m, "tvLoai"), r = { loai, user: val(m, "tvUser").toLowerCase(), pw: val(m, "tvPw"), email: val(m, "tvEm").toLowerCase(), ten: val(m, "tvTen"), chucVu: val(m, "tvCv"), vai: val(m, "tvVai"), nhom: val(m, "tvNhom") };
    if (loai === "tk") {
      if (!okUser(r.user)) { box.textContent = "Tên đăng nhập 3–40 ký tự: chữ không dấu, số, dấu chấm, gạch."; return; }
      if (r.pw.length < 6) { box.textContent = "Mật khẩu ban đầu tối thiểu 6 ký tự."; return; }
      if (r.email && !okEm(r.email)) { box.textContent = "Gmail chưa đúng."; return; }
      r.gmail = r.email;
    } else if (!okEm(r.email)) { box.textContent = "Gmail chưa đúng."; return; }
    if (!r.ten) { box.textContent = "Nhập họ và tên."; return; }
    run([r], document.getElementById("tvAdd"));
  };
  document.getElementById("tvBulkAdd").onclick = () => {
    const rows = [], bad = [];
    document.getElementById("tvBulk").value.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => {
      const [a, ten, vai, nhom, cv] = l.split(/\||\t/).map(x => (x || "").trim());
      const v = (vai || "thanhvien").toLowerCase(), id = (a || "").toLowerCase();
      if (!VAI[v]) return bad.push(l);
      if (okEm(id)) rows.push({ loai: "gg", email: id, ten: ten || id, vai: v, nhom: nhom || "", chucVu: cv || "" });
      else if (okUser(id)) rows.push({ loai: "tk", user: id, pw: randPw(), email: "", ten: ten || id, vai: v, nhom: nhom || "", chucVu: cv || "" });
      else bad.push(l);
    });
    if (bad.length) { box.textContent = "Dòng chưa đúng mẫu: " + bad.join(" ; "); return; }
    if (!rows.length) { box.textContent = "Chưa nhập người nào."; return; }
    run(rows, document.getElementById("tvBulkAdd"));
  };
  m.querySelectorAll("[data-tv]").forEach(b => b.onclick = () => {
    const t = S.tvList.find(x => x.email === b.dataset.em), k = b.dataset.tv;
    if (k === "duyet") modal("Duyệt Gmail tải tệp", `${t.ten} – ${t.gmail}`, `<div class="meta">Hệ thống chia sẻ thư mục minh chứng trên Drive cho ${esc(t.gmail)} (${t.vai === "xem" ? "quyền xem" : "quyền chỉnh sửa để tải tệp lên"}).</div>`, async () => {
      await shareUser(t.gmail, driveRole(t.vai));
      await db.collection("kd_tv").doc(t.email).update({ gmailTT: "duyet" });
      await log("Duyệt Gmail", t.email, t.gmail);
    }, "Duyệt");
    else if (k === "vai") modal("Sửa thông tin thành viên", tenDN(t.email) || t.email, `<label>Họ và tên</label><input type="text" id="fT" value="${esc(t.ten)}">
        <label>Chức vụ, đơn vị</label><input type="text" id="fC" value="${esc(t.chucVu)}">
        <label>Vai</label><select id="fV">${Object.keys(VAI).map(x => `<option value="${x}"${x === t.vai ? " selected" : ""}>${VAI[x]}</option>`).join("")}</select>
        <label>Nhóm công tác</label><select id="fN"><option value=""></option>${NHOM.map(n => `<option${n === t.nhom ? " selected" : ""}>${n}</option>`).join("")}</select>
        ${t.loai === "tk" ? `<label>Gmail tải tệp (để trống = gỡ)</label><input type="text" id="fG" value="${esc(t.gmail)}">` : ""}`, async w => {
        const v = val(w, "fV"), ten = val(w, "fT"), g = t.loai === "tk" ? val(w, "fG").toLowerCase() : t.gmail;
        if (!ten) throw new Error("Nhập họ và tên."); if (g && !okEm(g)) throw new Error("Gmail chưa đúng.");
        const up = { ten, chucVu: val(w, "fC"), vai: v, nhom: val(w, "fN") };
        if (t.loai === "tk" && g !== (t.gmail || "")) { if (t.gmail && t.gmailTT === "duyet") await unshareUser(t.gmail); Object.assign(up, { gmail: g, gmailTT: g ? "duyet" : "", gmailTg: g ? now() : "" }); }
        await db.collection("kd_tv").doc(t.email).update(up);
        if (!t.khoa && g && ((g !== t.gmail) || v !== t.vai || t.gmailTT !== "duyet")) await shareUser(g, driveRole(v));
        await log("Sửa thành viên", t.email, v);
      });
    else modal(t.khoa ? "Mở khóa tài khoản?" : "Khóa tài khoản?", (tenDN(t.email) || t.email) + (t.khoa ? " – đăng nhập lại được, chia sẻ lại thư mục Drive." : " – không đăng nhập được nữa, gỡ quyền thư mục Drive; tệp đã tải lên vẫn giữ."), "", async () => {
      await db.collection("kd_tv").doc(t.email).update({ khoa: !t.khoa });
      if (t.gmail && t.gmailTT === "duyet") { if (t.khoa) await shareUser(t.gmail, driveRole(t.vai)); else await unshareUser(t.gmail); }
      await log(t.khoa ? "Mở khóa" : "Khóa", t.email, "");
    }, t.khoa ? "Mở khóa" : "Khóa");
  });
}

/* ---------- Tài khoản của tôi ---------- */
async function renderTaiKhoan(m) {
  const tv = S.tv || {}, tk = isTkAcct();
  const gmTT = tv.gmail ? (tv.gmailTT === "duyet" ? '<span class="ok">đã duyệt – tải tệp được</span>' : '<span class="no">chờ Ban Thư ký duyệt</span>') : '<span class="meta">chưa đăng ký</span>';
  m.innerHTML = `<section class="content"><h2>Tài khoản của tôi</h2>
    <div class="panel"><table style="border:0"><tbody>
      <tr><td style="width:180px">Đăng nhập</td><td><b>${esc(tk ? tenDN(em()) : em())}</b> ${tk ? "(tên đăng nhập)" : "(Google)"}</td></tr>
      <tr><td>Họ và tên</td><td>${esc(tv.ten || nguoi())}</td></tr><tr><td>Chức vụ, đơn vị</td><td>${esc(tv.chucVu)}</td></tr>
      <tr><td>Vai</td><td>${S.admin ? "Quản trị" : esc(VAI[S.role] || S.role)}</td></tr><tr><td>Nhóm</td><td>${esc(tv.nhom)}</td></tr>
      ${tk ? `<tr><td>Gmail tải tệp</td><td>${esc(tv.gmail || "")} ${gmTT}</td></tr>` : ""}</tbody></table></div>
    ${tk && !S.admin ? `<div class="panel"><b>Đăng ký Gmail để tải tệp lên</b>
      <div class="meta">Bấm nút, chọn Gmail của bạn và cho phép truy cập Google Drive. Sau khi Ban Thư ký duyệt, bạn tải tệp lên được và có thể đăng nhập trang này bằng Google.</div>
      <button class="b pri" id="tkGm">${tv.gmail ? "Đổi Gmail" : "Đăng ký Gmail"}</button></div>
    <div class="panel"><b>Đổi mật khẩu</b>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 12px">
        <div><label>Mật khẩu hiện tại</label><input type="password" id="pw0" style="width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px"></div>
        <div><label>Mật khẩu mới (tối thiểu 8 ký tự)</label><input type="password" id="pw1" style="width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px"></div>
        <div><label>Nhập lại mật khẩu mới</label><input type="password" id="pw2" style="width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px"></div></div>
      <div class="row" style="justify-content:flex-start"><button class="b pri" id="tkPw">Đổi mật khẩu</button></div></div>` : ""}
    <div class="err" id="tkMsg"></div></section>`;
  const msg = (t, ok) => { const e = document.getElementById("tkMsg"); e.textContent = t; e.style.color = ok ? "var(--ok)" : ""; };
  const bGm = document.getElementById("tkGm");
  if (bGm) bGm.onclick = async () => {
    bGm.disabled = true; msg("");
    try { const g = await dangKyGmail(); msg(`Đã gửi đăng ký Gmail ${g}. Chờ Ban Thư ký duyệt.`, true); renderTaiKhoan(m); msg(`Đã gửi đăng ký Gmail ${g}. Chờ Ban Thư ký duyệt.`, true); }
    catch (e) { bGm.disabled = false; msg(errMsg(e)); }
  };
  const bPw = document.getElementById("tkPw");
  if (bPw) bPw.onclick = async () => {
    const p0 = val(m, "pw0"), p1 = val(m, "pw1"), p2 = val(m, "pw2");
    if (p1.length < 8) return msg("Mật khẩu mới tối thiểu 8 ký tự.");
    if (p1 !== p2) return msg("Hai lần nhập mật khẩu mới chưa khớp.");
    bPw.disabled = true; busy("Đang đổi mật khẩu…");
    try {
      const u = auth.currentUser;
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, p0));
      await u.updatePassword(p1);
      if (S.tv && S.tv.mkBanDau) { await db.collection("kd_tv").doc(em()).update({ mkBanDau: "" }); S.tv.mkBanDau = ""; }
      busy(); bPw.disabled = false; ["pw0", "pw1", "pw2"].forEach(i => { document.getElementById(i).value = ""; }); msg("Đã đổi mật khẩu.", true);
    } catch (e) { busy(); bPw.disabled = false; msg(/wrong-password|invalid-credential|invalid-login/.test(e && e.code || "") ? "Mật khẩu hiện tại không đúng." : errMsg(e)); }
  };
}
/* Liên kết Gmail với tài khoản tên đăng nhập (để sau này đăng nhập Google vào cùng hồ sơ); nếu Gmail đã gắn tài khoản khác thì chỉ ghi nhận Gmail */
async function dangKyGmail() {
  const u = auth.currentUser; let g = "", tok = null;
  try {
    const r = await u.linkWithPopup(provider(true));
    g = ((r.additionalUserInfo && r.additionalUserInfo.profile && r.additionalUserInfo.profile.email) || (r.user.providerData.find(p => p.providerId === "google.com") || {}).email || "").toLowerCase();
    tok = r.credential && r.credential.accessToken;
  } catch (e) {
    const c = e && e.code || "";
    if (c === "auth/credential-already-in-use" || c === "auth/email-already-in-use" || c === "auth/provider-already-linked") {
      const r = await gisToken("select_account", "");
      const who = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers: { Authorization: "Bearer " + r.access_token } }).then(x => x.json()).catch(() => ({}));
      g = (who.user && who.user.emailAddress || "").toLowerCase(); tok = r.access_token;
    } else throw e;
  }
  if (!okEm(g)) throw new Error("Không đọc được địa chỉ Gmail. Thử lại.");
  await db.collection("kd_tv").doc(em()).update({ gmail: g, gmailTT: "cho", gmailTg: now() });
  S.tv = Object.assign({}, S.tv, { gmail: g, gmailTT: "cho", gmailTg: now() });
  if (tok) saveTok(tok);
  await log("Đăng ký Gmail", em(), g);
  return g;
}

/* ---------- Google Drive ---------- */
/* Gmail dùng cho Drive: tài khoản Google = chính email; tài khoản tên đăng nhập = Gmail đã được duyệt */
function driveEm() {
  if (!isTkAcct()) return em();
  return S.tv && S.tv.gmailTT === "duyet" ? S.tv.gmail : "";
}
function gisToken(prompt, hint) {
  return new Promise((res, rej) => {
    if (!(window.google && google.accounts && google.accounts.oauth2)) return rej(new Error("gis"));
    const c = google.accounts.oauth2.initTokenClient({
      client_id: C.CLIENT_ID, scope: DRIVE_SCOPE, prompt, login_hint: hint, hint,
      callback: r => r && r.access_token ? res(r) : rej(new Error((r && r.error) || "token")),
      error_callback: e => rej(new Error((e && e.type) || "popup"))
    });
    c.requestAccessToken({ prompt, login_hint: hint, hint });
  });
}
async function ensureDrive(force) {
  if (!force && S.tok && Date.now() < S.tokExp) return S.tok;
  const want = driveEm();
  if (!want) throw new Error(S.tv && S.tv.gmail ? `Gmail ${S.tv.gmail} đang chờ Ban Thư ký duyệt — duyệt xong mới tải tệp lên được.` : "Tài khoản chưa có Gmail để tải tệp. Vào “Tài khoản của tôi” → Đăng ký Gmail, chờ Ban Thư ký duyệt.");
  for (const pr of ["", "select_account"]) {
    try {
      const r = await gisToken(pr, want);
      const who = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers: { Authorization: "Bearer " + r.access_token } }).then(x => x.json()).catch(() => ({}));
      const wEm = (who.user && who.user.emailAddress || "").toLowerCase();
      if (wEm && wEm !== want) { if (pr) throw new Error(`Đã chọn tài khoản Google ${wEm}, khác Gmail đã đăng ký ${want}. Bấm lại và chọn đúng ${want}.`); continue; }
      saveTok(r.access_token, r.expires_in); return S.tok;
    } catch (e) { if (pr && !/^(gis|token|popup)/.test(e.message)) throw e; }
  }
  if (isTkAcct()) throw new Error("Chưa kết nối được Google Drive. Cho phép cửa sổ bật lên rồi bấm lại.");
  const r = await auth.currentUser.reauthenticateWithPopup(provider(true));
  if (!(r.credential && r.credential.accessToken)) throw new Error("Chưa kết nối được Google Drive. Cho phép cửa sổ bật lên rồi bấm lại.");
  saveTok(r.credential.accessToken); return S.tok;
}
async function drive(url, opt = {}, retried) {
  const tk = await ensureDrive();
  const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({}, opt.headers || {}, { Authorization: "Bearer " + tk }) }));
  if (r.status === 401 && !retried) { saveTok(null); return drive(url, opt, true); }
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google Drive: " + ((j.error && j.error.message) || r.status));
  return j;
}
const DQ = "https://www.googleapis.com/drive/v3/files";
async function folderIn(name, parent) {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER}' and trashed=false` + (parent ? ` and '${parent}' in parents` : " and 'root' in parents"));
  const f = await drive(`${DQ}?q=${q}&fields=files(id,webViewLink)&supportsAllDrives=true`);
  if (f.files && f.files[0]) return f.files[0];
  return drive(`${DQ}?fields=id,webViewLink&supportsAllDrives=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ name, mimeType: FOLDER }, parent ? { parents: [parent] } : {})) });
}
async function uploadFile(file, parent, name, retried) {
  if (file.size > C.MAX_MB * 1048576) throw new Error(`Tệp vượt ${C.MAX_MB} MB.`);
  const tk = await ensureDrive();
  const st = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,webViewLink", {
    method: "POST", headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": file.type || "application/octet-stream" },
    body: JSON.stringify({ name, parents: [parent] })
  });
  if (st.status === 401 && !retried) { saveTok(null); return uploadFile(file, parent, name, true); }
  if (st.status === 403 || st.status === 404) throw new Error("Tài khoản Google của bạn chưa có quyền ghi vào thư mục minh chứng. Báo Ban Thư ký kiểm tra lại quyền chia sẻ.");
  if (!st.ok) throw new Error("Không khởi tạo được tải lên (" + st.status + ").");
  const r = await fetch(st.headers.get("Location"), { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "Tải lên lỗi " + r.status);
  return j;
}
async function shareUser(email, role) {
  return drive(`${DQ}/${S.cfg.rootId}/permissions?sendNotificationEmail=false&supportsAllDrives=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, type: "user", emailAddress: email }) });
}
async function unshareUser(email) {
  const p = await drive(`${DQ}/${S.cfg.rootId}/permissions?fields=permissions(id,emailAddress,role)&supportsAllDrives=true`);
  for (const x of (p.permissions || [])) if ((x.emailAddress || "").toLowerCase() === email && x.role !== "owner") await drive(`${DQ}/${S.cfg.rootId}/permissions/${x.id}?supportsAllDrives=true`, { method: "DELETE" });
}

/* ---------- Thao tác minh chứng ---------- */
const findMc = id => S.mc.find(r => r.id === id);
const findCc = id => S.cc.find(r => r.id === id);
async function upMeta(file, folder, prefix) {
  busy("Đang tải tệp lên Drive…");
  const f = await uploadFile(file, folder, (prefix ? prefix + "_" : "") + file.name);
  return { link: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`, fileId: f.id, nguoi: nguoi(), email: em(), tg: now() };
}
async function ganTep(r, file, extra) {
  extra = extra || {};
  let meta;
  if (file) meta = await upMeta(file, tcOf(r.tieuChi).folderId, r.ma || r.id);
  else if (/^https?:\/\//i.test(extra.link || "")) meta = { link: extra.link.trim(), fileId: "", nguoi: nguoi(), email: em(), tg: now() };
  else throw new Error("Chọn tệp, kéo – thả tệp vào ô hoặc dán đường link (bắt đầu bằng http).");
  const up = Object.assign(meta, { trangThai: TT.CHO });
  if (extra.soNgay !== undefined) up.soNgay = String(extra.soNgay).slice(0, 200);
  if (extra.noi !== undefined) up.noi = String(extra.noi).slice(0, 200);
  if (extra.ten && extra.ten !== r.ten) { up.ten = extra.ten.slice(0, 400); if (r.loai === "MC" && !r.tenGoiY) up.tenGoiY = r.ten; }
  busy("Đang ghi danh mục…");
  await db.collection("kd_mc").doc(r.id).update(up);
  await log("Tải tệp", r.id, (r.ma || "") + " – " + (file ? file.name : extra.link));
}
async function themVanBan(cha, v, file) {
  if (!v.ten) throw new Error("Nhập tên văn bản.");
  let meta;
  if (file) meta = await upMeta(file, tcOf(cha.tieuChi).folderId, cha.ma);
  else if (/^https?:\/\//i.test(v.link)) meta = { link: v.link, fileId: "", nguoi: nguoi(), email: em(), tg: now() };
  else throw new Error("Chọn tệp hoặc dán đường link (bắt đầu bằng http).");
  busy("Đang ghi danh mục…");
  await db.collection("kd_mc").add(Object.assign({ tieuChi: cha.tieuChi, loai: "TP", ma: "", ten: v.ten.slice(0, 400), soNgay: v.soNgay.slice(0, 200), noi: v.noi.slice(0, 200), dungChung: "",
    trangThai: TT.CHO, ghiChu: "", cha: cha.id, taoLuc: Date.now() }, meta));
  if (cha.trangThai === TT.CHUA) await db.collection("kd_mc").doc(cha.id).update({ trangThai: TT.CHO });
  await log("Thêm văn bản", cha.id, cha.ma + " – " + v.ten);
}

/* ---------- Hộp thoại ---------- */
function modal(title, sub, body, onOk, okText) {
  const w = document.createElement("div"); w.className = "modal";
  w.innerHTML = `<div class="box"><h3>${esc(title)}</h3><div class="meta">${esc(sub || "")}</div>${body}<div class="err" id="mErr"></div>
    <div class="row"><button class="b" id="mNo">Hủy</button><button class="b pri" id="mOk">${esc(okText || "Lưu")}</button></div></div>`;
  document.body.appendChild(w);
  w.querySelector("#mNo").onclick = () => w.remove();
  w.querySelector("#mOk").onclick = async () => {
    const btn = w.querySelector("#mOk"); btn.disabled = true; w.querySelector("#mErr").textContent = "";
    try { await onOk(w); busy(); w.remove(); if (S.tab === "tv") renderMain(); }
    catch (e) { busy(); btn.disabled = false; w.querySelector("#mErr").textContent = errMsg(e); }
  };
  return w;
}
const fileField = (note, multi) => `<div class="drop" id="fDrop" tabindex="0" role="button"><input type="file" id="fFile"${multi ? " multiple" : ""} style="display:none">
  <b>Kéo – thả tệp vào đây</b> hoặc <u>bấm để chọn tệp</u><div class="meta" id="fChon" style="margin:4px 0 0">PDF, Word, Excel, ảnh… tối đa ${C.MAX_MB} MB${multi ? " · chọn được nhiều tệp" : ""}</div></div>
  ${note ? `<div class="meta" style="margin-top:4px">${note}</div>` : ""}`;
const filesOf = w => { if (w._files && w._files.length) return w._files; const i = w.querySelector("#fFile"); return i && i.files ? [...i.files] : []; };
const fileOf = w => filesOf(w)[0] || null;
/* Gắn kéo–thả cho ô #fDrop; onPick(files) chạy khi có tệp */
function upBind(w, onPick) {
  const dz = w.querySelector("#fDrop"), inp = w.querySelector("#fFile"); if (!dz) return;
  const pick = fl => { w._files = [...fl]; const c = w.querySelector("#fChon"); if (c) c.textContent = "Đã chọn: " + w._files.map(f => f.name).join("; "); if (onPick) onPick(w._files); };
  dz.onclick = () => inp.click();
  dz.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } };
  inp.onchange = () => { if (inp.files && inp.files.length) pick(inp.files); };
  ["dragenter", "dragover"].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add("on"); }));
  ["dragleave", "drop"].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove("on"); }));
  dz.addEventListener("drop", e => { const fl = e.dataTransfer && e.dataTransfer.files; if (fl && fl.length) pick(fl); });
}
/* Đọc văn bản vừa chọn và điền số hiệu, ngày, nơi ban hành (và tên) vào các ô còn trống hoặc do máy điền */
async function tuDien(w, file, opt) {
  opt = opt || {};
  const c = w.querySelector("#fChon"), name = file.name;
  if (!window.VB) return null;
  if (c) c.textContent = "Đã chọn: " + name + " – đang đọc văn bản…";
  const m = await window.VB.doc(file);
  if (w._files && w._files[0] !== file) return m;
  const set = (id, v) => { const e = w.querySelector("#" + id); if (e && v && (!e.value.trim() || e.dataset.auto === "1")) { e.value = v; e.dataset.auto = "1"; } };
  set("fSo", m.soNgay); set("fNoi", m.noi); if (opt.ten) set("fTen", m.tieuDe);
  const tm = w.querySelector("#fTenMoi"); if (tm && m.loai) { tm.textContent = m.tieuDe; w.querySelector("#fDoiTenBox").style.display = ""; }
  if (c) c.innerHTML = esc("Đã chọn: " + name) + "<br>" + (m.loai || m.so || m.noi
    ? `<span class="ok">Đã nhận diện:</span> ${esc([m.loai, m.so, m.ngay, m.noi].filter(Boolean).join(" · "))} <span class="meta">– kiểm tra lại các ô bên dưới</span>`
    : `<span class="meta">${m.quet ? "Tệp scan dạng ảnh, không đọc được chữ — nhập tay số, ngày, nơi ban hành." : m.khongDoc ? "Loại tệp này không tự đọc được — nhập tay." : "Không nhận diện được thông tin ban hành — nhập tay."}</span>`);
  return m;
}

/* ---------- Kho chung: tải lên một chỗ, hệ thống gợi ý minh chứng phù hợp ---------- */
let khoFolderId = "";
async function khoFolder() { if (!khoFolderId) khoFolderId = (await folderIn("00. KHO CHUNG", S.cfg.rootId)).id; return khoFolderId; }
function goiYKho(k, lim) {
  const T = tokSet([k.tieuDe, k.trichYeu, k.ten].join(" ")), B = tokSet(String(k.noiDung || "").slice(0, 2500));
  const so = normVN(k.so || ""), da = new Set(k.ganVao || []);
  return S.mc.filter(r => r.loai === "MC" && !r.goc && r.trangThai !== TT.BO && !da.has(r.id)).map(r => {
    let d = 0;
    [r.ten, r.tenGoiY].filter(Boolean).forEach(t => {
      // so cả tên đầy đủ và từng vế (tên gợi ý thường liệt kê nhiều loại: “Phiếu khảo sát, biên bản tọa đàm, …”)
      [[t, 1]].concat(String(t).split(/[,;/]| và | hoặc /).map(x => [x, 0.95])).forEach(([part, w]) => {
        const M = tokSet(part); if (M.size < 2) return;
        let a = 0, b = 0; M.forEach(x => { if (T.has(x)) a++; if (B.has(x)) b++; });
        d = Math.max(d, (M.size < 3 && w < 1 ? 0.75 : w) * (0.7 * a / M.size + 0.3 * Math.max(a, b) / M.size));
      });
    });
    if (so && so.length > 4 && normVN(r.soNgay || "").includes(so)) d = 1;
    return { r, d };
  }).filter(o => o.d >= 0.4).sort((p, q) => (q.d - p.d) || cmpMa(p.r.tieuChi, q.r.tieuChi) || efOf(p.r) - efOf(q.r)).slice(0, lim || 3);
}
async function ganKho(k, mc) {
  const g = goc(mc), soNgay = [k.so, k.ngay].filter(Boolean).join(", ");
  if (!g.link && !kids(g.id).length) {
    const up = { link: k.link, fileId: k.fileId || "", nguoi: k.nguoi || nguoi(), email: em(), tg: now(), trangThai: TT.CHO };
    if (!g.soNgay && soNgay) up.soNgay = soNgay.slice(0, 200);
    if (!g.noi && k.noi) up.noi = k.noi.slice(0, 200);
    await db.collection("kd_mc").doc(g.id).update(up);
  } else {
    await db.collection("kd_mc").add({ tieuChi: g.tieuChi, loai: "TP", ma: "", ten: String(k.tieuDe || k.ten).slice(0, 400), soNgay: soNgay.slice(0, 200), noi: String(k.noi || "").slice(0, 200), dungChung: "",
      link: k.link, fileId: k.fileId || "", nguoi: k.nguoi || nguoi(), email: em(), tg: now(), trangThai: TT.CHO, ghiChu: "", cha: g.id, taoLuc: Date.now(), tuKho: k.id });
    if (g.trangThai === TT.CHUA) await db.collection("kd_mc").doc(g.id).update({ trangThai: TT.CHO });
  }
  const ds = [...new Set([...(k.ganVao || []), g.id])];
  await db.collection("kd_kho").doc(k.id).update({ ganVao: ds, trangThai: "dagan" });
  k.ganVao = ds;
  await log("Gán từ kho chung", g.id, `${g.ma} ← ${k.ten}`);
}
function renderKho(m) {
  const F = S.locKho || (S.locKho = "cho");
  const all = (S.kho || []).slice().sort((a, b) => (b.taoLuc || 0) - (a.taoLuc || 0));
  const list = all.filter(k => F === "all" || (F === "cho" ? !(k.ganVao || []).length : (k.ganVao || []).length));
  const nCho = all.filter(k => !(k.ganVao || []).length).length;
  const tenMc = id => { const r = findMc(id); return r ? `<b>${esc(r.ma)}</b> (${esc(r.tieuChi)})` : esc(id); };
  let h = `<section class="content"><h2>Kho chung</h2>
    <div class="meta">Tải tài liệu lên một chỗ, không cần biết thuộc tiêu chí nào: hệ thống đọc tên và nội dung văn bản (PDF có chữ, Word), tự nhận số hiệu, ngày, nơi ban hành và gợi ý minh chứng phù hợp. Bấm <b>Gán</b> để đưa vào minh chứng; một tài liệu gán được cho nhiều minh chứng.</div>
    ${S.khoLoi ? `<div class="err">${esc(S.khoLoi)} — quản trị cần bấm “Cập nhật quy tắc” trong Cài đặt.</div>` : ""}
    ${canUp() ? `<div class="panel">${fileField("", true)}
      <details style="margin-top:8px"><summary>Hoặc thêm bằng đường link (website, Google Drive…)</summary>
        <div style="display:grid;grid-template-columns:2fr 3fr auto;gap:8px;align-items:end;margin-top:6px">
          <div><label>Tên tài liệu *</label><input type="text" id="kTen" placeholder="VD: Trang công bố chuẩn đầu ra CTĐT"></div>
          <div><label>Đường link *</label><input type="text" id="kLink" placeholder="https://…"></div>
          <button class="b pri" id="kLinkAdd" style="margin-bottom:2px">Thêm</button></div></details>
      <div class="err" id="kErr"></div></div>` : ""}
    <div class="row" style="justify-content:flex-start;align-items:center;margin:0 0 8px">
      <select id="kLoc" style="width:auto"><option value="cho"${F === "cho" ? " selected" : ""}>Chưa gán (${nCho})</option><option value="da"${F === "da" ? " selected" : ""}>Đã gán (${all.length - nCho})</option><option value="all"${F === "all" ? " selected" : ""}>Tất cả (${all.length})</option></select>
      ${isTk() && nCho ? `<button class="b" id="kAuto">Gán tất cả gợi ý khớp từ 80%</button>` : ""}</div>
    <table><thead><tr><th style="width:24%">Tài liệu</th><th style="width:26%">Thông tin nhận diện</th><th>Gợi ý minh chứng</th><th style="width:120px"></th></tr></thead><tbody>`;
  list.forEach(k => {
    const gy = goiYKho(k, 3), id = esc(k.id);
    h += `<tr><td><a class="f" href="${esc(k.link)}" target="_blank" rel="noopener" style="white-space:normal">${esc(k.ten)}</a><div class="meta" style="font-size:11.5px;margin:2px 0 0">${esc(k.nguoi)} · ${esc(k.tg)}</div></td>
      <td style="font-size:13px">${k.tieuDe && k.tieuDe !== k.ten ? `<b>${esc(k.tieuDe)}</b><br>` : ""}${esc([k.so, k.ngay].filter(Boolean).join(", ")) || '<span class="meta">chưa có số, ngày</span>'}${k.noi ? "<br>" + esc(k.noi) : ""}${k.quet ? '<br><span class="meta">tệp scan – nhập tay thông tin</span>' : ""}</td>
      <td style="font-size:13px">${(k.ganVao || []).length ? `<div class="ok" style="margin-bottom:4px">Đã gán: ${(k.ganVao || []).map(tenMc).join(", ")}</div>` : ""}
        ${gy.map(o => `<div style="margin:2px 0">${canUp() ? `<button class="b pri" data-k="gan" data-id="${id}" data-mc="${esc(o.r.id)}">Gán</button> ` : ""}<b>${esc(o.r.ma)}</b> (${esc(o.r.tieuChi)}) ${esc(o.r.ten)} <span class="meta">${Math.round(o.d * 100)}%</span></div>`).join("") || '<span class="meta">Chưa tìm được minh chứng phù hợp — bấm “Chọn minh chứng”.</span>'}</td>
      <td><div class="act">${canUp() ? `<button class="b" data-k="chon" data-id="${id}">Chọn minh chứng</button><button class="b" data-k="sua" data-id="${id}">Sửa thông tin</button>` : ""}
        ${isTk() || k.email === em() ? `<button class="b red" data-k="xoa" data-id="${id}">Xóa</button>` : ""}</div></td></tr>`;
  });
  if (!list.length) h += `<tr><td colspan="4" class="meta">${F === "cho" ? "Không còn tài liệu chờ gán." : "Chưa có tài liệu."}</td></tr>`;
  m.innerHTML = h + "</tbody></table></section>";
  document.getElementById("kLoc").onchange = e => { S.locKho = e.target.value; renderMain(); };
  const err = t => { const e = document.getElementById("kErr"); if (e) e.textContent = t; };
  if (canUp()) {
    upBind(m, async files => {
      try {
        const folder = await khoFolder();
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f.size > C.MAX_MB * 1048576) throw new Error(`${f.name} vượt ${C.MAX_MB} MB.`);
          busy(`Đang đọc văn bản ${i + 1}/${files.length}: ${f.name}`);
          const mt = window.VB ? await window.VB.doc(f) : { tieuDe: f.name };
          busy(`Đang tải lên ${i + 1}/${files.length}: ${f.name}`);
          const up = await uploadFile(f, folder, f.name);
          await db.collection("kd_kho").add({ ten: f.name, link: up.webViewLink || `https://drive.google.com/file/d/${up.id}/view`, fileId: up.id, nguoi: nguoi(), email: em(), tg: now(), taoLuc: Date.now(),
            loaiVB: mt.loai || "", so: mt.so || "", ngay: mt.ngay || "", noi: mt.noi || "", trichYeu: mt.trichYeu || "", tieuDe: mt.tieuDe || f.name, noiDung: String(mt.noiDung || "").slice(0, 3000), quet: !!mt.quet, ganVao: [], trangThai: "cho" });
        }
        busy(); m._files = null; S.locKho = "cho"; renderMain();
      } catch (e) { busy(); m._files = null; err(errMsg(e)); }
    });
    document.getElementById("kLinkAdd").onclick = async () => {
      const ten = val(m, "kTen"), link = val(m, "kLink");
      if (!ten) return err("Nhập tên tài liệu."); if (!/^https?:\/\//i.test(link)) return err("Đường link phải bắt đầu bằng http.");
      try { await db.collection("kd_kho").add({ ten, link, fileId: "", nguoi: nguoi(), email: em(), tg: now(), taoLuc: Date.now(), loaiVB: "", so: "", ngay: "", noi: "", trichYeu: "", tieuDe: ten, noiDung: "", quet: false, ganVao: [], trangThai: "cho" }); }
      catch (e) { err(errMsg(e)); }
    };
  }
  const kAuto = document.getElementById("kAuto");
  if (kAuto) kAuto.onclick = () => {
    const ds = all.filter(k => !(k.ganVao || []).length).map(k => ({ k, o: goiYKho(k, 1)[0] })).filter(x => x.o && x.o.d >= 0.8);
    if (!ds.length) return err("Không có tài liệu nào khớp từ 80% trở lên.");
    modal(`Gán tự động ${ds.length} tài liệu?`, "Chỉ gán những tài liệu có gợi ý khớp từ 80% trở lên; kiểm tra lại ở từng tiêu chí sau khi gán.",
      `<ul style="font-size:13px">${ds.map(x => `<li>${esc(x.k.ten)} → <b>${esc(x.o.r.ma)}</b> (${esc(x.o.r.tieuChi)}) ${Math.round(x.o.d * 100)}%</li>`).join("")}</ul>`, async () => {
        for (let i = 0; i < ds.length; i++) { busy(`Đang gán ${i + 1}/${ds.length}…`); await ganKho(ds[i].k, ds[i].o.r); }
      }, "Gán tất cả");
  };
  m.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
    const k = (S.kho || []).find(x => x.id === b.dataset.id), a = b.dataset.k;
    if (a === "gan") { const r = findMc(b.dataset.mc); modal("Gán vào minh chứng?", `${k.ten}`, `<div class="panel" style="margin:6px 0">→ <b>${esc(goc(r).ma)}</b> (tiêu chí ${esc(goc(r).tieuChi)}) – ${esc(goc(r).ten)}</div><div class="meta">${goc(r).link || kids(goc(r).id).length ? "Minh chứng đã có văn bản: tài liệu được thêm thành văn bản thành phần." : "Minh chứng chưa có tệp: tài liệu gắn thẳng vào minh chứng, điền số, ngày, nơi ban hành nếu còn trống."}</div>`, async () => { await ganKho(k, r); }, "Gán"); }
    else if (a === "chon") {
      const ds = goiYKho(k, 300).concat(S.mc.filter(r => r.loai === "MC" && !r.goc && r.trangThai !== TT.BO).map(r => ({ r, d: 0 }))).filter((o, i, arr) => arr.findIndex(z => z.r.id === o.r.id) === i);
      const opt = l => l.slice(0, 80).map(o => `<option value="${esc(o.r.id)}">${esc(o.r.ma)} (${esc(o.r.tieuChi)})${coTep(o.r) ? " ✓" : ""} – ${esc(o.r.ten).slice(0, 90)}${o.d ? ` · ${Math.round(o.d * 100)}%` : ""}</option>`).join("");
      const w0 = modal("Chọn minh chứng để gán", k.ten, `<label>Tìm theo mã, tiêu chí, tên</label><input type="text" id="fQ" placeholder="VD: 4.5, phổ điểm, H2.02.01">
        <label>Minh chứng (gợi ý giống nhất xếp trên)</label><select id="fD" size="9" style="height:auto">${opt(ds)}</select>`, async w => {
        const r = findMc(val(w, "fD")); if (!r) throw new Error("Chọn một minh chứng."); await ganKho(k, r);
      }, "Gán");
      const fq = w0.querySelector("#fQ"), fd = w0.querySelector("#fD");
      fq.oninput = () => { const q = normVN(fq.value); fd.innerHTML = opt(q ? ds.filter(o => normVN([o.r.ma, o.r.tieuChi, o.r.ten, o.r.tenGoiY].join(" ")).includes(q)) : ds); };
    }
    else if (a === "sua") modal("Sửa thông tin tài liệu", k.ten, `<label>Tên văn bản (dùng khi gán)</label><textarea id="fT" rows="2">${esc(k.tieuDe || k.ten)}</textarea>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px"><div><label>Số hiệu</label><input type="text" id="fS" value="${esc(k.so)}"></div><div><label>Ngày ban hành</label><input type="text" id="fN" value="${esc(k.ngay)}"></div></div>
      <label>Nơi ban hành</label><input type="text" id="fNo" value="${esc(k.noi)}">`, async w => {
      await db.collection("kd_kho").doc(k.id).update({ tieuDe: val(w, "fT").slice(0, 400), so: val(w, "fS").slice(0, 100), ngay: val(w, "fN").slice(0, 50), noi: val(w, "fNo").slice(0, 200) });
    });
    else if (a === "xoa") modal("Xóa khỏi kho chung?", k.ten, `<div class="meta">Chỉ xóa khỏi danh sách kho chung; tệp vẫn giữ trên Drive, các minh chứng đã gán không bị ảnh hưởng.</div>`, async () => {
      await db.collection("kd_kho").doc(k.id).delete();
    }, "Xóa");
  });
}
const val = (w, id) => { const e = w.querySelector("#" + id); return e ? e.value.trim() : ""; };

function bindActions(root) {
  root.querySelectorAll("[data-go2]").forEach(x => x.onclick = e => { e.preventDefault(); S.tab = "tc"; S.tcSel = x.dataset.go2; S.q = ""; render(); });
  root.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const a = b.dataset.a, id = b.dataset.id;
    const r = id ? (findMc(id) || findCc(id)) : null;
    if (a === "gan") {
      const w0 = modal("Tải tệp cho minh chứng " + r.ma, r.ten, fileField("Minh chứng gồm nhiều văn bản (nhiều quyết định, nhiều năm…)? Dùng nút “+ Văn bản” để tải từng văn bản.") +
        `<label>hoặc dán đường link (Google Drive, website)</label><input type="text" id="fLink" placeholder="https://…">
         <label>Số, ngày ban hành / thời điểm khảo sát <span style="font-weight:400">(tự điền khi đọc được văn bản)</span></label><input type="text" id="fSo" value="${esc(r.soNgay)}">
         <label>Nơi ban hành</label><input type="text" id="fNoi" value="${esc(r.noi)}">
         <label id="fDoiTenBox" style="display:none;margin-top:8px;color:var(--ink)"><input type="checkbox" id="fDoiTen"> Đổi tên minh chứng theo tên văn bản: <i id="fTenMoi"></i></label>`, async w => {
        const f = fileOf(w), link = val(w, "fLink"), dt = w.querySelector("#fDoiTen");
        if (!f && !link) throw new Error("Chọn tệp, kéo – thả tệp vào ô hoặc dán đường link.");
        await ganTep(r, f, { link, soNgay: val(w, "fSo"), noi: val(w, "fNoi"), ten: dt && dt.checked ? w.querySelector("#fTenMoi").textContent : "" });
      }, "Tải lên");
      upBind(w0, fl => tuDien(w0, fl[0]));
    }
    else if (a === "them") {
      const w0 = modal("Thêm văn bản cho minh chứng " + r.ma, r.ten,
      `${fileField()}<label>hoặc dán đường link (website, Google Drive)</label><input type="text" id="fLink" placeholder="https://…">
       <label>Tên văn bản * <span style="font-weight:400">(tự điền khi đọc được văn bản)</span></label><input type="text" id="fTen" placeholder="VD: Quyết định ban hành CTĐT năm 2023">
       <label>Số, ngày ban hành / thời điểm khảo sát</label><input type="text" id="fSo" placeholder="VD: 4364/QĐ-HCQG, 18/09/2023">
       <label>Nơi ban hành</label><input type="text" id="fNoi" placeholder="VD: Học viện Hành chính và Quản trị công">`, async w => {
        await themVanBan(r, { ten: val(w, "fTen"), soNgay: val(w, "fSo"), noi: val(w, "fNoi"), link: val(w, "fLink") }, fileOf(w));
      }, "Lưu văn bản");
      upBind(w0, fl => tuDien(w0, fl[0], { ten: true }));
    }
    else if (a === "sua") modal("Sửa thông tin", r.ma || "Văn bản thành phần",
      `<label>Tên minh chứng / văn bản * <span style="font-weight:400">(sửa theo đúng tên văn bản thực tế)</span></label><textarea id="fTen" rows="3">${esc(r.ten)}</textarea>
       ${r.loai === "MC" ? `<div class="meta" style="margin:2px 0 0">Tên gợi ý theo Phụ lục II: ${esc(r.tenGoiY || r.ten)} (được giữ lại để đối chiếu)</div>` : ""}
       <label>Số, ngày ban hành / thời điểm khảo sát</label><input type="text" id="fSo" value="${esc(r.soNgay)}">
       <label>Nơi ban hành</label><input type="text" id="fNoi" value="${esc(r.noi)}">
       <label>Dùng chung với tiêu chí</label><input type="text" id="fDc" value="${esc(r.dungChung)}" placeholder="VD: 2.2; 4.5">`, async w => {
      const ten = val(w, "fTen"); if (!ten) throw new Error("Tên không được để trống.");
      const up = { ten: ten.slice(0, 400), soNgay: val(w, "fSo").slice(0, 200), noi: val(w, "fNoi").slice(0, 200), dungChung: val(w, "fDc").slice(0, 100) };
      if (r.loai === "MC" && !r.tenGoiY && ten !== r.ten) up.tenGoiY = r.ten;
      await db.collection("kd_mc").doc(r.id).update(up);
      await log("Sửa thông tin", r.id, ten);
    });
    else if (a === "noinhanh") { const d2 = findMc(b.dataset.dich); modal("Nối dùng chung minh chứng?", `${r.ma} (tiêu chí ${r.tieuChi}) sẽ dùng tệp, văn bản và trạng thái của ${d2.ma} (tiêu chí ${d2.tieuChi}).`,
      `<div class="panel" style="margin:6px 0"><b>${esc(r.ma)}</b> – ${esc(r.ten)}<br>⇄ <b>${esc(d2.ma)}</b> – ${esc(d2.ten)}</div><div class="meta">Tải lên hay bổ sung văn bản ở một bên là bên kia cập nhật theo. Có thể “Bỏ nối” bất cứ lúc nào.</div>`, async () => { await noiMinhChung(r, d2); }, "Nối"); }
    else if (a === "ktrung") modal("Đánh dấu không trùng?", `${r.ma} – ${r.ten}`, `<div class="meta">Hệ thống sẽ không gợi ý nối minh chứng này với minh chứng vừa nêu nữa.</div>`, async () => {
      const ds = [...new Set([...(r.khongTrung || []), ...b.dataset.dich.split(",").filter(Boolean)])];
      await db.collection("kd_mc").doc(r.id).update({ khongTrung: ds });
    }, "Không trùng");
    else if (a === "bonoi") modal("Bỏ nối dùng chung?", `${r.ma} – ${r.ten}`, `<div class="meta">Minh chứng trở lại chưa có tệp riêng; tệp vẫn thuộc ${esc(goc(r).ma)}.</div>`, async () => {
      await db.collection("kd_mc").doc(r.id).update({ goc: "" }); await log("Bỏ nối dùng chung", r.id, r.ma);
    }, "Bỏ nối");
    else if (a === "noi") {
      const goiY = S.mc.filter(x => x.loai === "MC" && x.id !== r.id && x.tieuChi !== r.tieuChi && x.trangThai !== TT.BO && goc(x).id !== r.id)
        .map(x => ({ x, d: tuongDong(r, x), co: coTep(x) })).sort((p, q) => (q.d - p.d) || (q.co - p.co));
      const opt = list => list.slice(0, 60).map(o => `<option value="${esc(o.x.id)}">${esc(o.x.ma)} (${esc(o.x.tieuChi)})${o.co ? " ✓ có tệp" : ""} – ${esc(o.x.ten).slice(0, 90)}</option>`).join("");
      const w0 = modal("Nối dùng chung minh chứng", `${r.ma} (tiêu chí ${r.tieuChi}) – ${r.ten}`,
        `<label>Tìm minh chứng ở tiêu chí khác (mã, tên, số hiệu)</label><input type="text" id="fQ" placeholder="VD: H1.01.01, quy trình xây dựng, 4364/QĐ">
         <label>Chọn minh chứng để dùng chung (gợi ý giống nhất xếp trên)</label><select id="fD" size="8" style="height:auto">${opt(goiY)}</select>
         <div class="meta" style="margin-top:6px">Sau khi nối, ${esc(r.ma)} dùng chung mã, tệp, văn bản và trạng thái của minh chứng được chọn (mã hóa một lần theo Kế hoạch TĐG).</div>`, async w => {
        const d2 = findMc(val(w, "fD")); if (!d2) throw new Error("Chọn một minh chứng."); await noiMinhChung(r, d2);
      }, "Nối");
      const fq = w0.querySelector("#fQ"), fd = w0.querySelector("#fD");
      fq.oninput = () => { const k = normVN(fq.value); fd.innerHTML = opt(k ? goiY.filter(o => normVN([o.x.ma, o.x.ten, o.x.soNgay, o.x.tieuChi].join(" ")).includes(k)) : goiY); };
    }
    else if (a === "ra") modal("Rà soát", (r.ma || "") + " " + r.ten,
      `<label>Trạng thái</label><select id="fSt">${DS_TT.map(s => `<option${s === r.trangThai ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
       <label>Ghi chú rà soát (VD: thiếu dấu, sai năm, ngoài giai đoạn đánh giá)</label><textarea id="fGc" rows="3">${esc(r.ghiChu)}</textarea>`, async w => {
      await db.collection("kd_mc").doc(r.id).update({ trangThai: val(w, "fSt"), ghiChu: val(w, "fGc").slice(0, 500) });
      await log("Rà soát", r.id, val(w, "fSt") + " " + val(w, "fGc"));
    });
    else if (a === "go") modal("Gỡ liên kết tệp?", "Tệp vẫn giữ trong thư mục Drive; chỉ gỡ khỏi danh mục.", "", async () => {
      await db.collection("kd_mc").doc(r.id).update({ link: "", fileId: "", nguoi: "", email: "", tg: "", trangThai: r.loai === "MC" ? TT.CHUA : TT.BO });
      await log("Gỡ tệp", r.id, r.link);
    }, "Gỡ tệp");
    else if (a === "xoa") modal("Xóa văn bản thành phần?", r.ten + " (tệp vẫn giữ trong Drive)", "", async () => {
      await db.collection("kd_mc").doc(r.id).delete(); await log("Xóa văn bản", r.id, r.ten);
    }, "Xóa");
    else if (a === "cc") upBind(modal("Tải bản chính thức", r.so + " – " + r.ten, fileField("Ưu tiên bản PDF có dấu tải từ Cổng thông tin điện tử Chính phủ / Bộ GDĐT."), async w => {
      const f = fileOf(w); if (!f) throw new Error("Chưa chọn tệp.");
      const meta = await upMeta(f, S.cfg.ccFolderId, r.id); busy("Đang ghi danh mục…");
      await db.collection("kd_cc").doc(r.id).update(meta); await log("Tải văn bản căn cứ", r.id, f.name);
    }, "Tải lên"));
    else if (a === "gocc") modal("Gỡ tệp bản chính thức?", r.ten, "", async () => {
      await db.collection("kd_cc").doc(r.id).update({ link: "", fileId: "", nguoi: "", email: "", tg: "" }); await log("Gỡ tệp căn cứ", r.id, "");
    }, "Gỡ");
    else if (a === "newmc") { const maTc = b.dataset.tc || S.tcSel; modal("Thêm minh chứng cho tiêu chí " + maTc, "Mã minh chứng sinh tự động theo thứ tự tiếp theo.", `<label>Tên minh chứng *</label><textarea id="fTen" rows="3"></textarea>`, async w => {
      const ten = val(w, "fTen"); if (!ten) throw new Error("Nhập tên minh chứng.");
      const list = mcOf(maTc), [t, c] = maTc.split(".").map(Number), pad = n => String(n).padStart(2, "0");
      const last = list[list.length - 1], prefix = last ? String(last.ma).replace(/\d+$/, "") : `H${t}.${pad(t)}.${pad(c)}.`;
      const ma = prefix + pad((last ? efOf(last) : 0) + 1);
      await db.collection("kd_mc").add({ tieuChi: maTc, loai: "MC", ma, ten: ten.slice(0, 400), soNgay: "", noi: "", dungChung: "", link: "", fileId: "", nguoi: "", email: "", tg: "",
        trangThai: TT.CHUA, ghiChu: "", cha: "", taoLuc: Date.now() });
      await log("Thêm minh chứng", ma, ten);
    }); }
  });
}

/* ---------- Cài đặt (quản trị): quy tắc + khởi tạo ---------- */
const RS_API = "https://firebaserules.googleapis.com/v1/";
async function rsProbe(v) {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${C.FIREBASE.projectId}/databases/(default)/documents/kd_rules_v/${encodeURIComponent(v)}?key=${C.FIREBASE.apiKey}`, { cache: "no-store" });
    if (r.status === 403) return false; if (r.status === 404 || r.ok) return true; return null;
  } catch (e) { return null; }
}
async function rsRepo() { return (await fetch("firebase/kd.rules?t=" + Date.now(), { cache: "no-store" })).text(); }
function rsMerge(live, block) {
  const B = block.replace(/\s+$/, "").split("\n"), L = live.split("\n");
  const a = L.findIndex(l => /=====\s*KDTHS\b/.test(l)); let b = -1; L.forEach((l, i) => { if (/Hết khối KDTHS/.test(l)) b = i; });
  if (a >= 0 && b > a) return L.slice(0, a).concat(B, L.slice(b + 1)).join("\n");
  let p = -1; L.forEach((l, i) => { if (/Hết khối PNL/.test(l)) p = i; });
  if (p < 0) { // chèn trước 2 dấu đóng cuối (đóng documents và service)
    let n = 0; for (let i = L.length - 1; i >= 0; i--) { if (/^\s*}\s*$/.test(L[i])) { n++; if (n === 2) { p = i - 1; break; } } }
    if (p < 0) throw new Error("Không tìm được vị trí chèn khối quy tắc.");
  }
  return L.slice(0, p + 1).concat([""], B, L.slice(p + 1)).join("\n");
}
async function rsRun(msg) {
  let auth2 = null;
  try {
    const block = await rsRepo();
    const app2 = firebase.apps.find(x => x.name === "kd-rules") || firebase.initializeApp(C.FIREBASE, "kd-rules"); auth2 = app2.auth();
    const p = new firebase.auth.GoogleAuthProvider(); p.addScope("https://www.googleapis.com/auth/firebase"); p.setCustomParameters({ prompt: "select_account" });
    msg("Đang mở cửa sổ đăng nhập Google (chọn tài khoản đã tạo dự án Firebase)…");
    const r = await auth2.signInWithPopup(p); const tok = r && r.credential && r.credential.accessToken; if (!tok) throw new Error("Google không cấp quyền.");
    const call = async (url, opt) => { const res = await fetch(url, Object.assign({ headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" } }, opt || {})); const j = await res.json().catch(() => ({})); if (!res.ok) { const e = new Error((j.error && j.error.message) || "HTTP " + res.status); e.status = res.status; throw e; } return j; };
    msg("Đang đọc quy tắc đang chạy…"); const proj = "projects/" + C.FIREBASE.projectId;
    const rel = await call(RS_API + proj + "/releases/cloud.firestore"), cur = await call(RS_API + rel.rulesetName);
    const files = (cur.source && cur.source.files) || []; const f = files.find(x => /Hết khối PNL/.test(x.content || "")) || files[0];
    if (!f) throw new Error("Không đọc được tệp quy tắc đang chạy.");
    const merged = rsMerge(f.content, block);
    if (merged !== f.content) {
      msg("Đang kiểm tra và xuất bản (máy chủ báo lỗi thì không đổi gì)…");
      const nr = await call(RS_API + proj + "/rulesets", { method: "POST", body: JSON.stringify({ source: { files: files.map(x => x === f ? { name: x.name, content: merged } : { name: x.name, content: x.content }) } }) });
      await call(RS_API + proj + "/releases/cloud.firestore", { method: "PATCH", body: JSON.stringify({ release: { name: proj + "/releases/cloud.firestore", rulesetName: nr.name } }) });
    }
    msg("Đã xuất bản. Đang chờ máy chủ áp dụng (tối đa khoảng 1 phút)…");
    for (let i = 0; i < 18; i++) { if ((await rsProbe(C.RULES_V)) === true) return true; await new Promise(z => setTimeout(z, 5000)); }
    throw new Error("Đã xuất bản nhưng máy chủ chưa áp dụng. Chờ 1–2 phút rồi tải lại trang.");
  } catch (x) {
    if (x && x.status === 403) throw new Error("Tài khoản vừa chọn không có quyền sửa quy tắc dự án Firebase. Chọn tài khoản đã tạo dự án.");
    if (x && x.status === 400) throw new Error("Máy chủ báo quy tắc có lỗi nên chưa đổi gì: " + x.message);
    throw x;
  } finally { try { if (auth2) await auth2.signOut(); } catch (e) { /* bỏ qua */ } }
}
async function khoiTao(msg) {
  const seed = await (await fetch("data/seed.json", { cache: "no-store" })).json();
  let cfg = S.cfg || {};
  msg("Đang tạo thư mục minh chứng trên Google Drive…");
  const root = await folderIn(C.TEN_THU_MUC, null);
  const cc = await folderIn("0. CĂN CỨ PHÁP LÝ", root.id);
  const tcFolder = {}, stdFolder = {};
  for (let i = 0; i < seed.tieuChi.length; i++) {
    const t = seed.tieuChi[i];
    if (!stdFolder[t.tieuChuan]) stdFolder[t.tieuChuan] = await folderIn(`TC${t.tieuChuan}. ${t.tenTieuChuan}`, root.id);
    msg(`Đang tạo thư mục tiêu chí ${t.ma} (${i + 1}/52)…`);
    tcFolder[t.ma] = (await folderIn(`Tiêu chí ${t.ma}`, stdFolder[t.tieuChuan].id)).id;
  }
  cfg = { rootId: root.id, rootUrl: root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`, ccFolderId: cc.id, tg: now(), boi: em() };
  await db.collection("kd_cfg").doc("main").set(cfg, { merge: true });
  S.cfg = Object.assign({}, S.cfg || {}, cfg);
  msg("Đang ghi danh mục tiêu chí, căn cứ, minh chứng gợi ý…");
  const has = async c => !(await db.collection(c).limit(1).get()).empty;
  const ops = [];
  seed.tieuChi.forEach(t => ops.push(["kd_tc", t.ma, Object.assign({}, t, { folderId: tcFolder[t.ma] }), true]));
  if (!(await has("kd_cc"))) seed.canCu.forEach(c => ops.push(["kd_cc", c.id, Object.assign({}, c, { link: "", fileId: "", nguoi: "", email: "", tg: "" })]));
  if (!(await has("kd_mc"))) seed.minhChung.forEach((m, i) => ops.push(["kd_mc", m.id, { tieuChi: m.tieuChi, loai: "MC", ma: m.ma, ten: m.ten, soNgay: "", noi: "", dungChung: "", link: "", fileId: "", nguoi: "", email: "", tg: "", trangThai: TT.CHUA, ghiChu: "", cha: "", taoLuc: i }]));
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(([c, id, d, merge]) => b.set(db.collection(c).doc(id), d, merge ? { merge: true } : undefined));
    await b.commit();
  }
  await log("Khởi tạo", "kd_cfg/main", ops.length + " bản ghi");
}
function renderCaiDat(m) {
  const okR = S.rulesOk === true, hasCfg = !!S.cfg;
  m.innerHTML = `<section class="content"><h2>Cài đặt hệ thống (quản trị)</h2>
    <div class="panel"><b>Bước 1. Quy tắc dữ liệu Firestore</b> – ${okR ? '<span class="ok">đã cập nhật</span>' : S.rulesOk === false ? '<span class="no">chưa cập nhật</span>' : "chưa kiểm tra được"}
      <div class="meta">Chèn khối quy tắc KDTHS vào quy tắc chung của dự án phuc-nguyen-library; giữ nguyên phần PNL, PNW, PND. Máy chủ kiểm tra cú pháp trước, lỗi thì không đổi gì.</div>
      <button class="b ${okR ? "" : "pri"}" id="cdRules">Cập nhật quy tắc</button></div>
    <div class="panel"><b>Bước 2. Khởi tạo thư mục Drive và dữ liệu</b> – ${hasCfg ? '<span class="ok">đã khởi tạo</span>' : '<span class="no">chưa khởi tạo</span>'}
      <div class="meta">Tạo thư mục “${esc(C.TEN_THU_MUC)}” trong Drive của tài khoản đang đăng nhập (8 thư mục tiêu chuẩn, 52 thư mục tiêu chí, thư mục căn cứ) và nạp 52 tiêu chí, 15 văn bản căn cứ, 257 minh chứng gợi ý. Chạy lại không tạo trùng, không ghi đè minh chứng đã nhập.</div>
      <button class="b ${hasCfg ? "" : "pri"}" id="cdInit" ${okR ? "" : "disabled"}>${hasCfg ? "Chạy lại khởi tạo" : "Khởi tạo"}</button></div>
    <div class="panel"><b>Bước 3.</b> Vào tab <b>Thành viên</b>, thêm email thành viên Hội đồng, Ban Thư ký, nhóm công tác; gửi họ đường link trang này.</div>
    <div class="err" id="cdMsg"></div></section>`;
  const msg = t => { const e = document.getElementById("cdMsg"); if (e) e.textContent = t; busy(t); };
  document.getElementById("cdRules").onclick = async e => {
    e.target.disabled = true;
    try { await rsRun(msg); S.rulesOk = true; busy(); await restart(); } catch (x) { busy(); msg(errMsg(x)); e.target.disabled = false; }
  };
  document.getElementById("cdInit").onclick = async e => {
    e.target.disabled = true;
    try { await khoiTao(msg); busy(); S.tab = "tc"; await restart(); } catch (x) { busy(); msg(errMsg(x)); e.target.disabled = false; }
  };
}
async function restart() { S.unsub.forEach(f => f()); S.unsub = []; S.loaded = false; await start(); render(); }
