# 찬송가 모듈 (Hymn Module)

찬송가 검색, 악보 보기, 즐겨찾기 기능을 제공하는 모듈입니다.

## 주요 기능

1. **카테고리 선택**
   - 통합 찬송가
   - 은혜찬송가

2. **검색 기능**
   - 번호로 검색
   - 제목으로 검색
   - 가사로 검색
   - 전체 검색

3. **가사 보기**
   - 텍스트 형태로 가사 표시
   - 절별로 구분하여 표시

4. **악보 보기**
   - 이미지 형태의 악보 표시
   - 전체화면 모드
   - 세로/가로 모드 전환
   - 가로 모드 자동 스크롤 (시간 조절 가능)
   - 화면 꺼짐 방지 (Wake Lock API)

5. **즐겨찾기**
   - 찬송가 즐겨찾기 추가/제거
   - 즐겨찾기만 보기

6. **로컬 캐싱**
   - 한번 불러온 찬송가는 로컬에 캐시
   - 빠른 재로딩

## Firebase 데이터 구조

### Collection: `hymns`

Document ID: `{category}_{number}` (예: `unified_1`, `grace_1`)

Fields:
- `category` (string): 'unified' 또는 'grace'
- `number` (number): 찬송가 번호
- `title` (string): 찬송가 제목
- `firstLine` (string): 첫 가사
- `lyrics` (array): 가사 배열 (각 요소는 문자열, 줄바꿈은 '\n')
- `scoreImageUrl` (string): 세로 모드 악보 이미지 URL
- `scoreImageUrlLandscape` (string): 가로 모드 악보 이미지 URL (선택사항)

예시:
```javascript
{
  category: 'unified',
  number: 1,
  title: '만세 반석이신 예수',
  firstLine: '만세 반석이신 예수',
  lyrics: [
    '만세 반석이신 예수\n만세 반석이신 예수',
    '만세 반석이신 예수\n만세 반석이신 예수'
  ],
  scoreImageUrl: 'https://storage.googleapis.com/.../unified_1_portrait.jpg',
  scoreImageUrlLandscape: 'https://storage.googleapis.com/.../unified_1_landscape.jpg'
}
```

## 사용 방법

### App.jsx에서 통합

```jsx
import HymnModule from './hymn/HymnModule';

function App() {
  const [showHymnModule, setShowHymnModule] = useState(false);
  
  return (
    <div>
      {/* 성구암송 Audio Play 버튼 옆에 음표 아이콘 추가 */}
      <button onClick={() => setShowHymnModule(true)}>🎵</button>
      
      {/* 찬송가 모듈 */}
      {showHymnModule && (
        <HymnModule onClose={() => setShowHymnModule(false)} />
      )}
    </div>
  );
}
```

## 폴더 구조

```
hymn/
├── components/
│   ├── HymnSearch.jsx          # 검색 컴포넌트
│   ├── HymnViewer.jsx          # 가사 뷰어
│   └── HymnScoreViewer.jsx     # 악보 뷰어
├── hooks/
│   ├── useHymnCache.js         # 로컬 캐싱 훅
│   └── useFavorites.js          # 즐겨찾기 훅
├── styles/
│   └── hymn.css                # 스타일 파일
├── HymnModule.jsx              # 메인 모듈 컴포넌트
└── README.md
```

## 주요 기능 상세

### 자동 스크롤
- 가로 모드에서만 작동
- 전체화면 모드에서만 작동
- 스크롤 속도: 10초 ~ 60초 (사용자 조절 가능)
- 끝에 도달하면 처음으로 돌아감

### 화면 꺼짐 방지
- Wake Lock API 사용 (지원되는 브라우저에서)
- 전체화면 + 가로 모드 + 자동 스크롤 활성화 시 작동

### 로컬 캐싱
- localStorage 사용
- 캐시 유효기간: 30일
- 자동 만료 처리

### 즐겨찾기
- localStorage에 저장
- 카테고리별로 관리
- 즐겨찾기만 보기 기능

## 브라우저 호환성

- Wake Lock API: Chrome 84+, Edge 84+, Opera 70+
- localStorage: 모든 모던 브라우저
- IndexedDB (Firebase 캐시): 모든 모던 브라우저

## 개발 노트

이 모듈은 `feature/hymn-module` 브랜치에서 개발되었습니다.
GitHub에 새로 분기하여 업데이트할 예정입니다.
