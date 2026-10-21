// 저장된 글자 크기를 화면이 그려지기 전에 적용 (html[data-font-size] → :root --font-scale)
(function () {
    try {
        var saved = localStorage.getItem('fontSize');
        if (saved) document.documentElement.dataset.fontSize = saved;
    } catch (e) {}
})();

// 바텀시트 끌어 올리기·내리기
// 1) 지도 아래 시트(.sheet): 손잡이를 위아래로 끌면 지도 높이가 바뀌어 시트가 올라가거나 내려감
//    놓은 자리에 그대로 멈춤 (맨 위·맨 아래까지만) · 손잡이를 누르면 기본 ↔ 접힘
// 2) 화면 위로 열린 시트(.modal-sheet__panel): 아래로 끌어 내리면 닫힘
var SheetDrag = (function () {
    var PEEK = 150;      // 접혔을 때 보이는 시트 높이
    var MAP_MIN = 96;    // 펼쳤을 때 남는 지도 높이 (뒤로 버튼 자리)

    function relayoutMaps() {
        if (window.MapKit && MapKit.relayout) MapKit.relayout();
    }

    // 손가락·마우스 끌기 공통: onMove(dy), onEnd(dy, 짧게 눌렀는지)
    function drag(handle, onStart, onMove, onEnd) {
        var startY = null;
        var lastDy = 0;
        handle.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            startY = e.clientY;
            lastDy = 0;
            handle.setPointerCapture(e.pointerId);
            onStart();
        });
        handle.addEventListener('pointermove', function (e) {
            if (startY === null) return;
            lastDy = e.clientY - startY;
            onMove(lastDy);
        });
        // 끝난 자리는 마지막으로 움직인 값으로 (취소될 때는 좌표가 0으로 와서)
        function end() {
            if (startY === null) return;
            startY = null;
            onEnd(lastDy, Math.abs(lastDy) < 6);
        }
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    function mapSheet(sheet) {
        var map = sheet.previousElementSibling;
        if (!map || !map.classList.contains('map-view')) return;
        var handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'sheet__handle';
        handle.setAttribute('aria-label', '시트 접기·펼치기');
        sheet.prepend(handle);

        // 기본 높이는 처음 끌 때 잼 (처음에 숨겨진 시트도 있어서)
        //  시트 높이도 그때 재 두고, 내려갈 때 줄어들지 않게 고정 (아래 버튼과 사이가 벌어지지 않게)
        var base = 0;
        var sheetBase = 0;
        var startHeight = 0;
        function limits() {
            if (!base) {
                base = map.offsetHeight;
                sheetBase = sheet.offsetHeight;
            }
            return { min: MAP_MIN, base: base, max: Math.max(base, window.innerHeight - PEEK) };
        }
        // 시트 아래 고정 버튼(.bottom-action)은 시트가 내려간 만큼 같이 내려감 (올릴 때는 제자리)
        var action = sheet.nextElementSibling;
        if (action && !action.classList.contains('bottom-action')) action = null;

        function setHeight(h, animate) {
            map.classList.toggle('is-resizing', !animate);
            map.style.flex = 'none';
            map.style.height = h + 'px';
            sheet.style.minHeight = sheetBase + 'px';
            if (action) {
                action.classList.toggle('is-resizing', !animate);
                action.style.transform = 'translateY(' + Math.max(0, h - limits().base) + 'px)';
            }
            sheet.dataset.state = h <= MAP_MIN + 1 ? 'expanded' : (h >= limits().max - 1 ? 'collapsed' : 'default');
            if (animate) setTimeout(relayoutMaps, 260);
            else relayoutMaps();
        }

        drag(handle, function () {
            startHeight = map.offsetHeight;
        }, function (dy) {
            var l = limits();
            setHeight(Math.min(l.max, Math.max(l.min, startHeight + dy)), false);
        }, function (dy, tap) {
            var l = limits();
            if (tap) {
                // 누르기: 접혀 있으면 기본으로, 아니면 접기
                return setHeight(sheet.dataset.state === 'collapsed' ? base : l.max, true);
            }
            // 놓은 자리에 그대로 멈춤 (맨 위·맨 아래 넘지 않게만)
            setHeight(Math.min(l.max, Math.max(l.min, startHeight + dy)), true);
        });
    }

    function modalPanel(panel) {
        var grabber = panel.querySelector('.sheet__grabber');
        if (!grabber) return;
        var handle = document.createElement('div');
        handle.className = 'sheet__handle';
        handle.setAttribute('aria-hidden', 'true');
        panel.prepend(handle);
        drag(handle, function () {
            panel.style.transition = 'none';
        }, function (dy) {
            panel.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
        }, function (dy) {
            panel.style.transition = '';
            panel.style.transform = '';
            // 80px 넘게 내리면 닫기 (각 화면의 '바깥 누르면 닫힘'을 그대로 씀)
            if (dy > 80) panel.parentNode.click();
        });
    }

    function init() {
        document.querySelectorAll('.sheet').forEach(mapSheet);
        document.querySelectorAll('.modal-sheet__panel').forEach(modalPanel);
    }

    return { init: init };
})();

document.addEventListener('DOMContentLoaded', function () {
    SheetDrag.init();

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
