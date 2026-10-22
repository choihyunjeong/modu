// 지도: APP_CONFIG.kakaoMapKey가 있으면 카카오 지도를 띄우고,
// 없으면 HTML에 있는 정적 지도 이미지와 디자인 좌표 배치를 그대로 씀.
//
// <div class="map-view" data-map data-center="pickup" data-route="pickup,destination">
//     <img class="map-view__static" ...>                       정적 지도
//     <div class="map-pin" data-static-pos data-place="pickup">  핀 (정적: --x/--y, 카카오: places 좌표)
// </div>
//
// data-route="pickup,destination" : 탑승 위치 → 목적지 도로 경로를 그림 (받기 전·실패 시 직선)
// data-fit="car,pickup"           : 선 없이 그 장소들이 모두 보이게만 맞춤
// data-gps (map-view)    : 지도를 띄우기 전에 실제 내 위치를 받아 내 위치·탑승 위치로 씀
// data-move-to="pickup"  : 표시를 그 장소 쪽으로 움직임 (차량 다가오기)
// data-move-path="route" : 표시를 이번 호출 도로 경로를 따라 움직임 (이동 중)
//   data-move-range="0,0.7" 어느 구간을 움직일지 (0 = 처음, 1 = 끝)
//   data-move-ms="8000"     움직이는 시간 (APP_CONFIG.demoScale을 곱함)
// data-move-path="approach" : 배정된 차가 도로를 따라 탑승 위치로 다가옴 (차량 배정 · 도착 임박)
var MapKit = (function () {
    var config = window.APP_CONFIG || {};
    var callbacks = null;
    var mounted = [];   // 띄운 지도와 장소 표시 { map, overlays: { 장소이름: [overlay] } }
    var ROUTE_STYLE = { strokeWeight: 5, strokeColor: '#0b5ed7', strokeOpacity: 0.9 };

    // 카카오 지도 SDK 불러오기 (장소 검색 services 포함 · 한 번만)
    //  onFail: 키가 없거나 불러오지 못했을 때 (등록 안 된 도메인 등)
    var failed = false;
    var failCallbacks = [];
    function load(callback, onFail) {
        if (!config.kakaoMapKey || failed) { if (onFail) onFail(); return; }
        if (window.kakao && window.kakao.maps && window.kakao.maps.services) return kakao.maps.load(callback);
        if (onFail) failCallbacks.push(onFail);
        if (callbacks) return callbacks.push(callback);
        callbacks = [callback];
        var script = document.createElement('script');
        script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=' + encodeURIComponent(config.kakaoMapKey);
        script.onload = function () {
            kakao.maps.load(function () { callbacks.forEach(function (cb) { cb(); }); });
        };
        script.onerror = function () {
            failed = true;
            console.warn('카카오 지도를 불러오지 못해 정적 지도를 보여줘요. (developers.kakao.com에 이 사이트 도메인이 등록됐는지 확인)');
            failCallbacks.forEach(function (cb) { cb(); });
        };
        document.head.appendChild(script);
    }

    function places() {
        return window.Trip ? Trip.places() : (config.places || {});
    }

    function latLng(p) {
        return new kakao.maps.LatLng(p.lat, p.lng);
    }

    function toLatLng(name) {
        var p = places()[name];
        return p ? latLng(p) : null;
    }

    // [[lat, lng], ...] → 카카오 좌표 목록
    function toPath(points) {
        return points.map(function (p) { return new kakao.maps.LatLng(p[0], p[1]); });
    }

    // 여백: 위는 핀 글자 자리, 아래는 시트가 덮는 자리만큼
    //  center(내 위치)가 있으면 그 점이 지도 한가운데 오면서 다른 장소도 모두 보이게
    //  (각 장소를 내 위치 반대편으로 뒤집은 점까지 넣어 맞춘 뒤 내 위치로 옮김)
    function fit(map, path, pad, center) {
        var bounds = new kakao.maps.LatLngBounds();
        path.forEach(function (p) {
            bounds.extend(p);
            if (center) {
                bounds.extend(new kakao.maps.LatLng(
                    center.getLat() * 2 - p.getLat(),
                    center.getLng() * 2 - p.getLng()
                ));
            }
        });
        // 모든 점이 거의 같은 곳이면(집에서 집 등) 너무 확대되지 않게 그 자리를 보통 크기로
        var sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
        if (Math.abs(ne.getLat() - sw.getLat()) < 0.0008 && Math.abs(ne.getLng() - sw.getLng()) < 0.0008) {
            map.setLevel(3);
            map.setCenter(new kakao.maps.LatLng((sw.getLat() + ne.getLat()) / 2, (sw.getLng() + ne.getLng()) / 2));
        } else if (pad != null) map.setBounds(bounds, pad, pad, pad + 16, pad);
        else map.setBounds(bounds, 56, 24, 32, 24);
        if (center) map.setCenter(center);
    }

    // 경로 위 비율(0~1) 지점부터 끝까지 남은 길 (첫 점이 그 지점)
    function restFrom(path, ratio) {
        var lengths = [0];
        for (var i = 1; i < path.length; i++) {
            var dLat = path[i].getLat() - path[i - 1].getLat();
            var dLng = path[i].getLng() - path[i - 1].getLng();
            lengths.push(lengths[i - 1] + Math.sqrt(dLat * dLat + dLng * dLng));
        }
        var target = lengths[lengths.length - 1] * ratio;
        for (var j = 1; j < path.length; j++) {
            if (lengths[j] >= target) return [pointAt(path, ratio)].concat(path.slice(j));
        }
        return [path[path.length - 1]];
    }

    // 경로 위 비율(0~1) 지점의 좌표 (구간 길이 비율로 계산)
    function pointAt(path, ratio) {
        var lengths = [0];
        for (var i = 1; i < path.length; i++) {
            var dLat = path[i].getLat() - path[i - 1].getLat();
            var dLng = path[i].getLng() - path[i - 1].getLng();
            lengths.push(lengths[i - 1] + Math.sqrt(dLat * dLat + dLng * dLng));
        }
        var target = lengths[lengths.length - 1] * ratio;
        for (var j = 1; j < path.length; j++) {
            if (lengths[j] >= target) {
                var part = lengths[j] - lengths[j - 1];
                var r = part ? (target - lengths[j - 1]) / part : 0;
                return new kakao.maps.LatLng(
                    path[j - 1].getLat() + (path[j].getLat() - path[j - 1].getLat()) * r,
                    path[j - 1].getLng() + (path[j].getLng() - path[j - 1].getLng()) * r
                );
            }
        }
        return path[path.length - 1];
    }

    // 경로 위 비율 지점에서 가는 방향 (0 = 위쪽(북), 시계 방향 각도) · 앞뒤 조금씩 떨어진 두 점으로 잼
    function headingAt(path, ratio) {
        var a = pointAt(path, Math.max(0, ratio - 0.01));
        var b = pointAt(path, Math.min(1, ratio + 0.01));
        var dLat = b.getLat() - a.getLat();
        var dLng = (b.getLng() - a.getLng()) * Math.cos(a.getLat() * Math.PI / 180);
        if (!dLat && !dLng) return null;
        return Math.atan2(dLng, dLat) * 180 / Math.PI;
    }

    // 차 그림을 가는 방향으로 돌림 (차 그림은 앞이 위쪽)
    function turnCar(el, deg) {
        var img = el.querySelector('img');
        if (img) img.style.transform = 'rotate(' + deg + 'deg)';
    }

    // 표시를 경로를 따라 부드럽게 움직임 · onStep(지금 비율)이 있으면 매번 부름
    //  차(.map-car)는 길 방향을 따라 앞을 보며 돌고, 다 오면 그 방향을 저장 (차량 도착 화면에서 이어 씀)
    function move(overlay, path, el, onStep) {
        var range = (el.dataset.moveRange || '0,1').split(',').map(Number);
        var duration = Number(el.dataset.moveMs || 8000) * (config.demoScale || 1);
        var isCar = el.classList.contains('map-car');
        var heading = null;
        var startTime = null;
        // 이 단계가 시작된 뒤 지난 시간만큼 앞에서 출발 (다른 화면에 갔다 와도 차가 처음으로 돌아가지 않게)
        var stageAt = window.Trip && Trip.get().stageAt;
        var already = stageAt ? Math.min(duration, Math.max(0, Date.now() - stageAt)) : 0;
        function step(now) {
            if (!startTime) startTime = now - already;
            var t = Math.min(1, (now - startTime) / duration);
            var ratio = range[0] + (range[1] - range[0]) * t;
            overlay.setPosition(pointAt(path, ratio));
            if (isCar) {
                var target = headingAt(path, ratio);
                if (target != null) {
                    // 짧은 쪽으로 조금씩 돌아 모퉁이에서 휙 꺾이지 않게
                    heading = heading == null ? target : heading + (((target - heading + 540) % 360) - 180) * 0.15;
                    turnCar(el, heading);
                }
            }
            if (onStep) onStep(ratio);
            if (t < 1) return requestAnimationFrame(step);
            if (isCar && heading != null && window.Trip) Trip.set({ carHeading: heading });
            // 탑승 위치에 닿음 (경로 끝까지 간 차) → 도착 임박 화면이 차량 도착으로 넘어감 (push.js)
            if (isCar && range[1] >= 1 && el.dataset.movePath === 'approach') {
                document.dispatchEvent(new CustomEvent('mapkit:car-arrived'));
            }
        }
        requestAnimationFrame(step);
    }

    // 이번 호출 도로 경로 받기 (Trip이 없거나 실패하면 null)
    function withRoute(callback) {
        if (!window.Trip) return callback(null);
        Trip.ensureRoute(callback);
    }

    function mountKakao(view) {
        var canvas = document.createElement('div');
        canvas.className = 'map-view__canvas';
        view.prepend(canvas);

        // 처음엔 경로·장소 전체가 보이게 맞춤 (내 위치를 가운데로 옮기는 건 '내 위치' 버튼을 눌렀을 때만)
        var map = new kakao.maps.Map(canvas, {
            center: toLatLng(view.dataset.center || 'pickup'),
            level: Number(view.dataset.level || 3)
        });
        view.classList.add('is-kakao');
        var overlays = {};
        mounted.push({ map: map, overlays: overlays });
        var pad = view.dataset.fitPad ? Number(view.dataset.fitPad) : null;

        // 경로: 먼저 직선으로 그리고, 도로 경로를 받으면 그 길로 바꿈
        if (view.dataset.route) {
            var straight = view.dataset.route.split(',').map(toLatLng).filter(Boolean);
            var routeLine = new kakao.maps.Polyline(Object.assign({ map: map, path: straight }, ROUTE_STYLE));
            fit(map, straight, pad);
            withRoute(function (route) {
                if (!route) return;
                var road = toPath(route.path);
                routeLine.setPath(road);
                fit(map, road, pad);
            });
        } else if (view.dataset.fit) {
            fit(map, view.dataset.fit.split(',').map(toLatLng).filter(Boolean), pad);
        }

        // 핀·내 위치 표시를 지도 좌표에 붙임 (점이 좌표에 오도록 아래 끝 기준)
        view.querySelectorAll('[data-place]').forEach(function (el) {
            var position = toLatLng(el.dataset.place);
            if (!position) return;
            var overlay = new kakao.maps.CustomOverlay({
                map: map, position: position, content: el,
                yAnchor: el.classList.contains('map-pin') ? 1 : 0.5,
                // 퍼지는 원은 핀·차 아래에 깔림
                zIndex: el.classList.contains('map-pulse') ? 0 : 1
            });
            (overlays[el.dataset.place] = overlays[el.dataset.place] || []).push(overlay);

            if (el.dataset.movePath === 'route') {
                // 탑승 중: 차가 지나온 길은 지우고 남은 길만 그림
                withRoute(function (route) {
                    var path = route ? toPath(route.path) : [toLatLng('pickup'), toLatLng('destination')];
                    move(overlay, path, el, function (ratio) {
                        if (routeLine) routeLine.setPath(restFrom(path, ratio));
                    });
                });
            } else if (el.dataset.movePath === 'approach' && window.Trip) {
                Trip.approachRoute(function (route) {
                    var road = route ? toPath(route.path) : [toLatLng('car'), toLatLng('pickup')];
                    var drive = route ? Trip.driveMinutes(route) : null;
                    // 차가 오는 길 전체가 보이게 (data-fit 장소들과 함께)
                    if (view.dataset.fit) fit(map, road.concat(view.dataset.fit.split(',').map(toLatLng).filter(Boolean)), pad);
                    // 남은 길만 그림 (차가 지나간 길은 지워짐) · 도착까지 남은 시간도 같이 바뀜
                    var line = new kakao.maps.Polyline(Object.assign({ map: map, path: road }, ROUTE_STYLE));
                    move(overlay, road, el, function (ratio) {
                        line.setPath(restFrom(road, ratio));
                        if (drive) Trip.fillEta(document, drive, ratio);
                    });
                });
            } else if (el.dataset.moveTo && toLatLng(el.dataset.moveTo)) {
                move(overlay, [position, toLatLng(el.dataset.moveTo)], el);
            } else if (el.classList.contains('map-car') && window.Trip && Trip.get().carHeading != null) {
                // 멈춰 있는 차: 오던 방향 그대로
                turnCar(el, Trip.get().carHeading);
            }
        });

        // 내 위치 버튼: 실제 위치로 지도를 옮기고 내 위치 표시도 그 자리로
        //  위치 권한이 없거나 못 받으면 저장된 내 위치(예시)를 가운데로
        var locate = view.querySelector('[data-locate]');
        if (locate) {
            locate.addEventListener('click', function () {
                function fallback() {
                    map.panTo(toLatLng('me'));
                    if (window.Toast) Toast.show('위치 권한을 허용하면 실제 내 위치로 옮겨요');
                }
                if (!navigator.geolocation) return fallback();
                navigator.geolocation.getCurrentPosition(function (pos) {
                    setPlace('me', { lat: pos.coords.latitude, lng: pos.coords.longitude });
                }, fallback, { timeout: 5000, maximumAge: 60000 });
            });
        }
    }

    // 카카오 지도를 못 불러온 화면(정적 지도)의 내 위치 버튼
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-locate]');
        if (!btn || btn.closest('.is-kakao')) return;
        if (window.Toast) Toast.show('지도를 불러오지 못해 내 위치로 옮길 수 없어요');
    });

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
        mounted.forEach(function (m) {
            (m.overlays[name] || []).forEach(function (overlay) { overlay.setPosition(latLng(pos)); });
            m.map.panTo(latLng(pos));
        });
    }

    // 지도 칸 크기가 바뀐 뒤 다시 그림 (바텀시트를 끌어 올리고 내릴 때)
    function relayout() {
        mounted.forEach(function (m) { m.map.relayout(); });
    }

    return { load: load, setPlace: setPlace, relayout: relayout };
})();
