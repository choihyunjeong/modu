// 앱 설정
window.APP_CONFIG = {
    // 카카오 지도 JavaScript 키 (developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키)
    // 비워 두면 지도 자리에 디자인의 정적 지도 이미지가 보여요.
    kakaoMapKey: '5d75fa93437d11cffe744bb937276570',

    // 예시 좌표 (실제 서비스에선 검색·호출 데이터로 바뀜)
    places: {
        pickup: { lat: 37.6185, lng: 126.9205 },      // OO아파트 101동 정문 (예시 · 은평구 연신내 근처)
        me: { lat: 37.6188, lng: 126.9201 },          // 내 위치 (예시)
        destination: { lat: 37.6027, lng: 126.9291 }, // OO주민센터 (예시 · 은평구청 근처)
        car: { lat: 37.6203, lng: 126.9232 },         // 배정된 차량 위치 (예시)
        riding: { lat: 37.6110, lng: 126.9248 }       // 이동 중 차량 위치 (예시)
    }
};
