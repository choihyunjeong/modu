// 지도에서 직접 고르기
//  ?mode=pickup  탑승 위치 (탑승 위치 화면 "다른 위치 선택하기") → 호출 전 확인
//  ?mode=dest    도착지 (검색 "지도에서 직접 고르기") → 호출 전 확인
//  ?mode=fav     자주 가는 곳 추가 ("지도에서 선택") → 이름 입력 · &edit=home 이면 집 주소 바꾸기
//  지도를 움직이고 손을 떼면: 가까운 도로로 핀을 맞춤 (아파트 단지 안·건물 안 → 차가 설 수 있는 길가)
//   → 그 자리 주소를 카카오 주소 찾기로 보여 줌
(function () {
    var params = new URLSearchParams(location.search);
    var mode = params.get('mode') || 'dest';
    var edit = params.get('edit');
    var MODES = {
        pickup: { title: '탑승할 위치를 골라 주세요', pin: '여기서 탑승', ok: '이 위치로 부를게요' },
        dest: { title: '도착할 곳을 골라 주세요', pin: '도착', ok: '이 위치로 정하기' },
        fav: { title: edit === 'home' ? '집 위치를 골라 주세요' : '자주 가는 곳을 골라 주세요', pin: '여기', ok: '위치 확인' }
    };
    var m = MODES[mode] || MODES.dest;

    var wrap = document.querySelector('.pick');
    var nameEl = document.querySelector('[data-pick-name]');
    var addrEl = document.querySelector('[data-pick-addr]');
    var noteEl = document.querySelector('[data-pick-note]');
    var okBtn = document.querySelector('[data-pick-ok]');
    document.querySelector('[data-pick-title]').textContent = m.title;
    document.querySelector('[data-pin-label]').textContent = m.pin;
    okBtn.textContent = m.ok;
    if (mode === 'pickup') document.querySelector('.pick__back').href = 'confirm.html';
    if (mode === 'fav') document.querySelector('.pick__back').href = 'fav-add.html' + (edit ? '?edit=' + edit : '');

    // 카드 높이만큼 내 위치 버튼을 위로
    var card = document.querySelector('.pick-card');
    function placeLocate() { wrap.style.setProperty('--pick-card-h', card.offsetHeight + 'px'); }
    placeLocate();
    window.addEventListener('resize', placeLocate);

    // 처음 지도 가운데: 탑승 위치 → 지금 탑승 위치 · 집 바꾸기 → 집 · 나머지 → 내 위치
    var places = Trip.places();
    var home = Favorites.get('home');
    var start = mode === 'pickup' ? places.pickup : (edit === 'home' && home ? home : places.me);

    var picked = null;     // { name, addr, lat, lng, road }
    var seq = 0;           // 마지막으로 요청한 확인만 반영

    function busy() {
        picked = null;
        okBtn.disabled = true;
        nameEl.textContent = '위치를 확인하고 있어요…';
        addrEl.textContent = '';
        noteEl.hidden = true;
    }

    // 가까운 도로 (OSRM nearest · 이름 있는 도로 우선)
    //  아파트 단지 안 길은 이름이 없어서, 후보를 넉넉히(30개) 받아 250m 안의 이름 있는 도로(바깥 큰길)를 고름
    function nearestRoad(lat, lng, cb) {
        fetch('https://router.project-osrm.org/nearest/v1/driving/' + lng + ',' + lat + '?number=30')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var list = (data.waypoints || []).filter(function (w) { return w.distance < 250; });
                var best = list.filter(function (w) { return w.name; })[0] || list[0];
                cb(best ? { lat: best.location[1], lng: best.location[0], road: best.name || '', moved: best.distance } : null);
            })
            .catch(function () { cb(null); });
    }

    // 좌표 → 주소 (카카오 · 건물 이름 > 도로명 > 지번)
    function addressOf(lat, lng, cb) {
        if (!(window.kakao && kakao.maps.services)) return cb(null);
        new kakao.maps.services.Geocoder().coord2Address(lng, lat, function (result, status) {
            if (status !== kakao.maps.services.Status.OK || !result[0]) return cb(null);
            var road = result[0].road_address;
            var jibun = result[0].address;
            // 이름과 아래 주소가 같은 글자로 두 번 나오지 않게
            var name = (road && road.building_name) || (road && road.address_name) || (jibun && jibun.address_name) || '';
            var addr = road && road.building_name ? road.address_name : (road && jibun ? jibun.address_name : '');
            cb({ name: name, addr: addr === name ? '' : addr });
        });
    }

    function show(pos, road, moved) {
        var my = seq;
        addressOf(pos.lat, pos.lng, function (a) {
            if (my !== seq) return;
            var name = (a && a.name) || (road ? road + ' 길가' : '고른 위치');
            picked = { name: name, addr: (a && a.addr) || '', lat: pos.lat, lng: pos.lng, road: road };
            nameEl.textContent = name;
            addrEl.textContent = picked.addr;
            // 단지·건물 안에서 도로로 옮겼을 때 안내
            noteEl.hidden = !(moved > 8 && road);
            noteEl.textContent = mode === 'pickup'
                ? '차가 설 수 있게 가까운 도로(' + road + ')로 핀을 옮겼어요'
                : '차가 들어갈 수 있게 가까운 도로(' + road + ')로 핀을 옮겼어요';
            okBtn.disabled = false;
        });
    }

    MapKit.load(function () {
        var map = new kakao.maps.Map(document.querySelector('[data-pick-map]'), {
            center: new kakao.maps.LatLng(start.lat, start.lng),
            level: 2
        });
        var snapping = false;
        wrap.pickMap = map;    // 점검용 (지도 가운데 확인)

        function settle() {
            if (snapping) { snapping = false; return; }
            var c = map.getCenter();
            var my = ++seq;
            busy();
            nearestRoad(c.getLat(), c.getLng(), function (snap) {
                if (my !== seq) return;
                if (snap && snap.moved > 3) {
                    // 핀을 도로 위로 (지도를 그만큼 옮김 · 이때 생기는 idle은 건너뜀)
                    snapping = true;
                    map.panTo(new kakao.maps.LatLng(snap.lat, snap.lng));
                }
                show(snap || { lat: c.getLat(), lng: c.getLng() }, snap && snap.road, snap ? snap.moved : 0);
            });
        }
        kakao.maps.event.addListener(map, 'dragstart', function () { wrap.classList.add('is-moving'); seq++; busy(); });
        kakao.maps.event.addListener(map, 'dragend', function () { wrap.classList.remove('is-moving'); });
        kakao.maps.event.addListener(map, 'idle', settle);
        settle();

        // 내 위치로
        document.querySelector('[data-pick-locate]').addEventListener('click', function () {
            if (!navigator.geolocation) return map.panTo(new kakao.maps.LatLng(places.me.lat, places.me.lng));
            navigator.geolocation.getCurrentPosition(function (p) {
                map.panTo(new kakao.maps.LatLng(p.coords.latitude, p.coords.longitude));
            }, function () {
                Toast.show('내 위치를 찾지 못했어요. 위치 권한을 확인해 주세요');
                map.panTo(new kakao.maps.LatLng(places.me.lat, places.me.lng));
            }, { timeout: 8000 });
        });
    }, function () {
        nameEl.textContent = '지도를 불러오지 못했어요';
        addrEl.textContent = '인터넷 연결을 확인한 뒤 다시 열어 주세요.';
    });

    // 위치 확인
    okBtn.addEventListener('click', function () {
        if (!picked) return;
        if (mode === 'pickup') {
            Trip.set({
                pickupName: picked.name, pickupShort: picked.road ? picked.road + ' 길가' : '고른 위치',
                pickupSpot: '지도에서 고른 위치', pickupPos: { lat: picked.lat, lng: picked.lng },
                pickupCustom: picked
            });
            location.href = 'confirm.html';
        } else if (mode === 'dest') {
            Trip.start({ name: picked.name, addr: picked.addr, lat: picked.lat, lng: picked.lng });
            location.href = 'confirm.html';
        } else {
            try { sessionStorage.setItem('favPick', JSON.stringify(picked)); } catch (e) {}
            // 지도 화면을 기록에 남기지 않음 (이름 입력에서 뒤로 → 목록)
            location.replace('fav-add.html' + (edit ? '?edit=' + edit : '') + '#name');
        }
    });
})();
