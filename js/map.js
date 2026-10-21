// 지도: APP_CONFIG.kakaoMapKey가 있으면 카카오 지도를 띄우고,
// 없으면 HTML에 있는 정적 지도 이미지와 디자인 좌표 배치를 그대로 씀.
//
// <div class="map-view" data-map data-center="pickup" data-route="pickup,destination">
//     <img class="map-view__static" ...>                       정적 지도
//     <div class="map-pin" data-static-pos data-place="pickup">  핀 (정적: --x/--y, 카카오: places 좌표)
// </div>
(function () {
    var config = window.APP_CONFIG || {};
    var places = config.places || {};

    function loadKakao(callback) {
        if (window.kakao && window.kakao.maps) return kakao.maps.load(callback);
        var script = document.createElement('script');
        script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' + encodeURIComponent(config.kakaoMapKey);
        script.onload = function () { kakao.maps.load(callback); };
        script.onerror = function () { console.warn('카카오 지도를 불러오지 못해 정적 지도를 보여줘요.'); };
        document.head.appendChild(script);
    }

    function toLatLng(name) {
        var p = places[name];
        return p ? new kakao.maps.LatLng(p.lat, p.lng) : null;
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

        // 경로: 지정한 장소들을 잇는 선 (실제 길찾기 경로는 아님)
        if (view.dataset.route) {
            var path = view.dataset.route.split(',').map(toLatLng).filter(Boolean);
            new kakao.maps.Polyline({
                map: map, path: path,
                strokeWeight: 3, strokeColor: '#1f2124', strokeOpacity: 1
            });
            var bounds = new kakao.maps.LatLngBounds();
            path.forEach(function (p) { bounds.extend(p); });
            map.setBounds(bounds, 80, 40, 40, 40);
        }

        // 핀·내 위치 표시를 지도 좌표에 붙임 (점이 좌표에 오도록 아래 끝 기준)
        view.querySelectorAll('[data-place]').forEach(function (el) {
            var position = toLatLng(el.dataset.place);
            if (!position) return;
            new kakao.maps.CustomOverlay({
                map: map, position: position, content: el,
                yAnchor: el.classList.contains('map-pin') ? 1 : 0.5
            });
        });

        // 내 위치 버튼
        var locate = view.querySelector('[data-locate]');
        if (locate && navigator.geolocation) {
            locate.addEventListener('click', function () {
                navigator.geolocation.getCurrentPosition(function (pos) {
                    map.panTo(new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
                });
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var views = document.querySelectorAll('[data-map]');
        if (!views.length || !config.kakaoMapKey) return;
        loadKakao(function () { views.forEach(mountKakao); });
    });
})();
