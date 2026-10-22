// 장소 검색 (목적지 검색 · 음성으로 부르기가 같이 씀)
//  Places.search('은평구청', function (items) { ... })
//  items: [{ name, addr, lat, lng }] · 못 찾으면 [] · 인터넷이 안 되면 null
//  1) 카카오 장소 검색 (내 위치 가까운 곳 먼저)
//  2) 카카오를 못 쓰면 (키 없음 · 등록 안 된 도메인) OpenStreetMap 장소 검색으로 대신 찾음
var Places = (function () {
    function near() {
        return window.Trip ? Trip.places().me : { lat: 37.6031, lng: 126.9363 };
    }

    function search(query, callback) {
        var me = near();
        MapKit.load(function () {
            new kakao.maps.services.Places().keywordSearch(query, function (data, status) {
                if (status !== kakao.maps.services.Status.OK) return callback([]);
                callback(data.map(function (p) {
                    return { name: p.place_name, addr: p.road_address_name || p.address_name, lat: Number(p.y), lng: Number(p.x) };
                }));
            }, { location: new kakao.maps.LatLng(me.lat, me.lng), size: 10 });
        }, function () { searchOsm(query, me, callback); });
    }

    // OpenStreetMap(Nominatim) · 키 없이 무료 · 내 위치 주변(약 20km)을 먼저 보여줌
    function searchOsm(query, me, callback) {
        var d = 0.2;
        var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10' +
            '&countrycodes=kr&accept-language=ko&q=' + encodeURIComponent(query) +
            '&viewbox=' + [me.lng - d, me.lat + d, me.lng + d, me.lat - d].join(',');
        fetch(url).then(function (res) { return res.json(); }).then(function (data) {
            // 같은 건물이 점·면으로 여러 번 나오면 하나만 (이름이 같고 300m 안)
            var seen = [];
            callback(data.map(function (r) {
                return { name: r.name || r.display_name.split(',')[0], addr: osmAddress(r), lat: Number(r.lat), lng: Number(r.lon) };
            }).filter(function (p) {
                var dup = seen.some(function (q) {
                    return q.name === p.name && Math.abs(q.lat - p.lat) < 0.003 && Math.abs(q.lng - p.lng) < 0.003;
                });
                if (!dup) seen.push(p);
                return !dup;
            }));
        }).catch(function () { callback(null); });
    }

    // 한국식 주소 순서로 (시·구·동·도로 · 건물번호)
    function osmAddress(r) {
        var a = r.address || {};
        var parts = [a.city || a.province || a.state, a.borough || a.city_district || a.county, a.suburb || a.quarter || a.neighbourhood, a.road, a.house_number];
        return parts.filter(Boolean).join(' ') || r.display_name;
    }

    return { search: search };
})();
