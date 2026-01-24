# 매탄교구 말씀생활 기록 시스템

매탄교구 말씀생활 기록 및 순위 확인 웹 애플리케이션입니다.

## 주요 기능

### 📖 말씀생활 기록
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

### 🎤 성구암송
- 주간별 성구암송 말씀 표시 (지난주/이번주/다음주)
- MP3 오디오 재생 기능
- 전체 반복/한 구절 반복 모드
- 전체화면 모드

### 🎵 찬송가 모듈
- **통합 찬송가** 558곡
- **은혜찬송가** 308곡
- 번호/제목/가사로 검색
- 가사 보기 (절별 구분)
- 악보 이미지 보기
- 즐겨찾기 기능
- 로컬 캐싱 (빠른 재로딩)

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

## 🎵 찬송가 데이터 업로드

찬송가 모듈을 사용하려면 Firebase에 이미지와 메타데이터를 업로드해야 합니다.

### 빠른 시작

상세한 가이드는 [`HYMN_UPLOAD_QUICK_START.md`](./HYMN_UPLOAD_QUICK_START.md) 참고

1. **Firebase 서비스 계정 키 생성**
   - Firebase Console → 프로젝트 설정 → 서비스 계정
   - "새 비공개 키 생성" 클릭
   - `scripts/serviceAccountKey.json`으로 저장

2. **패키지 설치**
   ```bash
   npm install
   ```

3. **업로드 실행**
   ```bash
   # 테스트 (10곡만)
   npm run upload-hymns-test
   
   # 전체 업로드 (866곡)
   npm run upload-hymns
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

### 말씀생활 기록
1. 구역과 이름을 입력합니다.
2. 성경읽기 장 수를 입력합니다.
3. 주일인 경우 주일말씀 참석 방식을 선택합니다.
4. 수요일인 경우 수요말씀 참석 방식을 선택합니다.
5. 저장 버튼을 클릭합니다.
6. 확인 팝업에서 내용을 확인하고 확인을 클릭합니다.
7. 저장 후 순위 화면이 표시됩니다.

### 찬송가 사용
1. 성구암송 섹션에서 음표(🎵) 버튼 클릭
2. 통합 찬송가 또는 은혜찬송가 선택
3. 검색바에서 번호/제목/가사로 검색
4. 찬송가 선택 → 가사 보기 또는 악보 보기
5. ⭐ 버튼으로 즐겨찾기 추가/제거

## 순위 계산 방식

### 구역 순위
- 수요말씀 참석자를 구역별로 집계
- (현장+온라인) 집계와 (온라인제외) 집계의 1등 구역 표시

### 개인 순위
- **성경읽기**: 개인별 성경읽은 장수의 합계 및 순위
- **매일읽기**: 성경을 읽은 장수를 입력한 일 수 합계 및 순위
- **주일참석**: 주일참석 체크한 날짜 수 합계 및 순위
- **수요참석**: 수요말씀 참석 체크한 날짜 수 합계 및 순위

## 프로젝트 구조

```
maetan-word-life/
├── src/
│   ├── hymn/                    # 찬송가 모듈
│   │   ├── components/          # 검색, 가사, 악보 뷰어
│   │   ├── hooks/               # 캐싱, 즐겨찾기 훅
│   │   ├── data/                # 샘플 데이터
│   │   └── styles/              # CSS
│   ├── App.jsx                  # 메인 앱
│   ├── firebase.js              # Firebase 설정
│   └── styles.css               # 전역 스타일
├── scripts/                     # 업로드 스크립트
│   ├── uploadHymns.js           # 전체 업로드
│   ├── uploadHymnsTest.js       # 테스트 업로드
│   └── serviceAccountKey.json   # Firebase 서비스 키 (gitignore)
├── data/                        # 찬송가 원본 데이터
│   ├── hymn_1/                  # 통합 찬송가 (558곡)
│   └── hymn_2/                  # 은혜찬송가 (308곡)
└── public/                      # 정적 파일
```

## 배포

```bash
npm run deploy
```

Firebase Hosting에 자동 배포됩니다.

## 라이센스

MIT License
