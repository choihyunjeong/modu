// 음성으로 부르기 (voice.html · 피그마 말로하기_v17 A 듣는 중 → B 확인)
//  들은 말에서 목적지를 뽑아 장소 검색(js/places.js) → 첫 번째 결과로 "지금 부를까요?"
//  "네, 부르기"(또는 "네"라고 말하기) → 이번 호출로 접수하고 차량 찾는 중 화면으로
//  예시 문구를 눌러도 같은 흐름 (마이크를 못 쓰는 기기·시연용)
(function () {
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var listenStep = document.querySelector('[data-voice-step="listen"]');
    var confirmStep = document.querySelector('[data-voice-step="confirm"]');
    var title = document.querySelector('[data-voice-title]');
    var desc = document.querySelector('[data-voice-desc]');
    var heardLine = document.querySelector('[data-voice-heard]');
    var mic = document.querySelector('[data-voice-mic]');
    var micLabel = document.querySelector('[data-voice-mic-label]');
    var rec = null;
    var picked = null;   // 확인 중인 장소
    var heard = '';
    var viaVoice = false;  // 말로 했으면 확인 질문에도 "네/아니요"를 말로 받음

    // 받침 있으면 "으로", 없거나 ㄹ 받침이면 "로"
    function ro(word) {
        var code = word.charCodeAt(word.length - 1) - 0xac00;
        if (code < 0 || code > 11171) return '(으)로';
        var jong = code % 28;
        return jong === 0 || jong === 8 ? '로' : '으로';
    }

    // ---------- 듣기 ----------
    function setListening(on) {
        mic.classList.toggle('is-listening', on);
        mic.setAttribute('aria-pressed', on);
        mic.setAttribute('aria-label', on ? '듣는 중 · 누르면 멈춰요' : '말하기');
        micLabel.textContent = on ? '듣는 중' : '눌러서 말하기';
    }

    function showListen(message, sub) {
        stopSpeaking();
        confirmStep.hidden = true;
        listenStep.hidden = false;
        title.textContent = message || '어디로 갈까요?';
        desc.textContent = sub || (typeForm && !typeForm.hidden ? '어디로 갈지 입력해 주세요.' : '가운데 마이크를 누르고 말씀해 주세요.');
        heardLine.hidden = true;
    }

    // onText(최종 문장) · 듣는 동안 들린 말은 화면에 바로 보여 줌
    function listen(onText) {
        if (!Recognition) {
            showListen('이 기기에서는 말로 부를 수 없어요', '아래 예시를 누르거나 키보드로 입력해 주세요.');
            return;
        }
        if (rec) rec.abort();
        rec = new Recognition();
        rec.lang = 'ko-KR';
        rec.interimResults = true;
        var finalText = '';
        rec.onresult = function (e) {
            var text = '';
            for (var i = 0; i < e.results.length; i++) {
                text += e.results[i][0].transcript;
                if (e.results[i].isFinal) finalText = text;
            }
            heardLine.hidden = false;
            heardLine.textContent = '"' + text + '"';
        };
        rec.onerror = function (e) {
            // 확인 단계에서 "네/아니요"를 못 들은 경우엔 버튼으로 고르면 되니 그대로 둠
            if (!confirmStep.hidden) return;
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                showListen('마이크를 쓸 수 없어요', '브라우저 설정에서 마이크를 허용하거나, 예시를 누르거나 키보드로 입력해 주세요.');
            } else if (e.error === 'no-speech') {
                desc.textContent = '잘 듣지 못했어요. 마이크를 눌러 다시 말씀해 주세요.';
            }
        };
        rec.onend = function () {
            setListening(false);
            rec = null;
            if (finalText) onText(finalText.trim());
        };
        setListening(true);
        rec.start();
    }

    function stopListening() {
        if (rec) rec.abort();
        setListening(false);
    }

    // ---------- 들은 말 이해하기 ----------
    function understand(text) {
        heard = text;
        var t = text.replace(/[."'!?]/g, '').trim();
        var trip = Trip.get();

        // 진행 중인 호출 묻기
        if (/어디(쯤|야|에)|언제\s*(와|오)|도착했/.test(t)) {
            if (trip.calledAt) return location.href = 'assigned.html';
            return showListen('지금 진행 중인 호출이 없어요', '어디로 갈지 말씀해 주시면 바로 불러 드려요.');
        }
        // 내일·모레 → 예약 탭
        if (/내일|모레/.test(t)) {
            StateNotice.leave('내일 이동은 전일접수로 신청해요 · 시간을 골라 주세요');
            return location.href = 'reserve.html';
        }

        var query = t
            .replace(/\s*(으로|로|에|까지)?\s*(지금\s*)?(바로\s*)?(가는\s*차|가\s*줘|가\s*주세요|가자|갈래|가고\s*싶어(요)?|불러\s*줘|불러\s*주세요|불러\s*줄래|부탁해(요)?|가요)\s*$/, '')
            .replace(/\s*(으로|로)$/, '')
            .trim();
        if (!query) return showListen('어디로 갈지 다시 말씀해 주세요', '예: "은평성모병원으로 불러줘"');

        title.textContent = '찾고 있어요…';
        desc.textContent = '"' + query + '"';
        Places.search(query, function (items) {
            if (items === null) return showListen('찾지 못했어요', '인터넷 연결을 확인하고 다시 말씀해 주세요.');
            if (!items.length) return showListen('"' + query + '"' + '을(를) 찾지 못했어요', '다른 이름으로 다시 말씀해 주세요.');
            // 출발지와 같은 곳이어도 그대로 진행 (거리 0m)
            showConfirm(items[0], query);
        });
    }

    // ---------- 확인 ----------
    function showConfirm(place, query) {
        picked = place;
        listenStep.hidden = true;
        confirmStep.hidden = false;
        var trip = Trip.get();
        var question = place.name + ro(place.name) + ' 지금 부를까요?';
        var stats = WaitStats.forDay();
        document.querySelector('[data-confirm-heard]').textContent = '"' + heard + '"';
        document.querySelector('.voice-confirm__heard-label').textContent = viaVoice ? '이렇게 들었어요' : '이렇게 입력했어요';
        document.querySelector('[data-confirm-no]').textContent = viaVoice ? '아니요, 다시 말할게요' : '아니요, 다시 입력할게요';
        document.querySelector('.voice-confirm__note').hidden = !viaVoice;
        document.querySelector('[data-confirm-question]').textContent = question;
        document.querySelector('[data-confirm-sub]').textContent =
            (trip.pickupName || '래미안베라힐즈 정문') + '에서 출발 · 보통 ' + stats.min + '~' + stats.max + '분 뒤 타요';
        document.querySelector('[data-confirm-edit]').href = 'search.html?q=' + encodeURIComponent(query);
        document.querySelector('[data-confirm-yes]').focus();

        // 말로 불렀을 때만: 질문을 읽어 주고, 다 읽으면 "네 / 아니요"를 들음
        if (!viaVoice) return;
        speak(question + ' 네 또는 아니요로 말씀해 주세요.', function () {
            listen(function (answer) {
                if (/^(네|예|응|어|부르|불러|좋아|그래)/.test(answer)) call();
                else if (/아니|다시|취소/.test(answer)) retry();
            });
        });
    }

    function call() {
        if (!picked) return;
        stopListening();
        stopSpeaking();
        Trip.start({ name: picked.name, addr: picked.addr, lat: picked.lat, lng: picked.lng });
        // 저장한 탑승 정보로 바로 접수
        Trip.set({ calledAt: Date.now(), boardedAt: null, chat: [], helpRequests: [], share: null, carHeading: null, stage: 'waiting', stageAt: Date.now(),
            ride: window.RideInfo ? RideInfo.tags() : null });
        StateNotice.leave(picked.name + ro(picked.name) + ' 호출했어요');
        location.href = 'waiting.html';
    }

    // 아니요: 말로 했으면 다시 듣고, 입력했으면 입력칸으로
    function retry() {
        picked = null;
        showListen();
        if (viaVoice) {
            desc.textContent = '듣고 있어요. 어디로 갈지 말씀해 주세요.';
            listen(understand);
        } else {
            setTyping(true);
            typeInput.select();
        }
    }

    // ---------- 읽어 주기 ----------
    function speak(text, done) {
        if (!window.speechSynthesis) return done && done();
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        u.onend = function () { if (done) done(); };
        speechSynthesis.speak(u);
    }

    function stopSpeaking() {
        if (window.speechSynthesis) speechSynthesis.cancel();
    }

    // ---------- 버튼 ----------
    // 키보드: 같은 화면에 입력칸을 열고 휴대폰 키보드를 올림 (다시 누르면 닫힘)
    var keyboardBtn = document.querySelector('[data-voice-keyboard]');
    var typeForm = document.querySelector('[data-voice-type]');
    var typeInput = document.getElementById('voice-text');
    var examples = document.querySelector('[data-voice-examples]');
    function setTyping(on) {
        typeForm.hidden = !on;
        examples.hidden = on;
        keyboardBtn.setAttribute('aria-pressed', on);
        keyboardBtn.classList.toggle('is-on', on);
        if (on) {
            stopListening();
            stopSpeaking();
            desc.textContent = '어디로 갈지 입력해 주세요.';
            var text = heardLine.hidden ? '' : heardLine.textContent.replace(/"/g, '');
            if (text && !typeInput.value) typeInput.value = text;
            typeInput.focus();
        } else {
            desc.textContent = '가운데 마이크를 누르고 말씀해 주세요.';
        }
    }
    keyboardBtn.addEventListener('click', function () { setTyping(typeForm.hidden); });
    typeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = typeInput.value.trim();
        if (!text) return typeInput.focus();
        typeInput.blur();
        viaVoice = false;
        understand(text);
    });
    mic.addEventListener('click', function () {
        if (rec) return stopListening();
        if (!typeForm.hidden) setTyping(false);
        viaVoice = true;
        desc.textContent = '듣고 있어요. 어디로 갈지 말씀해 주세요.';
        listen(understand);
    });
    document.querySelectorAll('.voice-example').forEach(function (btn) {
        btn.addEventListener('click', function () {
            stopListening();
            viaVoice = false;
            understand(btn.textContent.replace(/"/g, ''));
        });
    });
    document.querySelector('[data-confirm-yes]').addEventListener('click', call);
    document.querySelector('[data-confirm-no]').addEventListener('click', retry);
    document.querySelector('[data-voice-close]').addEventListener('click', function () {
        stopListening();
        stopSpeaking();
        if (history.length > 1) history.back();
        else location.href = 'index.html';
    });

    // 들어오면 기다림 · 가운데 마이크를 눌러야 듣기 시작
    if (!Recognition) showListen('이 기기에서는 말로 부를 수 없어요', '아래 예시를 누르거나 키보드로 입력해 주세요.');
})();
