// 자주 가는 곳 · 최근 목적지 (이 브라우저에 저장 · localStorage)
//  Favorites: 집은 늘 맨 위 (주소만 바꿀 수 있음) · 나머지는 추가·삭제
//  Recent: 이동을 마친 기록(Trip.history)의 도착지 · 처음엔 비어 있고 한 번 이동하면 생김
var Favorites = (function () {
    var KEY = 'favorites';
    var HOME = { id: 'home', type: 'home', name: '집', addr: '은평구 통일로 630 · 래미안베라힐즈', lat: 37.60277, lng: 126.93638 };
    // 처음부터 들어 있는 자주 가는 곳 (집 말고)
    var SEEDS = [
        { id: 'seed-hospital', type: 'place', name: '은평성모병원', addr: '은평구 통일로 1021 · 본관 정문', lat: 37.63361, lng: 126.91630 }
    ];
    var SEEDED = 'favoritesSeeded';

    function read() {
        var list = null;
        try { list = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
        if (!Array.isArray(list) || !list.length) list = [HOME];
        // 기본 장소는 한 번만 넣음 (이미 저장된 목록에도 · 지우면 다시 안 생김)
        var seeded = null;
        try { seeded = localStorage.getItem(SEEDED); } catch (e) {}
        if (!seeded) {
            SEEDS.forEach(function (seed) {
                var has = list.some(function (f) { return f.id === seed.id || f.name === seed.name; });
                if (!has) list.push(seed);
            });
            write(list);
            try { localStorage.setItem(SEEDED, '1'); } catch (e) {}
        }
        return list;
    }
    function write(list) {
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }

    function list() { return read(); }
    function get(id) { return read().filter(function (f) { return f.id === id; })[0] || null; }

    function add(place) {
        var list = read();
        list.push({ id: 'f' + Date.now(), type: 'place', name: place.name, addr: place.addr || '', lat: place.lat, lng: place.lng });
        write(list);
    }
    function update(id, patch) {
        write(read().map(function (f) { return f.id === id ? Object.assign({}, f, patch) : f; }));
    }
    function remove(id) {
        if (id === 'home') return;
        write(read().filter(function (f) { return f.id !== id; }));
    }

    return { list: list, get: get, add: add, update: update, remove: remove };
})();

var Recent = (function () {
    var CLEARED = 'recentClearedAt';

    // 최근 도착지 (같은 곳은 한 번만 · 최근 것부터 5곳)
    function list() {
        var clearedAt = 0;
        try { clearedAt = Number(localStorage.getItem(CLEARED)) || 0; } catch (e) {}
        var seen = {};
        return (window.Trip ? Trip.history() : []).filter(function (r) {
            if (r.doneAt <= clearedAt || seen[r.dest]) return false;
            seen[r.dest] = true;
            return true;
        }).slice(0, 5).map(function (r) {
            return { name: r.dest, addr: r.destAddr || '', lat: r.destLat, lng: r.destLng };
        });
    }
    function clear() {
        try { localStorage.setItem(CLEARED, String(Date.now())); } catch (e) {}
    }
    return { list: list, clear: clear };
})();
