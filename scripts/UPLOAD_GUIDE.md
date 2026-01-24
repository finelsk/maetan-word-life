# 찬송가 데이터 Firebase 업로드 가이드

## 1. 사전 준비

### Firebase Admin SDK 서비스 계정 키 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택 (test-db56e)
3. 프로젝트 설정(⚙️) → 서비스 계정 탭
4. "새 비공개 키 생성" 클릭
5. 다운로드된 JSON 파일을 `scripts/serviceAccountKey.json`으로 저장

### Firebase Storage 규칙 설정

Firebase Console → Storage → Rules에서 다음과 같이 설정:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 찬송가 이미지는 누구나 읽기 가능
    match /hymns/{allPaths=**} {
      allow read: if true;
      allow write: if false; // 관리자만 업로드
    }
  }
}
```

### Firestore 보안 규칙 설정

Firebase Console → Firestore Database → Rules에서 hymns 컬렉션 읽기 허용:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 기존 규칙...
    
    // 찬송가는 누구나 읽기 가능
    match /hymns/{hymnId} {
      allow read: if true;
      allow write: if false; // 관리자만 쓰기
    }
  }
}
```

## 2. 패키지 설치

```bash
npm install firebase-admin
```

또는 package.json에 추가:

```json
{
  "type": "module",
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

## 3. 업로드 실행

### 전체 업로드 (558 + 308 = 866곡)

```bash
node scripts/uploadHymns.js
```

⚠️ **주의**: 전체 업로드는 시간이 오래 걸립니다 (약 1시간)

### 테스트 업로드 (10곡만)

```bash
node scripts/uploadHymnsTest.js
```

## 4. 데이터 구조

### Firestore: `hymns` 컬렉션

Document ID: `{category}_{number}` (예: `unified_1`, `grace_100`)

```json
{
  "category": "unified", // 또는 "grace"
  "number": 1,
  "title": "만복의 근원 하나님",
  "firstLine": "만복의 근원 하나님",
  "scoreImageUrl": "https://storage.googleapis.com/.../hymns/unified/1.jpg",
  "scoreImageUrlLandscape": "",
  "lyrics": [],
  "createdAt": "2026-01-24T...",
  "updatedAt": "2026-01-24T..."
}
```

### Firebase Storage: `hymns/` 폴더

```
hymns/
  ├── unified/
  │   ├── 1.jpg
  │   ├── 2.jpg
  │   └── ...
  └── grace/
      ├── 1.jpg
      ├── 2.jpg
      └── ...
```

## 5. 문제 해결

### 서비스 계정 키 오류

```
Error: Could not load the default credentials
```

→ `serviceAccountKey.json` 파일이 `scripts/` 폴더에 있는지 확인

### Storage 버킷 오류

```
Error: Storage bucket not found
```

→ Firebase Console → Storage → 시작하기 클릭하여 Storage 활성화

### 권한 오류

```
Error: Permission denied
```

→ Firebase Console → Storage/Firestore 보안 규칙 확인

## 6. 업로드 후 확인

1. **Firebase Console → Storage**
   - `hymns/unified/` 폴더에 558개 이미지
   - `hymns/grace/` 폴더에 308개 이미지

2. **Firebase Console → Firestore Database**
   - `hymns` 컬렉션에 866개 문서

3. **웹 앱 테스트**
   - http://localhost:5173/ 접속
   - 찬송가 버튼(🎵) 클릭
   - 통합 찬송가/은혜찬송가 탭에서 검색 가능
   - 찬송가 선택 시 악보 이미지 표시

## 7. 비용 안내

- **Firebase Storage**: 5GB까지 무료
  - 찬송가 이미지 약 866곡 × 평균 200KB = 약 173MB
  
- **Firestore**: 1GB까지 무료
  - 메타데이터 약 866개 × 1KB = 약 1MB

→ 무료 범위 내에서 충분히 사용 가능합니다.
