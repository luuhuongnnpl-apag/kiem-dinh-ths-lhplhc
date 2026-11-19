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
function renderLogin(msg) {
  app.innerHTML = `<div class="login"><h2>CSDL minh chứng</h2>
    <div class="meta">Tự đánh giá CTĐT thạc sĩ ngành Luật Hiến pháp và Luật Hành chính (định hướng ứng dụng) – Học viện Hành chính và Quản trị công · Thông tư 04/2025/TT-BGDĐT</div>
    <p style="font-size:14px">Đăng nhập bằng tài khoản Google đã đăng ký với Ban Thư ký. Lần đầu Google có thể báo “ứng dụng chưa được xác minh”: bấm <b>Nâng cao</b> → <b>Đi tới…</b> để cấp quyền lưu tệp vào thư mục minh chứng.</p>
    <div class="err" id="lgErr">${esc(msg || "")}</div>
    <div class="row" style="justify-content:flex-start">${S.user ? `<button class="b" id="lgOut">Đăng xuất ${esc(em())}</button>` : ""}<button class="b pri" id="lgBtn">Đăng nhập bằng Google</button></div></div>`;
  document.getElementById("lgBtn").onclick = login;
  const o = document.getElementById("lgOut"); if (o) o.onclick = () => auth.signOut();
}

