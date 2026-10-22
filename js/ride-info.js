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
            var wheelchair = WHEELCHAIRS.indexOf(data.device) > -1;
            // 휠체어 정보 추가에서 찾은 모델·규격 (없으면 규격 미확인)
            var wc = data.wheelchair && data.wheelchair.status !== 'unknown' ? data.wheelchair.label : '규격 미확인';
            result.device = DEVICES[data.device] +
                (wheelchair ? (data.otherBoarding ? ' · 다른 탑승 방법 요청 · ' + data.otherBoarding : ' · 앉은 채 탑승 · ' + wc) : '');
        }

        var requests = (data.requests || []).map(function (v) { return REQUESTS[v]; });
        if (data.requestEtc) requests.push(data.requestEtc);
        result.requests = requests.length ? '미리 전할 요청 · ' + requests.join(', ') : '';

        if (data.contact) result.contact = CONTACTS[data.contact];
        return result;
    }

    // 접수할 때 함께 전달되는 짧은 꼬리표 (차량 찾는 중 화면 · 저장 안 했으면 null)
    //  [{ text, tone: 'primary' | 'warning' | '' }]
    var REQUEST_SHORT = {
        'slow-explain': '천천히 설명',
        'text-guide': '글로 안내',
        'tell-before-help': '돕기 전에 먼저 말하기',
        'wait-answer': '답변 기다려 주기'
    };
    var CONTACT_SHORT = {
        'message': '문자·앱 메시지 · 전화 가능',
        'message-only': '문자·앱 메시지로 연락',
        'phone': '전화로 연락'
    };

    function tags() {
        var data = load();
        if (!data || !data.device) return null;
        var list = [{ text: DEVICES[data.device], tone: '' }];
        var wc = data.wheelchair || {};
        if (WHEELCHAIRS.indexOf(data.device) > -1) {
            if (data.otherBoarding) list.push({ text: '다른 탑승 방법 요청', tone: 'warning' });
            if (wc.status === 'over') list.push({ text: '규격 접수 전 확인', tone: 'warning' });
            else if (wc.status === 'model') list.push({ text: wc.model, tone: '' });
            else if (wc.status === 'size') list.push({ text: '폭 ' + wc.w + ' · 길이 ' + wc.l + 'mm', tone: '' });
            else list.push({ text: '규격 미확인', tone: '' });
            if (wc.status !== 'over' && !data.otherBoarding) list.push({ text: 'UD 가능', tone: 'primary' });
        }
        (data.requests || []).forEach(function (v) { if (REQUEST_SHORT[v]) list.push({ text: REQUEST_SHORT[v], tone: '' }); });
        if (data.requestEtc) list.push({ text: '기타 요청 있음', tone: '' });
        if (data.contact) list.push({ text: CONTACT_SHORT[data.contact], tone: '' });
        return list;
    }

    return {
        tags: tags,
        load: load,
        save: save,
        fillDevice: fillDevice,
        saveDevice: saveDevice,
        fillContact: fillContact,
        saveContact: saveContact,
        describe: describe
    };
})();
