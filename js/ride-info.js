// 탑승 정보 저장/불러오기 (브라우저 localStorage)
// 등록·수정 화면에서 고른 값을 저장하고, 호출 전 확인 화면에 보여줌
var RideInfo = (function () {
    var KEY = 'rideInfo';

    var DEVICES = {
        'manual-wheelchair': '수동 휠체어',
        'power-wheelchair': '전동 휠체어',
        'walker': '보행기',
        'cane': '지팡이·목발',
        'other': '다른 이동 보조기기',
        'none': '이동 보조기기 없음'
    };
    var WHEELCHAIRS = ['manual-wheelchair', 'power-wheelchair'];

    var CONTACTS = {
        'message': '문자·앱 메시지로 연락 · 전화 가능',
        'message-only': '문자·앱 메시지로 연락',
        'phone': '전화로 연락'
    };

    var REQUESTS = {
        'slow-explain': '천천히 설명해 주세요',
        'text-guide': '글로 안내해 주세요',
        'tell-before-help': '도와주시기 전에 먼저 말씀해 주세요',
        'wait-answer': '답변을 조금 기다려 주세요'
    };

    function load() {
        try {
            return JSON.parse(localStorage.getItem(KEY)) || null;
        } catch (e) {
            return null;
        }
    }

    function save(patch) {
        var data = Object.assign({}, load(), patch);
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    }

    function check(name, value) {
        var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
        if (input) input.checked = true;
    }

    function checkedValue(name) {
        var input = document.querySelector('input[name="' + name + '"]:checked');
        return input ? input.value : '';
    }

    function checkedValues(name) {
        return Array.prototype.map.call(
            document.querySelectorAll('input[name="' + name + '"]:checked'),
            function (input) { return input.value; }
        );
    }

    // ① 이동 보조기기 화면
    function fillDevice() {
        var data = load();
        if (!data) return;
        if (data.device) check('device', data.device);
        if (data.refused) check('refused', data.refused);
    }

    function saveDevice() {
        save({ device: checkedValue('device'), refused: checkedValue('refused') });
    }

    // ② 연락 방법·요청 화면
    function fillContact() {
        var data = load();
        if (!data) return;
        if (data.contact) check('contact', data.contact);
        (data.requests || []).forEach(function (v) { check('request', v); });
        var etc = document.getElementById('request-etc');
        if (etc && data.requestEtc) etc.value = data.requestEtc;
    }

    function saveContact() {
        var etc = document.getElementById('request-etc');
        save({
            contact: checkedValue('contact'),
            requests: checkedValues('request'),
            requestEtc: etc ? etc.value.trim() : ''
        });
    }

    // 호출 전 확인 화면 문구
    function describe() {
        var data = load();
        if (!data) return null;
        var result = {};

        if (data.device) {
            result.device = DEVICES[data.device] +
                (WHEELCHAIRS.indexOf(data.device) > -1 ? ' · 앉은 채 탑승 · 규격 미확인' : '');
        }

        var requests = (data.requests || []).map(function (v) { return REQUESTS[v]; });
        if (data.requestEtc) requests.push(data.requestEtc);
        result.requests = requests.length ? '미리 전할 요청 · ' + requests.join(', ') : '';

        if (data.contact) result.contact = CONTACTS[data.contact];
        return result;
    }

    return {
        fillDevice: fillDevice,
        saveDevice: saveDevice,
        fillContact: fillContact,
        saveContact: saveContact,
        describe: describe
    };
})();
