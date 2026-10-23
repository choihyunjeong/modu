// 탑승 정보 저장/불러오기 (브라우저 localStorage)
// 등록·수정 화면에서 고른 값을 저장하고, 호출 전 확인 화면에 보여줌
//
// 등록 흐름(이동 보조기기 → 휠체어 크기 → 연락 방법 → 완료)은 임시 저장(sessionStorage)에만 씀
//  완료 화면에 닿아야 진짜로 저장 · 중간에 흐름 밖(홈·호출 전 확인 등)으로 나가면 임시 저장은 버림
var RideInfo = (function () {
    var KEY = 'rideInfo';
    var DRAFT_KEY = 'rideInfoDraft';
    var FLOW_PAGES = ['ride-info.html', 'ride-info-contact.html', 'wheelchair.html'];
    var page = location.pathname.split('/').pop() || 'index.html';
    var inFlow = FLOW_PAGES.indexOf(page) > -1;

    function readSaved() {
        try {
            return JSON.parse(localStorage.getItem(KEY)) || null;
        } catch (e) {
            return null;
        }
    }
    function readDraft() {
        try {
            return JSON.parse(sessionStorage.getItem(DRAFT_KEY));
        } catch (e) {
            return null;
        }
    }
    function writeDraft(data) {
        try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) {}
    }
    function dropDraft() {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) {}
    }

    // 10/23 이전 버전은 수정 창의 기본 선택(수동 휠체어·문자 메시지만 등)이나 끝내지 않은 등록도 저장됐음
    //  → 그때 저장된 값은 한 번 지우고 새로 시작 (이미 앱을 설치한 휴대폰 포함)
    try {
        if (localStorage.getItem('rideInfoVer') !== '2') {
            localStorage.removeItem(KEY);
            localStorage.setItem('rideInfoVer', '2');
        }
    } catch (e) {}

    if (inFlow) {
        // 흐름에 처음 들어오면 지금 저장된 값에서 시작
        if (!readDraft()) writeDraft(readSaved() || {});
    } else if (page === 'ride-info-done.html') {
        // 완료: 임시 저장을 진짜로 저장
        var done = readDraft();
        if (done) {
            try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
        }
        dropDraft();
    } else {
        // 흐름 밖: 끝내지 않은 등록은 버림
        dropDraft();
    }

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

    // 등록 흐름 안에서는 임시 저장을, 밖에서는 저장된 값을 읽고 씀
    function load() {
        if (inFlow) {
            var draft = readDraft();
            return draft && Object.keys(draft).length ? draft : null;
        }
        return readSaved();
    }

    function save(patch) {
        var data = Object.assign({}, load(), patch);
        if (inFlow) return writeDraft(data);
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

    // UD택시에 탈 수 없는 보조기기 (이용 가능 휠체어: 폭 670 × 길이 1,180 × 높이 1,300mm 이내
    //  → 넘는 대형 전동휠체어 · 전동 스쿠터 등은 탑승 불가) · 다른 이동 보조기기의 "기기 이름"으로 판단
    var NOT_ALLOWED = [
        { re: /스쿠터|scooter/i,
          title: '전동스쿠터는 UD택시에 탑승할 수 없어요',
          desc: '전동스쿠터를 이용한 탑승은 지원하지 않아요. 다른 보조기기를 사용하신다면 선택을 변경해 주세요.' },
        { re: /대형/,
          title: '대형 전동휠체어는 UD택시에 탑승할 수 없어요',
          desc: 'UD택시는 폭 670mm × 길이 1,180mm × 높이 1,300mm 이내의 휠체어만 탈 수 있어요. 이 크기 안이라면 전동 휠체어를 선택해 주세요.' },
        { re: /침대|베드|들것|스트레처|눕는|누운/,
          title: '누운 채로는 UD택시에 탑승할 수 없어요',
          desc: 'UD택시는 휠체어에 앉은 채 타는 차량이에요. 누워서 이동해야 한다면 콜센터로 문의해 주세요.' }
    ];

    // 기기 이름이 탈 수 없는 기기면 { title, desc } · 아니면 null
    function blocked(name) {
        var text = String(name || '').replace(/\s+/g, '');
        if (!text) return null;
        for (var i = 0; i < NOT_ALLOWED.length; i++) if (NOT_ALLOWED[i].re.test(text)) return NOT_ALLOWED[i];
        return null;
    }

    function otherNameField() { return document.getElementById('other-device'); }

    // ① 이동 보조기기 화면
    function fillDevice() {
        var data = load();
        if (!data) return;
        if (data.device) check('device', data.device);
        if (data.refused) check('refused', data.refused);
        var field = otherNameField();
        if (field && data.otherDevice) field.value = data.otherDevice;
    }

    function saveDevice() {
        var device = checkedValue('device');
        var field = otherNameField();
        save({
            device: device,
            refused: checkedValue('refused'),
            otherDevice: device === 'other' && field ? field.value.trim() : ''
        });
    }

    // 화면에 보일 보조기기 이름 (다른 이동 보조기기는 적은 이름)
    function deviceName(data) {
        return data.device === 'other' && data.otherDevice ? data.otherDevice : DEVICES[data.device];
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
            result.device = deviceName(data) +
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
        var list = [{ text: deviceName(data), tone: '' }];
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
        blocked: blocked,
        describe: describe
    };
})();
