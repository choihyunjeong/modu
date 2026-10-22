// 기사님과 대화 화면 (chat.html?stage=...)
//  stage: before(배정 직후) · soon(도착 임박) · arrived(차량 도착) · riding(이동 중) · done(이동 완료)
//  대화 중에도 호출은 계속 진행 (js/push.js Progress) → 단계가 바뀌면 "자동 안내"가 대화에 올라오고
//  머리글 · 자주 쓰는 말 · 뒤로 가기(지금 단계의 진행 화면)가 함께 바뀜
(function () {
    var config = window.APP_CONFIG || {};
    var driver = config.driver || {};
    var trip = Trip.get();
    var dest = (trip.destination && trip.destination.name) || '은평성모병원';

    var STAGES = {
        before: {
            back: 'assigned.html',
            sub: '약 8분 후 도착 예정',
            auto: '차량이 배정됐어요 · 약 8분 후 도착 예정',
            quick: ['탑승 준비에 시간이 필요해요', '탑승 위치에서 기다리고 있어요', '탑승 위치를 바꾸고 싶어요']
        },
        // 임박·도착에선 "차량을 찾기 어려워요"가 맨 앞
        soon: {
            back: 'arriving.html',
            sub: '약 3분 후 도착 예정',
            auto: '차가 곧 도착해요',
            quick: ['차량을 찾기 어려워요', '탑승 위치에서 기다리고 있어요', '탑승 준비에 시간이 필요해요']
        },
        arrived: {
            back: 'arrived.html',
            sub: '탑승 위치에 도착했어요',
            auto: '차량이 탑승 위치에 도착했어요',
            quick: ['차량을 찾기 어려워요', '금방 나가요', '탑승 준비에 시간이 필요해요']
        },
        riding: {
            back: 'riding.html',
            sub: dest + '까지 이동 중',
            auto: '출발했어요 · ' + dest + '으로 가요',
            quick: ['에어컨을 조금 약하게 해주세요', '내릴 때 도와주세요', '목적지에 가까워지면 알려주세요']
        },
        done: {
            back: 'trip-done.html',
            sub: '이동이 끝났어요',
            auto: '목적지에 도착했어요 · 이용해 주셔서 고마워요',
            quick: ['감사합니다', '내릴 때 도와주셔서 고마워요']
        }
    };
    // 진행 단계 → 대화 화면 상태
    var FROM_PROGRESS = { waiting: 'before', assigned: 'before', arriving: 'soon', arrived: 'arrived', riding: 'riding', done: 'done' };

    function currentKey() {
        var step = window.Progress && Progress.sync();
        if (step && FROM_PROGRESS[step.stage]) return FROM_PROGRESS[step.stage];
        var key = new URLSearchParams(location.search).get('stage');
        return STAGES[key] ? key : 'before';
    }

    var stage = currentKey();
    var wrap = document.getElementById('wrap');
    var log = document.querySelector('[data-chat-log]');
    var quick = document.querySelector('[data-chat-quick]');
    var openedAt = Date.now();
    // 대화에 올라온 자동 안내 (처음 상태 + 대화 중에 바뀐 상태)
    var autos = [{ text: STAGES[stage].auto, at: openedAt }];

    function esc(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 시각만 (10:09)
    function hm(time) {
        var d = new Date(time);
        return d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function applyStage() {
        var s = STAGES[stage];
        wrap.dataset.stage = stage === 'done' ? 'riding' : stage;
        document.querySelector('[data-chat-back]').href = s.back;
        if (driver.name) document.querySelector('[data-chat-name]').textContent = driver.name;
        document.querySelector('[data-chat-sub]').textContent = (driver.plate ? driver.plate + ' · ' : '') + s.sub;
        quick.innerHTML = s.quick.map(function (text) {
            return '<button type="button" class="chat-quick__chip">' + esc(text) + '</button>';
        }).join('');
    }

    // 대화 기록과 자동 안내를 시간 순서대로
    function render(items) {
        var first = Math.min(items[0] ? items[0].at : openedAt, openedAt);
        var rows = items.map(function (m) { return { at: m.at, msg: m }; })
            .concat(autos.map(function (a) { return { at: a.at, auto: a.text }; }))
            .sort(function (a, b) { return a.at - b.at; });
        var html = '<p class="chat-chip">오늘 ' + Actions.clock(first) + '</p>';
        rows.forEach(function (r) {
            if (r.auto) {
                html += '<p class="chat-chip">자동 안내 · ' + esc(r.auto) + '</p>';
                return;
            }
            var m = r.msg;
            var meta = m.from === 'driver'
                ? '기사님이 답했어요 · ' + hm(m.at)
                : (m.status === 'seen' ? '기사님이 확인했어요 · ' : '전송됨 · 기사님 화면에 표시 · ') + hm(m.at);
            html += '<div class="chat-msg chat-msg--' + (m.from === 'driver' ? 'driver' : 'me') + '">' +
                '<p class="chat-msg__bubble">' + esc(m.text) + '</p>' +
                '<p class="chat-msg__meta">' + meta + '</p></div>';
        });
        log.innerHTML = html;
        log.scrollTop = log.scrollHeight;
    }

    applyStage();
    render(Chat.list());
    Chat.onChange(render);

    // 대화 중에도 호출 진행을 따라감 (단계가 바뀌면 자동 안내 + 위쪽 안내)
    setInterval(function () {
        var key = currentKey();
        if (key === stage) return;
        stage = key;
        autos.push({ text: STAGES[stage].auto, at: Date.now() });
        applyStage();
        render(Chat.list());
        Toast.show(STAGES[stage].auto, { top: true, duration: 3500 });
        if (navigator.vibrate) navigator.vibrate(120);
    }, 1000);

    // 자주 쓰는 말: 누르면 바로 보냄
    quick.addEventListener('click', function (e) {
        var chip = e.target.closest('.chat-quick__chip');
        if (chip) Chat.send(chip.textContent);
    });

    // 직접 입력 · 말로 입력 → 보내기
    var form = document.querySelector('[data-chat-form]');
    var field = document.getElementById('chat-text');
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = field.value.trim();
        if (!text) {
            Toast.show('보낼 말을 입력하거나 위의 자주 쓰는 말을 눌러 주세요');
            return field.focus();
        }
        Chat.send(text);
        field.value = '';
    });
})();
