// 진행 화면 버튼 · 피그마 "승객화면_수정" F 흐름 (시연용 · 요청·메시지는 실제로 보내지지 않음)
//  <button data-action="more">          F8 더보기 메뉴 (보호자 공유 · 호출 취소)
//  <button data-action="share">         F3 보호자 공유 시트 / F3b 공유 중 (중단)
//  <button data-action="cancel">        F1 호출 취소 확인 (배정 전) / F2 (배정 후) · #wrap[data-cancel-stage="before|after"]
//  <button data-action="help">          F6a 도움 요청 (탑승 전) / F6b (이동 중) · #wrap[data-stage="riding"]
//  <button data-action="compose">       F6c 관제센터에 메시지 보내기
//  <button data-action="requests">      F6d 이번 이동의 요청 내역
//  <button data-action="quick-send">    빠른 메시지 · 누르면 같은 자리에서 "기사님께 보냈어요"로 바뀜
//  <button data-action="call-driver">   휴대폰 전화 앱으로 기사님 번호 (config.js)
//  <button data-action="call-center">   휴대폰 전화 앱으로 관제센터 번호 (config.js)
//  [data-help-status]  도움 요청을 보낸 뒤에만 보이는 상태 줄 · [data-help-label] 버튼 글자 → "추가 도움 요청"
var Actions = (function () {
    var config = window.APP_CONFIG || {};
    var driver = config.driver || {};
    var center = config.callCenter || {};

    function esc(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function clock(time) {
        var d = new Date(time);
        var h = d.getHours();
        return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function wrapData(name) {
        var wrap = document.getElementById('wrap');
        return wrap ? wrap.dataset[name] : undefined;
    }

    function trip() { return window.Trip ? Trip.get() : {}; }
    function saveTrip(patch) { if (window.Trip) Trip.set(patch); }

    // ---------- 화면 위로 열리는 시트 · 가운데 확인 창 ----------
    //  닫히면 연 버튼으로 초점이 돌아감 · Esc · 바깥(딤) 누르면 onDismiss(없으면 닫기)
    function openLayer(kind, html, bind, opener, onDismiss) {
        var layer = document.createElement('div');
        layer.className = kind === 'dialog' ? 'confirm-dialog' : 'modal-sheet modal-sheet--dim';
        layer.setAttribute('role', kind === 'dialog' ? 'alertdialog' : 'dialog');
        layer.setAttribute('aria-modal', 'true');
        layer.innerHTML = kind === 'dialog'
            ? '<div class="confirm-dialog__box">' + html + '</div>'
            : '<div class="modal-sheet__panel action-sheet"><span class="sheet__grabber" aria-hidden="true"></span>' + html + '</div>';
        var panel = layer.firstChild;
        var title = panel.querySelector('h2');
        if (title) {
            title.id = 'layer-title-' + Date.now();
            layer.setAttribute('aria-labelledby', title.id);
        }
        document.body.appendChild(layer);
        document.body.classList.add('is-modal-open');
        if (kind !== 'dialog') SheetDrag.panel(panel);

        function close(keepFocus) {
            if (!layer.parentNode) return;
            layer.remove();
            document.removeEventListener('keydown', onKey);
            if (!document.querySelector('.modal-sheet:not([hidden]), .confirm-dialog')) {
                document.body.classList.remove('is-modal-open');
            }
            if (!keepFocus && opener && opener.focus) opener.focus();
        }
        function dismiss() { (onDismiss || close)(); }
        function onKey(e) {
            // 위에 다른 창이 떠 있으면 그 창이 먼저 닫힘
            if (e.key === 'Escape' && layer === lastLayer()) dismiss();
        }
        layer.addEventListener('click', function (e) { if (e.target === layer) dismiss(); });
        document.addEventListener('keydown', onKey);
        bind(panel, close);
        // 처음 초점: 지정한 칸 → 없으면 시트 제목 (버튼이 미리 골라진 것처럼 보이지 않게)
        var first = panel.querySelector('[data-autofocus]');
        if (!first && title) {
            title.setAttribute('tabindex', '-1');
            first = title;
        }
        if (first) first.focus();
        return close;
    }

    function lastLayer() {
        var all = document.querySelectorAll('.modal-sheet--dim, .confirm-dialog');
        return all[all.length - 1];
    }

    function sheetTitle(title, desc) {
        return '<div class="action-sheet__head"><h2 class="action-sheet__title">' + esc(title) + '</h2>' +
            (desc ? '<p class="action-sheet__desc">' + esc(desc) + '</p>' : '') + '</div>';
    }

    // ---------- F8 더보기 메뉴 ----------
    function more(opener) {
        var sharing = !!trip().share;
        var html =
            '<h2 class="blind">더보기</h2>' +
            '<div class="menu-rows">' +
                '<button type="button" class="menu-row" data-go="share">' +
                    '<span class="menu-row__icon" aria-hidden="true"><span class="icon icon--user-multiple"></span></span>' +
                    '<span class="menu-row__text">보호자에게 이동 상황 공유' +
                        (sharing ? '<span class="menu-row__sub">공유 중</span>' : '') + '</span>' +
                    '<span class="icon icon--sm icon--chevron-right menu-row__arrow" aria-hidden="true"></span></button>' +
                '<button type="button" class="menu-row menu-row--danger" data-go="cancel">' +
                    '<span class="menu-row__icon" aria-hidden="true"><span class="icon icon--close"></span></span>' +
                    '<span class="menu-row__text">호출 취소</span>' +
                    '<span class="icon icon--sm icon--chevron-right menu-row__arrow" aria-hidden="true"></span></button>' +
            '</div>' +
            '<button type="button" class="btn-text-close" data-close>닫기</button>';
        openLayer('sheet', html, function (panel, close) {
            panel.querySelectorAll('[data-go]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    close(true);
                    run(btn.dataset.go, opener);
                });
            });
            panel.querySelector('[data-close]').addEventListener('click', function () { close(); });
        }, opener);
    }

    // ---------- F3 보호자 공유 · F3b 공유 중 ----------
    function share(opener) {
        if (trip().share) return sharing(opener);
        // 연결된(수락한) 보호자만 · "이동 알림 받기"를 허용한 분은 처음부터 골라 둠
        var guardians = Guardians.connected().map(function (g) {
            return Object.assign({ badge: g.notify ? '접수 알림 받는 중' : '연결됨', checked: g.notify }, g);
        });
        if (!guardians.length) {
            Toast.show('연결된 보호자가 없어요 · 홈의 "보호자 연결"에서 먼저 초대해 주세요');
            return;
        }
        var html = sheetTitle('보호자에게 이동 상황을 공유할까요?', '공유를 시작하면 보호자가 이번 이동을 같이 볼 수 있어요.') +
            '<p class="action-sheet__label" id="share-to">공유할 보호자</p>' +
            '<div class="guardian-pick" role="group" aria-labelledby="share-to">' +
                guardians.map(function (g, i) {
                    return '<label class="guardian-pick__row">' +
                        '<span class="guardian-pick__avatar" aria-hidden="true"></span>' +
                        '<span class="guardian-pick__text">' +
                            '<span class="guardian-pick__name">' + esc(g.name) + ' (' + esc(g.relation) + ')' +
                                (g.badge ? '<span class="guardian-pick__badge">' + esc(g.badge) + '</span>' : '') + '</span>' +
                            '<span class="guardian-pick__phone">' + esc(g.phone) + '</span>' +
                        '</span>' +
                        '<input type="checkbox" class="checkbox" value="' + i + '"' + (g.checked ? ' checked' : '') + '>' +
                    '</label>';
                }).join('') +
            '</div>' +
            '<div class="info-box">' +
                '<p>공유되는 것 · 차량 번호 · 기사님 · 도착 예정 시각 · 차량 위치</p>' +
                '<p>끝나는 때 · 이번 이동이 끝나면(하차 뒤) 자동으로 종료돼요</p>' +
            '</div>' +
            '<button type="button" class="btn btn--primary" data-start>이동 상황 공유하기</button>' +
            '<p class="action-sheet__foot">전달 방법 · 앱 알림으로 보내요. 앱이 없는 보호자에겐 문자(차량 번호 · 도착 예정 · 위치 보기 링크)로 가요.</p>';
        openLayer('sheet', html, function (panel, close) {
            var start = panel.querySelector('[data-start]');
            function picked() {
                return Array.prototype.map.call(panel.querySelectorAll('.guardian-pick input:checked'), function (input) {
                    return guardians[input.value].name;
                });
            }
            function sync() { start.disabled = !picked().length; }
            panel.addEventListener('change', sync);
            sync();
            start.addEventListener('click', function () {
                var names = picked();
                saveTrip({ share: { names: names, at: Date.now() } });
                close();
                Toast.show(names.join(', ') + ' 님에게 이동 상황을 공유하기 시작했어요', { check: true });
            });
        }, opener);
    }

    function sharing(opener) {
        var s = trip().share;
        var html = sheetTitle(s.names.join(', ') + ' 님에게 이동 상황 공유 중',
                clock(s.at).replace(/^오[전후] /, '') + '부터 · 차량 번호 · 기사님 · 도착 예정 · 차량 위치가 전달돼요') +
            '<div class="info-box"><p>이동 완료 또는 호출 취소 시 자동으로 종료돼요.</p></div>' +
            '<button type="button" class="btn btn--danger-line" data-stop>공유 중단하기</button>' +
            '<p class="action-sheet__foot">중단하면 보호자에게 "공유가 끝났어요" 알림이 가요 · 다시 시작은 더보기 → 보호자 공유에서</p>' +
            '<button type="button" class="btn-text-close" data-close>닫기</button>';
        openLayer('sheet', html, function (panel, close) {
            panel.querySelector('[data-stop]').addEventListener('click', function () {
                saveTrip({ share: null });
                close();
                Toast.show('이동 상황 공유를 중단했어요', { check: true });
            });
            panel.querySelector('[data-close]').addEventListener('click', function () { close(); });
        }, opener);
    }

    // ---------- F1 / F2 호출 취소 확인 ----------
    var CANCEL = {
        before: {
            desc: '아직 차가 정해지기 전이라 수수료 없이 취소돼요.',
            note: '취소하면 접수가 사라지고 보호자 공유도 종료돼요 · 다시 타려면 새로 호출해요'
        },
        // F2는 피그마에서 "미완료" (취소 수수료·재호출 제한 확정 후 표시)
        after: {
            desc: '기사님이 이미 오고 있어요.',
            note: '취소 수수료 · 재호출 제한 안내 — 확정 후 표시 · 보호자 공유는 함께 종료돼요',
            warn: true
        }
    };

    function cancel(opener) {
        var c = CANCEL[wrapData('cancelStage')] || CANCEL.before;
        var reasons = ['일정이 바뀌었어요', '다른 차를 탔어요', '차가 너무 늦어요', '기타'];
        var html =
            '<span class="confirm-dialog__icon" aria-hidden="true"><span class="icon icon--warning-alt"></span></span>' +
            '<div class="confirm-dialog__head">' +
                '<h2 class="confirm-dialog__title">호출을 취소할까요?</h2>' +
                '<p class="confirm-dialog__desc">' + esc(c.desc) + '</p>' +
            '</div>' +
            '<div class="cancel-reason">' +
                '<p class="cancel-reason__label" id="cancel-reason">취소하는 이유 (선택)</p>' +
                '<div class="cancel-reason__chips" role="group" aria-labelledby="cancel-reason">' +
                    reasons.map(function (r) {
                        return '<button type="button" class="reason-chip" aria-pressed="false">' + esc(r) + '</button>';
                    }).join('') +
                '</div>' +
            '</div>' +
            '<p class="confirm-dialog__note' + (c.warn ? ' confirm-dialog__note--warn' : '') + '">' +
                '<span class="icon icon--sm icon--warning" aria-hidden="true"></span>' + esc(c.note) + '</p>' +
            '<div class="confirm-dialog__actions">' +
                '<button type="button" class="btn btn--primary btn--md" data-keep data-autofocus>계속 기다릴게요</button>' +
                '<button type="button" class="btn btn--danger-line btn--md" data-confirm>호출 취소하기</button>' +
            '</div>';
        openLayer('dialog', html, function (box, close) {
            var chips = box.querySelectorAll('.reason-chip');
            chips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    var on = chip.getAttribute('aria-pressed') !== 'true';
                    chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
                    chip.setAttribute('aria-pressed', on);
                });
            });
            box.querySelector('[data-keep]').addEventListener('click', function () { close(); });
            box.querySelector('[data-confirm]').addEventListener('click', function () {
                close(true);
                saveTrip({ share: null, chat: [], helpRequests: [] });
                StateNotice.leave('호출을 취소했어요');
                location.replace('index.html');
            });
        }, opener);
    }

    // ---------- F6a / F6b 도움 요청 ----------
    function help(opener) {
        var riding = wrapData('stage') === 'riding';
        var count = requests().length;
        var html =
            // 이번 이동의 요청 내역은 제목 오른쪽 위 (보낸 요청이 있으면 개수도)
            '<button type="button" class="help-history-top" data-help="requests" aria-haspopup="dialog">' +
                '요청 내역' + (count ? ' <span class="help-history-top__count">' + count + '</span>' : '') +
                '<span class="icon icon--xs icon--chevron-right" aria-hidden="true"></span></button>' +
            '<div class="action-sheet__head">' +
                '<h2 class="action-sheet__title action-sheet__title--lg">어떤 도움이 필요하세요?</h2>' +
                '<p class="action-sheet__desc">' + (riding
                    ? '급하거나 기사님께 직접 말하기 어려운 상황에 쓰세요. 일반 요청은 대화 화면에서 보내요.'
                    : '탑승에 어려움이 있으면 알려주세요.') + '</p>' +
            '</div>' +
            '<div class="help-options">' +
                (riding
                    ? '<div class="help-options__pair">' +
                          helpCard('몸이 안 좋아요', '기사님 + 관제센터에 전달', 'send') +
                          helpCard('차 세워 주세요', '기사님 + 관제센터에 전달', 'send') +
                      '</div>' +
                      '<button type="button" class="help-card help-card--row" data-help="compose">' +
                          '<span class="help-card__title">관제센터에만 알리기</span>' +
                          '<span class="help-card__desc">관제센터에만 전달 · 기사님 모르게 상담원이 먼저 확인해요</span></button>'
                    : helpCard('탑승 장소까지 가기 어려워요', '상황을 기사님과 관제센터에 알려요.', 'send', true) +
                      '<button type="button" class="help-card help-card--row" data-help="compose">' +
                          '<span class="help-card__title">관제센터에 메시지 보내기</span>' +
                          '<span class="help-card__desc">기사님께 말하기 어려운 상황을 글로 보내요</span></button>') +
                '<a class="help-119" href="tel:119">' +
                    '<span class="help-119__icon" aria-hidden="true"><span class="icon icon--warning-alt"></span></span>' +
                    '<span class="help-119__text">' +
                        '<span class="help-119__title">119 전화 연결</span>' +
                        '<span class="help-119__desc">' + (riding
                            ? '전화 앱으로 119에 연결돼요 · 위치는 직접 말씀해 주세요 · 통화 여부는 앱에 남지 않아요'
                            : '긴급 상황에서만 · 전화 앱이 열려요') + '</span>' +
                    '</span>' +
                '</a>' +
            '</div>';
        openLayer('sheet', html, function (panel, close) {
            panel.querySelectorAll('[data-help]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    if (btn.dataset.help === 'send') {
                        close();
                        var title = btn.querySelector('.help-card__title').textContent;
                        addRequest({ title: title, to: '기사님 + 관제센터' });
                        Toast.show('기사님과 관제센터에 알렸어요', { check: true });
                        if (navigator.vibrate) navigator.vibrate(80);
                    } else {
                        close(true);
                        run(btn.dataset.help, opener);
                    }
                });
            });
        }, opener);
    }

    // row: 한 줄 가득 쓰는 카드는 왼쪽 정렬 (둘씩 놓는 카드만 가운데)
    function helpCard(title, desc, kind, row) {
        return '<button type="button" class="help-card' + (row ? ' help-card--row' : '') + '" data-help="' + kind + '">' +
            '<span class="help-card__title">' + esc(title) + '</span>' +
            '<span class="help-card__desc">' + esc(desc) + '</span></button>';
    }

    // ---------- 요청 기록 (F6d · 탑승 중 상태 줄) ----------
    function requests() { return trip().helpRequests || []; }

    function addRequest(req) {
        req.at = Date.now();
        saveTrip({ helpRequests: requests().concat([req]) });
        renderHelpStatus();
    }

    function renderHelpStatus() {
        var list = requests();
        var last = list[list.length - 1];
        document.querySelectorAll('[data-help-status]').forEach(function (el) {
            el.hidden = !last;
            var text = el.querySelector('[data-help-status-text]');
            if (last && text) text.textContent = '도움 요청 전송됨 · ' + clock(last.at).replace(/^오[전후] /, '');
        });
        document.querySelectorAll('[data-help-label]').forEach(function (el) {
            el.textContent = last ? '추가 도움 요청' : el.dataset.helpLabel;
        });
    }

    // ---------- F6c 관제센터에 메시지 보내기 ----------
    function compose(opener) {
        var html =
            '<div class="action-sheet__head action-sheet__head--close">' +
                '<h2 class="action-sheet__title">관제센터에 메시지 보내기</h2>' +
                '<button type="button" class="action-sheet__x" aria-label="닫기" data-x><span class="icon icon--close" aria-hidden="true"></span></button>' +
            '</div>' +
            '<p class="action-sheet__desc">어떤 상황인지 알려주세요. 이 메시지는 기사님께 전달되지 않아요.</p>' +
            '<div class="compose-box">' +
                '<label class="compose-box__label" for="compose-text">상황을 입력해 주세요</label>' +
                '<textarea class="compose-box__input" id="compose-text" maxlength="200" rows="3" placeholder="예: 기사님과 연락이 되지 않아 탑승 위치를 확인하기 어려워요." data-autofocus></textarea>' +
                '<div class="compose-box__foot">' +
                    '<button type="button" class="voice-input" data-voice-for="compose-text">' +
                        '<span class="icon icon--xs icon--microphone" aria-hidden="true"></span>말로 입력</button>' +
                    '<span class="text-area__count"><span data-count-for="compose-text">0</span> / 200자</span>' +
                '</div>' +
            '</div>' +
            '<p class="compose-fail" role="alert" hidden>전송하지 못했어요. 내용은 그대로 있어요.</p>' +
            '<button type="button" class="btn btn--primary" data-send disabled>메시지 보내기</button>';
        var closeSheet;
        function confirmQuit() {
            var input = document.getElementById('compose-text');
            if (!input || !input.value.trim()) return closeSheet();
            quitDialog(function () { closeSheet(); });
        }
        closeSheet = openLayer('sheet', html, function (panel, close) {
            var input = panel.querySelector('#compose-text');
            var send = panel.querySelector('[data-send]');
            var fail = panel.querySelector('.compose-fail');
            input.addEventListener('input', function () { send.disabled = !input.value.trim(); });
            panel.querySelector('[data-x]').addEventListener('click', confirmQuit);
            send.addEventListener('click', function () {
                // 인터넷이 끊겨 있으면 실패 · 입력 내용은 그대로 둠
                if (!navigator.onLine) {
                    fail.hidden = false;
                    send.textContent = '다시 보내기';
                    return;
                }
                addRequest({ title: '관제센터에 보낸 메시지', text: input.value.trim(), to: '관제센터' });
                close();
                Toast.show('관제센터에 메시지를 보냈어요', { check: true });
            });
        }, opener, confirmQuit);
    }

    // 작성을 그만둘까요? (내용이 있을 때 닫으면)
    function quitDialog(onQuit) {
        var html =
            '<div class="confirm-dialog__head confirm-dialog__head--left">' +
                '<h2 class="confirm-dialog__title confirm-dialog__title--sm">작성을 그만둘까요?</h2>' +
                '<p class="confirm-dialog__desc">적은 내용은 저장되지 않아요.</p>' +
            '</div>' +
            '<div class="confirm-dialog__actions">' +
                '<button type="button" class="btn btn--outline btn--md" data-keep data-autofocus>계속 쓰기</button>' +
                '<button type="button" class="btn btn--outline btn--md btn--danger-text" data-quit>그만두기</button>' +
            '</div>';
        openLayer('dialog', html, function (box, close) {
            box.querySelector('[data-keep]').addEventListener('click', function () {
                close(true);
                var input = document.getElementById('compose-text');
                if (input) input.focus();
            });
            box.querySelector('[data-quit]').addEventListener('click', function () {
                close(true);
                onQuit();
            });
        });
    }

    // ---------- F6d 이번 이동의 요청 내역 ----------
    function requestList(opener) {
        var list = requests().slice().reverse();
        var html = sheetTitle('이번 이동의 요청 내역') +
            (list.length
                ? '<ul class="request-list">' + list.map(function (r) {
                    return '<li class="request-item">' +
                        '<p class="request-item__title">' + esc(r.title) + '</p>' +
                        '<p class="request-item__meta">' + clock(r.at) + ' · 전송 완료 · ' + esc(r.to) + '</p>' +
                        (r.text ? '<p class="request-item__text">"' + esc(r.text) + '"</p>' : '') +
                    '</li>';
                }).join('') + '</ul>'
                : '<p class="request-empty">아직 보낸 요청이 없어요.</p>') +
            '<div class="btn-line-row">' +
                '<button type="button" class="btn-line" data-more-msg>' + (list.length ? '추가 메시지 보내기' : '메시지 보내기') + '</button>' +
                '<button type="button" class="btn-line" data-call>관제센터에 전화</button>' +
            '</div>' +
            '<button type="button" class="btn-text-close" data-close>닫기</button>';
        openLayer('sheet', html, function (panel, close) {
            panel.querySelector('[data-more-msg]').addEventListener('click', function () {
                close(true);
                compose(opener);
            });
            panel.querySelector('[data-call]').addEventListener('click', function () { dial(center.tel); });
            panel.querySelector('[data-close]').addEventListener('click', function () { close(); });
        }, opener);
    }

    // ---------- 빠른 메시지 (같은 자리에서 결과 표시 · 화면 전환 없음) ----------
    function quickSend(btn) {
        if (btn.classList.contains('is-sent')) return;
        if (!btn.dataset.text) {
            btn.dataset.text = btn.textContent.trim();
            btn.dataset.html = btn.innerHTML;
        }
        btn.classList.remove('is-failed');
        if (!navigator.onLine) {
            btn.classList.add('is-failed');
            btn.textContent = '전송하지 못했어요 · 다시 보내기';
            return;
        }
        Chat.send(btn.dataset.text);
        btn.classList.add('is-sent');
        btn.innerHTML = '<span class="icon icon--sm icon--checkmark" aria-hidden="true"></span>기사님께 보냈어요';
        setTimeout(function () {
            btn.classList.remove('is-sent');
            btn.innerHTML = btn.dataset.html;
        }, 3000);
    }

    // 휴대폰 전화 앱 열기
    function dial(number) {
        if (number) location.href = 'tel:' + number.replace(/[^0-9+]/g, '');
    }

    function run(action, opener) {
        if (action === 'more') more(opener);
        else if (action === 'share') share(opener);
        else if (action === 'cancel') cancel(opener);
        else if (action === 'help') help(opener);
        else if (action === 'compose') compose(opener);
        else if (action === 'requests') requestList(opener);
        else if (action === 'quick-send') quickSend(opener);
        else if (action === 'call-driver') dial(driver.tel);
        else if (action === 'call-center') dial(center.tel);
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (btn) run(btn.dataset.action, btn);
    });

    // 탑승 중 · 보호자 자동 알림 줄 ("이동 알림 받기"를 허용한 연결된 보호자가 있을 때만)
    function renderGuardianNotice() {
        var names = Guardians.notifyTargets().map(function (g) { return g.name; });
        document.querySelectorAll('[data-guardian-notice]').forEach(function (el) {
            el.hidden = !names.length;
            el.textContent = names.join(', ') + ' 님에게 이동 시작 알림을 보냈어요';
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('[data-help-label]').forEach(function (el) {
            if (!el.dataset.helpLabel) el.dataset.helpLabel = el.textContent.trim();
        });
        renderHelpStatus();
        renderGuardianNotice();
    });

    return { run: run, clock: clock };
})();

// 기사님과 대화 기록 (이번 호출 · 빠른 메시지와 대화 화면이 같이 씀)
//  { from: 'me' | 'driver', text, at, status: 'sent' | 'seen' }
var Chat = (function () {
    var listeners = [];

    function list() { return (window.Trip && Trip.get().chat) || []; }
    function save(items) {
        if (window.Trip) Trip.set({ chat: items });
        listeners.forEach(function (fn) { fn(items); });
    }

    // 보내면 · 잠시 뒤 기사님이 확인 · 조금 더 뒤 짧게 답함 (시연용)
    function send(text) {
        var at = Date.now();
        save(list().concat([{ from: 'me', text: text, at: at, status: 'sent' }]));
        setTimeout(function () {
            save(list().map(function (m) { return m.at === at && m.from === 'me' ? Object.assign({}, m, { status: 'seen' }) : m; }));
        }, 3000);
        setTimeout(function () {
            save(list().concat([{ from: 'driver', text: '네, 알겠어요.', at: Date.now() }]));
        }, 5500);
    }

    function onChange(fn) { listeners.push(fn); }

    return { list: list, send: send, onChange: onChange };
})();
