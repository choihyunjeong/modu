// 사이트를 http로 열면 https로 다시 엶 (마이크·내 위치는 https에서만 쓸 수 있음 · 내 컴퓨터에서 열 땐 그대로)
(function () {
    var local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (location.protocol === 'http:' && !local) location.replace('https:' + location.href.slice(5));
})();

// 저장된 글자 크기를 화면이 그려지기 전에 적용 (html[data-font-size] → :root --font-scale)
(function () {
    try {
        var saved = localStorage.getItem('fontSize');
        if (saved) document.documentElement.dataset.fontSize = saved;
    } catch (e) {}
})();

// 바텀시트 끌어 올리기·내리기
// 1) 지도 아래 시트(.sheet): 손잡이를 위아래로 끌면 지도 높이가 바뀌어 시트가 올라가거나 내려감
//    놓은 자리에 그대로 멈춤 (맨 위·맨 아래까지만) · 손잡이를 누르면 기본 ↔ 접힘
// 2) 화면 위로 열린 시트(.modal-sheet__panel): 아래로 끌어 내리면 닫힘
var SheetDrag = (function () {
    var PEEK = 150;      // 접혔을 때 보이는 시트 높이
    var MAP_MIN = 96;    // 펼쳤을 때 남는 지도 높이 (뒤로 버튼 자리)

    function relayoutMaps() {
        if (window.MapKit && MapKit.relayout) MapKit.relayout();
    }

    // 손가락·마우스 끌기 공통: onMove(dy), onEnd(dy, 짧게 눌렀는지)
    function drag(handle, onStart, onMove, onEnd) {
        var startY = null;
        var lastDy = 0;
        handle.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            startY = e.clientY;
            lastDy = 0;
            handle.setPointerCapture(e.pointerId);
            onStart();
        });
        handle.addEventListener('pointermove', function (e) {
            if (startY === null) return;
            lastDy = e.clientY - startY;
            onMove(lastDy);
        });
        // 끝난 자리는 마지막으로 움직인 값으로 (취소될 때는 좌표가 0으로 와서)
        function end() {
            if (startY === null) return;
            startY = null;
            onEnd(lastDy, Math.abs(lastDy) < 6);
        }
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    function mapSheet(sheet) {
        var map = sheet.previousElementSibling;
        if (!map || !map.classList.contains('map-view')) return;
        var handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'sheet__handle';
        handle.setAttribute('aria-label', '시트 접기·펼치기');
        sheet.prepend(handle);

        // 화면은 높이가 고정(.map-page)이라 페이지는 스크롤되지 않음
        //  시트를 내리면 시트와 아래 버튼(.bottom-action)이 함께 화면 밖으로 내려가 가려지고,
        //  올리면 시트가 늘어나 남은 자리를 채움 (시트 안 내용은 시트 안에서 스크롤)
        var wrap = sheet.parentNode;
        var action = sheet.nextElementSibling;
        if (action && !action.classList.contains('bottom-action')) action = null;
        var OVERLAP = 16;    // 시트가 지도를 덮는 높이 (--sheet-overlap)

        // 기본 높이는 처음 끌 때 잼 (처음에 숨겨진 시트도 있어서)
        var base = 0;
        var sheetBase = 0;
        var startHeight = 0;
        function limits() {
            if (!base) {
                base = map.offsetHeight;
                sheetBase = sheet.offsetHeight;
            }
            return { min: MAP_MIN, base: base, max: Math.max(base, wrap.clientHeight - PEEK) };
        }

        function setHeight(h, animate) {
            var l = limits();
            map.classList.toggle('is-resizing', !animate);
            sheet.classList.toggle('is-resizing', !animate);
            map.style.height = h + 'px';
            // 시트는 기본 높이보다 작아지지 않음 → 내리면 버튼과 함께 아래로 밀려 내려감
            var room = wrap.clientHeight - h - (action ? action.offsetHeight : 0) + OVERLAP;
            sheet.style.flex = 'none';
            sheet.style.height = Math.max(sheetBase, room) + 'px';
            sheet.dataset.state = h <= MAP_MIN + 1 ? 'expanded' : (h >= l.max - 1 ? 'collapsed' : 'default');
            if (animate) setTimeout(relayoutMaps, 260);
            else relayoutMaps();
        }

        drag(handle, function () {
            startHeight = map.offsetHeight;
        }, function (dy) {
            var l = limits();
            setHeight(Math.min(l.max, Math.max(l.min, startHeight + dy)), false);
        }, function (dy, tap) {
            var l = limits();
            if (tap) {
                // 누르기: 접혀 있으면 기본으로, 아니면 접기
                return setHeight(sheet.dataset.state === 'collapsed' ? base : l.max, true);
            }
            // 놓은 자리에 그대로 멈춤 (맨 위·맨 아래 넘지 않게만)
            setHeight(Math.min(l.max, Math.max(l.min, startHeight + dy)), true);
        });
    }

    function modalPanel(panel) {
        var grabber = panel.querySelector('.sheet__grabber');
        if (!grabber) return;
        var handle = document.createElement('div');
        handle.className = 'sheet__handle';
        handle.setAttribute('aria-hidden', 'true');
        panel.prepend(handle);
        drag(handle, function () {
            panel.style.transition = 'none';
        }, function (dy) {
            panel.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
        }, function (dy) {
            panel.style.transition = '';
            panel.style.transform = '';
            // 80px 넘게 내리면 닫기 (각 화면의 '바깥 누르면 닫힘'을 그대로 씀)
            if (dy > 80) panel.parentNode.click();
        });
    }

    function init() {
        document.querySelectorAll('.sheet').forEach(mapSheet);
        document.querySelectorAll('.modal-sheet__panel').forEach(modalPanel);
    }

    return { init: init, panel: modalPanel };
})();

