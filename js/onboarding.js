// 온보딩 (온보딩_v3 1~4)
//  다음 · 좌우로 밀기로 넘김 · 건너뛰기는 마지막 권한 화면으로 · 권한 화면의 "나중에"는 바로 홈으로
//  "허용하고 시작하기": 알림 → 위치 → 마이크 권한을 차례로 물어본 뒤 홈으로 (거절해도 앱은 그대로 쓸 수 있음)
//  한 번 마치면 다시 보이지 않음 (localStorage onboarded)
(function () {
    var slides = Array.prototype.slice.call(document.querySelectorAll('[data-onb-slide]'));
    var dots = document.querySelectorAll('.onb__dots span');
    var next = document.querySelector('[data-onb-next]');
    var skip = document.querySelector('[data-onb-skip]');
    var listen = document.querySelector('[data-onb-listen]');
    var count = document.querySelector('[data-onb-count]');
    var index = 0;
    var last = slides.length - 1;

    function show(i) {
        index = Math.max(0, Math.min(last, i));
        slides.forEach(function (s, n) { s.hidden = n !== index; });
        dots.forEach(function (d, n) { d.classList.toggle('is-on', n === index); });
        next.textContent = index === last ? '허용하고 시작하기' : '다음';
        skip.textContent = index === last ? '나중에' : '건너뛰기';
        count.textContent = slides.length + '쪽 중 ' + (index + 1) + '쪽';
        if (listen.getAttribute('aria-pressed') === 'true') read();
    }

    function finish() {
        try { localStorage.setItem('onboarded', '1'); } catch (e) {}
        if (window.speechSynthesis) speechSynthesis.cancel();
        location.replace('index.html');
    }

    // 권한을 차례로 물어봄 (지원하지 않거나 거절해도 다음으로)
    function askPermissions() {
        next.disabled = true;
        next.textContent = '권한을 확인하고 있어요…';
        var steps = [
            function (done) {
                if (!('Notification' in window) || Notification.permission !== 'default') return done();
                Promise.resolve(Notification.requestPermission()).then(done, done);
            },
            function (done) {
                if (!navigator.geolocation) return done();
                navigator.geolocation.getCurrentPosition(function () { done(); }, function () { done(); }, { timeout: 8000 });
            },
            function (done) {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return done();
                navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
                    s.getTracks().forEach(function (t) { t.stop(); });
                    done();
                }, function () { done(); });
            }
        ];
        (function run(i) {
            if (i >= steps.length) return finish();
            steps[i](function () { run(i + 1); });
        })(0);
    }

    next.addEventListener('click', function () {
        if (index === last) askPermissions();
        else show(index + 1);
    });
    skip.addEventListener('click', function () {
        if (index === last) finish();
        else show(last);
    });

    // 좌우로 밀어서 넘기기
    var startX = null;
    document.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(dx) < 50) return;
        show(index + (dx < 0 ? 1 : -1));
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') show(index + 1);
        if (e.key === 'ArrowLeft') show(index - 1);
    });

    // 소리로 듣기: 지금 화면의 제목·설명을 읽어 줌 (켜 두면 넘길 때마다)
    function read() {
        if (!window.speechSynthesis) return Toast.show('이 기기에서는 소리로 들을 수 없어요');
        var s = slides[index];
        var text = s.querySelector('.onb__title').textContent + '. ' + s.querySelector('.onb__desc').textContent;
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        speechSynthesis.speak(u);
    }
    listen.addEventListener('click', function () {
        var on = listen.getAttribute('aria-pressed') !== 'true';
        listen.setAttribute('aria-pressed', on);
        if (on) read();
        else if (window.speechSynthesis) speechSynthesis.cancel();
    });

    show(0);
})();
