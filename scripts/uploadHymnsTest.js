/**
 * 찬송가 데이터 업로드 테스트 스크립트 (10곡만)
 * 
 * 사용법:
 * 1. node scripts/uploadHymnsTest.js
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
        cacheControl: 'public, max-age=31536000'
      }
    });
    
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
      firstLine: hymn.title,
      scoreImageUrl: imageUrl || '',
      scoreImageUrlLandscape: '',
      lyrics: [],
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

// 테스트 업로드 (10곡만)
async function uploadTestHymns() {
  console.log('\n=== 테스트 업로드 시작 (10곡) ===\n');
  
  // 통합 찬송가 5곡
  const unifiedListPath = 'D:\\project\\hymn\\data\\hymn_1\\a_list.txt';
  const unifiedHymns = parseHymnList(unifiedListPath).slice(0, 5);
  
  console.log('통합 찬송가 5곡 업로드 중...\n');
  
  for (const hymn of unifiedHymns) {
    const localImagePath = `D:\\project\\hymn\\data\\hymn_1\\a${String(hymn.number).padStart(3, '0')}.jpg`;
    const remoteImagePath = `hymns/unified/${hymn.number}.jpg`;
    
    if (!fs.existsSync(localImagePath)) {
      console.log(`⚠️  통합 ${hymn.number}번 이미지 없음: ${localImagePath}`);
      continue;
    }
    
    const imageUrl = await uploadImage(localImagePath, remoteImagePath);
    if (imageUrl) {
      await saveHymnToFirestore('unified', hymn, imageUrl);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 은혜찬송가 5곡
  const graceListPath = 'D:\\project\\hymn\\data\\hymn_2\\b_list.txt';
  const graceHymns = parseHymnList(graceListPath).slice(0, 5);
  
  console.log('\n은혜찬송가 5곡 업로드 중...\n');
  
  for (const hymn of graceHymns) {
    const localImagePath = `D:\\project\\hymn\\data\\hymn_2\\b${String(hymn.number).padStart(3, '0')}.jpg`;
    const remoteImagePath = `hymns/grace/${hymn.number}.jpg`;
    
    if (!fs.existsSync(localImagePath)) {
      console.log(`⚠️  은혜 ${hymn.number}번 이미지 없음: ${localImagePath}`);
      continue;
    }
    
    const imageUrl = await uploadImage(localImagePath, remoteImagePath);
    if (imageUrl) {
      await saveHymnToFirestore('grace', hymn, imageUrl);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n✅ 테스트 업로드 완료!\n');
}

// 메인 실행
async function main() {
  try {
    await uploadTestHymns();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 업로드 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
