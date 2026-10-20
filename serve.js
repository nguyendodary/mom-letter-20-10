'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;
const INDEX_PATH = path.join(ROOT, 'index.html');
const ASSETS_DIR = path.join(ROOT, 'assets');

const MIME = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8'
};

if (!fs.existsSync(INDEX_PATH)) {
  console.error('Không tìm thấy index.html trong thư mục dự án.');
  process.exit(1);
}

// Rebuild the compressed copy whenever the source file changes, so editing
// index.html and refreshing the browser is enough while preparing the gift.
let pageCache = { key: '', raw: null, gzip: null, etag: '' };

function loadPage() {
  const stat = fs.statSync(INDEX_PATH);
  const key = `${stat.mtimeMs}:${stat.size}`;
  if (pageCache.key === key) return pageCache;

  const raw = fs.readFileSync(INDEX_PATH);
  const gzip = zlib.gzipSync(raw, { level: 9 });
  pageCache = {
    key,
    raw,
    gzip,
    etag: `"mom-letter-${raw.length}-${gzip.length}-${Math.floor(stat.mtimeMs)}"`
  };
  return pageCache;
}

const documentHeaders = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
    "img-src data:",
    "font-src data:",
    "media-src 'self'",
    "connect-src 'self'",
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

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(text);
}

function servePage(req, res) {
  let page;
  try {
    page = loadPage();
  } catch (error) {
    console.error('Không đọc được index.html:', error.message);
    sendText(res, 500, 'Trang đang tạm thời không khả dụng.');
    return;
  }

  if (req.headers['if-none-match'] === page.etag) {
    res.writeHead(304, { ETag: page.etag, 'Cache-Control': 'no-cache' });
    res.end();
    return;
  }

  const acceptsGzip = /\bgzip\b/i.test(req.headers['accept-encoding'] || '');
  const payload = acceptsGzip ? page.gzip : page.raw;

  res.writeHead(200, {
    ...documentHeaders,
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
}

function serveAsset(req, res, relativePath) {
  const target = path.resolve(ASSETS_DIR, relativePath);
  // Chặn truy cập ra ngoài thư mục assets.
  if (!target.startsWith(ASSETS_DIR + path.sep)) {
    sendText(res, 403, 'Không được phép.');
    return;
  }

  let stat;
  try {
    stat = fs.statSync(target);
  } catch (error) {
    sendText(res, 404, 'Không tìm thấy tài nguyên.');
    return;
  }
  if (!stat.isFile()) {
    sendText(res, 404, 'Không tìm thấy tài nguyên.');
    return;
  }

  const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
  const etag = `"asset-${stat.size}-${Math.floor(stat.mtimeMs)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=86400' });
    res.end();
    return;
  }

  const baseHeaders = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    ETag: etag
  };

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (match) {
      let start = match[1] === '' ? null : Number(match[1]);
      let end = match[2] === '' ? null : Number(match[2]);

      if (start === null && end !== null) {
        start = Math.max(0, stat.size - end);
        end = stat.size - 1;
      } else {
        if (start === null) start = 0;
        if (end === null || end >= stat.size) end = stat.size - 1;
      }

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(target, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer((req, res) => {
  let pathname = '/';
  try {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (error) {
    sendText(res, 400, 'Yêu cầu không hợp lệ.');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end('Phương thức không được hỗ trợ.');
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    servePage(req, res);
    return;
  }

  if (pathname.startsWith('/assets/')) {
    serveAsset(req, res, pathname.slice('/assets/'.length));
    return;
  }

  sendText(res, 404, 'Không tìm thấy trang.');
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
