// 시연용 상태 진행
// 1) 앱 알림: [data-push] 템플릿이 있으면 정해진 시간 뒤 위에서 알림 배너를 내림
//    <template data-push data-delay="5000"> <a class="push-card" href="..."> ... </a> </template>
// 2) 알림 없이 바뀌는 상태(도착 → 탑승 중 → 이동 완료): [data-auto-next]의 화면으로 넘어감
//    <div id="wrap" data-auto-next="riding.html" data-delay="8000">
document.addEventListener('DOMContentLoaded', function () {
    var auto = document.querySelector('[data-auto-next]');
    if (auto) {
        setTimeout(function () {
            // replace: 자동으로 바뀐 상태는 뒤로 가기 기록에 남기지 않음
            location.replace(auto.dataset.autoNext);
        }, Number(auto.dataset.delay || 8000));
    }

    document.querySelectorAll('template[data-push]').forEach(function (tpl) {
        setTimeout(function () {
            var banner = document.createElement('div');
            banner.className = 'push-banner';
            banner.setAttribute('role', 'status');
            banner.appendChild(tpl.content.cloneNode(true));
            document.body.appendChild(banner);
        }, Number(tpl.dataset.delay || 5000));
    });
});
