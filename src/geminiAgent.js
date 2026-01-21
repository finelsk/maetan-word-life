import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from './firebase';

// Gemini API 키 설정
// 환경 변수에서 가져오거나 직접 설정
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Gemini AI 초기화
let genAI = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  } catch (error) {
    console.error('Gemini AI initialization error:', error);
  }
} else {
  console.warn('Gemini API Key is not set. Please set VITE_GEMINI_API_KEY in .env file');
}

/**
 * Firestore에서 말씀생활 데이터를 조회하여 분석 가능한 형태로 변환
 */
export const fetchWordLifeData = async (options = {}) => {
  try {
    const {
      limitCount = null,
      orderByField = 'timestamp',
      orderDirection = 'desc'
    } = options;

    const wordLifeRef = collection(db, 'wordLife');
    let q = query(wordLifeRef);

    if (limitCount !== null) {
      q = query(wordLifeRef, limit(limitCount));
    }

    const snapshot = await getDocs(q);
    const data = [];

    snapshot.forEach((doc) => {
      const docData = doc.data();
      // 이름 정규화 (공백 제거)
      const normalizedName = (docData.name || '').trim();
      const timestamp = docData.timestamp?.toDate ? docData.timestamp.toDate() : new Date(docData.timestamp || 0);
      data.push({
        id: doc.id,
        date: docData.date,
        district: docData.district,
        name: normalizedName, // 정규화된 이름 사용
        bibleReading: docData.bibleReading || 0,
        sundayAttendance: docData.sundayAttendance || '',
        wednesdayAttendance: docData.wednesdayAttendance || '',
        timestamp: timestamp.toISOString(),
        timestampValue: timestamp.getTime() // 정렬을 위한 숫자 값
      });
    });

    // 클라이언트에서 timestamp 기준으로 정렬 (최신순)
    data.sort((a, b) => {
      const timestampA = a.timestampValue || 0;
      const timestampB = b.timestampValue || 0;
      return timestampB - timestampA;
    });

    return data;
  } catch (error) {
    console.error('Firestore 데이터 조회 오류:', error);
    throw error;
  }
};

/**
 * Firestore에서 모든 이름 목록 조회
 */
export const fetchAllNames = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'wordLife'));
    const namesSet = new Set();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.name) {
        namesSet.add(data.name);
      }
    });
    
    return Array.from(namesSet).sort();
  } catch (error) {
    console.error('이름 목록 조회 오류:', error);
    throw error;
  }
};

/**
 * 특정 이름으로 데이터 조회
 */
