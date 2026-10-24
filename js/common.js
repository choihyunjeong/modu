// 사이트를 http로 열면 https로 다시 엶 (마이크·내 위치는 https에서만 쓸 수 있음 · 내 컴퓨터에서 열 땐 그대로)
(function () {
    var local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (location.protocol === 'http:' && !local) location.replace('https:' + location.href.slice(5));
})();

// 웹앱(PWA): 서비스 워커 등록 (https에서만 · 항상 최신 화면을 먼저 받고, 끊기면 저장해 둔 화면)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}

// 저장된 글자 크기를 화면이 그려지기 전에 적용 (html[data-font-size] → :root --font-scale)
(function () {
    try {
        var saved = localStorage.getItem('fontSize');
        if (saved) document.documentElement.dataset.fontSize = saved;
    } catch (e) {}
})();

// 화면 색: 자동(휴대폰 설정) · 밝게 · 어둡게 → html[data-theme="light|dark"] (화면이 그려지기 전에)
//  자동이면 휴대폰 다크모드가 바뀔 때도 따라감 · 위쪽 상태 표시줄 색(theme-color)도 맞춤
var Theme = (function () {
    var KEY = 'theme';
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function get() {
        try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; }
    }
    function apply() {
        var pick = get();
        var dark = pick === 'dark' || (pick === 'auto' && !!(mq && mq.matches));
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
            m.setAttribute('content', dark ? '#1f1f1f' : '#ffffff');
        });
    }
    function set(pick) {
        try { localStorage.setItem(KEY, pick); } catch (e) {}
        apply();
    }
    apply();
    if (mq && mq.addEventListener) mq.addEventListener('change', apply);
    return { get: get, set: set };
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

    // 시트 안 내용을 손가락으로 끌 때: 시트를 움직일지(takeOver) 안을 스크롤할지 처음 움직인 방향으로 정함
    //  takeOver(dy): dy < 0 위로, dy > 0 아래로 · true면 시트가 손가락을 따라 움직이고 안은 스크롤되지 않음
    function contentDrag(area, takeOver, onStart, onMove, onEnd) {
        var startX = 0, startY = 0, mode = null;
        area.addEventListener('touchstart', function (e) {
            // 글 쓰는 칸·슬라이더·지도 안에서는 원래대로
            if (e.touches.length !== 1 || e.target.closest('input, textarea, select, [contenteditable], .map-view')) { mode = 'none'; return; }
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            mode = null;
        }, { passive: true });
        area.addEventListener('touchmove', function (e) {
            if (mode === 'none' || e.touches.length !== 1) return;
            var dx = e.touches[0].clientX - startX;
            var dy = e.touches[0].clientY - startY;
            if (mode === null) {
                if (!dy || Math.abs(dx) > Math.abs(dy)) {
                    if (Math.abs(dx) > 4) mode = 'none';    // 옆으로 넘기는 칩 목록 등은 그대로
                    return;
                }
                if (!takeOver(dy)) { mode = 'none'; return; }
                mode = 'sheet';
                onStart();
            }
            if (e.cancelable) e.preventDefault();
            onMove(dy);
        }, { passive: false });
        function end(e) {
            if (mode !== 'sheet') { mode = null; return; }
            mode = null;
            var t = e.changedTouches && e.changedTouches[0];
            onEnd(t ? t.clientY - startY : 0);
        }
        area.addEventListener('touchend', end);
        area.addEventListener('touchcancel', end);

        // 컴퓨터(마우스)로 끌 때도 같게 · 6px 넘게 움직여야 끌기로 봄 (그냥 누르기는 그대로 클릭)
        var mStart = null, mMode = null, mDy = 0;
        area.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || e.target.closest('input, textarea, select, [contenteditable], .map-view')) return;
            mStart = e.clientY;
            mMode = null;
            mDy = 0;
        });
        document.addEventListener('mousemove', function (e) {
            if (mStart === null) return;
            mDy = e.clientY - mStart;
            if (mMode === null) {
                if (Math.abs(mDy) < 6) return;
                if (!takeOver(mDy)) { mMode = 'none'; return; }
                mMode = 'sheet';
                document.body.style.userSelect = 'none';
                onStart();
            }
            if (mMode !== 'sheet') return;
            e.preventDefault();
            onMove(mDy);
        });
        document.addEventListener('mouseup', function () {
            if (mStart === null) return;
            var was = mMode;
            mStart = null;
            mMode = null;
            if (was !== 'sheet') return;
            document.body.style.userSelect = '';
            onEnd(mDy);
            // 끌고 놓은 자리의 버튼이 눌리지 않게 (바로 뒤 클릭 한 번만 막음)
            function stop(ev) { ev.stopPropagation(); ev.preventDefault(); }
            area.addEventListener('click', stop, true);
            setTimeout(function () { area.removeEventListener('click', stop, true); }, 0);
        });
    }

    function mapSheet(sheet) {
        var map = sheet.previousElementSibling;
        if (!map || !map.classList.contains('map-view')) return;
        var handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'sheet__handle';
        handle.setAttribute('aria-label', '시트 접기·펼치기');

        // 손잡이·그래버를 뺀 내용을 스크롤 칸으로 감쌈 (손잡이는 늘 맨 위에 보이게)
        var scroller = document.createElement('div');
        scroller.className = 'sheet__scroll';
        Array.prototype.slice.call(sheet.childNodes).forEach(function (node) {
            if (node.nodeType === 1 && node.classList.contains('sheet__grabber')) return;
            scroller.appendChild(node);
        });
        sheet.appendChild(scroller);
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
            // 가장 높이 올린 자리: 시트 내용이 다 보이는 데까지 (더 올려도 빈칸만 생기니 막음 · 내용이 길면 지도 96px까지)
            var need = sheet.offsetHeight - scroller.clientHeight + scroller.scrollHeight;
            var room = wrap.clientHeight - (action ? action.offsetHeight : 0) + OVERLAP;
            var top = Math.min(base, Math.max(MAP_MIN, room - need));
            return { min: top, base: base, max: Math.max(base, wrap.clientHeight - PEEK) };
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
            sheet.dataset.state = h <= l.min + 1 ? 'expanded' : (h >= l.max - 1 ? 'collapsed' : 'default');
            handle.setAttribute('aria-expanded', sheet.dataset.state !== 'collapsed');
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

        // 처음 열 때 시트 내용이 다 보이게 (화면 틀에 data-sheet-fit · 호출 진행 화면)
        //  지도를 줄여 시트를 늘리되 지도는 화면의 data-sheet-fit %(기본 15%)보다 작아지지 않음 · 내용이 길면 나머지는 시트 안에서 스크롤
        //  기본 높이보다 지도를 키우지는 않음 · 진행에 따라 내용이 바뀌면 다시 맞춤 (사용자가 시트를 직접 움직였으면 그대로)
        var fitMin = wrap.hasAttribute('data-sheet-fit') ? (Number(wrap.dataset.sheetFit) || 15) : 0;
        var moved = false;
        function fitContent() {
            if (!fitMin || moved || !wrap.clientHeight) return;
            limits();
            // 시트 전체 = 손잡이·간격(시트 높이 - 내용 칸 높이) + 내용 전체 길이
            var need = sheet.offsetHeight - scroller.clientHeight + scroller.scrollHeight;
            var room = wrap.clientHeight - (action ? action.offsetHeight : 0) + OVERLAP;
            var h = Math.round(Math.max(MAP_MIN, wrap.clientHeight * fitMin / 100, Math.min(base, room - need)));
            if (Math.abs(h - map.offsetHeight) < 2) return;
            sheetBase = 0;
            setHeight(h, false);
            base = h;
            sheetBase = sheet.offsetHeight;
        }
        if (fitMin) {
            ['pointerdown', 'touchstart', 'wheel'].forEach(function (type) {
                handle.addEventListener(type, function () { moved = true; }, { passive: true });
            });
            scroller.addEventListener('touchmove', function () { if (sheet.classList.contains('is-resizing')) moved = true; }, { passive: true });
            scroller.addEventListener('wheel', function () { if (sheet.classList.contains('is-resizing')) moved = true; }, { passive: true });
            requestAnimationFrame(fitContent);
            window.addEventListener('load', fitContent);
            window.addEventListener('resize', fitContent);
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitContent);
            // 그림이 늦게 뜨거나 진행 상태로 글이 바뀌어 내용 길이가 달라지면 다시
            if (window.ResizeObserver) {
                var watch = new ResizeObserver(function () { requestAnimationFrame(fitContent); });
                Array.prototype.forEach.call(scroller.children, function (el) { watch.observe(el); });
            }
        }

        // 키보드(Enter·Space)·화면 읽기 프로그램으로 누를 때도 접기 ↔ 펼치기 (손가락·마우스는 위 끌기에서 처리)
        handle.setAttribute('aria-expanded', 'true');
        handle.addEventListener('click', function (e) {
            if (e.detail !== 0) return;
            var l = limits();
            setHeight(sheet.dataset.state === 'collapsed' ? base : l.max, true);
        });

        // 시트 안 어디를 끌어도 시트가 움직임
        //  위로: 다 펼쳐질 때까지는 시트가 올라가고, 다 펼친 뒤에야 안이 스크롤됨
        //  아래로: 안이 맨 위일 때는 시트가 내려가고, 스크롤된 상태면 먼저 안이 위로 스크롤됨
        var lastDy = 0;
        contentDrag(scroller, function (dy) {
            if (dy < 0) return map.offsetHeight > limits().min + 1;
            return scroller.scrollTop <= 0;
        }, function () {
            startHeight = map.offsetHeight;
            lastDy = 0;
        }, function (dy) {
            var l = limits();
            lastDy = dy;
            setHeight(Math.min(l.max, Math.max(l.min, startHeight + dy)), false);
        }, function () {
            var l = limits();
            setHeight(Math.min(l.max, Math.max(l.min, startHeight + lastDy)), true);
        });

        // 마우스 휠: 아래로 굴리면 시트가 다 펼쳐질 때까지 올라가고, 위로 굴리면 안이 맨 위일 때 시트가 내려감
        var wheelEnd = null;
        scroller.addEventListener('wheel', function (e) {
            if (e.ctrlKey) return;    // 확대·축소
            var l = limits();
            var delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
            var h = map.offsetHeight;
            var up = delta > 0 && h > l.min + 1;
            var down = delta < 0 && scroller.scrollTop <= 0 && h < l.max - 1;
            if (!up && !down) return;
            e.preventDefault();
            setHeight(Math.min(l.max, Math.max(l.min, h - delta)), false);
            clearTimeout(wheelEnd);
            wheelEnd = setTimeout(relayoutMaps, 150);
        }, { passive: false });
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

        // 시트 안 내용을 아래로 끌어도 (안이 맨 위일 때) 시트가 따라 내려감
        var lastDy = 0;
        contentDrag(panel, function (dy) {
            if (dy < 0) return false;
            return panel.scrollTop <= 0 && !innerScrolled(panel);
        }, function () {
            panel.style.transition = 'none';
            lastDy = 0;
        }, function (dy) {
            lastDy = dy;
            panel.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
        }, function () {
            panel.style.transition = '';
            panel.style.transform = '';
            if (lastDy > 80) panel.parentNode.click();
        });
    }

    // 시트 안에 따로 스크롤되는 칸이 있고 그게 내려가 있으면 그 칸을 먼저 스크롤
    function innerScrolled(panel) {
        var boxes = panel.querySelectorAll('*');
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].scrollTop > 0 && boxes[i].scrollHeight > boxes[i].clientHeight) return true;
        }
        return false;
    }

    function init() {
        document.querySelectorAll('.sheet').forEach(mapSheet);
        document.querySelectorAll('.modal-sheet__panel').forEach(modalPanel);
    }

    return { init: init, panel: modalPanel };
})();

