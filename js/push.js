// 시연용 상태 진행 (차량 찾는 중 → 배정 → 도착 임박 → 도착 → 탑승 중 → 이동 완료)
//  앱을 보고 있는 동안에는 알림 배너를 띄우지 않고, 화면이 그 자리에서 다음 상태로 바뀜
//  바뀐 화면 위쪽에 짧은 안내를 잠깐 보여 줌 (휴대폰 알림은 앱 밖에서 받는 것 · notifications.html 참고)
//
//  <div id="wrap" data-auto-next="assigned.html" data-delay="8000" data-next-notice="UD택시가 배정됐어요">
//    data-next-notice : 다음 화면에서 보여 줄 안내 (없으면 안내 없이 바뀜)
document.addEventListener('DOMContentLoaded', function () {
    // 시간은 APP_CONFIG.demoScale만큼 늘림 (config.js에서 한 번에 조절)
    var scale = (window.APP_CONFIG && APP_CONFIG.demoScale) || 1;
    var auto = document.querySelector('[data-auto-next]');
    if (!auto) return;
    var started = false;
    var told = false;
    var next = function () {
        // 시트·메뉴를 보고 있으면 닫을 때까지 조금씩 미룸 · 왜 멈췄는지 한 번 알려 줌
        if (document.body.classList.contains('is-modal-open')) {
            if (!told && auto.dataset.nextNotice) {
                told = true;
                Toast.show(auto.dataset.nextNotice + ' · 창을 닫으면 다음 화면으로 넘어가요', { top: true, duration: 4000 });
            }
            return setTimeout(next, 1500);
        }
        if (auto.dataset.nextNotice) StateNotice.leave(auto.dataset.nextNotice);
        // replace: 자동으로 바뀐 상태는 뒤로 가기 기록에 남기지 않음
        location.replace(auto.dataset.autoNext);
    };
    function go() {
        if (started) return;
        started = true;
        next();
    }
    setTimeout(go, Number(auto.dataset.delay || 8000) * scale);
    // data-next-on-arrive: 지도 위 차가 탑승 위치에 닿으면 바로 (지도를 못 쓰면 위 시간대로)
    if (auto.hasAttribute('data-next-on-arrive')) {
        document.addEventListener('mapkit:car-arrived', function () { setTimeout(go, 1200); });
    }
});
