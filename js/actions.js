// 진행 화면 버튼 (시연용 · 실제로 전화가 걸리거나 메시지가 보내지지 않음)
//  <button data-action="msg">               기사님께 메시지 시트 (data-msgs="말1|말2"로 자주 쓰는 말 바꿈)
//  <button data-action="send-msg">          누르면 그 글자를 기사님께 바로 보냄
//  <button data-action="call-driver">       기사님께 전화 (안심번호 연결 화면)
//  <button data-action="call-center">       콜센터 전화
//  <button data-action="guardian">          보호자에게 지금 상황 알리기
//  <button data-action="menu" data-title="도움이 필요하세요?" data-options="call-center,guardian">
//                                           고를 수 있는 메뉴 시트 (도움 요청 · 더보기)
//  <button data-action="cancel" data-desc="...">  호출 취소 확인
//  지금 상황 문구(보호자 알림)는 #wrap[data-share-status]
var Actions = (function () {
    var config = window.APP_CONFIG || {};
    var driver = config.driver || { name: '기사님', plate: '', car: '' };
    var guardian = config.guardian || { name: '보호자', relation: '' };
    var center = config.callCenter || { name: '콜센터' };

    function esc(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function trip() {
        return window.Trip ? Trip.get() : {};
    }

    // ---------- 화면 위로 열리는 시트 ----------
    //  html: 시트 안 내용 · bind(panel, close): 버튼 연결 · 닫으면 연 버튼으로 초점이 돌아감
    function openSheet(html, bind, opener) {
        var sheet = document.createElement('div');
        sheet.className = 'modal-sheet modal-sheet--dim';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.innerHTML = '<div class="modal-sheet__panel modal-sheet__panel--msg">' +
            '<span class="sheet__grabber" aria-hidden="true"></span>' + html + '</div>';
        var panel = sheet.firstChild;
        var title = panel.querySelector('h2');
        if (title) {
            title.id = 'action-sheet-title';
            sheet.setAttribute('aria-labelledby', title.id);
        }
        document.body.appendChild(sheet);
        document.body.classList.add('is-modal-open');
        SheetDrag.panel(panel);

        function onKey(e) { if (e.key === 'Escape') close(); }
        function close(keepFocus) {
            if (!sheet.parentNode) return;
            sheet.remove();
            document.removeEventListener('keydown', onKey);
            if (!document.querySelector('.modal-sheet:not([hidden]), .call-screen')) {
                document.body.classList.remove('is-modal-open');
            }
            if (!keepFocus && opener) opener.focus();
        }
        sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
        document.addEventListener('keydown', onKey);
        bind(panel, close);
        var first = panel.querySelector('button, input');
        if (first) first.focus();
        return close;
    }

    function sheetHead(title, desc) {
        return '<div class="msg-sheet__head"><h2 class="msg-sheet__title">' + esc(title) + '</h2>' +
            (desc ? '<p class="msg-sheet__desc">' + esc(desc) + '</p>' : '') + '</div>';
    }

    // ---------- 기사님께 메시지 ----------
    function defaultMsgs() {
        return ['탑승 준비에 시간이 필요해요', (trip().pickupShort || '정문') + '에 있어요', '5분 정도 늦게 나가요', '짐이 조금 있어요'];
    }

    function sendMsg(text) {
        Toast.show('기사님께 보냈어요 · “' + text + '”');
    }

    function msg(opener) {
        var list = opener.dataset.msgs ? opener.dataset.msgs.split('|') : defaultMsgs();
        var html = sheetHead('기사님께 메시지', driver.name + ' · ' + driver.plate) +
            '<div class="msg-sheet__group">' +
                '<p class="msg-sheet__caption">자주 쓰는 말 · 누르면 바로 보내져요</p>' +
                list.map(function (text) {
                    return '<button type="button" class="quick-msg__btn quick-msg__btn--sheet" data-quick>' +
                        '<span>' + esc(text) + '</span><span class="icon icon--sm icon--send" aria-hidden="true"></span></button>';
                }).join('') +
            '</div>' +
            '<div class="msg-sheet__group">' +
                '<div class="msg-input">' +
                    '<input class="msg-input__field" type="text" placeholder="직접 입력하기" aria-label="기사님께 보낼 메시지 직접 입력" enterkeyhint="send">' +
                    '<button type="button" class="msg-input__mic" aria-label="말로 입력하기" data-mic><span class="icon icon--sm icon--microphone" aria-hidden="true"></span></button>' +
                    '<button type="button" class="msg-input__send" aria-label="보내기" data-send hidden><span class="icon icon--sm icon--send" aria-hidden="true"></span></button>' +
                '</div>' +
                '<p class="msg-sheet__hint">보내면 기사님 앱에 바로 떠요</p>' +
            '</div>';
        openSheet(html, function (panel, close) {
            panel.querySelectorAll('[data-quick]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    close();
                    sendMsg(btn.textContent.trim());
                });
            });
            var input = panel.querySelector('.msg-input__field');
            var send = panel.querySelector('[data-send]');
            var mic = panel.querySelector('[data-mic]');
            function sync() {
                var has = !!input.value.trim();
                send.hidden = !has;
                mic.hidden = has;
            }
            function sendTyped() {
                var text = input.value.trim();
                if (!text) return;
                close();
                sendMsg(text);
            }
            input.addEventListener('input', sync);
            input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendTyped(); });
            send.addEventListener('click', sendTyped);
            mic.addEventListener('click', function () { listen(input, mic, sync); });
        }, opener);
    }

    // 말로 입력 (브라우저가 음성 인식을 지원할 때만)
    function listen(input, mic, done) {
        var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return Toast.show('이 기기에서는 말로 입력할 수 없어요');
        var rec = new Recognition();
        rec.lang = 'ko-KR';
        mic.classList.add('is-listening');
        input.placeholder = '듣고 있어요…';
        rec.onresult = function (e) {
            input.value = e.results[0][0].transcript;
            done();
        };
        rec.onend = function () {
            mic.classList.remove('is-listening');
            input.placeholder = '직접 입력하기';
        };
        rec.onerror = function () { Toast.show('잘 듣지 못했어요. 다시 눌러 주세요'); };
        rec.start();
    }

    // ---------- 전화 (안심번호 연결 화면) ----------
    function call(who, opener) {
        var isDriver = who === 'driver';
        var screen = document.createElement('div');
        screen.className = 'call-screen';
        screen.setAttribute('role', 'dialog');
        screen.setAttribute('aria-modal', 'true');
        screen.setAttribute('aria-label', (isDriver ? driver.name : center.name) + ' 통화');
        screen.innerHTML =
            '<div class="call-screen__who">' +
                (isDriver
                    ? '<img class="call-screen__photo" src="image/driver.png" alt="">'
                    : '<span class="call-screen__photo call-screen__photo--icon"><span class="icon icon--lg icon--phone" aria-hidden="true"></span></span>') +
                '<p class="call-screen__name">' + esc(isDriver ? driver.name : center.name) + '</p>' +
                '<p class="call-screen__sub">' + esc(isDriver ? driver.plate + ' · ' + driver.car : '상담원 연결') + '</p>' +
                '<p class="call-screen__status" role="status">' + (isDriver ? '안심번호로 연결하고 있어요…' : '연결하고 있어요…') + '</p>' +
            '</div>' +
            '<button type="button" class="call-screen__end" aria-label="통화 끊기">' +
                '<span class="icon icon--lg icon--phone" aria-hidden="true"></span>' +
            '</button>' +
            '<p class="call-screen__note">' + (isDriver ? '내 번호는 기사님께 보이지 않아요' : '상담 시간 · 24시간') + '</p>';
        document.body.appendChild(screen);
        document.body.classList.add('is-modal-open');

        var status = screen.querySelector('.call-screen__status');
        var seconds = 0;
        var tick = null;
        var connect = setTimeout(function () {
            screen.classList.add('is-connected');
            tick = setInterval(function () {
                seconds++;
                status.textContent = '통화 중 ' + ('0' + Math.floor(seconds / 60)).slice(-2) + ':' + ('0' + seconds % 60).slice(-2);
            }, 1000);
            status.textContent = '통화 중 00:00';
        }, 2500);

        function onKey(e) { if (e.key === 'Escape') end(); }
        function end() {
            clearTimeout(connect);
            clearInterval(tick);
            screen.remove();
            document.removeEventListener('keydown', onKey);
            if (!document.querySelector('.modal-sheet:not([hidden])')) document.body.classList.remove('is-modal-open');
            Toast.show(seconds ? '통화를 마쳤어요' : '전화를 끊었어요');
            if (opener) opener.focus();
        }
        var endBtn = screen.querySelector('.call-screen__end');
        endBtn.addEventListener('click', end);
        document.addEventListener('keydown', onKey);
        endBtn.focus();
    }

    // ---------- 보호자에게 알리기 ----------
    function shareText() {
        var t = trip();
        var wrap = document.getElementById('wrap');
        var status = (wrap && wrap.dataset.shareStatus) || document.title.split('|')[0].trim();
        return '[모두의 이동] 지금 상황: ' + status + '\n' +
            '출발 · ' + (t.pickupName || '래미안베라힐즈 정문') + '\n' +
            '도착 · ' + ((t.destination && t.destination.name) || '은평성모병원');
    }

    function guardianSheet(opener) {
        var text = shareText();
        var html = sheetHead('보호자에게 알리기', guardian.name + ' 님 · ' + guardian.relation) +
            '<div class="msg-sheet__group">' +
                '<p class="msg-sheet__caption">이렇게 보내져요</p>' +
                '<p class="share-preview">' + esc(text).replace(/\n/g, '<br>') + '<br><span class="share-preview__link">실시간 위치 보기 ›</span></p>' +
            '</div>' +
            '<div class="msg-sheet__group">' +
                '<button type="button" class="btn btn--primary" data-send-guardian>' + esc(guardian.name) + ' 님에게 보내기</button>' +
                '<button type="button" class="btn btn--outline" data-share-other>다른 사람에게 공유하기</button>' +
            '</div>';
        openSheet(html, function (panel, close) {
            panel.querySelector('[data-send-guardian]').addEventListener('click', function () {
                close();
                Toast.show(guardian.name + ' 님에게 지금 상황을 보냈어요');
            });
            panel.querySelector('[data-share-other]').addEventListener('click', function () {
                close();
                if (navigator.share) {
                    navigator.share({ title: '모두의 이동', text: text, url: location.href }).catch(function () {});
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(text + '\n' + location.href).then(function () {
                        Toast.show('공유할 내용을 복사했어요');
                    }, function () { Toast.show('복사하지 못했어요'); });
                } else {
                    Toast.show('이 기기에서는 공유할 수 없어요');
                }
            });
        }, opener);
    }

    // ---------- 메뉴 (도움 요청 · 더보기) ----------
    var MENU = {
        'call-center': { icon: 'phone', label: '콜센터 상담원과 통화' },
        'call-driver': { icon: 'phone', label: '기사님께 전화' },
        'msg': { icon: 'chat', label: '기사님께 메시지' },
        'guardian': { icon: 'user-multiple', label: '보호자에게 알리기' },
        'cancel': { icon: 'close', label: '호출 취소', danger: true }
    };

    function menu(opener) {
        var options = (opener.dataset.options || 'call-center,guardian').split(',');
        var html = sheetHead(opener.dataset.title || '더보기', opener.dataset.desc) +
            '<div class="msg-sheet__group">' +
                options.map(function (key) {
                    var m = MENU[key];
                    return '<button type="button" class="quick-msg__btn--sheet menu-item' + (m.danger ? ' menu-item--danger' : '') + '" data-pick="' + key + '">' +
                        '<span class="icon icon--sm icon--' + m.icon + '" aria-hidden="true"></span>' + esc(m.label) + '</button>';
                }).join('') +
            '</div>' +
            '<button type="button" class="btn btn--close" data-close>닫기</button>';
        openSheet(html, function (panel, close) {
            panel.querySelectorAll('[data-pick]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    close(true);
                    run(btn.dataset.pick, opener);
                });
            });
            panel.querySelector('[data-close]').addEventListener('click', function () { close(); });
        }, opener);
    }

    // ---------- 호출 취소 ----------
    function cancel(opener) {
        var wrap = document.getElementById('wrap');
        var desc = (wrap && wrap.dataset.cancelDesc) || '취소하면 처음부터 다시 접수해야 해요.';
        var html = sheetHead('호출을 취소할까요?', desc) +
            '<div class="msg-sheet__group">' +
                '<button type="button" class="btn btn--danger" data-confirm>호출 취소하기</button>' +
                '<button type="button" class="btn btn--close" data-close>계속 기다릴게요</button>' +
            '</div>';
        openSheet(html, function (panel, close) {
            panel.querySelector('[data-confirm]').addEventListener('click', function () {
                close(true);
                StateNotice.leave('호출을 취소했어요');
                location.replace('index.html');
            });
            panel.querySelector('[data-close]').addEventListener('click', function () { close(); });
        }, opener);
    }

    function run(action, opener) {
        if (action === 'msg') msg(opener);
        else if (action === 'send-msg') sendMsg(opener.textContent.trim());
        else if (action === 'call-driver') call('driver', opener);
        else if (action === 'call-center') call('center', opener);
        else if (action === 'guardian') guardianSheet(opener);
        else if (action === 'menu') menu(opener);
        else if (action === 'cancel') cancel(opener);
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (btn) run(btn.dataset.action, btn);
    });

    return { run: run };
})();
