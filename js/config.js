// 앱 설정
window.APP_CONFIG = {
    // 카카오 지도 JavaScript 키 (developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키)
    // 비워 두면 지도 자리에 디자인의 정적 지도 이미지가 보여요.
    kakaoMapKey: '6eac755619f2fa466bd16134f219f4f5',

    // 예시 좌표 (실제 서비스에선 검색·호출 데이터로 바뀜)
    places: {
        pickup: { lat: 37.6029, lng: 126.9360 },      // 집 · 래미안베라힐즈 101동 정문 (은평구 통일로 630)
        me: { lat: 37.6032, lng: 126.9357 },          // 내 위치 (예시 · 집 안)
        destination: { lat: 37.6334, lng: 126.9176 }, // 은평성모병원 (은평구 통일로 1021)
        car: { lat: 37.6047, lng: 126.9386 },         // 배정된 차량 처음 위치 (탑승 위치에서 약 300m)
        riding: { lat: 37.6151, lng: 126.9286 }       // 이동 중 차량 위치 (예시)
    }
};