// 앱 안 짧은 안내 (보냈어요 · 배정됐어요 등) · 하나씩만 보이고 잠시 뒤 사라짐
//  Toast.show('관제센터에 메시지를 보냈어요', { check: true })  ·  Toast.show('UD택시가 배정됐어요', { top: true })
var Toast = (function () {
    var el = null;
    var timer = null;
    function show(text, opts) {
        opts = opts || {};
        if (!el) {
            el = document.createElement('p');
            el.className = 'app-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = text;
        if (opts.check) {
            var icon = document.createElement('span');
            icon.className = 'icon icon--sm icon--checkmark';
            icon.setAttribute('aria-hidden', 'true');
            el.prepend(icon);
        }
        el.classList.toggle('app-toast--top', !!opts.top);
        // 다시 보여 줄 때도 나타나는 움직임이 나오게
        el.classList.remove('is-shown');
        void el.offsetWidth;
        el.classList.add('is-shown');
        clearTimeout(timer);
        timer = setTimeout(function () { el.classList.remove('is-shown'); }, opts.duration || 2500);
    }
    return { show: show };
})();

// 보호자 (브라우저 localStorage · 처음엔 config.js의 예시 보호자)
//  { name, relation, phone, notify(이동 알림 받기), proxy(대신 접수), status: 'connected' | 'invited' }
//  자동 알림은 연결됐고(수락함) "이동 알림 받기"를 허용한 보호자에게만 감
var Guardians = (function () {
    var KEY = 'guardians';

    function list() {
        try {
            var saved = JSON.parse(localStorage.getItem(KEY));
            if (saved) return saved;
        } catch (e) {}
        var base = (window.APP_CONFIG && APP_CONFIG.guardians) || [];
        return base.map(function (g) { return Object.assign({ status: 'connected' }, g); });
    }

    function save(items) {
        try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    }

    // 새로 초대 (수락 대기) · 같은 번호면 설정만 바꿈
    function invite(g) {
        var items = list().filter(function (x) { return x.phone !== g.phone; });
        items.push(Object.assign({ status: 'invited' }, g));
        save(items);
    }

    function connected() {
        return list().filter(function (g) { return g.status === 'connected'; });
    }

    // 자동 알림을 받는 보호자
    function notifyTargets() {
        return connected().filter(function (g) { return g.notify; });
    }

    return { list: list, invite: invite, connected: connected, notifyTargets: notifyTargets };
})();

// 말로 입력 (브라우저 음성 인식 · 지원할 때만) · 들은 말을 입력칸 끝에 붙임
//  <button data-voice-for="입력칸 id">  ·  직접 부를 때: VoiceInput.listen(입력칸, 버튼)
var VoiceInput = (function () {
    function listen(field, button) {
        var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return Toast.show('이 기기에서는 말로 입력할 수 없어요. 직접 입력해 주세요');
        var rec = new Recognition();
        rec.lang = 'ko-KR';
        var placeholder = field.placeholder;
        if (button) button.classList.add('is-listening');
        field.placeholder = '듣고 있어요… 말씀해 주세요';
        rec.onresult = function (e) {
            var text = e.results[0][0].transcript;
            var max = field.maxLength > 0 ? field.maxLength : Infinity;
            field.value = (field.value ? field.value.replace(/\s*$/, ' ') : '') + text;
            field.value = field.value.slice(0, max);
            field.dispatchEvent(new Event('input', { bubbles: true }));
        };
        rec.onerror = function () { Toast.show('잘 듣지 못했어요. 다시 눌러 주세요'); };
        rec.onend = function () {
            if (button) button.classList.remove('is-listening');
            field.placeholder = placeholder;
        };
        rec.start();
    }
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-voice-for]');
        var field = btn && document.getElementById(btn.dataset.voiceFor);
        if (field) listen(field, btn);
    });
    return { listen: listen };
})();

