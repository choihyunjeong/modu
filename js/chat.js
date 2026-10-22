// 기사님과 대화 화면 (chat.html?stage=...)
//  stage: before(배정 직후) · soon(도착 임박) · arrived(차량 도착) · riding(이동 중)
//  상태마다 머리글 · 자동 안내 · 자주 쓰는 말이 바뀌고, 뒤로 가면 그 진행 화면으로
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
        }
    };

    var key = new URLSearchParams(location.search).get('stage');
    var stage = STAGES[key] ? key : 'before';
    var s = STAGES[stage];
    var wrap = document.getElementById('wrap');
    wrap.dataset.stage = stage;

    document.querySelector('[data-chat-back]').href = s.back;
    if (driver.name) document.querySelector('[data-chat-name]').textContent = driver.name;
    document.querySelector('[data-chat-sub]').textContent = (driver.plate ? driver.plate + ' · ' : '') + s.sub;

    var log = document.querySelector('[data-chat-log]');
    var openedAt = Date.now();

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

    function render(items) {
        var first = items[0] ? items[0].at : openedAt;
        var html = '<p class="chat-chip">오늘 ' + Actions.clock(first) + '</p>' +
            '<p class="chat-chip">자동 안내 · ' + esc(s.auto) + '</p>';
        items.forEach(function (m) {
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

    render(Chat.list());
    Chat.onChange(render);

    // 자주 쓰는 말: 누르면 바로 보냄
    var quick = document.querySelector('[data-chat-quick]');
    quick.innerHTML = s.quick.map(function (text) {
        return '<button type="button" class="chat-quick__chip">' + esc(text) + '</button>';
    }).join('');
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
