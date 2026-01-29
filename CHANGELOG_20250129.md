# 수정 내역 (2025-01-29)

## Gemini API 모델 업데이트

### 변경 요약
- **원인**: `gemini-1.5-flash` 계열 모델 지원 종료
- **조치**: 안정 모델 `gemini-2.5-flash`로 스크립트 수정

### 수정 파일
| 파일 | 내용 |
|------|------|
| `src/geminiAgent.js` | AI 질문 처리 시 사용하는 Gemini 모델 목록 변경 |

### 모델 변경 내용

**변경 전**
- `gemini-1.5-flash-latest` (1순위)
- `gemini-1.5-pro-latest`, `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-pro`, `gemini-2.0-flash-exp` (fallback)

**변경 후**
- `gemini-2.5-flash` (1순위, Stable)
- `gemini-2.0-flash` (fallback)
- `gemini-2.5-pro` (fallback)
- `gemini-2.0-flash-001` (fallback)

### 참고
- [Gemini API 모델 문서](https://ai.google.dev/gemini-api/docs/models)
- 배포: Firebase Hosting (test-db56e.web.app) 반영 완료
