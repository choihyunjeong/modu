// 지도: APP_CONFIG.kakaoMapKey가 있으면 카카오 지도를 띄우고,
// 없으면 HTML에 있는 정적 지도 이미지와 디자인 좌표 배치를 그대로 씀.
//
// <div class="map-view" data-map data-center="pickup" data-route="pickup,destination">
//     <img class="map-view__static" ...>                       정적 지도
//     <div class="map-pin" data-static-pos data-place="pickup">  핀 (정적: --x/--y, 카카오: places 좌표)
// </div>
//
// data-gps (map-view)    : 지도를 띄우기 전에 실제 내 위치를 받아 내 위치·탑승 위치로 씀
// data-move-to="pickup"  : 표시를 그 장소 쪽으로 움직임 (차량 다가오기 · 이동 중)
//   data-move-range="0,0.7" 출발~도착 사이 어느 구간을 움직일지 (0 = 처음 자리, 1 = 도착)
//   data-move-ms="8000"     움직이는 시간
var MapKit = (function () {
    var config = window.APP_CONFIG || {};
    var callbacks = null;
    var mounted = [];   // 띄운 지도와 장소 표시 { map, overlays: { 장소이름: [overlay] } }

    // 카카오 지도 SDK 불러오기 (장소 검색 services 포함 · 한 번만)
    function load(callback) {
        if (!config.kakaoMapKey) return;
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) return kakao.maps.load(callback);
        if (callbacks) return callbacks.push(callback);
        callbacks = [callback];
        var script = document.createElement('script');
        script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=' + encodeURIComponent(config.kakaoMapKey);
        script.onload = function () {
            kakao.maps.load(function () { callbacks.forEach(function (cb) { cb(); }); });
        };
        script.onerror = function () { console.warn('카카오 지도를 불러오지 못해 정적 지도를 보여줘요.'); };
        document.head.appendChild(script);
    }

    function places() {
        return window.Trip ? Trip.places() : (config.places || {});
    }

    function toLatLng(name) {
        var p = places()[name];
        return p ? new kakao.maps.LatLng(p.lat, p.lng) : null;
    }

    // 표시를 from → to 로 부드럽게 움직임
    function move(overlay, from, to, el) {
        var range = (el.dataset.moveRange || '0,1').split(',').map(Number);
        var duration = Number(el.dataset.moveMs || 8000);
        var startTime = null;
        function step(now) {
            if (!startTime) startTime = now;
            var t = Math.min(1, (now - startTime) / duration);
            var r = range[0] + (range[1] - range[0]) * t;
            overlay.setPosition(new kakao.maps.LatLng(
                from.getLat() + (to.getLat() - from.getLat()) * r,
                from.getLng() + (to.getLng() - from.getLng()) * r
            ));
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function mountKakao(view) {
        var canvas = document.createElement('div');
        canvas.className = 'map-view__canvas';
        view.prepend(canvas);

        var map = new kakao.maps.Map(canvas, {
            center: toLatLng(view.dataset.center || 'pickup'),
            level: Number(view.dataset.level || 3)
        });
        view.classList.add('is-kakao');
        var overlays = {};
        mounted.push({ map: map, overlays: overlays });

        // 경로: 지정한 장소들을 잇는 선 (실제 길찾기 경로는 아님)
        //  data-fit: 선 없이 그 장소들이 모두 보이게만 맞춤 (차량 배정 · 도착 임박)
        var fitNames = view.dataset.route || view.dataset.fit;
        if (fitNames) {
            var path = fitNames.split(',').map(toLatLng).filter(Boolean);
            if (view.dataset.route) {
                new kakao.maps.Polyline({
                    map: map, path: path,
                    strokeWeight: 3, strokeColor: '#1f2124', strokeOpacity: 1
                });
            }
            var bounds = new kakao.maps.LatLngBounds();
            path.forEach(function (p) { bounds.extend(p); });
            // 여백: 위는 핀 글자 자리, 아래는 시트가 덮는 자리만큼
            //  data-fit-pad: 작은 지도(도착 임박)는 여백을 줄여 너무 멀어지지 않게
            var pad = view.dataset.fitPad ? Number(view.dataset.fitPad) : null;
            if (pad != null) map.setBounds(bounds, pad, pad, pad + 16, pad);
            else map.setBounds(bounds, 56, 24, 32, 24);
        }

        // 핀·내 위치 표시를 지도 좌표에 붙임 (점이 좌표에 오도록 아래 끝 기준)
        view.querySelectorAll('[data-place]').forEach(function (el) {
            var position = toLatLng(el.dataset.place);
            if (!position) return;
            var overlay = new kakao.maps.CustomOverlay({
                map: map, position: position, content: el,
                yAnchor: el.classList.contains('map-pin') ? 1 : 0.5
            });
            (overlays[el.dataset.place] = overlays[el.dataset.place] || []).push(overlay);
            var target = el.dataset.moveTo && toLatLng(el.dataset.moveTo);
            if (target) move(overlay, position, target, el);
        });

        // 내 위치 버튼: 실제 위치로 지도를 옮기고 내 위치 표시도 그 자리로
        var locate = view.querySelector('[data-locate]');
        if (locate && navigator.geolocation) {
            locate.addEventListener('click', function () {
                navigator.geolocation.getCurrentPosition(function (pos) {
                    setPlace('me', { lat: pos.coords.latitude, lng: pos.coords.longitude });
                }, function () {
                    alert('내 위치를 확인하려면 위치 권한을 허용해 주세요.');
                });
            });
        }
    }

    // 실제 내 위치를 받아 저장 (실패·거부하면 예시 좌표 그대로)
    function withGps(callback) {
        if (!navigator.geolocation || !window.Trip) return callback();
        navigator.geolocation.getCurrentPosition(function (pos) {
            var me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            Trip.set({ me: me, pickupPos: me });
            callback();
        }, function () { callback(); }, { timeout: 5000, maximumAge: 60000 });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var views = document.querySelectorAll('[data-map]');
        if (!views.length || !config.kakaoMapKey) return;
        var gps = document.querySelector('[data-map][data-gps]');
        (gps ? withGps : function (cb) { cb(); })(function () {
            load(function () { views.forEach(mountKakao); });
        });
    });

    // 장소 표시를 새 좌표로 옮기고 지도를 그쪽으로 (탑승 위치 바꾸기)
    //  아직 지도를 띄우기 전이면 아무것도 안 함 (띄울 때 Trip 좌표를 씀)
    function setPlace(name, pos) {
        if (!window.kakao || !kakao.maps || !kakao.maps.LatLng) return;
        var latLng = new kakao.maps.LatLng(pos.lat, pos.lng);
        mounted.forEach(function (m) {
            (m.overlays[name] || []).forEach(function (overlay) { overlay.setPosition(latLng); });
            m.map.panTo(latLng);
        });
    }

    // 장소 한 곳을 지도로 보여줌 (목적지 고르기 화면 · 열 때마다 새 장소로)
    //  view는 화면에 보이는 상태에서 불러야 지도 크기가 맞음
    function preview(view, pos, pinEl) {
        load(function () {
            var latLng = new kakao.maps.LatLng(pos.lat, pos.lng);
            if (!view.kakaoMap) {
                var canvas = document.createElement('div');
                canvas.className = 'map-view__canvas';
                view.prepend(canvas);
                view.kakaoMap = new kakao.maps.Map(canvas, { center: latLng, level: 3 });
                view.kakaoPin = new kakao.maps.CustomOverlay({
                    map: view.kakaoMap, position: latLng, content: pinEl, yAnchor: 1
                });
                view.classList.add('is-kakao');
            } else {
                view.kakaoMap.relayout();
                view.kakaoMap.setLevel(3);
                view.kakaoMap.setCenter(latLng);
                view.kakaoPin.setPosition(latLng);
            }
        });
    }

    return { load: load, setPlace: setPlace, preview: preview };
})();
