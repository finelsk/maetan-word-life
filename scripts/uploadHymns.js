/**
 * 찬송가 데이터 업로드 스크립트
 * 
 * 사용법:
 * 1. Node.js 환경에서 실행 (npm install firebase-admin 필요)
 * 2. Firebase Admin SDK 서비스 계정 키 필요
 * 3. node scripts/uploadHymns.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Admin 초기화
// 주의: serviceAccountKey.json 파일이 필요합니다
// Firebase Console > 프로젝트 설정 > 서비스 계정 > 비공개 키 생성
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'test-db56e.firebasestorage.app'
});

const db = getFirestore();
const bucket = getStorage().bucket();

// 찬송가 목록 파싱 함수
function parseHymnList(filePath) {
  // 파일 읽기 (UTF-8)
  let content = fs.readFileSync(filePath, 'utf8');
  
  // BOM 제거
  content = content.replace(/^\uFEFF/, '');
  
  // 줄 분리 (\r\n 또는 \n)
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  const hymns = [];
  lines.forEach(line => {
    line = line.trim();
    // 형식: "001. 만복의 근원 하나님"
    const match = line.match(/^(\d{3})\.\s+(.+)$/);
    if (match) {
      const number = parseInt(match[1], 10);
      const title = match[2].trim();
      hymns.push({ number, title });
    }
  });
  
  return hymns;
}

// 이미지 업로드 함수
async function uploadImage(localPath, remotePath) {
  try {
    await bucket.upload(localPath, {
      destination: remotePath,
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000' // 1년 캐시
      }
    });
    
    // 공개 URL 생성
    const file = bucket.file(remotePath);
    await file.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${remotePath}`;
    return publicUrl;
  } catch (error) {
    console.error(`이미지 업로드 실패 (${localPath}):`, error.message);
    return null;
  }
}

// Firestore에 찬송가 메타데이터 저장
async function saveHymnToFirestore(category, hymn, imageUrl) {
  const docId = `${category}_${hymn.number}`;
  
  try {
    await db.collection('hymns').doc(docId).set({
      category: category,
      number: hymn.number,
      title: hymn.title,
      firstLine: hymn.title, // 첫 가사는 제목과 동일하게 설정 (나중에 수정 가능)
      scoreImageUrl: imageUrl || '',
      scoreImageUrlLandscape: '', // 가로 모드 이미지는 없음
      lyrics: [], // 가사는 나중에 추가
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`✅ ${category} ${hymn.number}번 저장 완료`);
    return true;
  } catch (error) {
    console.error(`❌ ${category} ${hymn.number}번 저장 실패:`, error.message);
    return false;
  }
}

// 통합 찬송가 업로드
async function uploadUnifiedHymns() {
  console.log('\n=== 통합 찬송가 업로드 시작 ===\n');
  
  const listPath = 'D:\\project\\hymn\\data\\hymn_1\\a_list.txt';
  const hymns = parseHymnList(listPath);
  
  console.log(`총 ${hymns.length}곡 발견\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const hymn of hymns) {
    const localImagePath = `D:\\project\\hymn\\data\\hymn_1\\a${String(hymn.number).padStart(3, '0')}.jpg`;
    const remoteImagePath = `hymns/unified/${hymn.number}.jpg`;
    
    // 이미지 파일 존재 확인
    if (!fs.existsSync(localImagePath)) {
      console.log(`⚠️  통합 ${hymn.number}번 이미지 없음`);
      failCount++;
      continue;
    }
    
    // 이미지 업로드
    const imageUrl = await uploadImage(localImagePath, remoteImagePath);
    
    if (!imageUrl) {
      failCount++;
      continue;
    }
    
    // Firestore 저장
    const success = await saveHymnToFirestore('unified', hymn, imageUrl);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // API 속도 제한 방지 (50ms 대기)
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n통합 찬송가 업로드 완료: 성공 ${successCount}곡, 실패 ${failCount}곡\n`);
}

// 은혜찬송가 업로드
async function uploadGraceHymns() {
  console.log('\n=== 은혜찬송가 업로드 시작 ===\n');
  
  const listPath = 'D:\\project\\hymn\\data\\hymn_2\\b_list.txt';
  const hymns = parseHymnList(listPath);
  
  console.log(`총 ${hymns.length}곡 발견\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const hymn of hymns) {
    const localImagePath = `D:\\project\\hymn\\data\\hymn_2\\b${String(hymn.number).padStart(3, '0')}.jpg`;
    const remoteImagePath = `hymns/grace/${hymn.number}.jpg`;
    
    // 이미지 파일 존재 확인
    if (!fs.existsSync(localImagePath)) {
      console.log(`⚠️  은혜 ${hymn.number}번 이미지 없음`);
      failCount++;
      continue;
    }
    
    // 이미지 업로드
    const imageUrl = await uploadImage(localImagePath, remoteImagePath);
    
    if (!imageUrl) {
      failCount++;
      continue;
    }
    
    // Firestore 저장
    const success = await saveHymnToFirestore('grace', hymn, imageUrl);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // API 속도 제한 방지 (50ms 대기)
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n은혜찬송가 업로드 완료: 성공 ${successCount}곡, 실패 ${failCount}곡\n`);
}

// 메인 실행
async function main() {
  try {
    console.log('🎵 찬송가 데이터 업로드 시작...\n');
    
    // 통합 찬송가 업로드
    await uploadUnifiedHymns();
    
    // 은혜찬송가 업로드
    await uploadGraceHymns();
    
    console.log('\n✅ 모든 업로드 완료!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 업로드 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