export const fetchDataByName = async (name, options = {}) => {
  try {
    const {
      limitCount = null
    } = options;

    const wordLifeRef = collection(db, 'wordLife');
    let q = query(
      wordLifeRef,
      where('name', '==', name.trim())
    );

    if (limitCount !== null) {
      q = query(
        wordLifeRef,
        where('name', '==', name.trim()),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    const data = [];

    snapshot.forEach((doc) => {
      const docData = doc.data();
      const timestamp = docData.timestamp?.toDate ? docData.timestamp.toDate() : new Date(docData.timestamp || 0);
      // 이름 정규화 (공백 제거)
      const normalizedName = (docData.name || '').trim();
      data.push({
        id: doc.id,
        date: docData.date,
        district: docData.district,
        name: normalizedName, // 정규화된 이름 사용
        bibleReading: docData.bibleReading || 0,
        sundayAttendance: docData.sundayAttendance || '',
        wednesdayAttendance: docData.wednesdayAttendance || '',
        timestamp: timestamp.toISOString(),
        timestampValue: timestamp.getTime() // 정렬을 위한 숫자 값
      });
    });

    data.sort((a, b) => (b.timestampValue || 0) - (a.timestampValue || 0));

    return data;
  } catch (error) {
    console.error('이름별 데이터 조회 오류:', error);
    throw error;
  }
};

/**
 * 데이터를 분석하기 쉬운 텍스트 형태로 변환
 */
const formatDataForAnalysis = (data, userName = null) => {
  if (!data || data.length === 0) {
    return '데이터가 없습니다.';
  }

  // 1. 데이터 정규화 및 중복 제거/병합
  const dataMap = new Map();
  data.forEach((item) => {
    const name = (item.name || '').trim();
    if (!name) return;

    // 날짜 정규화 (YYYY-MM-DD 형식으로 통일)
    let date = item.date || '날짜미상';
    if (date !== '날짜미상' && date.includes('-')) {
      const parts = date.split('-');
      if (parts.length === 3) {
        date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }

    // 구역 정규화 (문자열로 통일)
    const dist = String(item.district || '');
    const key = `${date}_${dist}_${name}`;
    
    const timestampValue = item.timestampValue || (item.timestamp ? new Date(item.timestamp).getTime() : 0);
    
    if (!dataMap.has(key)) {
      dataMap.set(key, { ...item, name, date, district: dist, timestampValue });
    } else {
      const existing = dataMap.get(key);
      const existingTimestampValue = existing.timestampValue || 0;
      
      // 더 최신 데이터로 병합 (최신순을 따르되, 정보가 있는 필드를 우선함)
      if (timestampValue >= existingTimestampValue) {
        dataMap.set(key, {
          ...item,
          name,
          date,
          district: dist,
          timestampValue,
          // 새 데이터가 비어있으면 기존 데이터의 정보를 유지 (누락 방지)
          bibleReading: item.bibleReading || existing.bibleReading || 0,
          sundayAttendance: item.sundayAttendance || existing.sundayAttendance || '',
          wednesdayAttendance: item.wednesdayAttendance || existing.wednesdayAttendance || ''
        });
      } else {
        // 기존 데이터가 더 최신인 경우에도 새 데이터의 정보를 채워넣음
        dataMap.set(key, {
          ...existing,
          bibleReading: existing.bibleReading || item.bibleReading || 0,
          sundayAttendance: existing.sundayAttendance || item.sundayAttendance || '',
          wednesdayAttendance: existing.wednesdayAttendance || item.wednesdayAttendance || ''
        });
      }
    }
  });

  // 중복 제거 및 병합된 데이터 배열
  const finalData = Array.from(dataMap.values());

  // 구역별 집계
  const districtStats = {};
  const personalStats = {};
  // 날짜별 상세 데이터
  const dateWiseData = {};

  finalData.forEach((item) => {
    // 날짜별 데이터 그룹화
    const dateKey = item.date;
    if (!dateWiseData[dateKey]) {
      dateWiseData[dateKey] = {
        date: dateKey,
        records: [],
        sundayAttendees: {
          onSite: [],
          online: []
        },
        wednesdayAttendees: {
          onSite: [],
          online: []
        }
      };
    }
    dateWiseData[dateKey].records.push({
      name: item.name,
      district: item.district,
      bibleReading: item.bibleReading || 0,
      sundayAttendance: item.sundayAttendance || '',
      wednesdayAttendance: item.wednesdayAttendance || ''
    });
    
    // 주일말씀 참석자 구분 (현장/온라인)
    const attendeeLabel = `${item.name} (${item.district}구역)`;
    if (item.sundayAttendance === '현장참석') {
      if (!dateWiseData[dateKey].sundayAttendees.onSite.includes(attendeeLabel)) {
        dateWiseData[dateKey].sundayAttendees.onSite.push(attendeeLabel);
      }
    } else if (item.sundayAttendance === '온라인') {
      if (!dateWiseData[dateKey].sundayAttendees.online.includes(attendeeLabel)) {
        dateWiseData[dateKey].sundayAttendees.online.push(attendeeLabel);
      }
    }
    
    // 수요말씀 참석자 구분 (현장/온라인)
    if (item.wednesdayAttendance === '현장참석') {
      if (!dateWiseData[dateKey].wednesdayAttendees.onSite.includes(attendeeLabel)) {
        dateWiseData[dateKey].wednesdayAttendees.onSite.push(attendeeLabel);
      }
    } else if (item.wednesdayAttendance === '온라인') {
      if (!dateWiseData[dateKey].wednesdayAttendees.online.includes(attendeeLabel)) {
        dateWiseData[dateKey].wednesdayAttendees.online.push(attendeeLabel);
      }
    }

    // 구역별 통계
    const dist = item.district;
    if (!districtStats[dist]) {
      districtStats[dist] = {
        totalRecords: 0,
        totalBibleReading: 0,
        sundayCount: {
          onSite: 0,
          online: 0,
          total: 0
        },
        wednesdayCount: {
          onSite: 0,
          online: 0,
          total: 0
        },
        participants: new Set()
      };
    }
    districtStats[dist].totalRecords++;
    districtStats[dist].totalBibleReading += item.bibleReading;
    
    // 주일말씀 참석 통계
    if (item.sundayAttendance === '현장참석') {
      districtStats[dist].sundayCount.onSite++;
      districtStats[dist].sundayCount.total++;
    } else if (item.sundayAttendance === '온라인') {
      districtStats[dist].sundayCount.online++;
      districtStats[dist].sundayCount.total++;
    }
    
    // 수요말씀 참석 통계
    if (item.wednesdayAttendance === '현장참석') {
      districtStats[dist].wednesdayCount.onSite++;
      districtStats[dist].wednesdayCount.total++;
    } else if (item.wednesdayAttendance === '온라인') {
      districtStats[dist].wednesdayCount.online++;
      districtStats[dist].wednesdayCount.total++;
    }
    
    districtStats[dist].participants.add(item.name);

    // 개인별 통계
    const personalKey = `${item.district}_${item.name}`;
    if (!personalStats[personalKey]) {
      personalStats[personalKey] = {
        district: item.district,
        name: item.name,
        totalBibleReading: 0,
        daysWithReading: 0,
        sundayCount: {
          onSite: 0,
          online: 0,
          total: 0
        },
        wednesdayCount: {
          onSite: 0,
          online: 0,
          total: 0
        }
      };
    }
    personalStats[personalKey].totalBibleReading += item.bibleReading;
    if (item.bibleReading > 0) personalStats[personalKey].daysWithReading++;
    
    if (item.sundayAttendance === '현장참석') {
      personalStats[personalKey].sundayCount.onSite++;
      personalStats[personalKey].sundayCount.total++;
    } else if (item.sundayAttendance === '온라인') {
      personalStats[personalKey].sundayCount.online++;
      personalStats[personalKey].sundayCount.total++;
    }
    
    if (item.wednesdayAttendance === '현장참석') {
      personalStats[personalKey].wednesdayCount.onSite++;
      personalStats[personalKey].wednesdayCount.total++;
    } else if (item.wednesdayAttendance === '온라인') {
      personalStats[personalKey].wednesdayCount.online++;
      personalStats[personalKey].wednesdayCount.total++;
    }
  });

  // 텍스트 형태로 변환
  let text = `매탄교구 말씀생활 데이터 분석\n\n`;
  if (userName) {
    text += `조회자: ${userName}\n\n`;
  }
  text += `총 유니크 기록 수: ${finalData.length}개\n\n`;

  text += `[구역별 통계]\n`;
  Object.keys(districtStats).sort().forEach((dist) => {
    const stats = districtStats[dist];
    const participantsList = Array.from(stats.participants).sort().join(', ');
    text += `구역 ${dist}: `;
    text += `참여자 ${stats.participants.size}명 (${participantsList}), `;
    text += `성경읽기 총 ${stats.totalBibleReading}장, `;
    text += `주일말씀 총 ${stats.sundayCount.total}회 (현장 ${stats.sundayCount.onSite}회, 온라인 ${stats.sundayCount.online}회), `;
    text += `수요말씀 총 ${stats.wednesdayCount.total}회 (현장 ${stats.wednesdayCount.onSite}회, 온라인 ${stats.wednesdayCount.online}회)\n`;
  });

  text += `\n[전체 참여자 목록]\n`;
  const allParticipants = Array.from(new Set(finalData.map(item => `${item.name} (${item.district}구역)`))).sort();
  allParticipants.forEach((participant, index) => {
    text += `${index + 1}. ${participant}\n`;
  });

  // 전체 성경읽기 참여인원 구역별 집계 (날짜별이 아닌 전체 데이터 기준, 구역별 누적 장수 포함)
  text += `\n[전체 성경읽기 참여인원 구역별 현황]\n`;
  const bibleReadingParticipants = new Set();
  const districtBibleReaders = {};
  
  finalData.forEach(item => {
    if (item.bibleReading > 0) {
      const name = (item.name || '').trim();
      const dist = String(item.district || '');
      
      if (!districtBibleReaders[dist]) {
        districtBibleReaders[dist] = new Set();
      }
      
      bibleReadingParticipants.add(`${name}_${dist}`);
      districtBibleReaders[dist].add(name);
    }
  });
  
  // 전체 누적 장수 계산
  const totalBibleReadingPages = finalData.reduce((sum, item) => sum + (item.bibleReading || 0), 0);
  
  text += `전체: ${bibleReadingParticipants.size}명\n`;
  Object.keys(districtBibleReaders).sort().forEach(dist => {
    // 구역별 누적 장수는 districtStats에서 가져옴
    const districtTotalPages = districtStats[dist] ? districtStats[dist].totalBibleReading : 0;
    text += `${dist}구역: ${districtBibleReaders[dist].size}명 (${districtTotalPages}장)\n`;
  });

  // 전체 수요말씀 누적 참석현황 구역별 집계 (전체 데이터 기준)
  text += `\n[전체 수요말씀 누적 참석현황 구역별 현황]\n`;
  Object.keys(districtStats).sort().forEach(dist => {
    const stats = districtStats[dist];
    if (stats.wednesdayCount.total > 0) {
      text += `${dist}구역: ${stats.wednesdayCount.total}명 (현장 ${stats.wednesdayCount.onSite}명/온라인 ${stats.wednesdayCount.online}명)\n`;
    }
  });

  // 날짜 형식 변환 함수
  const formatDateForAI = (dateString) => {
    try {
      const [year, month, day] = dateString.split('-');
      if (year && month && day) {
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        return {
          original: dateString,
          full: `${year}년 ${monthNum}월 ${dayNum}일`,
          simple: `${monthNum}월 ${dayNum}일`,
          numeric: `${monthNum}/${dayNum}`
        };
      }
    } catch (e) {}
    return { original: dateString, full: dateString, simple: dateString, numeric: dateString };
  };

  text += `\n[날짜별 상세 데이터]\n`;
  const sortedDates = Object.keys(dateWiseData).sort().reverse(); // 최신 날짜부터
  sortedDates.forEach((dateKey) => {
    const dateInfo = dateWiseData[dateKey];
    const dateFormats = formatDateForAI(dateKey);
    text += `\n날짜: ${dateFormats.original} (${dateFormats.full})\n`;
    
    // 구역별로 데이터를 재그룹화하여 AI에게 제공
    const districtGroups = {};
    dateInfo.records.forEach(record => {
      const d = record.district;
      if (!districtGroups[d]) {
        districtGroups[d] = {
          sunday: { onSite: [], online: [] },
          wednesday: { onSite: [], online: [] },
          reading: []
        };
      }
      
      if (record.sundayAttendance === '현장참석') districtGroups[d].sunday.onSite.push(record.name);
      else if (record.sundayAttendance === '온라인') districtGroups[d].sunday.online.push(record.name);
      
      if (record.wednesdayAttendance === '현장참석') districtGroups[d].wednesday.onSite.push(record.name);
      else if (record.wednesdayAttendance === '온라인') districtGroups[d].wednesday.online.push(record.name);
      
      if (record.bibleReading > 0) districtGroups[d].reading.push(`${record.name}(${record.bibleReading}장)`);
    });

    // 날짜별 요약 정보 (AI가 쉽게 파싱할 수 있도록)
    let totalWednesdayOnSite = 0;
    let totalWednesdayOnline = 0;
    let totalBibleReaders = new Set();
    const districtSummary = {};
    
    Object.keys(districtGroups).sort().forEach(d => {
      const group = districtGroups[d];
      const wOn = group.wednesday.onSite.length;
      const wOff = group.wednesday.online.length;
      const wTotal = wOn + wOff;
      
      totalWednesdayOnSite += wOn;
      totalWednesdayOnline += wOff;
      
      districtSummary[d] = {
        wednesday: { total: wTotal, onSite: wOn, online: wOff },
        bibleReaders: new Set()
      };
      
      // 성경읽기 참여자 수집
      group.reading.forEach(r => {
        const nameMatch = r.match(/^([^(]+)/);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          totalBibleReaders.add(name);
          districtSummary[d].bibleReaders.add(name);
        }
      });
    });
    
    const totalWednesday = totalWednesdayOnSite + totalWednesdayOnline;
    
    // 날짜별 요약 섹션 추가 (구역별 현장/온라인 참석자 이름 목록 포함)
    if (totalWednesday > 0) {
      text += `\n[${dateFormats.full} 수요말씀 참석현황 요약]\n`;
      text += `전체: ${totalWednesday}명 (현장 ${totalWednesdayOnSite}명/온라인 ${totalWednesdayOnline}명)\n`;
      Object.keys(districtGroups).sort().forEach(d => {
        const group = districtGroups[d];
        const wOn = group.wednesday.onSite.sort();
        const wOff = group.wednesday.online.sort();
        const wTotal = wOn.length + wOff.length;
        
        if (wTotal > 0) {
          text += `${d}구역: ${wTotal}명 (현장 ${wOn.length}명/온라인 ${wOff.length}명)\n`;
          if (wOn.length > 0) {
            text += `  - 현장: ${wOn.join(', ')}\n`;
          }
          if (wOff.length > 0) {
            text += `  - 온라인: ${wOff.join(', ')}\n`;
          }
        }
      });
    }
    
    // 구역별로 상세히 출력
    Object.keys(districtGroups).sort().forEach(d => {
      const group = districtGroups[d];
      text += `\n[${d}구역 상세]\n`;
      
      // 수요말씀 집계
      const wOn = group.wednesday.onSite.sort();
      const wOff = group.wednesday.online.sort();
      const wTotal = wOn.length + wOff.length;
      if (wTotal > 0) {
        text += `- 수요말씀: 총 ${wTotal}명 (현장 ${wOn.length}명: ${wOn.join(', ')} / 온라인 ${wOff.length}명: ${wOff.join(', ')})\n`;
      }
      
      // 주일말씀 집계
      const sOn = group.sunday.onSite.sort();
      const sOff = group.sunday.online.sort();
      const sTotal = sOn.length + sOff.length;
      if (sTotal > 0) {
        text += `- 주일말씀: 총 ${sTotal}명 (현장 ${sOn.length}명: ${sOn.join(', ')} / 온라인 ${sOff.length}명: ${sOff.sort().join(', ')})\n`;
      }

      if (group.reading.length > 0) {
        text += `- 성경읽기: ${group.reading.join(', ')}\n`;
      }
    });
  });

  text += `\n[개인별 누적 통계]\n`;
  const personalArray = Object.values(personalStats)
    .filter(p => p.totalBibleReading > 0 || p.sundayCount.total > 0 || p.wednesdayCount.total > 0)
    .sort((a, b) => b.totalBibleReading - a.totalBibleReading);
  
  personalArray.forEach((p, index) => {
    text += `${index + 1}. ${p.name} (${p.district}구역): 성경읽기 ${p.totalBibleReading}장, 주일 ${p.sundayCount.total}회, 수요 ${p.wednesdayCount.total}회\n`;
  });

  return text;
};

/**
 * Gemini Agent를 사용하여 데이터 조회 및 질문 답변
 */
export const queryGeminiAgent = async (userQuestion, userName = null, options = {}) => {
  // API 키 재확인 (런타임에서 다시 읽기)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  
  // genAI가 초기화되지 않았지만 API 키가 있으면 재초기화
  if (!genAI && apiKey) {
    try {
      genAI = new GoogleGenerativeAI(apiKey);
    } catch (error) {
      console.error('Gemini API 초기화 실패:', error);
      throw new Error('Gemini API 초기화 실패: ' + error.message);
    }
  }
  
  if (!genAI) {
    const errorMsg = 'Gemini API 키가 설정되지 않았습니다.\n\n' +
      '확인 사항:\n' +
      '1. .env 파일이 프로젝트 루트에 있는지 확인\n' +
      '2. .env 파일에 VITE_GEMINI_API_KEY=your_api_key 형식으로 설정되어 있는지 확인\n' +
      '3. 개발 서버를 재시작했는지 확인\n' +
      '4. 브라우저 콘솔에서 환경 변수 로딩 상태 확인';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    // 1. Firestore에서 데이터 조회
    let data;
    if (userName) {
      // 특정 이름의 데이터만 조회
      data = await fetchDataByName(userName, options);
    } else {
      // 전체 데이터 조회
      data = await fetchWordLifeData(options);
    }
    
    // 2. 데이터를 분석 가능한 형태로 변환
    const dataText = formatDataForAnalysis(data, userName);

    // 3. Gemini 모델 초기화
    // 최신 모델 이름 형식 시도 (2025년 기준)
    const modelNames = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-2.0-flash-exp'
    ];
    let model = null;
    
    // 첫 번째 모델로 시도
    model = genAI.getGenerativeModel({ model: modelNames[0] });

    // 4. 프롬프트 구성
    const prompt = `당신은 매탄교구 말씀생활 데이터를 분석하는 AI 어시스턴트입니다.

다음은 매탄교구 말씀생활 데이터입니다:

${dataText}

사용자 질문: ${userQuestion}

위 데이터를 바탕으로 사용자의 질문에 친절하고 정확하게 답변해주세요. 
한국어로 답변하고, 구체적인 숫자와 통계를 포함하여 답변해주세요.
수요말씀 참석 정보는 현장참석과 온라인 참석을 구분하여 답변해주세요.
데이터에 없는 정보는 추측하지 말고 "데이터에 해당 정보가 없습니다"라고 답변해주세요.

**중요: 답변 형식 지침**

1) 날짜별 수요말씀 참석현황을 구역별로 정리할 때는 반드시 아래 형식을 사용하세요:

수요말씀 구역별 참석현황
> 전체 : 00명 (현장 00명/온라인 00명)
> 41구역 : 00명 (현장 00명/온라인 00명)
  - 현장 : 이름1, 이름2, 이름3,....
  - 온라인 : 이름1, 이름2, 이름3....
> 42구역 : 00명 (현장 00명/온라인 00명)
  - 현장 : 이름1, 이름2, 이름3,....
  - 온라인 : 이름1, 이름2, 이름3....
> 43구역 : 00명 (현장 00명/온라인 00명)
  - 현장 : 이름1, 이름2, 이름3,....
  - 온라인 : 이름1, 이름2, 이름3....

2) 성경읽기 참여인원을 구역별로 정리할 때는 날짜별이 아니라 전체 데이터를 기준으로 구역별로 집계하여 반드시 아래 형식을 사용하세요 (장수는 구역별 누적장수):

성경읽기 현황
> 전체 : 00명
> 41구역 : 00명 (00000장)
> 42구역 : 00명 (00000장)
> 43구역 : 00명 (00000장)

3) 수요말씀 누적 참석현황을 구역별로 정리할 때는 조회한 날짜까지 누적된 숫자를 구역별로 반드시 아래 형식을 사용하세요:

수요말씀 구역별 누적 참석현황
> 41구역 : 00명 (현장 00명/온라인 00명)
> 42구역 : 00명 (현장 00명/온라인 00명)
> 43구역 : 00명 (현장 00명/온라인 00명)

위 형식을 정확히 따르되, 실제 데이터의 숫자와 이름을 사용하여 답변해주세요.`;

    // 5. Gemini에 질문 전송
    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (modelError) {
      // 첫 번째 모델 실패 시 다른 모델 시도
      if (modelError.message && modelError.message.includes('not found')) {
        for (let i = 1; i < modelNames.length; i++) {
          try {
            model = genAI.getGenerativeModel({ model: modelNames[i] });
            result = await model.generateContent(prompt);
            break; // 성공하면 루프 종료
          } catch (retryError) {
            if (i === modelNames.length - 1) {
              // 모든 모델 실패
              throw new Error(`사용 가능한 Gemini 모델을 찾을 수 없습니다. API 키와 모델 접근 권한을 확인해주세요. 오류: ${retryError.message}`);
            }
            continue;
          }
        }
      } else {
        throw modelError;
      }
    }
    
    const response = await result.response;
    const text = response.text();

    return {
      success: true,
      answer: text,
      dataCount: data.length
    };
  } catch (error) {
    console.error('Gemini Agent 오류:', error);
    throw error;
  }
};