// 출발지와 도착지가 너무 가까울 때 (집에서 집 등) · 딤 위로 아래에서 올라오는 안내 시트
//  NearSheet.show(누른 버튼) · 바깥·닫기·Esc·아래로 끌면 닫힘 · "도착지 다시 고르기"는 검색 화면으로
var NearSheet = (function () {
    function show(opener) {
        if (document.querySelector('.modal-sheet--near')) return;
        var dist = window.Trip && Trip.distText ? Trip.distText() : '';
        var layer = document.createElement('div');
        layer.className = 'modal-sheet modal-sheet--near';
        layer.setAttribute('role', 'alertdialog');
        layer.setAttribute('aria-modal', 'true');
        layer.setAttribute('aria-labelledby', 'near-title');
        layer.setAttribute('aria-describedby', 'near-desc');
        layer.innerHTML =
            '<div class="modal-sheet__panel near-sheet">' +
                '<span class="sheet__grabber" aria-hidden="true"></span>' +
                '<span class="near-sheet__icon" aria-hidden="true">!</span>' +
                '<h2 class="near-sheet__title" id="near-title" tabindex="-1">출발지와 도착지를 다시 확인해 주세요</h2>' +
                '<p class="near-sheet__desc" id="near-desc">두 곳이 너무 가까워서' + (dist ? '(' + dist + ')' : '') + ' 호출할 수 없어요.<br>출발지나 도착지를 바꾼 뒤 다시 호출해 주세요.</p>' +
                '<div class="near-sheet__actions">' +
                    '<a href="search.html" class="btn btn--primary">도착지 다시 고르기</a>' +
                    '<button type="button" class="btn btn--text" data-near-close>닫기</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(layer);
        document.body.classList.add('is-modal-open');
        SheetDrag.panel(layer.firstChild);

        function close() {
            layer.remove();
            document.removeEventListener('keydown', onKey);
            if (!document.querySelector('.modal-sheet:not([hidden])')) document.body.classList.remove('is-modal-open');
            if (opener && opener.focus) opener.focus();
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        layer.addEventListener('click', function (e) { if (e.target === layer) close(); });
        layer.querySelector('[data-near-close]').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        // 올라오는 움직임 뒤 제목으로 초점 (화면 읽기 프로그램이 바로 읽도록)
        requestAnimationFrame(function () { layer.classList.add('is-open'); });
        layer.querySelector('#near-title').focus();
    }
    return { show: show };
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

// 보호자 (브라우저 localStorage · 처음엔 아무도 없음)
//  { relation, phone, notify(이동 알림 받기), proxy(대신 접수), status: 'connected' | 'invited', invitedAt }
//  보호자 연결에서 초대 → "수락 대기 중" → 시연용으로 잠시(ACCEPT_MS) 뒤 상대가 수락한 것으로 처리
//  자동 알림은 연결됐고(수락함) "이동 알림 받기"를 허용한 보호자에게만 감
var Guardians = (function () {
    var KEY = 'guardians';
    var ACCEPT_MS = 10000;

    function read() {
        try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
    }

    function save(items) {
        try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    }

    // 수락 대기 중인 초대가 충분히 지났으면 연결로 바꾸고, 새로 연결된 보호자를 돌려줌
    function acceptPending() {
        var items = read();
        var accepted = [];
        items.forEach(function (g) {
            if (g.status === 'invited' && Date.now() - (g.invitedAt || 0) > ACCEPT_MS) {
                g.status = 'connected';
                g.justAccepted = true;   // 다음 화면에서 "수락했어요"를 한 번 알려 줌
                accepted.push(g);
            }
        });
        if (accepted.length) save(items);
        return accepted;
    }

    function list() {
        acceptPending();
        return read();
    }

    // 새로 초대 (수락 대기) · 같은 번호면 설정만 바꿈
    function invite(g) {
        var items = read().filter(function (x) { return x.phone !== g.phone; });
        items.push(Object.assign({ status: 'invited', invitedAt: Date.now() }, g));
        save(items);
    }

    // 화면에 보이는 이름: 관계 + 가린 번호 (가족 010-12••-••78)
    function label(g) {
        var phone = (g.phone || '').replace(/^(\d{3})-(\d{2})\d{1,2}-\d{2}(\d{2})$/, '$1-$2••-••$3');
        return (g.relation ? g.relation + ' ' : '') + phone;
    }

    function connected() {
        return list().filter(function (g) { return g.status === 'connected'; });
    }

    // 자동 알림을 받는 보호자
    function notifyTargets() {
        return connected().filter(function (g) { return g.notify; });
    }

    // 막 수락한 보호자를 한 번만 알려 줌
    function announceAccepted() {
        acceptPending();
        var items = read();
        var fresh = items.filter(function (g) { return g.justAccepted; });
        if (!fresh.length) return;
        items.forEach(function (g) { delete g.justAccepted; });
        save(items);
        Toast.show(fresh.map(label).join(', ') + ' 님이 보호자 연결을 수락했어요', { check: true, top: true, duration: 4000 });
    }

    return { list: list, invite: invite, connected: connected, notifyTargets: notifyTargets, label: label, announceAccepted: announceAccepted };
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
// 앞서 열었던 화면으로 되돌아가기 (새로 열지 않음 → 뒤로 가기가 두 화면 사이를 오가며 반복되지 않게)
//  화면마다 열릴 때 방문 기록 위치를 적어 두고, Nav.backTo('favorites.html')면 그 위치까지 뒤로
//  적어 둔 기록이 없으면(바로 연 경우) 그 화면으로 바꿔 열기
var Nav = (function () {
    var KEY = 'navPos';
    function positions() {
        try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
    }
    function page(url) {
        return url.split('/').pop().split(/[?#]/)[0] || 'index.html';
    }
    function mark() {
        var all = positions();
        all[page(location.pathname)] = history.length;
        try { sessionStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
    }
    function backTo(url) {
        var pos = positions()[page(url)];
        var steps = pos ? pos - history.length : 0;
        if (steps < 0) history.go(steps);
        else location.replace(url);
    }
    return { mark: mark, backTo: backTo };
})();
Nav.mark();

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
    // 뒤로 가기로 돌아온 화면(브라우저가 그대로 보여 줌)에서도 남겨 둔 안내를 보여 줌
    window.addEventListener('pageshow', function (e) { if (e.persisted) StateNotice.show(); });
    // 다른 안내와 겹치지 않게 조금 뒤에
    setTimeout(Guardians.announceAccepted, 1200);

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
        // 화면 색: 누르면 바로 바뀜 (글자 크기와 달리 '적용하기'를 기다리지 않음 · 바뀐 색을 바로 보며 고름)
        var themeOptions = fontSheet.querySelectorAll('[data-theme-option]');
        var syncTheme = function () {
            themeOptions.forEach(function (o) { o.setAttribute('aria-pressed', o.dataset.themeOption === Theme.get()); });
        };
        themeOptions.forEach(function (o) {
            o.addEventListener('click', function () {
                Theme.set(o.dataset.themeOption);
                syncTheme();
            });
        });
        syncTheme();
        // 열 때마다 지금 고른 화면 색으로 표시 (다른 화면에서 바꿨을 수도 있음)
        document.querySelectorAll('[data-open-font-size]').forEach(function (btn) {
            btn.addEventListener('click', syncTheme);
        });
        // 바깥(딤) 누르기 · Esc → 적용하지 않고 닫기
        fontSheet.addEventListener('click', function (e) { if (e.target === fontSheet) closeFontSheet(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !fontSheet.hidden) closeFontSheet(); });
    }
});
