// 앱 설정
window.APP_CONFIG = {
    // 카카오 지도 JavaScript 키 (developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키)
    // 비워 두면 지도 자리에 디자인의 정적 지도 이미지가 보여요.
    kakaoMapKey: '',

    // 예시 좌표 (실제 서비스에선 검색·호출 데이터로 바뀜)
    places: {
        pickup: { lat: 37.5664, lng: 127.0421 },      // 아파트 정문 (예시)
        me: { lat: 37.5667, lng: 127.0418 },          // 내 위치 (예시)
        destination: { lat: 37.5600, lng: 127.0449 }, // 한양대학교병원 정문 (예시)
        car: { lat: 37.5681, lng: 127.0447 },         // 배정된 차량 위치 (예시)
        riding: { lat: 37.5633, lng: 127.0433 }       // 이동 중 차량 위치 (예시)
    }
};
