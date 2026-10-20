'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8000);
const INDEX_PATH = path.join(__dirname, 'index.html');

if (!fs.existsSync(INDEX_PATH)) {
  console.error('Không tìm thấy index.html trong thư mục dự án.');
  process.exit(1);
}

// Rebuild the compressed copy whenever the source file changes, so editing
// index.html and refreshing the browser is enough while preparing the gift.
let cache = { key: '', raw: null, gzip: null, etag: '' };

function loadPage() {
  const stat = fs.statSync(INDEX_PATH);
  const key = `${stat.mtimeMs}:${stat.size}`;
  if (cache.key === key) return cache;

  const raw = fs.readFileSync(INDEX_PATH);
  const gzip = zlib.gzipSync(raw, { level: 9 });
  cache = {
    key,
    raw,
    gzip,
    etag: `"mom-letter-${raw.length}-${gzip.length}-${Math.floor(stat.mtimeMs)}"`
  };
  return cache;
}

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
    "img-src data:",
    "font-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      ...securityHeaders,
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8'
    });
    res.end('Phương thức không được hỗ trợ.');
    return;
  }

  if (pathname !== '/' && pathname !== '/index.html') {
    res.writeHead(404, {
      ...securityHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end('Không tìm thấy trang.');
    return;
  }

  let page;
  try {
    page = loadPage();
  } catch (error) {
    console.error('Không đọc được index.html:', error.message);
    res.writeHead(500, {
      ...securityHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end('Trang đang tạm thời không khả dụng.');
    return;
  }

  if (req.headers['if-none-match'] === page.etag) {
    res.writeHead(304, {
      ETag: page.etag,
      'Cache-Control': 'no-cache'
    });
    res.end();
    return;
  }

  const acceptsGzip = /\bgzip\b/i.test(req.headers['accept-encoding'] || '');
  const payload = acceptsGzip ? page.gzip : page.raw;

  res.writeHead(200, {
    ...securityHeaders,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': payload.length,
    'Content-Encoding': acceptsGzip ? 'gzip' : 'identity',
    'Cache-Control': 'no-cache',
    'Vary': 'Accept-Encoding',
    ETag: page.etag
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(payload);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Cổng ${PORT} đang được sử dụng. Hãy đặt biến môi trường PORT sang cổng khác.`);
  } else {
    console.error('Lỗi máy chủ:', error.message);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Lá thư đang chạy tại http://localhost:${PORT}`);
  console.log(`Máy chủ chỉ lắng nghe tại ${HOST}:${PORT}. Nhấn Ctrl+C để dừng.`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
