/**
 * Реверсный прокси для веб-превью.
 *
 * Почему нужен: в веб-режиме клиент делает relative URL (baseURL = ''),
 * чтобы запросы шли на тот же origin. Но сам dev-сервер (Metro) не
 * перенаправляет API-запросы, и они попадали на Metro, который отдавал
 * index.html — экран показывал «Сервер не отвечает» / «Не удалось
 * загрузить практику». Metro 0.83 уже не поддерживает server.middleware,
 * поэтому прокси делается отдельным процессом: слушает 4180, API-префиксы
 * прокидывает на backend (8000), всё остальное — на Metro (8081).
 */

const http = require('http');

const PROXY_PORT = parseInt(process.env.PROXY_PORT || '4180', 10);
const API_HOST = process.env.EXPO_PUBLIC_API_HOST || '127.0.0.1';
const API_PORT = parseInt(process.env.EXPO_PUBLIC_API_PORT || '8000', 10);
const METRO_HOST = process.env.METRO_HOST || '127.0.0.1';
const METRO_PORT = parseInt(process.env.METRO_PORT || '8081', 10);

const API_PREFIXES = [
  '/auth',
  '/adaptive',
  '/admin',
  '/analytics',
  '/gamification',
  '/mascot',
  '/notifications',
  '/payments',
  '/user',
];

function proxyTo(host, port, req, res) {
  const target = http.request(
    {
      host,
      port,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (targetRes) => {
      res.writeHead(targetRes.statusCode, targetRes.headers);
      targetRes.pipe(res);
    },
  );

  target.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          detail: 'Сервер недоступен: ' + err.message,
        }),
      );
    }
  });

  req.pipe(target);
}

const server = http.createServer((req, res) => {
  const url = req.url || '';
  const isApi = API_PREFIXES.some(
    (prefix) => url === prefix || url.startsWith(prefix + '/'),
  );
  if (isApi) {
    proxyTo(API_HOST, API_PORT, req, res);
  } else {
    proxyTo(METRO_HOST, METRO_PORT, req, res);
  }
});

// WebSocket (HMR Metro) тоже прокидываем на Metro.
server.on('upgrade', (req, socket, _head) => {
  const url = req.url || '';
  const target = http.request({
    host: METRO_HOST,
    port: METRO_PORT,
    method: req.method,
    path: url,
    headers: req.headers,
  });
  target.on('upgrade', (targetRes, targetSocket, _targetHead) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        Object.entries(targetRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        '\r\n\r\n',
    );
    targetSocket.pipe(socket);
    socket.pipe(targetSocket);
  });
  target.on('error', () => socket.destroy());
  target.end();
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(
    `[web-proxy] слушает 0.0.0.0:${PROXY_PORT}: API → ${API_HOST}:${API_PORT}, остальное → ${METRO_HOST}:${METRO_PORT}`,
  );
});
