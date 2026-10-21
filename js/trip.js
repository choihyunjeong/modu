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

    // 직선거리 × 1.3 을 도로 거리로 봄 (실제 길찾기 아님)
    function rideKm() {
        var p = places();
        var rad = Math.PI / 180;
        var dLat = (p.destination.lat - p.pickup.lat) * rad;
        var dLng = (p.destination.lng - p.pickup.lng) * rad;
        var a = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(p.pickup.lat * rad) * Math.cos(p.destination.lat * rad) * Math.pow(Math.sin(dLng / 2), 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3;
    }

    // 평균 시속 30km + 승하차 3분
    function rideMinutes() {
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
            return t.destination ? '목적지까지 약 ' + rideMinutes() + '분 · ' + rideKm().toFixed(1) + 'km (차에 탄 뒤 기준)' : null;
        },
        'ride-pin': function (t) { return t.destination ? '목적지까지 이동 약 ' + rideMinutes() + '분' : null; },
        'ride-left': function (t) { return t.destination ? '약 ' + rideMinutes() + '분 남음' : null; },
        'fare': function (t) { return t.destination ? fare().toLocaleString('ko-KR') + '원' : null; },
        'called-status': function (t) {
            if (!t.calledAt) return null;
            var min = Math.floor((Date.now() - t.calledAt) / 60000);
            return (min ? '접수 후 ' + min + '분 경과' : '방금 접수했어요') + ' · 접수번호 1125';
        },
        'arrive-clock': function (t) {
            return t.boardedAt ? clock(t.boardedAt + rideMinutes() * 60000) + ' 도착 예상' : null;
        },
        'done-desc': function (t) {
            return t.boardedAt ? clock24(t.boardedAt + rideMinutes() * 60000) + ' 하차 · 오늘 이동이 끝났어요' : null;
        },
        'done-meta': function (t) {
            if (!t.boardedAt) return null;
            return clock24(t.boardedAt) + ' 탑승 · ' + clock24(t.boardedAt + rideMinutes() * 60000) + ' 하차 · ' + rideKm().toFixed(1) + 'km';
        },
        'done-route': function (t) {
            return t.destination ? (t.pickupName || '출발지') + '  →  ' + t.destination.name : null;
        }
    };

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
    });

    return { get: load, set: set, start: start, places: places, bind: bind };
})();
