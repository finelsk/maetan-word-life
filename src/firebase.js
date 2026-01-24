import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase 설정 - 사용자가 자신의 Firebase 프로젝트 설정으로 교체해야 합니다
const firebaseConfig = {
  apiKey: "AIzaSyA8O-L_a8lIZa8F22c7l_oaE1OpsIZ18OU",
  authDomain: "test-db56e.firebaseapp.com",
  databaseURL: "https://test-db56e.firebaseio.com",
  projectId: "test-db56e",
  storageBucket: "test-db56e.firebasestorage.app",
  messagingSenderId: "391159408804",
  appId: "1:391159408804:web:9271b866d30663ba9cde31"
};

// Firebase 초기화
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase 초기화 실패:', error);
  throw error;
}

// Firestore 초기화
let db;
try {
  db = getFirestore(app);
  
  // 오프라인 캐시 활성화 (빠른 로딩을 위한 캐시)
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // 여러 탭이 열려있을 때 발생하는 오류 (무시 가능)
        console.log('Firestore 캐시: 여러 탭이 열려있어 캐시를 활성화할 수 없습니다.');
      } else if (err.code === 'unimplemented') {
        // 브라우저가 지원하지 않을 때 (무시 가능)
        console.log('Firestore 캐시: 현재 브라우저에서 지원하지 않습니다.');
      } else {
        console.error('Firestore 캐시 활성화 오류:', err);
      }
    });
  }
} catch (error) {
  console.error('Firestore 초기화 실패:', error);
  throw error;
}

// Firebase Storage 초기화
let storage;
try {
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase Storage 초기화 실패:', error);
  throw error;
}

export { db, app, storage };

