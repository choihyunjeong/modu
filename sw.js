// 웹앱(PWA) 서비스 워커
//  항상 최신 화면을 먼저 받아 옴(네트워크 우선) · 받은 건 저장해 두었다가 인터넷이 끊기면 그걸 보여 줌
//  저장된 것도 없으면 "인터넷 연결을 확인해 주세요" 화면(offline.html)
var CACHE = 'modu-v1';
var PRECACHE = ['offline.html', 'image/app-logo.svg', 'image/icon-192.png', 'css/common.css'];

self.addEventListener('install', function (e) {
    e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }));
    self.skipWaiting();
});

self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }));
    self.clients.claim();
});

self.addEventListener('fetch', function (e) {
    var req = e.request;
    // 이 사이트의 GET 요청만 (카카오 지도·길찾기 등 바깥 요청은 그대로)
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    // 화면(HTML)은 브라우저가 잠시 저장해 둔 옛 화면을 쓰지 않고 늘 새로 확인 (고친 화면이 바로 보이게)
    var fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req);
    e.respondWith(fresh.then(function (res) {
        if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
    }).catch(function () {
        return caches.match(req).then(function (hit) {
            if (hit) return hit;
            if (req.mode === 'navigate') return caches.match('offline.html');
            return new Response('', { status: 504 });
        });
    }));
});