// 아직 화면이 없는 버튼: <button data-soon="설정">  → "설정 화면은 아직 준비 중이에요"
document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-soon]');
    if (!el) return;
    e.preventDefault();
    var name = el.dataset.soon;
    // 받침이 있으면 "은", 없으면 "는"
    var code = name ? name.charCodeAt(name.length - 1) - 0xac00 : -1;
    var josa = code >= 0 && code <= 11171 ? (code % 28 ? '은' : '는') : '은(는)';
    Toast.show(name ? name + josa + ' 아직 준비 중이에요' : '아직 준비 중인 화면이에요');
});

// 글자 수: <span data-count-for="입력칸 id">0</span>
document.addEventListener('input', function (e) {
    if (!e.target.id) return;
    document.querySelectorAll('[data-count-for="' + e.target.id + '"]').forEach(function (el) {
        el.textContent = e.target.value.length;
    });
});

// 화면이 다음 상태로 바뀔 때 남긴 안내를 새 화면에서 보여 줌 (push.js · 호출 취소)
var StateNotice = (function () {
    var KEY = 'stateNotice';
    function leave(text) {
        try { sessionStorage.setItem(KEY, text); } catch (e) {}
    }
    function show() {
        var text = null;
        try {
            text = sessionStorage.getItem(KEY);
            sessionStorage.removeItem(KEY);
        } catch (e) {}
        if (!text) return;
        Toast.show(text, { top: true, duration: 3500 });
        // 휴대폰이면 짧게 진동 (지원할 때만)
        if (navigator.vibrate) navigator.vibrate(120);
    }
    return { leave: leave, show: show };
})();

