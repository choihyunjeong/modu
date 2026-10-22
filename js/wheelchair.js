// 휠체어 정보 추가 (휠체어정보_v13 A·B 흐름 · 시연용 · 사진 인식은 흉내만 냄)
//  화면은 주소 끝 #a0 · #a1 · #a1b · #a2 · #a2m · #a2x · #a4 · #a5 · #b1 · #b2 로 바뀌고, 뒤로 가기로 돌아감
//  저장하면 ② 연락과 요청(ride-info-contact.html)으로 · 호출 전 확인에서 왔으면(?from=confirm) 그 화면으로
(function () {
    var LIMIT = { w: 670, l: 1180, h: 1300 };   // 서울 UD택시 이용 기준 (mm)
    // 모델 예시 (실제 서비스에선 제조사 자료 검색)
    var MODELS = [
        { name: 'A사 B500', type: '전동', w: 620, l: 1110, h: 980 },
        { name: 'A사 B500 Plus', type: '전동', w: 640, l: 1150, h: 1000 },
        { name: 'A사 B500 Junior', type: '전동', w: 560, l: 1020, h: 920 },
        { name: 'C사 M300', type: '수동', w: 600, l: 1000, h: 900 },
        { name: 'C사 M300 Light', type: '수동', w: 580, l: 980, h: 880 },
        { name: 'D사 Smart 20', type: '전동', w: 610, l: 1080, h: 960 }
    ];
    var picked = MODELS[0];
    var cameraMode = 'label';   // label (A1) | photo (A1b)
    var stream = null;

    var from = new URLSearchParams(location.search).get('from');
    var NEXT = from === 'confirm' ? 'confirm.html' : 'ride-info-contact.html';

    function num(n) { return n.toLocaleString('ko-KR'); }
    function sizeText(m) { return '폭 ' + num(m.w) + ' · 길이 ' + num(m.l) + ' · 높이 ' + num(m.h) + 'mm'; }

    // ---------- 화면 바꾸기 ----------
    var steps = document.querySelectorAll('[data-step]');
    var title = document.querySelector('[data-wc-title]');
    var header = document.querySelector('[data-wc-header]');

    function show() {
        var key = location.hash.slice(1) || 'a0';
        var stepKey = key === 'a1b' ? 'a1' : key;
        if (!document.querySelector('[data-step="' + stepKey + '"]')) stepKey = key = 'a0';
        steps.forEach(function (s) { s.hidden = s.dataset.step !== stepKey; });
        var step = document.querySelector('[data-step="' + stepKey + '"]');
        title.textContent = key === 'a1b' ? '휠체어 사진 찍기' : step.dataset.title;
        header.classList.toggle('app-header--dark', stepKey === 'a1');
        document.body.classList.toggle('wc-dark', stepKey === 'a1');
        if (stepKey === 'a1') openCamera(key === 'a1b' ? 'photo' : 'label');
        else closeCamera();
        if (key === 'a2m') renderCandidates('[data-cand-list]', document.getElementById('wc-model-input').value);
        if (key === 'a4') renderCandidates('[data-cand-list-photo]', 'A사 B500');
        if (key === 'a2') renderPicked();
        window.scrollTo(0, 0);
        var heading = step.querySelector('h2, .wc-empty-state__title');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
    }
    window.addEventListener('hashchange', show);

    // 뒤로: 이 흐름 안에서 왔으면 이전 화면, 처음 화면이면 탑승 정보 등록으로
    document.querySelector('[data-wc-back]').addEventListener('click', function () {
        if (location.hash && location.hash !== '#a0' && history.length > 1) history.back();
        else location.href = 'ride-info.html' + (from ? '?from=' + from : '');
    });

    // ---------- 저장 ----------
    function save(wheelchair, message) {
        RideInfo.save({ wheelchair: wheelchair });
        StateNotice.leave(message);
        location.href = NEXT + (from ? '?from=' + from : '');
    }

    document.querySelectorAll('[data-save-unknown]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            save({ status: 'unknown', label: '규격 미확인 · 나중에 추가할 수 있어요' }, '"규격 미확인"으로 저장했어요');
        });
    });

    // ---------- A1 · A1b 카메라 ----------
    var video = document.querySelector('[data-cam-video]');
    var reading = document.querySelector('[data-cam-reading]');
    var camFile = document.querySelector('[data-cam-file]');
    var albumFile = document.querySelector('[data-album-file]');

    function openCamera(mode) {
        cameraMode = mode;
        var label = mode === 'label';
        document.querySelector('[data-cam-title]').innerHTML = label ? '제품 정보가 적힌 스티커를<br>찍어주세요' : '휠체어 전체가 틀 안에<br>들어오게 해 주세요';
        document.querySelector('[data-cam-chip]').textContent = label ? '제조사·모델명·바코드가 함께 보이게' : '라벨이나 모델명이 보이면 더 정확해요';
        document.querySelector('[data-cam-tip2]').textContent = label ? '글자가 또렷하게 보이면 바로 읽어요' : '바퀴부터 손잡이까지 다 나오게';
        document.querySelector('[data-cam-caption]').textContent = label ? '찍은 사진은 모델을 찾는 데만 써요' : '찍은 사진은 모델 후보를 찾는 데만 써요';
        document.querySelector('[data-cam-link]').hidden = !label;
        document.querySelector('[data-cam-frame]').classList.toggle('wc-camera__frame--photo', !label);
        reading.hidden = true;
        // 휴대폰 뒤쪽 카메라를 틀 안에 바로 보여 줌 (안 되면 찍기 버튼이 기본 카메라 앱을 엶)
        if (stream || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
            stream = s;
            video.srcObject = s;
            video.play();
            video.classList.add('is-on');
        }).catch(function () {});
    }

    function closeCamera() {
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = null;
        video.classList.remove('is-on');
        video.srcObject = null;
    }

    // 찍은 뒤: 잠깐 "읽는 중…" → 라벨이면 결과 확인(A2), 전체 사진이면 비슷한 모델(A4)
    function afterShot() {
        reading.hidden = false;
        setTimeout(function () {
            if (cameraMode === 'label') {
                picked = MODELS[0];
                location.hash = 'a2';
            } else {
                location.hash = 'a4';
            }
        }, 1500);
    }

    document.querySelector('[data-shutter]').addEventListener('click', function () {
        if (stream) afterShot();
        else camFile.click();
    });
    camFile.addEventListener('change', function () { if (camFile.files.length) afterShot(); });

    // 앨범에서 고르기 (A0의 "앨범에서 선택"은 라벨 사진으로)
    document.querySelectorAll('[data-album]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.dataset.album === 'label') cameraMode = 'label';
            albumFile.click();
        });
    });
    albumFile.addEventListener('change', function () {
        if (!albumFile.files.length) return;
        if (location.hash.slice(1).indexOf('a1') !== 0) location.hash = cameraMode === 'label' ? 'a1' : 'a1b';
        setTimeout(afterShot, 50);
    });

    // 플래시 (지원하는 휴대폰만)
    document.querySelector('[data-flash]').addEventListener('click', function () {
        var btn = this;
        var on = btn.getAttribute('aria-pressed') !== 'true';
        var track = stream && stream.getVideoTracks()[0];
        var caps = track && track.getCapabilities ? track.getCapabilities() : {};
        if (!caps.torch) return Toast.show('이 기기에서는 플래시를 켤 수 없어요');
        track.applyConstraints({ advanced: [{ torch: on }] }).then(function () {
            btn.setAttribute('aria-pressed', on);
            document.querySelector('[data-flash-state]').textContent = on ? '켬' : '끔';
        });
    });

    // ---------- A2 결과 확인 ----------
    function renderPicked() {
        document.querySelector('[data-a2-name]').textContent = picked.name + ' · ' + picked.type + ' 휠체어';
        document.querySelector('[data-a2-size]').textContent = sizeText(picked) + ' (제조사 자료)';
    }

    document.querySelectorAll('input[name="a2-match"]').forEach(function (r) {
        r.addEventListener('change', function () {
            document.querySelector('[data-a2-mods]').hidden = r.value !== 'yes';
        });
    });

    document.querySelector('[data-a2-save]').addEventListener('click', function () {
        var match = document.querySelector('input[name="a2-match"]:checked').value;
        if (match === 'no') return (location.hash = 'a2x');
        var mods = document.querySelector('input[name="a2-mods"]:checked').value === 'yes';
        save({
            status: 'model', model: picked.name, type: picked.type,
            w: picked.w, l: picked.l, h: picked.h, mods: mods,
            label: picked.name + ' · 폭 ' + num(picked.w) + ' · 길이 ' + num(picked.l) + 'mm' + (mods ? ' · 부착물 있음' : '')
        }, '휠체어 정보를 저장했어요');
    });

    // ---------- A2m · A4 후보 ----------
    function renderCandidates(selector, query) {
        var list = document.querySelector(selector);
        var q = (query || '').replace(/\s/g, '').toLowerCase();
        var items = MODELS.filter(function (m) { return !q || m.name.replace(/\s/g, '').toLowerCase().indexOf(q) > -1; }).slice(0, 5);
        if (selector === '[data-cand-list-photo]') items = MODELS.slice(0, 3);
        list.innerHTML = items.map(function (m, i) {
            return '<label class="choice-list__item"><input type="radio" class="radio" name="' + selector + '" value="' + MODELS.indexOf(m) + '">' +
                '<span class="choice-list__text"><span class="choice-list__title">' + m.name + ' · ' + m.type + '</span>' +
                '<span class="choice-list__desc">' + sizeText(m) + '</span></span></label>';
        }).join('');
        var count = document.querySelector('[data-cand-count]');
        if (selector === '[data-cand-list]') {
            count.textContent = '후보 ' + items.length + '개';
            document.querySelector('[data-cand-empty]').hidden = items.length > 0;
            list.hidden = !items.length;
        }
        var pick = document.querySelector(selector === '[data-cand-list]' ? '[data-cand-pick]' : '[data-cand-pick-photo]');
        pick.disabled = true;
        list.onchange = function () { pick.disabled = false; };
    }

    var modelInput = document.getElementById('wc-model-input');
    modelInput.addEventListener('input', function () { renderCandidates('[data-cand-list]', modelInput.value); });

    function pickFrom(selector, desc) {
        var checked = document.querySelector(selector + ' input:checked');
        if (!checked) return;
        picked = MODELS[Number(checked.value)];
        document.querySelector('[data-a2-desc]').textContent = desc;
        location.hash = 'a2';
    }
    document.querySelector('[data-cand-pick]').addEventListener('click', function () {
        pickFrom('[data-cand-list]', '검색으로 찾은 모델이에요. 실제 기기와 같은지 확인해 주세요.');
    });
    document.querySelector('[data-cand-pick-photo]').addEventListener('click', function () {
        pickFrom('[data-cand-list-photo]', '사진으로 찾은 모델이에요. 라벨이나 설명서와 비교해 확인해 주세요.');
    });

    // ---------- B2 규격 입력 (기준을 넘으면 B2x) ----------
    var sizeInputs = { w: document.querySelector('[data-size="w"]'), l: document.querySelector('[data-size="l"]') };
    var over = document.querySelector('[data-size-over]');

    function value(key) { return Number(sizeInputs[key].value.replace(/[^0-9]/g, '')) || 0; }

    // 숫자에 쉼표 (1,100)
    Object.keys(sizeInputs).forEach(function (key) {
        sizeInputs[key].addEventListener('input', function () {
            var n = value(key);
            sizeInputs[key].value = n ? num(n) : '';
            setOver([]);
        });
    });

    function setOver(keys) {
        var on = keys.length > 0;
        over.hidden = !on;
        ['w', 'l'].forEach(function (k) {
            document.querySelector('[data-size-box="' + k + '"]').classList.toggle('is-error', keys.indexOf(k) > -1);
            sizeInputs[k].setAttribute('aria-invalid', keys.indexOf(k) > -1);
        });
        document.querySelector('[data-b2-title]').textContent = on ? '잰 값을 입력해 주세요' : '규격을 입력해 주세요';
        document.querySelector('[data-height-desc]').textContent = on ? '확인 필요 · 차량을 부르기 전에 함께 확인해요' : '높이를 모르셔도 저장하고 호출할 수 있어요. 탑승 가능 여부는 확인되지 않은 상태로 남아요.';
        document.querySelector('[data-height-badge]').hidden = !on;
        document.querySelector('[data-size-save]').textContent = on ? '입력값 다시 확인' : '입력한 정보로 저장';
        var help = document.querySelector('[data-size-help]');
        var tel = (window.APP_CONFIG && APP_CONFIG.callCenter && APP_CONFIG.callCenter.tel) || '';
        help.hidden = !on || !tel;
        help.href = 'tel:' + tel.replace(/[^0-9]/g, '');
        if (on) {
            var parts = keys.map(function (k) {
                return (k === 'w' ? '폭' : '길이') + '(' + num(value(k)) + 'mm)';
            });
            var limits = keys.map(function (k) { return num(LIMIT[k]) + 'mm'; });
            document.querySelector('[data-size-over-text]').textContent =
                '입력한 ' + parts.join('·') + '이 이용 기준(' + limits.join('·') + ')을 넘어요. 입력값과 단위(mm)를 한 번 더 확인해 주세요.';
        }
    }

    var confirmedOver = false;
    document.querySelector('[data-size-save]').addEventListener('click', function () {
        var w = value('w'), l = value('l');
        if (!w || !l) {
            Toast.show('폭과 길이를 입력해 주세요');
            (w ? sizeInputs.l : sizeInputs.w).focus();
            return;
        }
        var bad = [];
        if (w > LIMIT.w) bad.push('w');
        if (l > LIMIT.l) bad.push('l');
        // 기준을 넘으면 한 번 확인 · 다시 눌러도 그대로면 그 값으로 저장 (접수 전 확인)
        if (bad.length && !confirmedOver) {
            confirmedOver = true;
            setOver(bad);
            sizeInputs[bad[0]].focus();
            return;
        }
        var mods = document.querySelector('[data-size-mods]').checked;
        save({
            status: bad.length ? 'over' : 'size', w: w, l: l, mods: mods,
            label: '폭 ' + num(w) + ' · 길이 ' + num(l) + 'mm' + (bad.length ? ' · 접수 전 확인' : '') + (mods ? ' · 부착물 있음' : '')
        }, '휠체어 규격을 저장했어요');
    });
    Object.keys(sizeInputs).forEach(function (k) {
        sizeInputs[k].addEventListener('input', function () { confirmedOver = false; });
    });

    // 말로 입력: "폭 620 길이 1100" → 숫자 두 개를 폭·길이에
    document.querySelector('[data-size-voice]').addEventListener('click', function () {
        var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return Toast.show('이 기기에서는 말로 입력할 수 없어요. 직접 입력해 주세요');
        var rec = new Recognition();
        rec.lang = 'ko-KR';
        var btn = this;
        btn.classList.add('is-listening');
        rec.onresult = function (e) {
            var text = e.results[0][0].transcript.replace(/,/g, '');
            var nums = text.match(/\d+/g) || [];
            if (nums[0]) sizeInputs.w.value = num(Number(nums[0]));
            if (nums[1]) sizeInputs.l.value = num(Number(nums[1]));
            if (!nums.length) Toast.show('숫자를 듣지 못했어요. "폭 620, 길이 1100"처럼 말해 주세요');
            confirmedOver = false;
            setOver([]);
        };
        rec.onend = function () { btn.classList.remove('is-listening'); };
        rec.start();
    });

    // 이전에 저장한 규격이 있으면 채워 둠
    var saved = (RideInfo.load() || {}).wheelchair;
    if (saved && saved.w) {
        sizeInputs.w.value = num(saved.w);
        sizeInputs.l.value = num(saved.l);
    }

    show();
})();
