// 화면 읽어주기 (홈_v18_03_읽어주는중)
//  오른쪽 위 스피커를 누르면 화면 전체를 처음부터 소리로 읽음 · 읽는 문장만 연한 파란 배경
//  아래쪽(탭바 위)에 "1/3 · 호출 안내 읽는 중" + 일시정지 / 읽기 종료
//  [data-read-part="이름"] 묶음 안의 [data-read] 문장을 순서대로 읽음
(function () {
    var toggle, bar, countEl, partEl, pauseBtn, pauseLabel, pauseIcon;
    var queue = [];      // [{ el, part, partIndex }]
    var index = 0;
    var parts = 0;
    var reading = false;
    var paused = false;

    function collect() {
        queue = [];
        var partEls = document.querySelectorAll('[data-read-part]');
        parts = partEls.length;
        partEls = Array.prototype.filter.call(partEls, function (part) { return !part.closest('[hidden]'); });
        parts = partEls.length;
        partEls.forEach(function (part, p) {
            var items = part.hasAttribute('data-read') ? [part] : Array.prototype.slice.call(part.querySelectorAll('[data-read]'));
            items.forEach(function (el) { queue.push({ el: el, part: part.dataset.readPart, partIndex: p }); });
        });
    }

    // 읽을 글: 화면 글자 그대로 (기호는 말로 바꿔 자연스럽게)
    function textOf(el) {
        return el.textContent.replace(/\s+/g, ' ').replace(/·/g, ',').replace(/~/g, '에서 ').trim();
    }

    function mark(item) {
        document.querySelectorAll('.is-reading').forEach(function (el) { el.classList.remove('is-reading'); });
        if (!item) return;
        item.el.classList.add('is-reading');
        item.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        countEl.textContent = (item.partIndex + 1) + '/' + parts;
        partEl.textContent = item.part + ' 읽는 중';
    }

    function speakCurrent() {
        var item = queue[index];
        if (!item) return stop();
        mark(item);
        var u = new SpeechSynthesisUtterance(textOf(item.el));
        u.lang = 'ko-KR';
        u.rate = 0.95;
        u.onend = function () {
            if (!reading || paused) return;
            index++;
            speakCurrent();
        };
        speechSynthesis.speak(u);
    }

    function start() {
        if (!window.speechSynthesis) return Toast.show('이 기기에서는 화면 읽어주기를 쓸 수 없어요');
        collect();
        index = 0;
        reading = true;
        setPaused(false);
        toggle.setAttribute('aria-pressed', 'true');
        toggle.classList.add('is-on');
        document.body.classList.add('is-reading-mode');
        bar.hidden = false;
        speechSynthesis.cancel();
        speakCurrent();
    }

    function stop() {
        reading = false;
        if (window.speechSynthesis) speechSynthesis.cancel();
        mark(null);
        toggle.setAttribute('aria-pressed', 'false');
        toggle.classList.remove('is-on');
        document.body.classList.remove('is-reading-mode');
        bar.hidden = true;
    }

    function setPaused(on) {
        paused = on;
        pauseLabel.textContent = on ? '이어 듣기' : '일시정지';
        pauseIcon.className = 'icon ' + (on ? 'icon--play' : 'icon--pause');
        partEl.textContent = on ? '잠시 멈췄어요' : (queue[index] ? queue[index].part + ' 읽는 중' : '');
    }

    // 일시정지: 지금 문장에서 멈추고, 이어 듣기는 그 문장을 처음부터 다시 읽음 (기기마다 pause가 달라서)
    function togglePause() {
        if (!reading) return;
        if (!paused) {
            setPaused(true);
            speechSynthesis.cancel();
        } else {
            setPaused(false);
            speakCurrent();
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        toggle = document.querySelector('[data-reader-toggle]');
        bar = document.querySelector('[data-reader-bar]');
        if (!toggle || !bar) return;
        countEl = bar.querySelector('[data-reader-count]');
        partEl = bar.querySelector('[data-reader-part]');
        pauseBtn = bar.querySelector('[data-reader-pause]');
        pauseLabel = bar.querySelector('[data-reader-pause-label]');
        pauseIcon = pauseBtn.querySelector('.icon');
        toggle.addEventListener('click', function () { reading ? stop() : start(); });
        pauseBtn.addEventListener('click', togglePause);
        bar.querySelector('[data-reader-stop]').addEventListener('click', stop);
        // 다른 화면으로 가면 읽기를 멈춤
        window.addEventListener('pagehide', function () { if (window.speechSynthesis) speechSynthesis.cancel(); });
    });
})();
