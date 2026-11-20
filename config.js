// Cấu hình công khai — không chứa mật khẩu. Quyền đọc/ghi do khối quy tắc KDTHS (firebase/kd.rules) quyết định.
window.KD_CONFIG = {
  FIREBASE: {
    apiKey: "AIzaSyCIYY-dzhJ4rUYsXvBQivIxcziUC3hR1-U",
    authDomain: "phuc-nguyen-library.firebaseapp.com",
    projectId: "phuc-nguyen-library",
    storageBucket: "phuc-nguyen-library.firebasestorage.app",
    messagingSenderId: "842652271567",
    appId: "1:842652271567:web:23b95b5c4d6061497988ba"
  },
  // OAuth client web của dự án (dùng chung với PND) — gia hạn quyền Drive ngầm
  CLIENT_ID: "842652271567-7d5orqj763rlrsiu2kq4ne0170fp9dsr.apps.googleusercontent.com",
  // Quản trị hệ sinh thái PN (trùng hàm isAdmin() của quy tắc chung)
  ADMIN_UID: "smoIpuX7qseqTeu9nToc9RYigku1",
  ADMIN_EMAILS: ["luuhuong.dhnv@gmail.com", "luuhuong.nnpl@gmail.com"],
  // Phiên bản khối quy tắc — phải trùng số trong firebase/kd.rules
  RULES_V: "20261120d",
  TEN_THU_MUC: "MINH CHUNG - TDG CTDT ThS LHP&LHC",
  MAX_MB: 50
};
