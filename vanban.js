"use strict";
/* Đọc văn bản tải lên (PDF có lớp chữ, Word .docx) và trích thông tin hành chính:
   số hiệu, ngày ban hành, cơ quan ban hành, loại văn bản, trích yếu. Chạy hoàn toàn trên trình duyệt. */
(function (root) {
  const VB = {};
  const LIB = {
    pdf: "vendor/pdf.min.js", worker: "vendor/pdf.worker.min.js", mammoth: "vendor/mammoth.browser.min.js"
  };
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((ok, fail) => {
      const s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = ok; s.onerror = () => { delete loaded[src]; fail(new Error("Không tải được thư viện đọc văn bản.")); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  /* Gom các mẩu chữ của pdf.js thành dòng; tách cột khi khoảng trống ngang lớn (đầu văn bản 2 cột) */
  VB.pdfLines = function (items, pageWidth) {
    const rows = [];
    items.filter(it => it.str && it.str.trim()).forEach(it => {
      const x = it.transform[4], y = it.transform[5], w = it.width || 0;
      let r = rows.find(z => Math.abs(z.y - y) < 3);
      if (!r) { r = { y, its: [] }; rows.push(r); }
      r.its.push({ x, w, s: it.str });
    });
    rows.sort((a, b) => b.y - a.y);
    const out = [], gap = Math.max(30, (pageWidth || 600) * 0.06);
    rows.forEach(r => {
      r.its.sort((a, b) => a.x - b.x);
      let cur = null;
      r.its.forEach(it => {
        if (cur && it.x - (cur.end) <= gap) { cur.t += (it.x - cur.end > 1.5 && !/\s$/.test(cur.t) && !/^\s/.test(it.s) ? " " : "") + it.s; cur.end = it.x + it.w; }
        else { cur = { t: it.s, x: it.x, end: it.x + it.w, y: r.y }; out.push(cur); }
      });
    });
    return out.map(l => ({ t: l.t.replace(/\s+/g, " ").trim(), x: l.x, mid: pageWidth ? l.x < pageWidth * 0.45 : true })).filter(l => l.t);
  };

  VB.readFile = async function (file) {
    const name = file.name || "", ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf" || file.type === "application/pdf") {
      if (!root.pdfjsLib) await loadScript(LIB.pdf);
      root.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.worker;
      const doc = await root.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let lines = [];
      for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
        const page = await doc.getPage(p), vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        lines = lines.concat(VB.pdfLines(tc.items, vp.width).map(l => Object.assign(l, { page: p })));
      }
      return { lines, quet: lines.length < 3 };
    }
    if (ext === "docx") {
      if (!root.mammoth) await loadScript(LIB.mammoth);
      const r = await root.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const txt = String(r.value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|h\d|li|td|tr|th)>/gi, "\n").replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return { lines: txt.split(/\n+/).map(t => ({ t: t.replace(/\s+/g, " ").trim(), mid: true })).filter(l => l.t).slice(0, 400), quet: false };
    }
    return { lines: [], quet: false, khongDoc: true };
  };

  const MOTTO = /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM|CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM|Độc lập\s*[-–]\s*Tự do\s*[-–]\s*Hạnh phúc|ĐẢNG CỘNG SẢN VIỆT NAM/gi;
  const SOHIEU = /^[-\d\s]*[A-ZĐ]{1,8}[\/-][A-ZĐ0-9]/;
  const laSo = t => /^Số(\s|:|\.|$)/.test(t);
  const AGENCY = /^(HỌC VIỆN|BỘ(?![A-Za-zÀ-ỹĐđ])|TRƯỜNG|KHOA(?![A-Za-zÀ-ỹĐđ])|BAN(?![A-Za-zÀ-ỹĐđ])|VIỆN(?![A-Za-zÀ-ỹĐđ])|ỦY BAN|UỶ BAN|UBND|CHÍNH PHỦ|QUỐC HỘI|TRUNG TÂM|PHÂN HIỆU|PHÒNG(?![A-Za-zÀ-ỹĐđ])|HỘI ĐỒNG|CỤC(?![A-Za-zÀ-ỹĐđ])|ĐẢNG ỦY|ĐẢNG UỶ|ĐOÀN(?![A-Za-zÀ-ỹĐđ])|CÔNG ĐOÀN|THỦ TƯỚNG|VĂN PHÒNG|SỞ(?![A-Za-zÀ-ỹĐđ])|TỔNG CỤC|ĐẠI HỌC|CHI BỘ)/;
  const LOAI = /^(QUYẾT ĐỊNH|KẾ HOẠCH|THÔNG TƯ LIÊN TỊCH|THÔNG TƯ|NGHỊ ĐỊNH|NGHỊ QUYẾT|LUẬT|BÁO CÁO|TỜ TRÌNH|THÔNG BÁO|BIÊN BẢN|CHƯƠNG TRÌNH|ĐỀ ÁN|HƯỚNG DẪN|QUY ĐỊNH|QUY CHẾ|CÔNG VĂN|GIẤY MỜI|DANH SÁCH|KẾT LUẬN|CHỈ THỊ|QUY TRÌNH|BẢN MÔ TẢ|ĐỀ CƯƠNG)(?![A-Za-zÀ-ỹĐđ])/;
  const TEN_CQ = {
    "HỌC VIỆN HÀNH CHÍNH VÀ QUẢN TRỊ CÔNG": "Học viện Hành chính và Quản trị công",
    "HỌC VIỆN HÀNH CHÍNH QUỐC GIA": "Học viện Hành chính Quốc gia",
    "HỌC VIỆN CHÍNH TRỊ QUỐC GIA HỒ CHÍ MINH": "Học viện Chính trị quốc gia Hồ Chí Minh",
    "BỘ GIÁO DỤC VÀ ĐÀO TẠO": "Bộ Giáo dục và Đào tạo", "BỘ NỘI VỤ": "Bộ Nội vụ", "BỘ TƯ PHÁP": "Bộ Tư pháp",
    "THỦ TƯỚNG CHÍNH PHỦ": "Thủ tướng Chính phủ", "CHÍNH PHỦ": "Chính phủ", "QUỐC HỘI": "Quốc hội",
    "KHOA LUẬT": "Khoa Luật", "CỤC QUẢN LÝ CHẤT LƯỢNG": "Cục Quản lý chất lượng"
  };
  const isUpper = t => { const L = t.replace(/[^A-Za-zÀ-ỹĐđ]/g, ""); return L.length >= 3 && L === L.toLocaleUpperCase("vi"); };
  const cauHoa = t => { const s = t.toLocaleLowerCase("vi"); return s.charAt(0).toLocaleUpperCase("vi") + s.slice(1); };
  const tenCQ = t => TEN_CQ[t] || (/^(KHOA|BAN|PHÒNG|TRUNG TÂM|PHÂN HIỆU) /.test(t) ? cauHoa(t.split(" ")[0]) + " " + cauHoa(t.split(" ").slice(1).join(" ")) : cauHoa(t));

  VB.parse = function (lines, fileName) {
    const L = lines.map(l => (typeof l === "string" ? { t: l, mid: true } : l));
    const all = L.map(l => l.t).join("\n");
    const head = L.slice(0, 40);
    const r = { so: "", ngay: "", noi: "", loai: "", trichYeu: "", tieuDe: "", noiDung: all.slice(0, 3000) };
    // Số hiệu
    const mSo = all.match(/Số\s*[:.]?\s*((?:\d{1,6})?\s*(?:\/\s*\d{4})?\s*[-/]\s*[A-ZĐ0-9][A-ZĐ0-9.-]*(?:\/[A-ZĐ0-9.-]+)*)/u);
    if (mSo) r.so = mSo[1].replace(/\s+/g, "");
    // Ngày ban hành
    const mNg = all.match(/ngày\s*(\d{1,2})?\s*tháng\s*(\d{1,2})?\s*năm\s*(\d{4})/i);
    if (mNg) r.ngay = mNg[1] && mNg[2] ? `${mNg[1].padStart(2, "0")}/${mNg[2].padStart(2, "0")}/${mNg[3]}` : mNg[2] ? `tháng ${mNg[2]}/${mNg[3]}` : `năm ${mNg[3]}`;
    // Cơ quan ban hành: các dòng in hoa cột trái phía trên dòng "Số"
    const iSo = head.findIndex(l => laSo(l.t));
    const top = (iSo > 0 ? head.slice(0, iSo) : head.slice(0, 12)).filter(l => l.mid !== false)
      .map(l => l.t.replace(MOTTO, "").replace(/[*]+/g, "").trim()).filter(t => t && !/^[-–_.\s]+$/.test(t) && !SOHIEU.test(t) && isUpper(t));
    const groups = [];
    top.forEach(t => { if (!groups.length || AGENCY.test(t)) groups.push([t]); else groups[groups.length - 1].push(t); });
    const ag = groups.filter(g => AGENCY.test(g[0]));
    if (ag.length) r.noi = tenCQ(ag[ag.length - 1].join(" ").replace(/\s+/g, " "));
    // Loại văn bản và trích yếu
    const iLoai = L.findIndex((l, i) => i < 60 && LOAI.test(l.t) && isUpper(l.t.split(" ").slice(0, 2).join(" ")));
    if (iLoai >= 0) {
      const m = L[iLoai].t.match(LOAI); r.loai = cauHoa(m[1]);
      const rest = [L[iLoai].t.slice(m[0].length).trim()];
      for (let j = iLoai + 1; j < Math.min(L.length, iLoai + 6); j++) {
        const t = L[j].t;
        if (/^[-–_=*.\s]{3,}$|^-{2,}|^Căn cứ|^- Căn cứ|^(GIÁM ĐỐC|BỘ TRƯỞNG|THỦ TƯỚNG|CHỦ TỊCH)(?![A-Za-zÀ-ỹĐđ])|^I\.\s|^Kính gửi|^Điều 1|^[A-ZÀ-ỸĐ][^:]{1,25}:\s/.test(t)) break;
        if ((/^Giai đoạn/.test(t) || laSo(t)) && rest.join("").length > 10) break;
        rest.push(t);
      }
      let ty = rest.join(" ").replace(/\s+/g, " ").trim();
      if (isUpper(ty)) ty = cauHoa(ty);
      r.trichYeu = ty;
    }
    const vv = all.match(/V\/v[:.]?\s*([^\n]{5,200})/);
    if (!r.trichYeu && vv) { r.loai = r.loai || "Công văn"; r.trichYeu = "V/v " + vv[1].trim(); }
    const fn = String(fileName || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
    r.tieuDe = r.loai ? (r.loai + (r.trichYeu ? " " + r.trichYeu.charAt(0).toLocaleLowerCase("vi") + r.trichYeu.slice(1) : "")) : fn;
    if (!r.so) { const m2 = fn.match(/(\d{1,6}[-/][A-Za-zĐđ][\wĐđ/-]*)/u); if (m2) r.so = m2[1]; }
    r.soNgay = [r.so, r.ngay].filter(Boolean).join(", ");
    return r;
  };

  /* ---------- Rà soát tự động hình thức: chữ ký số, dấu đỏ, ảnh chữ ký cạnh khối người ký ---------- */
  const KHOI_KY = /(^|\s)(KT\.|TM\.|TL\.|TUQ\.|Q\.\s|GIÁM ĐỐC|TRƯỞNG KHOA|TRƯỞNG PHÒNG|TRƯỞNG BAN|CHỦ TỊCH|HIỆU TRƯỞNG|BỘ TRƯỞNG|THỨ TRƯỞNG|BÍ THƯ|NGƯỜI LẬP|THƯ KÝ|CHỦ NHIỆM|TRƯỞNG BỘ MÔN|XÁC NHẬN CỦA)/;
  // Đếm điểm ảnh đỏ (mực dấu) trên canvas; trả về tỉ lệ
  function tiLeDo(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data; let n = 0;
    for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 140 && r - g > 60 && r - b > 45) n++; }
    return n / (d.length / 16);
  }
  const NGUONG_DO = 0.0008;
  async function doTrang(page) {
    const vp = page.getViewport({ scale: 0.9 }), cv = document.createElement("canvas");
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return tiLeDo(ctx, cv.width, cv.height);
  }
  async function kiemTraPdf(buf, doc) {
    const kt = { loai: "pdf", soTrang: doc.numPages, chuKySo: false, dauDo: false, anhKy: false, khoiKy: false, quet: false };
    // Chữ ký số: từ điển chữ ký /ByteRange, /Type /Sig, gói PKCS#7
    const raw = new TextDecoder("latin1").decode(buf.byteLength > 30e6 ? buf.slice(buf.byteLength - 15e6) : buf);
    kt.chuKySo = /\/ByteRange\s*\[|\/Type\s*\/Sig\b|adbe\.pkcs7|ETSI\.CAdES/.test(raw);
    // Trang cần xem: 3 trang đầu (quyết định kèm phụ lục ký ở đầu) và trang cuối
    const ps = [...new Set([1, 2, 3, doc.numPages].filter(p => p >= 1 && p <= doc.numPages))];
    const OPS = root.pdfjsLib.OPS, IMG = [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat].filter(x => x != null);
    let chu = 0;
    for (const p of ps) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent(), txt = tc.items.map(i => i.str).join(" ");
      chu += txt.replace(/\s/g, "").length;
      const coKhoi = KHOI_KY.test(txt); if (coKhoi) kt.khoiKy = true;
      const ol = await page.getOperatorList();
      if (coKhoi && ol.fnArray.some(f => IMG.includes(f))) kt.anhKy = true;
      if (!kt.dauDo && (await doTrang(page)) >= NGUONG_DO) kt.dauDo = true;
    }
    kt.quet = chu < 40 * ps.length;
    if (kt.quet) kt.anhKy = false;
    return kt;
  }
  async function kiemTraAnh(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
      const k = Math.min(1, 900 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0, w, h);
      return { loai: "anh", quet: true, dauDo: tiLeDo(ctx, w, h) >= NGUONG_DO };
    } finally { URL.revokeObjectURL(url); }
  }
  VB.kiemTra = async function (file) {
    const name = file.name || "", ext = (name.split(".").pop() || "").toLowerCase(), tg = Date.now();
    try {
      if (ext === "pdf" || file.type === "application/pdf") {
        if (!root.pdfjsLib) await loadScript(LIB.pdf);
        root.pdfjsLib.GlobalWorkerOptions.workerSrc = LIB.worker;
        const buf = new Uint8Array(await file.arrayBuffer());
        const doc = await root.pdfjsLib.getDocument({ data: buf.slice() }).promise;
        return Object.assign(await kiemTraPdf(buf, doc), { tg });
      }
      if (ext === "docx" || ext === "doc") return { loai: "word", tg };
      if (/^(jpe?g|png|webp|bmp|gif)$/.test(ext) || /^image\//.test(file.type)) return Object.assign(await kiemTraAnh(file), { tg });
      return { loai: "khac", tg };
    } catch (e) { return { loai: "loi", loi: String(e.message || e).slice(0, 200), tg }; }
  };

  VB.doc = async function (file) {
    let p;
    try {
      const x = await VB.readFile(file);
      p = Object.assign(VB.parse(x.lines, file.name), { quet: x.quet, khongDoc: !!x.khongDoc });
    } catch (e) {
      p = Object.assign(VB.parse([], file.name), { loi: e.message || String(e) });
    }
    p.kt = await VB.kiemTra(file);
    return p;
  };
  root.VB = VB;
})(typeof window !== "undefined" ? window : globalThis);
