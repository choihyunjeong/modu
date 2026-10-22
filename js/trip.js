// 이번 호출 정보 (시연용 · 브라우저 sessionStorage)
// 목적지 검색 → 탑승 위치 → 호출 전 확인 → 진행 화면들이 같은 호출 정보를 이어서 보여줌
//
// 화면에서 쓰기: <span data-trip="dest-name">OO주민센터</span>
//  저장된 값이 있을 때만 글자를 바꾸고, 없으면 디자인 기본 문구를 그대로 둠
var Trip = (function () {
    var KEY = 'trip';
    var config = window.APP_CONFIG || {};
    var base = config.places || {};

    function load() {
        try {
            return JSON.parse(sessionStorage.getItem(KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function save(data) {
        try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }

    function set(patch) {
        save(Object.assign(load(), patch));
    }

    // 새 목적지를 고르면 이전 호출 정보는 지움 (내 위치만 유지)
    function start(destination) {
        save({ destination: destination, me: load().me });
    }

    // 지도 좌표: 저장된 값 → 없으면 config 예시 좌표
    //  car(배정 차량)·riding(이동 중)은 탑승 위치·목적지 기준으로 계산
    function places() {
        var trip = load();
        var pickup = trip.pickupPos || base.pickup;
        var destination = trip.destination || base.destination;
        return {
            me: trip.me || base.me,
            pickup: pickup,
            destination: destination,
            car: {
                lat: pickup.lat + (base.car.lat - base.pickup.lat),
                lng: pickup.lng + (base.car.lng - base.pickup.lng)
            },
            riding: {
                lat: pickup.lat + (destination.lat - pickup.lat) * 0.4,
                lng: pickup.lng + (destination.lng - pickup.lng) * 0.4
            }
        };
    }

    // 도로 경로 (OSRM 무료 길찾기 서버 · 키 없음 · 시연용)
    //  받은 경로는 출발·도착 좌표별로 sessionStorage에 저장해 다시 부르지 않음
    //  route = { path: [[lat, lng], ...], km, min }
    var ROUTES_KEY = 'routes';

    function routeKey(from, to) {
        return [from.lat, from.lng, to.lat, to.lng].map(function (n) { return n.toFixed(5); }).join(',');
    }

    function savedRoutes() {
        try {
            return JSON.parse(sessionStorage.getItem(ROUTES_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function cachedRoute(from, to) {
        return savedRoutes()[routeKey(from, to)] || null;
    }

    // 경로를 받아 callback(route) · 실패하면 callback(null) (그때는 직선으로 보여줌)
    function fetchRoute(from, to, callback) {
        var hit = cachedRoute(from, to);
        if (hit) return callback(hit);
        var url = 'https://router.project-osrm.org/route/v1/driving/' +
            from.lng + ',' + from.lat + ';' + to.lng + ',' + to.lat + '?overview=full&geometries=geojson';
        fetch(url).then(function (res) { return res.json(); }).then(function (data) {
            var best = data.routes && data.routes[0];
            if (!best) return callback(null);
            var route = {
                path: best.geometry.coordinates.map(function (c) { return [+c[1].toFixed(5), +c[0].toFixed(5)]; }),
                km: best.distance / 1000,
                // 길찾기 시간은 막힘 없는 기준이라 × 1.4 (drive) · 이동 시간은 + 승하차 3분 (min)
                drive: Math.max(1, Math.round(best.duration / 60 * 1.4)),
                min: Math.max(5, Math.round(best.duration / 60 * 1.4 + 3))
            };
            var all = savedRoutes();
            all[routeKey(from, to)] = route;
            try { sessionStorage.setItem(ROUTES_KEY, JSON.stringify(all)); } catch (e) {}
            callback(route);
        }).catch(function () { callback(null); });
    }

    // 이번 호출(탑승 위치 → 목적지) 경로 · 받으면 화면 글자(시간·거리)도 다시 채움
    function route() {
        var p = places();
        return cachedRoute(p.pickup, p.destination);
    }

    function ensureRoute(callback) {
        var p = places();
        fetchRoute(p.pickup, p.destination, function (r) {
            if (r) bind(document);
            if (callback) callback(r);
        });
    }

    // 배정된 차 → 탑승 위치 도로 경로 (차가 오는 길 · 도착까지 남은 시간)
    function approachRoute(callback) {
        var p = places();
        fetchRoute(p.car, p.pickup, callback);
    }

    // 차가 오는 데 걸리는 분 (예전에 저장된 경로는 drive가 없어서 min - 3)
    function driveMinutes(r) {
        return r.drive || Math.max(1, r.min - 3);
    }

    // <span data-eta="title">: 도착까지 남은 시간 글자
    //  data-eta-at="0.6" 이면 차가 길의 60% 왔을 때 기준 (알림 미리보기처럼 고정된 시점)
    //  없으면 지도에서 차가 움직이는 대로 ratio를 받아 바뀜
    var ETA_TEXTS = {
        title: '약 {n}분 후 도착 예정',
        chip: '약 {n}분',
        push: '약 {n}분 후 도착 예정이에요.',
        soon: 'UD택시가 약 {n}분 후 도착해요'
    };

    function fillEta(root, drive, ratio) {
        root.querySelectorAll('[data-eta]').forEach(function (el) {
            var at = el.dataset.etaAt != null ? Number(el.dataset.etaAt) : ratio;
            if (at == null || !ETA_TEXTS[el.dataset.eta]) return;
            var text = ETA_TEXTS[el.dataset.eta].replace('{n}', Math.max(1, Math.ceil(drive * (1 - at))));
            if (el.textContent !== text) el.textContent = text;
        });
    }

    // 도로 경로가 있으면 그 거리, 없으면 직선거리 × 1.3
    function rideKm() {
        if (route()) return route().km;
        var p = places();
        var rad = Math.PI / 180;
        var dLat = (p.destination.lat - p.pickup.lat) * rad;
        var dLng = (p.destination.lng - p.pickup.lng) * rad;
        var a = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(p.pickup.lat * rad) * Math.cos(p.destination.lat * rad) * Math.pow(Math.sin(dLng / 2), 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3;
    }

    // 거리 글자: 1km 미만은 m (집에서 집이면 0m), 그 이상은 km
    function distText() {
        var km = rideKm();
        return km < 1 ? Math.round(km * 1000 / 10) * 10 + 'm' : km.toFixed(1) + 'km';
    }

    // 도로 경로 시간, 없으면 평균 시속 30km + 승하차 3분
    function rideMinutes() {
        if (route()) return route().min;
        return Math.max(5, Math.round(rideKm() / 30 * 60 + 3));
    }

    // 예시 요금: 10km까지 1,500원 · 이후 5km마다 200원
    function fare() {
        return 1500 + Math.max(0, Math.ceil((rideKm() - 10) / 5)) * 200;
    }

    function clock(time) {
        var d = new Date(time);
        var h = d.getHours();
        var m = ('0' + d.getMinutes()).slice(-2);
        return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + m;
    }

    function clock24(time) {
        var d = new Date(time);
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function ridersText(n) {
        return n ? '본인 + 동승자 ' + n + '명' : '본인 1명';
    }

    // data-trip 이름 → 보여줄 글자 (값이 없으면 null)
    var TEXTS = {
        'dest-name': function (t) { return t.destination && t.destination.name; },
        'done-dest': function (t) { return t.destination && t.destination.name + '에'; },
        'pickup-name': function (t) { return t.pickupName; },
        'pickup-short': function (t) { return t.pickupShort; },
        'pickup-spot': function (t) { return t.pickupSpot; },
        'riders': function (t) { return t.riders != null ? ridersText(t.riders) : null; },
        'riders-confirm': function (t) {
            return t.riders != null ? '본인 1명 · ' + (t.riders ? '동승자 ' + t.riders + '명' : '동승자 없음') : null;
        },
        'ride-time': function (t) {
            return t.destination ? '목적지까지 약 ' + rideMinutes() + '분 · ' + distText() + ' (차에 탄 뒤 기준)' : null;
        },
        'ride-pin': function (t) { return t.destination ? '목적지까지 이동 약 ' + rideMinutes() + '분' : null; },
        // 탑승 중: 목적지를 안 골랐어도 예시 좌표로 계산해 도착 예상 시각과 맞춤
        'ride-left': function () { return '약 ' + rideMinutes() + '분 남음'; },
        'ride-arrive-pin': function () { return '도착 · 약 ' + rideMinutes() + '분'; },
        'fare': function (t) { return t.destination ? fare().toLocaleString('ko-KR') + '원' : null; },
        'called-status': function (t) {
            if (!t.calledAt) return null;
            var min = Math.floor((Date.now() - t.calledAt) / 60000);
            return (min ? '접수 후 ' + min + '분 경과' : '방금 접수했어요') + ' · 접수번호 1125';
        },
        'arrive-clock': function (t) {
            return t.boardedAt ? clock(t.boardedAt + rideMinutes() * 60000) + ' 도착 예상' : null;
        },
        // 탑승 중 시트 · 운행 정보 (목적지를 안 골랐어도 예시 좌표로 계산)
        'board-clock': function (t) { return t.boardedAt ? clock(t.boardedAt) : null; },
        'arrive-at': function (t) { return t.boardedAt ? clock(t.boardedAt + rideMinutes() * 60000) : null; },
        'ride-dist': function () { return distText(); },
        'ride-fare': function () { return '약 ' + fare().toLocaleString('ko-KR') + '원'; },
        'done-desc': function (t) {
            return t.boardedAt ? clock24(t.boardedAt + rideMinutes() * 60000) + ' 하차 · 오늘 이동이 끝났어요' : null;
        },
        'done-meta': function (t) {
            if (!t.boardedAt) return null;
            return clock24(t.boardedAt) + ' 탑승 · ' + clock24(t.boardedAt + rideMinutes() * 60000) + ' 하차 · ' + distText();
        },
        'done-route': function (t) {
            return t.destination ? (t.pickupName || '출발지') + '  →  ' + t.destination.name : null;
        }
    };

    // 이용내역 (브라우저 localStorage · 이동 완료 화면에서 한 번씩 남김 · 최근 것이 앞)
    var HISTORY_KEY = 'tripHistory';

    function history() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function recordDone() {
        set({ stage: 'done' });
        var t = load();
        var id = t.calledAt || t.boardedAt;
        if (!id) return;
        var list = history();
        if (list.some(function (r) { return r.id === id; })) return;
        list.unshift({
            id: id,
            boardedAt: t.boardedAt || null,
            doneAt: t.boardedAt ? t.boardedAt + rideMinutes() * 60000 : Date.now(),
            pickup: t.pickupName || '래미안베라힐즈 정문',
            pickupSpot: t.pickupSpot || '정문 · 경사로 쪽',
            dest: (t.destination && t.destination.name) || '은평성모병원',
            km: Math.round(rideKm() * 10) / 10,
            fare: fare(),
            riders: t.riders != null ? ridersText(t.riders) : '본인 1명',
            helpRequests: t.helpRequests || [],
            chatCount: (t.chat || []).filter(function (m) { return m.from === 'me'; }).length
        });
        saveHistory(list);
    }

    function saveHistory(list) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) {}
    }

    // 기록 하나 고치기 (별점 등) · 지우기
    function updateHistory(id, patch) {
        saveHistory(history().map(function (r) { return r.id === id ? Object.assign({}, r, patch) : r; }));
    }
    function removeHistory(id) {
        saveHistory(history().filter(function (r) { return r.id !== id; }));
    }

    function bind(root) {
        var trip = load();
        (root || document).querySelectorAll('[data-trip]').forEach(function (el) {
            var text = TEXTS[el.dataset.trip] && TEXTS[el.dataset.trip](trip);
            if (text) el.textContent = text;
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        bind(document);
        // 알림 미리보기(template) 안의 글자도 바꿈
        document.querySelectorAll('template').forEach(function (tpl) { bind(tpl.content); });
        // 고정 시점 남은 시간(data-eta-at)은 차가 오는 길을 받아 채움
        var roots = [document].concat(Array.prototype.map.call(document.querySelectorAll('template'), function (t) { return t.content; }));
        var needs = roots.some(function (r) { return r.querySelector('[data-eta-at]'); });
        if (needs) approachRoute(function (r) {
            if (!r) return;
            roots.forEach(function (root) { fillEta(root, driveMinutes(r), null); });
        });
    });

    return {
        get: load, set: set, start: start, places: places, bind: bind,
        route: route, ensureRoute: ensureRoute, fetchRoute: fetchRoute,
        approachRoute: approachRoute, driveMinutes: driveMinutes, fillEta: fillEta,
        rideKm: rideKm, distText: distText,
        // 출발지와 도착지가 너무 가까워 부를 수 없음 (100m 미만 · 집에서 집 등)
        tooClose: function () { return rideKm() < 0.1; },
        history: history, recordDone: recordDone, updateHistory: updateHistory, removeHistory: removeHistory, clock: clock
    };
})();
