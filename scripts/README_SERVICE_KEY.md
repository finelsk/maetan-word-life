# 🔐 Firebase 서비스 계정 키 안내

이 폴더에는 **Firebase Admin SDK 서비스 계정 키**가 필요합니다.

## 파일 이름
`serviceAccountKey.json`

## 생성 방법

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 **test-db56e** 선택
3. 프로젝트 설정(⚙️) → **서비스 계정** 탭
4. **"새 비공개 키 생성"** 버튼 클릭
5. 다운로드된 JSON 파일을 이 폴더에 `serviceAccountKey.json`로 저장

## ⚠️ 보안 경고

- 이 파일은 **절대 Git에 커밋하지 마세요!**
- `.gitignore`에 이미 추가되어 있습니다.
- 이 파일로 Firebase 프로젝트의 모든 데이터에 접근할 수 있습니다.

## 파일이 없으면?

업로드 스크립트 실행 시 다음 에러가 발생합니다:
```
Error: Could not load the default credentials
```

→ 위 생성 방법을 따라 파일을 생성하세요.
