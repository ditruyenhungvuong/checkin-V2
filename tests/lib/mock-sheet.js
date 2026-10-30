/* =========================================================
   Mock Google Apps Script cho test (chạy trong tiến trình test, chỉ nghe 127.0.0.1).
   - POST bất kỳ đường dẫn → ghi dòng vào bộ nhớ (cùng sessionId thì cập nhật dòng cũ như Apps Script thật),
     trả {"result":"success","action":"inserted"|"updated"} kèm CORS *
     (Apps Script thật cũng trả Access-Control-Allow-Origin: *).
   - state.mode: 'ok' | '500json' (500 + JSON lỗi) | '500text' (500 + HTML) | 'hang' (không trả lời)
                 | 'reject' (200 + {"result":"error","error":"phone_invalid"} như Apps Script mới từ chối dữ liệu).
   - Không ghi file nào ra đĩa.
   ========================================================= */
'use strict';
const http = require('http');

function startMock(port) {
  const state = { mode: 'ok', rows: [], requests: [], hung: [] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      state.requests.push({ t: Date.now(), method: req.method, url: req.url, contentType: req.headers['content-type'] || '', body });
      const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
      if (req.method === 'OPTIONS') {
        res.writeHead(204, Object.assign({}, cors, { 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' }));
        return res.end();
      }
      if (state.mode === 'hang') { state.hung.push(res); return; }
      if (state.mode === '500json') {
        res.writeHead(500, cors);
        return res.end(JSON.stringify({ result: 'error', error: 'giả lập máy chủ lỗi' }));
      }
      if (state.mode === '500text') {
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/html' });
        return res.end('<html><body>Internal Server Error</body></html>');
      }
      if (state.mode === 'reject' && req.method === 'POST') {
        res.writeHead(200, cors);
        return res.end(JSON.stringify({ result: 'error', error: 'phone_invalid' }));
      }
      if (req.method === 'POST') {
        let data;
        try { data = JSON.parse(body); } catch (e) { data = { __parseError: true, raw: body }; }
        /* Như Apps Script thật: cùng sessionId thì cập nhật dòng cũ (state.rows = các dòng trong Sheet) */
        const idx = data && data.sessionId ? state.rows.findIndex(r => r.sessionId === data.sessionId) : -1;
        res.writeHead(200, cors);
        if (idx >= 0) { state.rows[idx] = data; return res.end(JSON.stringify({ result: 'success', action: 'updated' })); }
        state.rows.push(data);
        return res.end(JSON.stringify({ result: 'success', action: 'inserted' }));
      }
      res.writeHead(200, cors);
      res.end(JSON.stringify({ result: 'success', count: state.rows.length, data: state.rows }));
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({
      url: 'http://127.0.0.1:' + port + '/exec',
      state,
      posts: () => state.requests.filter(r => r.method === 'POST'),
      reset: () => { state.rows.length = 0; state.requests.length = 0; state.mode = 'ok'; },
      close: () => new Promise(r => {
        state.hung.forEach(h => { try { h.socket.destroy(); } catch (e) { /* đã đóng */ } });
        server.closeAllConnections && server.closeAllConnections();
        server.close(() => r());
      })
    }));
  });
}

module.exports = { startMock };