auth.onAuthStateChanged(async u => {
  S.unsub.forEach(f => f()); S.unsub = []; S.loaded = false;
  S.user = u; S.admin = isAdminUser(u); S.tv = null; S.role = "";
  if (!u) return renderLogin();
  busy("Đang kiểm tra quyền…");
  try {
    let tv = null;
    try { const d = await db.collection("kd_tv").doc(em()).get(); tv = d.exists ? d.data() : null; }
    catch (e) { if (!S.admin) throw e; }
    if (S.admin) S.role = "thuky";
    else if (tv && !tv.khoa) S.role = tv.vai || "xem";
    else { busy(); return renderLogin("Tài khoản " + u.email + " chưa được Ban Thư ký cấp quyền (hoặc đã bị khóa). Gửi email này cho Ban Thư ký để được thêm vào danh sách."); }
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
const coTep = r => !!r.link || kids(r.id).some(k => !!k.link);
function tienDo(ma) {
  const m = mcOf(ma).filter(r => r.trangThai !== TT.BO);
  return { co: m.filter(coTep).length, tong: m.length, dat: m.filter(r => r.trangThai === TT.DAT).length };
}
const stCls = s => "st st" + Math.max(0, DS_TT.indexOf(s));

/* ---------- Khung ---------- */
function render() {
  const tabs = [["tc", "Tiêu chí & minh chứng"], ["cc", "Căn cứ pháp lý"], ["th", "Tổng hợp & xuất danh mục"]];
  if (isTk()) tabs.push(["tv", "Thành viên"]);
  if (S.admin) tabs.push(["cd", "Cài đặt"]);
  const ready = S.loaded;
  app.innerHTML = `<header><h1>CSDL minh chứng – TĐG CTĐT thạc sĩ ngành Luật HP&amp;LHC<small>Thông tư 04/2025/TT-BGDĐT · 8 tiêu chuẩn · 52 tiêu chí · giai đoạn 01/9/2023 – 30/8/2026</small></h1>
    <span class="who">${esc(nguoi())} · ${S.admin ? "Quản trị" : esc(VAI[S.role] || S.role)}</span>
    ${S.cfg && S.cfg.rootUrl ? `<a class="b" style="background:#fff;text-decoration:none" href="${esc(S.cfg.rootUrl)}" target="_blank" rel="noopener">Thư mục Drive</a>` : ""}
    <button class="b" id="lo" style="background:#fff">Đăng xuất</button></header>
    <nav>${tabs.filter(t => ready || t[0] === "cd").map(t => `<button data-t="${t[0]}" class="${S.tab === t[0] ? "on" : ""}">${t[1]}</button>`).join("")}
    ${ready ? `<input id="q" placeholder="Tìm minh chứng, văn bản, mã…" value="${esc(S.q)}">` : ""}</nav><main id="main"></main>`;
  app.querySelectorAll("nav button").forEach(b => b.onclick = () => { S.tab = b.dataset.t; S.q = ""; render(); });
  document.getElementById("lo").onclick = () => auth.signOut();
  const q = document.getElementById("q"); if (q) q.oninput = () => { S.q = q.value; renderMain(); };
  renderMain();
}
function renderMain() {
  const m = document.getElementById("main"); if (!m) return;
  if (S.tab === "cd") return renderCaiDat(m);
  if (!S.loaded) { m.innerHTML = `<section class="content">Đang tải dữ liệu…</section>`; return; }
  if (S.q.trim()) return renderSearch(m);
  if (S.tab === "cc") return renderCanCu(m);
  if (S.tab === "th") return renderTongHop(m);
  if (S.tab === "tv") return renderThanhVien(m);
  renderTieuChiTab(m);
}

/* ---------- Tab tiêu chí ---------- */
function renderTieuChiTab(m) {
  let side = "", last = 0;
  S.tc.forEach(t => {
    if (t.tieuChuan !== last) { last = t.tieuChuan; side += `<div class="std">Tiêu chuẩn ${t.tieuChuan}. ${esc(t.tenTieuChuan)}</div>`; }
    const p = tienDo(t.ma);
    side += `<a data-tc="${esc(t.ma)}" class="${S.tcSel === t.ma ? "on" : ""}"><b>${esc(t.ma)}</b><span class="n">${t.dieuKien ? '<span class="badge">ĐK</span>' : ""}</span><span class="p">${p.co}/${p.tong}</span></a>`;
  });
  m.innerHTML = `<aside>${side}</aside><section class="content" id="sec"></section>`;
  m.querySelectorAll("aside a").forEach(a => a.onclick = () => { S.tcSel = a.dataset.tc; renderMain(); });
  const sec = document.getElementById("sec"), t = tcOf(S.tcSel);
  if (!t) { sec.textContent = "Không có dữ liệu."; return; }
  const p = tienDo(t.ma), li = (arr, tag) => `<${tag}>${(arr || []).map(x => `<li>${esc(x)}</li>`).join("")}</${tag}>`;
  sec.innerHTML = `<h2>Tiêu chí ${esc(t.ma)} ${t.dieuKien ? '<span class="badge">Tiêu chí điều kiện</span>' : ""}</h2>
    <div style="font-weight:600;margin-bottom:4px">${esc(t.ten)}</div>
    <div class="meta">Tiêu chuẩn ${t.tieuChuan}. ${esc(t.tenTieuChuan)} · ${esc(t.nhom)} · Hạn: ${esc(t.han)} · Có tệp ${p.co}/${p.tong} minh chứng · Đạt ${p.dat}</div>
    <details><summary>Yêu cầu của tiêu chí (Phụ lục II TT 04/2025)</summary>${li(t.yeuCau, "ol")}</details>
    <details><summary>Minh chứng gợi ý (Phụ lục II TT 04/2025)</summary>${li(t.goiY, "ul")}</details>
    ${tableMC(mcOf(t.ma))}
    ${isTk() ? `<div class="row" style="justify-content:flex-start"><button class="b pri" data-a="newmc">+ Thêm minh chứng cho tiêu chí ${esc(t.ma)}</button></div>` : ""}`;
  bindActions(sec);
}
function tableMC(mcs) {
  let h = `<table><thead><tr><th style="width:110px">Mã minh chứng</th><th>Tên minh chứng / văn bản</th><th style="width:150px">Số, ngày ban hành / thời điểm</th><th style="width:130px">Nơi ban hành</th><th style="width:80px">Dùng chung</th><th style="width:50px">Tệp</th><th style="width:120px">Trạng thái</th><th style="width:210px">Ghi chú / Tải lên</th></tr></thead><tbody>`;
  mcs.forEach(r => { h += rowHtml(r, true); kids(r.id).forEach(k => { h += rowHtml(k, false); }); });
  return h + "</tbody></table>";
}
function rowHtml(r, isMc) {
  const id = esc(r.id); let act = "";
  if (canUp()) {
    if (isMc && !r.link && !kids(r.id).length) act += `<button class="b pri" data-a="gan" data-id="${id}">⬆ Tải tệp</button>`;
    if (isMc) act += `<button class="b" data-a="them" data-id="${id}">+ Văn bản</button>`;
    act += `<button class="b" data-a="sua" data-id="${id}">Sửa</button>`;
  }
  if (isTk()) {
    act += `<button class="b" data-a="ra" data-id="${id}">Rà soát</button>`;
    if (r.link) act += `<button class="b red" data-a="go" data-id="${id}">Gỡ tệp</button>`;
    if (!isMc) act += `<button class="b red" data-a="xoa" data-id="${id}">Xóa</button>`;
  }
  return `<tr class="${isMc ? "mc" : "tp"}${r.trangThai === TT.BO ? " bo" : ""}">
    <td class="ma">${esc(r.ma || "")}</td>
    <td class="ten">${esc(r.ten)}${r.nguoi ? `<div class="meta" style="margin:2px 0 0;font-size:11.5px">${esc(r.nguoi)} · ${esc(r.tg)}</div>` : ""}</td>
    <td>${esc(r.soNgay)}</td><td>${esc(r.noi)}</td><td>${esc(r.dungChung)}</td>
    <td>${r.link ? `<a class="f" href="${esc(r.link)}" target="_blank" rel="noopener">Mở</a>` : ""}</td>
    <td><span class="${stCls(r.trangThai)}">${esc(r.trangThai || "")}</span></td>
    <td><div class="act">${act}</div>${r.ghiChu ? `<div class="note">${esc(r.ghiChu)}</div>` : ""}</td></tr>`;
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

/* ---------- Tổng hợp ---------- */
function renderTongHop(m) {
  const std = {};
  S.tc.forEach(t => {
    const p = tienDo(t.ma), k = t.tieuChuan;
    std[k] = std[k] || { ten: t.tenTieuChuan, nhom: t.nhom, co: 0, tong: 0, dat: 0 };
    std[k].co += p.co; std[k].tong += p.tong; std[k].dat += p.dat;
  });
  let h = `<section class="content"><h2>Tổng hợp tiến độ thu thập minh chứng</h2>
    <div class="row" style="justify-content:flex-start;margin:0 0 12px"><button class="b pri" id="csv">⬇ Xuất danh mục minh chứng (Excel – CSV)</button></div><div class="cards">`;
  Object.keys(std).forEach(k => {
    const s = std[k], pc = s.tong ? Math.round(s.co * 100 / s.tong) : 0;
    h += `<div class="card"><b>Tiêu chuẩn ${k}</b><div style="font-size:12.5px">${esc(s.ten)}</div><div class="bar"><i style="width:${pc}%"></i></div>
      <div class="meta" style="margin:0">Có tệp ${s.co}/${s.tong} (${pc}%) · Đạt ${s.dat}<br>${esc(s.nhom)}</div></div>`;
  });
  h += `</div><h3>Minh chứng còn thiếu ở 10 tiêu chí điều kiện</h3>`;
  let any = false;
  S.tc.filter(t => t.dieuKien).forEach(t => {
    const thieu = mcOf(t.ma).filter(r => r.trangThai !== TT.BO && (!coTep(r) || r.trangThai === TT.BOSUNG));
    if (!thieu.length) return; any = true;
    h += `<div class="hit" data-go="${esc(t.ma)}"><b>${esc(t.ma)}</b> – còn ${thieu.length} minh chứng: ${thieu.map(r => esc(r.ma) + " " + esc(r.ten)).join("; ")}</div>`;
  });
  if (!any) h += `<div class="meta">Các tiêu chí điều kiện đã có đủ tệp minh chứng.</div>`;
  m.innerHTML = h + "</section>";
  m.querySelectorAll("[data-go]").forEach(d => d.onclick = () => { S.tab = "tc"; S.tcSel = d.dataset.go; render(); });
  document.getElementById("csv").onclick = exportCsv;
}
function exportCsv() {
  const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const L = [["Số TT", "Mã minh chứng", "Tên minh chứng", "Số, ngày ban hành / Thời điểm khảo sát", "Nơi ban hành", "Dùng chung với tiêu chí", "Link tệp", "Trạng thái", "Ghi chú rà soát"]];
  let last = 0, stt = 0;
  S.tc.forEach(t => {
    if (t.tieuChuan !== last) { last = t.tieuChuan; L.push(["", "", `Tiêu chuẩn ${t.tieuChuan}. ${t.tenTieuChuan}`]); }
    L.push(["", "", `Tiêu chí ${t.ma}. ${t.ten}`]);
    mcOf(t.ma).filter(r => r.trangThai !== TT.BO).forEach(r => {
      L.push([++stt, r.ma, r.ten, r.soNgay, r.noi, r.dungChung, r.link, r.trangThai, r.ghiChu]);
      kids(r.id).filter(k => k.trangThai !== TT.BO).forEach(k => L.push(["", "", k.ten, k.soNgay, k.noi, k.dungChung, k.link, k.trangThai, k.ghiChu]));
    });
  });
  const blob = new Blob(["﻿" + L.map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Danh_muc_minh_chung_ThS_LHPLHC.csv"; document.body.appendChild(a); a.click(); a.remove();
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
async function renderThanhVien(m) {
  m.innerHTML = `<section class="content">Đang tải danh sách…</section>`;
  try { await loadTv(); } catch (e) { m.innerHTML = `<section class="content"><div class="err">${esc(errMsg(e))}</div></section>`; return; }
  if (S.tab !== "tv") return;
  const NHOM = ["Hội đồng TĐG", "Ban Thư ký", "Nhóm 1 (TC 1–2)", "Nhóm 2 (TC 3–4)", "Nhóm 3 (TC 5)", "Nhóm 4 (TC 6)", "Nhóm 5 (TC 7)", "Nhóm 6 (TC 8)", "Khác"];
  let h = `<section class="content"><h2>Thành viên được truy cập</h2>
    <div class="meta">Cần email Google vì mỗi người đăng nhập bằng tài khoản Google, và hệ thống chia sẻ thư mục minh chứng trên Drive theo email đó (Thành viên/Thư ký: quyền chỉnh sửa để tải tệp lên; Chỉ xem: quyền xem). Khóa → gỡ quyền Drive.</div>
    <div class="panel"><b>Thêm người</b>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 12px">
        <div><label>Email Google *</label><input type="text" id="tvEm" placeholder="nguyenvana@gmail.com" autocomplete="off"></div>
        <div><label>Họ và tên *</label><input type="text" id="tvTen" placeholder="Nguyễn Văn A"></div>
        <div><label>Chức vụ, đơn vị</label><input type="text" id="tvCv" placeholder="Giảng viên, Khoa Luật"></div>
        <div><label>Vai *</label><select id="tvVai">${Object.keys(VAI).map(k => `<option value="${k}"${k === "thanhvien" ? " selected" : ""}>${VAI[k]}</option>`).join("")}</select></div>
        <div><label>Nhóm công tác</label><select id="tvNhom"><option value=""></option>${NHOM.map(n => `<option>${n}</option>`).join("")}</select></div>
      </div>
      <div class="err" id="tvErr"></div>
      <div class="row" style="justify-content:flex-start"><button class="b pri" id="tvAdd">Thêm và chia sẻ thư mục</button></div>
      <details style="margin:8px 0 0"><summary>Dán nhiều người một lần (từ Excel)</summary>
        <div class="meta" style="margin-top:6px">Mỗi dòng một người, các cột cách nhau bằng dấu | hoặc Tab (dán thẳng từ Excel): Email | Họ và tên | Vai (thanhvien, thuky, xem) | Nhóm | Chức vụ, đơn vị</div>
        <textarea id="tvBulk" rows="5"></textarea>
        <div class="row" style="justify-content:flex-start"><button class="b" id="tvBulkAdd">Thêm danh sách</button></div></details></div>
    <table><thead><tr><th>Email</th><th>Họ và tên</th><th>Chức vụ, đơn vị</th><th>Vai</th><th>Nhóm</th><th>Tình trạng</th><th style="width:170px"></th></tr></thead><tbody>`;
  S.tvList.forEach(t => {
    h += `<tr><td>${esc(t.email)}</td><td>${esc(t.ten)}</td><td>${esc(t.chucVu)}</td><td>${esc(VAI[t.vai] || t.vai)}</td><td>${esc(t.nhom)}</td><td>${t.khoa ? '<span class="no">Đã khóa</span>' : '<span class="ok">Đang dùng</span>'}</td>
      <td><div class="act"><button class="b" data-tv="vai" data-em="${esc(t.email)}">Sửa</button><button class="b ${t.khoa ? "" : "red"}" data-tv="khoa" data-em="${esc(t.email)}">${t.khoa ? "Mở khóa" : "Khóa"}</button></div></td></tr>`;
  });
  m.innerHTML = h + "</tbody></table></section>";
  const box = document.getElementById("tvErr");
  const okEm = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || "");
  const addRows = async (rows, btn) => {
    btn.disabled = true; box.textContent = "";
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]; busy(`Đang thêm ${i + 1}/${rows.length}: ${r.email}`);
        await db.collection("kd_tv").doc(r.email).set({ ten: r.ten, chucVu: r.chucVu, vai: r.vai, nhom: r.nhom, khoa: false, tg: now(), boi: em() });
        await shareUser(r.email, r.vai === "xem" ? "reader" : "writer");
        await log("Thêm thành viên", r.email, r.vai);
      }
      busy(); renderMain();
    } catch (e) { busy(); btn.disabled = false; box.textContent = errMsg(e); }
  };
  document.getElementById("tvAdd").onclick = () => {
    const r = { email: val(m, "tvEm").toLowerCase(), ten: val(m, "tvTen"), chucVu: val(m, "tvCv"), vai: val(m, "tvVai"), nhom: val(m, "tvNhom") };
    if (!okEm(r.email)) { box.textContent = "Email chưa đúng."; return; }
    if (!r.ten) { box.textContent = "Nhập họ và tên."; return; }
    if (S.tvList.some(t => t.email === r.email)) { box.textContent = r.email + " đã có trong danh sách — dùng nút Sửa ở dòng đó."; return; }
    addRows([r], document.getElementById("tvAdd"));
  };
  document.getElementById("tvBulkAdd").onclick = () => {
    const rows = [], bad = [];
    document.getElementById("tvBulk").value.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => {
      const [e, ten, vai, nhom, cv] = l.split(/\||\t/).map(x => (x || "").trim());
      const v = (vai || "thanhvien").toLowerCase();
      if (!okEm(e) || !VAI[v]) bad.push(l); else rows.push({ email: e.toLowerCase(), ten: ten || e, vai: v, nhom: nhom || "", chucVu: cv || "" });
    });
    if (bad.length) { box.textContent = "Dòng chưa đúng mẫu: " + bad.join(" ; "); return; }
    if (!rows.length) { box.textContent = "Chưa nhập người nào."; return; }
    addRows(rows, document.getElementById("tvBulkAdd"));
  };
  m.querySelectorAll("[data-tv]").forEach(b => b.onclick = () => {
    const t = S.tvList.find(x => x.email === b.dataset.em);
    if (b.dataset.tv === "vai") {
      modal("Sửa thông tin thành viên", t.email, `<label>Họ và tên</label><input type="text" id="fT" value="${esc(t.ten)}">
        <label>Chức vụ, đơn vị</label><input type="text" id="fC" value="${esc(t.chucVu)}">
        <label>Vai</label><select id="fV">${Object.keys(VAI).map(k => `<option value="${k}"${k === t.vai ? " selected" : ""}>${VAI[k]}</option>`).join("")}</select>
        <label>Nhóm công tác</label><select id="fN"><option value=""></option>${NHOM.map(n => `<option${n === t.nhom ? " selected" : ""}>${n}</option>`).join("")}</select>`, async w => {
        const v = val(w, "fV"), ten = val(w, "fT"); if (!ten) throw new Error("Nhập họ và tên.");
        await db.collection("kd_tv").doc(t.email).update({ ten, chucVu: val(w, "fC"), vai: v, nhom: val(w, "fN") });
        if (!t.khoa && v !== t.vai) await shareUser(t.email, v === "xem" ? "reader" : "writer");
        await log("Sửa thành viên", t.email, v); return true;
      });
    } else {
      modal(t.khoa ? "Mở khóa tài khoản?" : "Khóa tài khoản?", t.email + (t.khoa ? " – chia sẻ lại thư mục Drive." : " – gỡ quyền thư mục Drive; tệp đã tải lên vẫn giữ."), "", async () => {
        await db.collection("kd_tv").doc(t.email).update({ khoa: !t.khoa });
        if (t.khoa) await shareUser(t.email, t.vai === "xem" ? "reader" : "writer"); else await unshareUser(t.email);
        await log(t.khoa ? "Mở khóa" : "Khóa", t.email, ""); return true;
      }, t.khoa ? "Mở khóa" : "Khóa");
    }
  });
}

/* ---------- Google Drive ---------- */
function gisToken(prompt) {
  return new Promise((res, rej) => {
    if (!(window.google && google.accounts && google.accounts.oauth2)) return rej(new Error("gis"));
    const c = google.accounts.oauth2.initTokenClient({
      client_id: C.CLIENT_ID, scope: DRIVE_SCOPE, prompt, login_hint: em(), hint: em(),
      callback: r => r && r.access_token ? res(r) : rej(new Error((r && r.error) || "token")),
      error_callback: e => rej(new Error((e && e.type) || "popup"))
    });
    c.requestAccessToken({ prompt, login_hint: em(), hint: em() });
  });
}
async function ensureDrive(force) {
  if (!force && S.tok && Date.now() < S.tokExp) return S.tok;
  for (const pr of ["", "select_account"]) {
    try {
      const r = await gisToken(pr);
      const who = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers: { Authorization: "Bearer " + r.access_token } }).then(x => x.json()).catch(() => ({}));
      const wEm = (who.user && who.user.emailAddress || "").toLowerCase();
      if (wEm && wEm !== em()) { if (pr) throw new Error(`Đã chọn tài khoản Google ${wEm}, khác tài khoản đăng nhập ${em()}. Bấm lại và chọn đúng ${em()}.`); continue; }
      saveTok(r.access_token, r.expires_in); return S.tok;
    } catch (e) { if (pr && !/^(gis|token|popup)/.test(e.message)) throw e; }
  }
  // dự phòng: đăng nhập lại qua Firebase để lấy quyền Drive
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
async function ganTep(r, file) {
  const t = tcOf(r.tieuChi), meta = await upMeta(file, t.folderId, r.ma || r.id);
  busy("Đang ghi danh mục…");
  await db.collection("kd_mc").doc(r.id).update(Object.assign(meta, { trangThai: TT.CHO }));
  await log("Tải tệp", r.id, r.ma + " – " + file.name);
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
const fileField = note => `<label>Tệp (PDF, Word, Excel, ảnh… tối đa ${C.MAX_MB} MB)</label><input type="file" id="fFile">${note ? `<div class="meta" style="margin-top:4px">${note}</div>` : ""}`;
const fileOf = w => { const i = w.querySelector("#fFile"); return i && i.files && i.files[0] || null; };
const val = (w, id) => { const e = w.querySelector("#" + id); return e ? e.value.trim() : ""; };

function bindActions(root) {
  root.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const a = b.dataset.a, id = b.dataset.id;
    const r = id ? (findMc(id) || findCc(id)) : null;
    if (a === "gan") modal("Tải tệp cho minh chứng " + r.ma, r.ten, fileField("Minh chứng gồm nhiều văn bản (nhiều quyết định, nhiều năm…)? Dùng nút “+ Văn bản” để tải từng văn bản kèm số, ngày ban hành."), async w => {
      const f = fileOf(w); if (!f) throw new Error("Chưa chọn tệp."); await ganTep(r, f);
    }, "Tải lên");
    else if (a === "them") modal("Thêm văn bản cho minh chứng " + r.ma, r.ten,
      `<label>Tên văn bản *</label><input type="text" id="fTen" placeholder="VD: Quyết định ban hành CTĐT năm 2023">
       <label>Số, ngày ban hành / thời điểm khảo sát</label><input type="text" id="fSo" placeholder="VD: 4364/QĐ-HCQG, 18/9/2023">
       <label>Nơi ban hành</label><input type="text" id="fNoi" placeholder="VD: Học viện Hành chính và Quản trị công">
       ${fileField()}<label>hoặc dán đường link (website, Drive)</label><input type="text" id="fLink" placeholder="https://…">`, async w => {
      await themVanBan(r, { ten: val(w, "fTen"), soNgay: val(w, "fSo"), noi: val(w, "fNoi"), link: val(w, "fLink") }, fileOf(w));
    }, "Lưu văn bản");
    else if (a === "sua") modal("Sửa thông tin", r.ma || "Văn bản thành phần",
      `<label>Tên minh chứng / văn bản *</label><textarea id="fTen" rows="3">${esc(r.ten)}</textarea>
       <label>Số, ngày ban hành / thời điểm khảo sát</label><input type="text" id="fSo" value="${esc(r.soNgay)}">
       <label>Nơi ban hành</label><input type="text" id="fNoi" value="${esc(r.noi)}">
       <label>Dùng chung với tiêu chí</label><input type="text" id="fDc" value="${esc(r.dungChung)}" placeholder="VD: 2.2; 4.5">`, async w => {
      const ten = val(w, "fTen"); if (!ten) throw new Error("Tên không được để trống.");
      await db.collection("kd_mc").doc(r.id).update({ ten: ten.slice(0, 400), soNgay: val(w, "fSo").slice(0, 200), noi: val(w, "fNoi").slice(0, 200), dungChung: val(w, "fDc").slice(0, 100) });
      await log("Sửa thông tin", r.id, ten);
    });
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
    else if (a === "cc") modal("Tải bản chính thức", r.so + " – " + r.ten, fileField("Ưu tiên bản PDF có dấu tải từ Cổng thông tin điện tử Chính phủ / Bộ GDĐT."), async w => {
      const f = fileOf(w); if (!f) throw new Error("Chưa chọn tệp.");
      const meta = await upMeta(f, S.cfg.ccFolderId, r.id); busy("Đang ghi danh mục…");
      await db.collection("kd_cc").doc(r.id).update(meta); await log("Tải văn bản căn cứ", r.id, f.name);
    }, "Tải lên");
    else if (a === "gocc") modal("Gỡ tệp bản chính thức?", r.ten, "", async () => {
      await db.collection("kd_cc").doc(r.id).update({ link: "", fileId: "", nguoi: "", email: "", tg: "" }); await log("Gỡ tệp căn cứ", r.id, "");
    }, "Gỡ");
    else if (a === "newmc") modal("Thêm minh chứng cho tiêu chí " + S.tcSel, "Mã minh chứng sinh tự động theo thứ tự tiếp theo.", `<label>Tên minh chứng *</label><textarea id="fTen" rows="3"></textarea>`, async w => {
      const ten = val(w, "fTen"); if (!ten) throw new Error("Nhập tên minh chứng.");
      const list = mcOf(S.tcSel), [t, c] = S.tcSel.split(".").map(Number), pad = n => String(n).padStart(2, "0");
      const last = list[list.length - 1], prefix = last ? String(last.ma).replace(/\d+$/, "") : `H${t}.${pad(t)}.${pad(c)}.`;
      const ma = prefix + pad((last ? efOf(last) : 0) + 1);
      await db.collection("kd_mc").add({ tieuChi: S.tcSel, loai: "MC", ma, ten: ten.slice(0, 400), soNgay: "", noi: "", dungChung: "", link: "", fileId: "", nguoi: "", email: "", tg: "",
        trangThai: TT.CHUA, ghiChu: "", cha: "", taoLuc: Date.now() });
      await log("Thêm minh chứng", ma, ten);
    });
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
