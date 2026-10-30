/* =========================================================
   Server tĩnh cho test app Check-in Cảm Xúc Mẹ Bầu. KHÔNG sửa file gốc.
   - Đọc TOÀN BỘ file app vào bộ nhớ một lần lúc khởi động (thư mục nằm trên Google Drive, đọc chậm).
   - Khi phục vụ script.js: thay ĐÚNG dòng đầu-dòng `const GOOGLE_SCRIPT_URL = '...';` bằng URL mock,
     chỉ thay trong bộ nhớ. Dòng comment số 5 cũng chứa chữ GOOGLE_SCRIPT_URL nên regex neo ^const.
   - Chốt an toàn: chuỗi phục vụ KHÔNG được chứa `script.google.com` ở BẤT KỲ đâu (kể cả comment).
     Không bỏ comment bằng regex `//.*$` vì chính regex đó sẽ xén `//script.google.com/...` trong
     chuỗi URL và làm kiểm tra qua mặt. Kiểm thô trên toàn văn là chặt hơn và an toàn hơn.
     Vi phạm → throw, không mở server, toàn bộ test dừng.
   Dùng: const { startStatic } = require('./lib/static-server');
         const srv = await startStatic({ port, appDir, mockUrl }); ... await srv.close();
   ========================================================= */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.md': 'text/markdown; charset=utf-8'
};

/* Chuẩn bị script.js an toàn trong bộ nhớ; tách hàm để test đơn vị được */
function patchScript(src, mockUrl) {
  if (typeof mockUrl !== 'string' || mockUrl.includes('script.google.com')) {
    throw new Error('mockUrl không hợp lệ: ' + mockUrl);
  }
  const line = /^const GOOGLE_SCRIPT_URL = '[^']*';[ \t]*$/m;
  const all = src.match(new RegExp(line.source, 'mg')) || [];
  if (all.length !== 1) {
    throw new Error('script.js: cần đúng 1 dòng đầu-dòng `const GOOGLE_SCRIPT_URL = \'...\';`, thấy ' + all.length);
  }
  const out = src.replace(line, 'const GOOGLE_SCRIPT_URL = ' + JSON.stringify(mockUrl) + ';');
  if (out.includes('script.google.com')) {
    throw new Error('AN TOÀN: script.js phục vụ cho test vẫn chứa script.google.com – DỪNG, không ghi vào Sheet thật');
  }
  if (!out.includes('const GOOGLE_SCRIPT_URL = ' + JSON.stringify(mockUrl) + ';')) {
    throw new Error('script.js: thay URL không thành công');
  }
  return out;
}

function startStatic(opts) {
  const appDir = path.resolve(opts.appDir);
  /* Nạp toàn bộ file app (chỉ file phẳng ở gốc, bỏ thư mục tests) vào bộ nhớ */
  const files = {};
  for (const name of fs.readdirSync(appDir)) {
    const f = path.join(appDir, name);
    if (fs.statSync(f).isFile()) files[name] = fs.readFileSync(f);
  }
  if (!files['script.js'] || !files['index.html']) throw new Error('Thiếu script.js hoặc index.html ở ' + appDir);
  const original = files['script.js'].toString('utf8');
  files['script.js'] = Buffer.from(patchScript(original, opts.mockUrl || ''), 'utf8');
  const log = [];

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const rel = (urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
    log.push(req.method + ' ' + rel);
    const data = Object.prototype.hasOwnProperty.call(files, rel) ? files[rel] : null;
    if (!data) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(opts.port, '127.0.0.1', () => resolve({
      url: 'http://127.0.0.1:' + opts.port + '/',
      servedScript: files['script.js'].toString('utf8'),
      originalHadRealUrl: /^const GOOGLE_SCRIPT_URL = 'https:\/\/script\.google\.com\//m.test(original),
      requestLog: log,
      close: () => new Promise(r => server.close(r))
    }));
  });
}

module.exports = { startStatic, patchScript };
