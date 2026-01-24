# 찬송가 Firebase 업로드 빠른 시작 가이드

## ⚡ 빠른 시작 (3단계)

### 1️⃣ Firebase 서비스 계정 키 다운로드

1. https://console.firebase.google.com/ 접속
2. 프로젝트 **test-db56e** 선택
3. 프로젝트 설정(⚙️) → **서비스 계정** 탭
4. **"새 비공개 키 생성"** 버튼 클릭
5. 다운로드된 JSON 파일을 다음 경로로 저장:
   ```
   D:\project\hymn\maetan-word-life\scripts\serviceAccountKey.json
   ```

### 2️⃣ Firebase Storage 활성화

1. Firebase Console → **Storage**
2. **"시작하기"** 버튼 클릭
3. 기본 설정으로 진행

### 3️⃣ 패키지 설치 및 업로드

```bash
# 1. 패키지 설치
cd D:\project\hymn\maetan-word-life
npm install

# 2. 테스트 업로드 (10곡만)
npm run upload-hymns-test

# 3. 전체 업로드 (866곡)
npm run upload-hymns
```

## 📝 업로드 진행 상황

터미널에서 다음과 같이 진행 상황이 표시됩니다:

```
🎵 찬송가 데이터 업로드 시작...

=== 통합 찬송가 업로드 시작 ===

총 558곡 발견

✅ unified 1번 저장 완료
✅ unified 2번 저장 완료
✅ unified 3번 저장 완료
...

통합 찬송가 업로드 완료: 성공 558곡, 실패 0곡

=== 은혜찬송가 업로드 시작 ===

총 308곡 발견

✅ grace 1번 저장 완료
✅ grace 2번 저장 완료
...

은혜찬송가 업로드 완료: 성공 308곡, 실패 0곡

✅ 모든 업로드 완료!
```

## 🎯 업로드 완료 후 확인

### Firebase Console에서 확인

1. **Storage 확인**
   - https://console.firebase.google.com/project/test-db56e/storage
   - `hymns/unified/` 폴더 → 558개 이미지
   - `hymns/grace/` 폴더 → 308개 이미지

2. **Firestore 확인**
   - https://console.firebase.google.com/project/test-db56e/firestore
   - `hymns` 컬렉션 → 866개 문서

### 웹 앱에서 확인

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. http://localhost:5173/ 접속

3. 찬송가 버튼(🎵) 클릭

4. **통합 찬송가** 탭에서 1번 선택

5. "악보" 버튼 클릭 → 이미지가 표시되면 성공! ✅

## ⏱️ 예상 소요 시간

- **테스트 업로드 (10곡)**: 약 1분
- **전체 업로드 (866곡)**: 약 60~90분

💡 **팁**: 전체 업로드는 백그라운드로 실행하고 다른 작업을 하세요!

## 🚨 문제 해결

### 에러: "serviceAccountKey.json not found"

→ 1단계를 다시 확인하여 서비스 계정 키를 올바른 경로에 저장하세요.

### 에러: "Storage bucket not found"

→ 2단계를 다시 확인하여 Firebase Storage를 활성화하세요.

### 에러: "Permission denied"

→ Firebase Console → Storage → Rules에서 다음 규칙 설정:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /hymns/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## 💰 비용

**완전 무료!** Firebase 무료 플랜(Spark) 범위 내:
- Storage: 5GB 무료 (찬송가 이미지 약 173MB 사용)
- Firestore: 1GB 무료 (메타데이터 약 1MB 사용)

---

📖 더 자세한 내용은 `scripts/UPLOAD_GUIDE.md`를 참고하세요.