document.addEventListener('DOMContentLoaded', function () {
    SheetDrag.init();
    StateNotice.show();

    // 다른 화면에서 수정하러 들어온 경우(?from=confirm): 저장 후 그 화면으로 돌아감
    //  [data-keep-from] 다음 단계 링크에도 from을 이어 붙임
    //  [data-return]    저장 버튼 → 들어온 화면으로 (data-return-label이 있으면 버튼 글자도 바꿈)
    var RETURN_PAGES = { confirm: 'confirm.html' };
    var from = new URLSearchParams(location.search).get('from');
    if (RETURN_PAGES[from]) {
        document.querySelectorAll('[data-keep-from]').forEach(function (a) {
            var url = new URL(a.getAttribute('href'), location.href);
            url.searchParams.set('from', from);
            a.href = url.href;
        });
        document.querySelectorAll('[data-return]').forEach(function (a) {
            a.href = RETURN_PAGES[from];
            if (a.dataset.returnLabel) a.textContent = a.dataset.returnLabel;
        });
    }

    // 뒤로 버튼: 직전 화면으로 (바로 열어서 이전 기록이 없으면 href로)
    document.querySelectorAll('[data-history-back]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            if (history.length > 1) {
                e.preventDefault();
                history.back();
            }
        });
    });

    // 하나만 고르는 칩 묶음: [data-select-group] 안의 .chip
    document.querySelectorAll('[data-select-group]').forEach(function (group) {
        var chips = group.querySelectorAll('.chip');
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip); });
            });
        });
    });

    // 글자 크기 저장 + 모든 화면에 적용
    function applyFontSize(size) {
        document.documentElement.dataset.fontSize = size;
        try { localStorage.setItem('fontSize', size); } catch (e) {}
    }
    function currentFontSize() {
        return document.documentElement.dataset.fontSize || 'normal';
    }

    // 글자 크기 칩: 고르면 바로 적용
    var fontChips = document.querySelectorAll('[data-font-size-chips] .chip');
    fontChips.forEach(function (chip) {
        chip.setAttribute('aria-pressed', chip.dataset.fontSize === currentFontSize());
        chip.addEventListener('click', function () {
            applyFontSize(chip.dataset.fontSize);
        });
    });

    // 글자 크기 시트: [data-open-font-size]로 열고, 고른 뒤 '적용하기'를 눌러야 반영
    //  [data-font-size-option] 선택지 · [data-font-size-preview] 미리보기(data-size로 크기 바뀜)
    var fontSheet = document.querySelector('[data-font-size-sheet]');
    if (fontSheet) {
        var fontOptions = fontSheet.querySelectorAll('[data-font-size-option]');
        var fontPreview = fontSheet.querySelector('[data-font-size-preview]');
        var fontPicked = currentFontSize();
        var fontOpener = null;

        var pickFontSize = function (size) {
            fontPicked = size;
            fontOptions.forEach(function (o) { o.setAttribute('aria-pressed', o.dataset.fontSizeOption === size); });
            if (fontPreview) fontPreview.dataset.size = size;
        };
        var openFontSheet = function (e) {
            fontOpener = e.currentTarget;
            pickFontSize(currentFontSize());
            fontSheet.hidden = false;
            document.body.classList.add('is-modal-open');
            var pressed = fontSheet.querySelector('[data-font-size-option][aria-pressed="true"]');
            if (pressed) pressed.focus();
        };
        var closeFontSheet = function () {
            fontSheet.hidden = true;
            document.body.classList.remove('is-modal-open');
            if (fontOpener) fontOpener.focus();
        };

        document.querySelectorAll('[data-open-font-size]').forEach(function (btn) {
            btn.addEventListener('click', openFontSheet);
        });
        fontOptions.forEach(function (o) {
            o.addEventListener('click', function () { pickFontSize(o.dataset.fontSizeOption); });
        });
        fontSheet.querySelector('[data-apply-font-size]').addEventListener('click', function () {
            applyFontSize(fontPicked);
            closeFontSheet();
        });
        // 바깥(딤) 누르기 · Esc → 적용하지 않고 닫기
        fontSheet.addEventListener('click', function (e) { if (e.target === fontSheet) closeFontSheet(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !fontSheet.hidden) closeFontSheet(); });
    }
});
