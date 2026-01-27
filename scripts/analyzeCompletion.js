/**
 * 성경 완독 분석 스크립트
 * 
 * 사용법:
 * node scripts/analyzeCompletion.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIBLE_TOTAL_CHAPTERS = 1189;

// Firebase Admin 초기화
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json 파일이 없습니다.');
  console.error('Firebase Console > 프로젝트 설정 > 서비스 계정 > 비공개 키 생성');
  console.error('생성된 파일을 scripts/serviceAccountKey.json으로 저장하세요.');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function analyzeCompletion() {
  console.log('\n📖 성경 완독 분석 시작...\n');
  console.log(`성경 총 장 수: ${BIBLE_TOTAL_CHAPTERS}장\n`);
  console.log('='.repeat(60));

  try {
    // 모든 wordLife 데이터 가져오기
    const snapshot = await db.collection('wordLife').get();
    
    if (snapshot.empty) {
      console.log('❌ 데이터가 없습니다.');
      return;
    }

    console.log(`총 문서 수: ${snapshot.size}개\n`);

    // 날짜별 최신 데이터만 추출 (중복 제거)
    const dataMap = new Map();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.date}_${data.district}_${data.name}`;
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      
      if (!dataMap.has(key) || timestamp > dataMap.get(key).timestamp) {
        dataMap.set(key, { ...data, timestamp, docId: doc.id });
      }
    });

    console.log(`중복 제거 후 레코드 수: ${dataMap.size}개\n`);
    console.log('='.repeat(60));

    // 개인별 통계 집계
    const personalStats = {};
    
    dataMap.forEach((record) => {
      const key = `${record.district}구역_${record.name}`;
      
      if (!personalStats[key]) {
        personalStats[key] = {
          name: record.name,
          district: record.district,
          totalReading: 0,
          records: [],
          dates: []
        };
      }
      
      personalStats[key].totalReading += record.bibleReading || 0;
      personalStats[key].records.push({
        date: record.date,
        bibleReading: record.bibleReading || 0,
        docId: record.docId
      });
      personalStats[key].dates.push(record.date);
    });

    // 완독 계산 및 정렬
    const statsArray = Object.entries(personalStats)
      .map(([key, stat]) => ({
        key,
        ...stat,
        completedRounds: Math.floor(stat.totalReading / BIBLE_TOTAL_CHAPTERS),
        remainder: stat.totalReading % BIBLE_TOTAL_CHAPTERS,
        progressPercent: ((stat.totalReading % BIBLE_TOTAL_CHAPTERS) / BIBLE_TOTAL_CHAPTERS * 100).toFixed(1)
      }))
      .sort((a, b) => b.totalReading - a.totalReading);

    // 완독자 분석
    const completers = statsArray.filter(s => s.completedRounds >= 1);
    const nearCompleters = statsArray.filter(s => s.completedRounds === 0 && s.remainder >= 1000);
    
    console.log('\n🏆 완독자 목록 (1독 이상)\n');
    console.log('-'.repeat(60));
    
    if (completers.length === 0) {
      console.log('아직 완독자가 없습니다.');
    } else {
      completers.forEach((stat, idx) => {
        console.log(`${idx + 1}. ${stat.district}구역 ${stat.name}`);
        console.log(`   총 읽은 장: ${stat.totalReading}장`);
        console.log(`   완독 횟수: ${stat.completedRounds}독 ${'🥇'.repeat(stat.completedRounds)}`);
        console.log(`   현재 진행: ${stat.remainder}장 (${stat.progressPercent}%)`);
        console.log(`   기록 일수: ${stat.records.length}일`);
        console.log('');
      });
    }

    console.log('='.repeat(60));
    console.log('\n📊 완독 임박자 (1000장 이상, 아직 미완독)\n');
    console.log('-'.repeat(60));
    
    if (nearCompleters.length === 0) {
      console.log('1000장 이상 읽은 미완독자가 없습니다.');
    } else {
      nearCompleters.forEach((stat, idx) => {
        const remaining = BIBLE_TOTAL_CHAPTERS - stat.remainder;
        console.log(`${idx + 1}. ${stat.district}구역 ${stat.name}`);
        console.log(`   총 읽은 장: ${stat.totalReading}장`);
        console.log(`   진행률: ${stat.progressPercent}%`);
        console.log(`   남은 장: ${remaining}장`);
        console.log('');
      });
    }

    console.log('='.repeat(60));
    console.log('\n📈 전체 통계\n');
    console.log('-'.repeat(60));
    
    const totalParticipants = statsArray.filter(s => s.totalReading > 0).length;
    const totalReading = statsArray.reduce((sum, s) => sum + s.totalReading, 0);
    
    console.log(`참여자 수: ${totalParticipants}명`);
    console.log(`완독자 수: ${completers.length}명`);
    console.log(`전체 읽은 장 수: ${totalReading}장`);
    console.log(`평균 읽은 장 수: ${totalParticipants > 0 ? Math.round(totalReading / totalParticipants) : 0}장`);

    console.log('\n='.repeat(60));
    console.log('\n📋 상위 10명 상세 정보\n');
    console.log('-'.repeat(60));

    statsArray.slice(0, 10).forEach((stat, idx) => {
      console.log(`\n${idx + 1}. ${stat.district}구역 ${stat.name}`);
      console.log(`   총 읽은 장: ${stat.totalReading}장`);
      console.log(`   완독: ${stat.completedRounds}독 / 현재 진행: ${stat.remainder}장`);
      console.log(`   기록 일수: ${stat.records.length}일`);
      
      // 최근 5개 기록 표시
      const recentRecords = stat.records
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      
      console.log('   최근 기록:');
      recentRecords.forEach(r => {
        console.log(`     - ${r.date}: ${r.bibleReading}장`);
      });
    });

    // 완독 알림 로직 검증
    console.log('\n='.repeat(60));
    console.log('\n🔍 완독 알림 로직 검증\n');
    console.log('-'.repeat(60));

    completers.forEach(stat => {
      console.log(`\n[${stat.district}구역 ${stat.name}]`);
      
      // 날짜순 정렬
      const sortedRecords = stat.records.sort((a, b) => a.date.localeCompare(b.date));
      
      let cumulative = 0;
      let prevRounds = 0;
      
      sortedRecords.forEach(record => {
        cumulative += record.bibleReading;
        const currentRounds = Math.floor(cumulative / BIBLE_TOTAL_CHAPTERS);
        
        if (currentRounds > prevRounds) {
          console.log(`  ✅ ${record.date}: ${record.bibleReading}장 입력 → 누적 ${cumulative}장 → ${currentRounds}독 완료!`);
          console.log(`     (이전: ${prevRounds}독 → 현재: ${currentRounds}독, 알림 발생 조건 충족)`);
        }
        
        prevRounds = currentRounds;
      });
      
      console.log(`  최종: ${cumulative}장, ${prevRounds}독`);
    });

    console.log('\n\n✅ 분석 완료!\n');

  } catch (error) {
    console.error('❌ 분석 중 오류:', error);
  }

  process.exit(0);
}

analyzeCompletion();
