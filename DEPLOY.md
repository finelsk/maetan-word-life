# Firebase Hosting 배포 가이드

## 사전 준비

1. **Firebase CLI 설치**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase 로그인**
   ```bash
   firebase login
   ```

3. **Firebase 프로젝트 확인**
   - Firebase Console (https://console.firebase.google.com/)에서 프로젝트 `maetan4`가 있는지 확인
   - 없으면 새 프로젝트 생성 또는 기존 프로젝트 사용

## 프로젝트 설정

1. **프로젝트 ID 확인/변경**
   - `.firebaserc` 파일에서 프로젝트 ID가 올바른지 확인
   - 다른 프로젝트를 사용하려면 `.firebaserc` 파일의 `"default": "maetan4"` 부분을 변경

2. **Firebase 프로젝트 초기화 (처음 한 번만)**
   ```bash
   firebase init hosting
   ```
   - 기존 설정을 덮어쓰지 않도록 주의
   - `firebase.json` 파일이 이미 있으면 건너뛰기

## 배포 방법

### 방법 1: npm 스크립트 사용 (권장)
```bash
npm run deploy
```

### 방법 2: 수동 배포
```bash
# 1. 빌드
npm run build

# 2. 배포
firebase deploy --only hosting
```

## 배포 후 확인

배포가 완료되면 다음 URL에서 확인할 수 있습니다:
- https://maetan4.firebaseapp.com/
- https://maetan4.web.app/

## 주의사항

1. **Firebase 프로젝트 ID 확인**
   - `src/firebase.js`의 `projectId`와 `.firebaserc`의 프로젝트 ID가 일치해야 합니다
   - 현재 `firebase.js`에는 `test-db56e`가 설정되어 있으므로, `maetan4` 프로젝트를 사용하려면 `firebase.js`도 수정해야 합니다

2. **Firestore 보안 규칙**
   - 배포 전에 Firestore 보안 규칙이 올바르게 설정되어 있는지 확인하세요

3. **환경 변수**
   - 프로덕션 환경에서도 Firebase 설정이 올바른지 확인하세요

## 문제 해결

### 배포 오류 발생 시
```bash
# Firebase CLI 버전 확인
firebase --version

# Firebase 재로그인
firebase logout
firebase login

# 프로젝트 재초기화
firebase use maetan4
```

### 빌드 오류 발생 시
```bash
# node_modules 재설치
rm -rf node_modules
npm install

# 빌드 테스트
npm run build
```




