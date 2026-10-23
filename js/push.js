// 호출 진행 (시연용) · 차량 찾는 중 → 배정 → 도착 임박 → 도착 → 탑승 중 → 이동 완료
//  진행은 시간 기준: 단계가 시작된 시각(stageAt)부터 정해진 시간이 지나면 다음 단계
//  → 대화 화면·홈 등 다른 화면에 있어도 호출은 계속 진행되고, 진행 화면으로 돌아오면 지금 단계의 화면이 보임
//  앱을 보고 있는 동안에는 알림 배너 대신 화면이 그 자리에서 바뀌고 위쪽에 짧은 안내 (휴대폰 알림은 notifications.html)
//
//  진행 화면: <div id="wrap" data-progress-stage="assigned"> (data-next-on-arrive: 지도 위 차가 닿으면 바로)
var Progress = (function () {
    var scale = (window.APP_CONFIG && APP_CONFIG.demoScale) || 1;
    // ms: 이 단계에 머무는 시간 (demoScale을 곱함) · notice: 다음 단계로 넘어갈 때 안내
    var FLOW = [
        { stage: 'waiting', url: 'waiting.html', ms: 4000, notice: 'UD택시가 배정됐어요' },
        { stage: 'assigned', url: 'assigned.html', ms: 8000, notice: 'UD택시가 곧 도착해요' },
        // 배정 → 도착 임박은 같은 화면(assigned.html)에서 글자만 바뀜 (새로 열지 않음)
        { stage: 'arriving', url: 'assigned.html', ms: 6000, notice: '차량이 도착했어요' },
        { stage: 'arrived', url: 'arrived.html', ms: 3200, notice: '탑승했어요 · 목적지로 출발해요' },
        { stage: 'riding', url: 'riding.html', ms: 8000, notice: '목적지에 도착했어요' },
        { stage: 'done', url: 'trip-done.html' }
    ];

    function index(stage) {
        for (var i = 0; i < FLOW.length; i++) if (FLOW[i].stage === stage) return i;
        return -1;
    }

    function trip() { return window.Trip ? Trip.get() : {}; }

    // 시간이 지난 만큼 단계를 앞으로 · 지금 단계 정보를 돌려줌 (진행 중인 호출이 없으면 null)
    function sync() {
        var t = trip();
        var i = index(t.stage);
        if (!t.calledAt || i < 0) return null;
        var at = t.stageAt || Date.now();
        var start = i;
        while (FLOW[i].ms && Date.now() - at >= FLOW[i].ms * scale) {
            at += FLOW[i].ms * scale;
            i++;
        }
        if (i !== start) {
            var patch = { stage: FLOW[i].stage, stageAt: at };
            if (FLOW[i].stage === 'riding' && !t.boardedAt) patch.boardedAt = at;
            if (index('riding') < i && !t.boardedAt) patch.boardedAt = at - FLOW[index('riding')].ms * scale;
            Trip.set(patch);
            if (FLOW[i].stage === 'done') Trip.recordDone();
        }
        return FLOW[i];
    }

    // 지금 단계에서 다음으로 넘어가기까지 남은 시간 (ms)
    function remaining() {
        var t = trip();
        var step = FLOW[index(t.stage)];
        if (!step || !step.ms) return Infinity;
        return Math.max(0, step.ms * scale - (Date.now() - (t.stageAt || Date.now())));
    }

    // 다음 단계로 (진행 화면에서)
    function advance() {
        var step = FLOW[index(trip().stage)];
        if (!step) return null;
        var next = FLOW[index(step.stage) + 1];
        var patch = { stage: next.stage, stageAt: Date.now() };
        if (next.stage === 'riding' && !trip().boardedAt) patch.boardedAt = Date.now();
        Trip.set(patch);
        return { step: step, next: next };
    }

    function previousNotice(stage) {
        var i = index(stage);
        return i > 0 ? FLOW[i - 1].notice : '';
    }

    return { FLOW: FLOW, index: index, sync: sync, remaining: remaining, advance: advance, previousNotice: previousNotice };
})();

