// 대기 시간 통계 (피그마 "승객화면_수정" 섹션의 그래프 · image 2)
//  출처: 서울시설공단 장애인콜택시 일별 이용현황 API (2026-01-01 ~ 31) · 서울 전체 · 하루 평균 대기시간(분)
//  정의(접수→배차인지 접수→승차인지)는 공단 확인 전이라 우선 "승차까지"로 표시
//  새 달 자료가 나오면 DAYS만 바꾸면 화면 문구가 모두 따라 바뀜
//
//  화면에서 쓰기 (오늘 요일 기준으로 채움)
//   <span data-stat="day">목요일</span>        오늘 요일
//   <span data-stat="avg">32</span>            같은 요일 평균 (분, 반올림)
//   <span data-stat="range">30~36</span>       같은 요일 가장 짧은 날 ~ 가장 긴 날 (분)
//   <span data-stat="basis">...</span>         기준 설명 한 줄
var WaitStats = (function () {
    var SOURCE = {
        year: 2026,
        month: 1,
        name: '서울시설공단 장애인콜택시 일별 이용현황',
        // 실제 자료는 서울 전체지만, 프로토타입이라 화면에는 우선 은평구로 표시
        area: '은평구'
    };

    // 1월 1일 ~ 31일 하루 평균 대기시간(분) · holiday: 주말이 아닌 공휴일 (평일·주말 평균에서 뺌)
    var DAYS = [24.4, 25.4, 20.2, 33.9, 32.9, 30.9, 30.3, 30, 33.5, 25.1,
        32.1, 38.8, 39, 43.5, 32.5, 31.6, 27.6, 35.8, 39.7, 34.5,
        36, 30, 33.3, 27.8, 30, 34, 37.6, 38.7, 35.4, 44.4,
        27.3];
    var HOLIDAYS = [1];

    var DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

    // 요일별로 묶음 (0 = 일요일)
    function byWeekday() {
        var groups = [[], [], [], [], [], [], []];
        DAYS.forEach(function (min, i) {
            var date = i + 1;
            if (HOLIDAYS.indexOf(date) > -1) return;
            groups[new Date(SOURCE.year, SOURCE.month - 1, date).getDay()].push(min);
        });
        return groups;
    }

    function mean(list) {
        return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
    }

    // 오늘(또는 주어진 날) 요일 기준
    function forDay(date) {
        var day = (date || new Date()).getDay();
        var list = byWeekday()[day];
        return {
            day: DAY_NAMES[day],
            avg: Math.round(mean(list)),
            min: Math.floor(Math.min.apply(null, list)),
            max: Math.ceil(Math.max.apply(null, list)),
            weekend: day === 0 || day === 6
        };
    }

    function basis() {
        return SOURCE.area + ' · ' + SOURCE.year + '년 ' + SOURCE.month + '월 같은 요일 평균';
    }

    // 지금 날짜(요일)·시간대 (10월 22일(목) 오후 2~3시)
    function slot(date) {
        var d = date || new Date();
        var h = d.getHours();
        var h12 = h % 12 || 12;
        var next = (h + 1) % 12 || 12;
        return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + '일월화수목금토'.charAt(d.getDay()) + ') ' +
            (h < 12 ? '오전 ' : '오후 ') + h12 + '~' + next + '시';
    }

    // 홈 대기 카드 (홈_v23): 다음 2시간(지금 14시대 → 15~17시)은 같은 요일 평균,
    //  지금 예상은 그보다 조금 짧게 (시연용 · 실시간 접수 자료를 받으면 바꿈)
    function nowWait(date) {
        return Math.max(5, Math.round(forDay(date).avg * 0.85));
    }
    function nextWindow(date) {
        var h = (date || new Date()).getHours();
        return ((h + 1) % 24) + '~' + ((h + 3) % 24) + '시';
    }

    function fill(root) {
        var s = forDay();
        var now = new Date();
        var clock = (now.getHours() < 12 ? '오전 ' : '오후 ') + (now.getHours() % 12 || 12) + ':' + ('0' + now.getMinutes()).slice(-2) + ' 기준';
        var texts = {
            slot: slot(),
            // 지금 시각 (· 오후 1:05 기준)
            now: '· ' + clock,
            clock: clock,
            nowWait: String(nowWait()),
            window: nextWindow(),
            day: s.day,
            avg: String(s.avg),
            range: s.min + '~' + s.max,
            basis: basis()
        };
        (root || document).querySelectorAll('[data-stat]').forEach(function (el) {
            if (texts[el.dataset.stat] != null) el.textContent = texts[el.dataset.stat];
        });
        // 막대 길이: 둘 중 긴 쪽이 100%
        var bars = { now: nowWait(), later: s.avg };
        var top = Math.max(bars.now, bars.later);
        (root || document).querySelectorAll('[data-bar]').forEach(function (el) {
            el.style.width = Math.round(bars[el.dataset.bar] / top * 100) + '%';
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        fill(document);
        // 시간대가 바뀌면 문구도 바뀌게 (1분마다 확인)
        setInterval(function () { fill(document); }, 60000);
    });

    return { forDay: forDay, slot: slot, basis: basis, fill: fill, nowWait: nowWait, source: SOURCE };
})();
