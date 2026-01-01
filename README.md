# 매탄교구 말씀생활 기록 시스템

매탄교구 말씀생활 기록 및 순위 확인 웹 애플리케이션입니다.

## 기능

- 일자 자동 표시 (현재 날짜)
- 구역 선택 (41, 42, 43)
- 이름 입력
- 이전 입력값 자동 불러오기 (localStorage 사용)
- 성경읽기 장 수 입력
- 주일말씀 참석 기록 (주일만 가능)
- 수요말씀 참석 기록 (수요일만 가능)
- Firebase 데이터베이스 저장
- 저장 전 확인 팝업
- 구역 순위 및 개인 순위 표시

## 설치 방법

1. 의존성 설치:
```bash
npm install
```

2. Firebase 설정:
   - `src/firebase.js` 파일을 열어서 자신의 Firebase 프로젝트 설정으로 교체하세요.
   - Firebase Console에서 Firestore Database를 생성하세요.

3. 개발 서버 실행:
```bash
npm run dev
```

4. 빌드:
```bash
npm run build
```

## Firebase 설정

`src/firebase.js` 파일에서 다음 정보를 자신의 Firebase 프로젝트 정보로 교체하세요:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## 사용 방법

1. 구역과 이름을 입력합니다.
2. 성경읽기 장 수를 입력합니다.
3. 주일인 경우 주일말씀 참석 방식을 선택합니다.
4. 수요일인 경우 수요말씀 참석 방식을 선택합니다.
5. 저장 버튼을 클릭합니다.
6. 확인 팝업에서 내용을 확인하고 확인을 클릭합니다.
7. 저장 후 순위 화면이 표시됩니다.

## 순위 계산 방식

### 구역 순위
- 수요말씀 참석자를 구역별로 집계
- (현장+온라인) 집계와 (온라인제외) 집계의 1등 구역 표시

### 개인 순위
- **성경읽기**: 개인별 성경읽은 장수의 합계 및 순위
- **매일읽기**: 성경을 읽은 장수를 입력한 일 수 합계 및 순위
- **주일참석**: 주일참석 체크한 날짜 수 합계 및 순위
- **수요참석**: 수요말씀 참석 체크한 날짜 수 합계 및 순위

