// 저장된 글자 크기를 화면이 그려지기 전에 적용 (html[data-font-size] → :root --font-scale)
(function () {
    try {
        var saved = localStorage.getItem('fontSize');
        if (saved) document.documentElement.dataset.fontSize = saved;
    } catch (e) {}
})();

document.addEventListener('DOMContentLoaded', function () {
    // 다른 화면에서 수정하러 들어온 경우(?from=confirm): 저장 후 그 화면으로 돌아감
    //  [data-keep-from] 다음 단계 링크에도 from을 이어 붙임
    //  [data-return]    저장 버튼 → 들어온 화면으로 (data-return-label이 있으면 버튼 글자도 바꿈)
    var RETURN_PAGES = { confirm: 'confirm.html' };
    var from = new URLSearchParams(location.search).get('from');
    if (RETURN_PAGES[from]) {
        document.querySelectorAll('[data-keep-from]').forEach(function (a) {
            var url = new URL(a.getAttribute('href'), location.href);
            url.searchParams.set('from', from);
            a.href = url.href;
        });
        document.querySelectorAll('[data-return]').forEach(function (a) {
            a.href = RETURN_PAGES[from];
            if (a.dataset.returnLabel) a.textContent = a.dataset.returnLabel;
        });
    }

    // 뒤로 버튼: 직전 화면으로 (바로 열어서 이전 기록이 없으면 href로)
    document.querySelectorAll('[data-history-back]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            if (history.length > 1) {
                e.preventDefault();
                history.back();
            }
        });
    });

    // 하나만 고르는 칩 묶음: [data-select-group] 안의 .chip
    document.querySelectorAll('[data-select-group]').forEach(function (group) {
        var chips = group.querySelectorAll('.chip');
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip); });
            });
        });
    });

    // 글자 크기 저장 + 모든 화면에 적용
    function applyFontSize(size) {
        document.documentElement.dataset.fontSize = size;
        try { localStorage.setItem('fontSize', size); } catch (e) {}
    }
    function currentFontSize() {
        return document.documentElement.dataset.fontSize || 'normal';
    }

    // 글자 크기 칩: 고르면 바로 적용
    var fontChips = document.querySelectorAll('[data-font-size-chips] .chip');
    fontChips.forEach(function (chip) {
        chip.setAttribute('aria-pressed', chip.dataset.fontSize === currentFontSize());
        chip.addEventListener('click', function () {
            applyFontSize(chip.dataset.fontSize);
        });
    });

    // 글자 크기 시트: [data-open-font-size]로 열고, 고른 뒤 '적용하기'를 눌러야 반영
    //  [data-font-size-option] 선택지 · [data-font-size-preview] 미리보기(data-size로 크기 바뀜)
    var fontSheet = document.querySelector('[data-font-size-sheet]');
    if (fontSheet) {
        var fontOptions = fontSheet.querySelectorAll('[data-font-size-option]');
        var fontPreview = fontSheet.querySelector('[data-font-size-preview]');
        var fontPicked = currentFontSize();
        var fontOpener = null;

        var pickFontSize = function (size) {
            fontPicked = size;
            fontOptions.forEach(function (o) { o.setAttribute('aria-pressed', o.dataset.fontSizeOption === size); });
            if (fontPreview) fontPreview.dataset.size = size;
        };
        var openFontSheet = function (e) {
            fontOpener = e.currentTarget;
            pickFontSize(currentFontSize());
            fontSheet.hidden = false;
            document.body.classList.add('is-modal-open');
            var pressed = fontSheet.querySelector('[data-font-size-option][aria-pressed="true"]');
            if (pressed) pressed.focus();
        };
        var closeFontSheet = function () {
            fontSheet.hidden = true;
            document.body.classList.remove('is-modal-open');
            if (fontOpener) fontOpener.focus();
        };

        document.querySelectorAll('[data-open-font-size]').forEach(function (btn) {
            btn.addEventListener('click', openFontSheet);
        });
        fontOptions.forEach(function (o) {
            o.addEventListener('click', function () { pickFontSize(o.dataset.fontSizeOption); });
        });
        fontSheet.querySelector('[data-apply-font-size]').addEventListener('click', function () {
            applyFontSize(fontPicked);
            closeFontSheet();
        });
        // 바깥(딤) 누르기 · Esc → 적용하지 않고 닫기
        fontSheet.addEventListener('click', function (e) { if (e.target === fontSheet) closeFontSheet(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !fontSheet.hidden) closeFontSheet(); });
    }
});