document.addEventListener('DOMContentLoaded', function () {
    var wrap = document.querySelector('[data-progress-stage]');
    if (!wrap || !window.Trip) return;
    var stage = wrap.dataset.progressStage;
    var page = location.pathname.split('/').pop() || 'index.html';
    var t = Trip.get();
    if (t.calledAt && !t.stageAt) Trip.set({ stageAt: Date.now() });

    // 이 화면이 맡은 단계를 알림 · 화면이 글자를 바꿈 (initial: 처음 열 때라 효과 없이)
    function announce(initial) {
        wrap.dataset.progressStage = stage;
        document.dispatchEvent(new CustomEvent('progress:stage', { detail: { stage: stage, initial: initial } }));
    }

    // 진행 중인 호출이 없거나(화면을 바로 연 경우) 이 화면보다 앞 단계면 → 이 단계부터 시작
    var current = Progress.sync();
    if (!current || Progress.index(current.stage) < Progress.index(stage)) {
        Trip.set({ calledAt: t.calledAt || Date.now(), stage: stage, stageAt: Date.now() });
    } else if (current.stage !== stage) {
        if (current.url === page) {
            // 같은 화면이 맡은 다음 단계 (배정 → 도착 임박) · 그 단계로 보여 줌
            stage = current.stage;
        } else {
            // 다른 화면에 있는 동안 진행됐으면 지금 단계 화면으로
            StateNotice.leave(Progress.previousNotice(current.stage));
            return location.replace(current.url);
        }
    }
    // 화면 스크립트가 듣기 시작한 뒤에 알림
    setTimeout(function () { announce(true); }, 0);

    var started = false;
    var told = false;
    function go() {
        // 시트·메뉴를 보고 있으면 닫을 때까지 조금씩 미룸 · 왜 멈췄는지 한 번 알려 줌
        if (document.body.classList.contains('is-modal-open')) {
            var step = Progress.FLOW[Progress.index(stage)];
            if (!told && step && step.notice) {
                told = true;
                Toast.show(step.notice + ' · 창을 닫으면 다음 화면으로 넘어가요', { top: true, duration: 4000 });
            }
            return setTimeout(go, 1500);
        }
        if (started) return;
        started = true;
        // 그 사이 다른 화면에서 이미 다음 단계로 갔으면 그 화면으로 (단계를 건너뛰지 않게)
        // 다음 단계도 이 화면이면: 새로 열지 않고 그 자리에서 글자만 바꾸고 계속 진행
        function stayHere(next, notice) {
            if (notice) Toast.show(notice, { top: true, duration: 3000 });
            stage = next;
            started = false;
            told = false;
            announce(false);
            setTimeout(go, Progress.remaining());
        }
        var now = Progress.sync();
        if (now && now.stage !== stage) {
            // 시간이 지나 이미 다음 단계로 넘어감 (같은 화면이면 그 자리에서)
            if (now.url === page) return stayHere(now.stage, Progress.previousNotice(now.stage));
            return location.replace(now.url);
        }
        var moved = Progress.advance();
        if (!moved) return;
        if (moved.next.url === page) return stayHere(moved.next.stage, moved.step.notice);
        if (moved.step.notice) StateNotice.leave(moved.step.notice);
        // replace: 자동으로 바뀐 상태는 뒤로 가기 기록에 남기지 않음
        location.replace(moved.next.url);
    }
    setTimeout(go, Progress.remaining());
    // 뒤로 가기로 돌아왔을 때 브라우저가 예전 화면을 그대로 보여 주면 새로 열어 지금 단계를 맞춤
    window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });
    // 지도 위 차가 탑승 위치에 닿으면 바로 (지도를 못 쓰면 위 시간대로)
    if (wrap.hasAttribute('data-next-on-arrive')) {
        document.addEventListener('mapkit:car-arrived', function () {
            // 배정 화면에서는 도착 임박 단계일 때만 (차가 다 온 뒤 차량 도착으로)
            if (stage === wrap.dataset.nextOnArrive || !wrap.dataset.nextOnArrive) setTimeout(go, 1200);
        });
    }
});
