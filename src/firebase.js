import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

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
  console.log('Firebase 초기화 성공:', app.options.projectId);
} catch (error) {
  console.error('Firebase 초기화 실패:', error);
  throw error;
}

// Firestore 초기화
let db;
try {
  db = getFirestore(app);
  console.log('Firestore 초기화 성공');
} catch (error) {
  console.error('Firestore 초기화 실패:', error);
  throw error;
}

export { db, app };

