import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from './firebase';

// Gemini API 키 설정
// 환경 변수에서 가져오거나 직접 설정
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// 디버깅: 환경 변수 확인 (개발 환경에서만)
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
      limitCount = 1000, // 기본 최대 1000개
      orderByField = 'timestamp',
      orderDirection = 'desc'
    } = options;

    const wordLifeRef = collection(db, 'wordLife');
    let q = query(wordLifeRef, orderBy(orderByField, orderDirection));
    
    if (limitCount) {
      q = query(wordLifeRef, orderBy(orderByField, orderDirection), limit(limitCount));
    }

    const snapshot = await getDocs(q);
    const data = [];

    snapshot.forEach((doc) => {
      const docData = doc.data();
      data.push({
        id: doc.id,
        date: docData.date,
        district: docData.district,
        name: docData.name,
        bibleReading: docData.bibleReading || 0,
        sundayAttendance: docData.sundayAttendance || '',
        wednesdayAttendance: docData.wednesdayAttendance || '',
        timestamp: docData.timestamp?.toDate ? docData.timestamp.toDate().toISOString() : docData.timestamp
      });
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
      limitCount = 1000
    } = options;

    const wordLifeRef = collection(db, 'wordLife');
    // where만 사용하여 인덱스 오류 방지
    let q = query(
      wordLifeRef,
      where('name', '==', name)
    );
    
    if (limitCount) {
      q = query(
        wordLifeRef,
        where('name', '==', name),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    const data = [];

    snapshot.forEach((doc) => {
      const docData = doc.data();
      const timestamp = docData.timestamp?.toDate ? docData.timestamp.toDate() : new Date(docData.timestamp || 0);
      data.push({
        id: doc.id,
        date: docData.date,
        district: docData.district,
        name: docData.name,
        bibleReading: docData.bibleReading || 0,
        sundayAttendance: docData.sundayAttendance || '',
        wednesdayAttendance: docData.wednesdayAttendance || '',
        timestamp: timestamp.toISOString(),
        timestampValue: timestamp.getTime() // 정렬을 위한 숫자 값
      });
    });

    // 클라이언트에서 timestamp 기준으로 정렬 (최신순)
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

  // 구역별 집계
  const districtStats = {};
  const personalStats = {};
  // 날짜별 상세 데이터
  const dateWiseData = {};

  data.forEach((item) => {
    // 날짜별 데이터 그룹화
    const dateKey = item.date || '날짜미상';
    if (!dateWiseData[dateKey]) {
      dateWiseData[dateKey] = {
        date: dateKey,
        records: [],
        sundayAttendees: [],
        wednesdayAttendees: []
      };
    }
    dateWiseData[dateKey].records.push({
      name: item.name,
      district: item.district,
      bibleReading: item.bibleReading || 0,
      sundayAttendance: item.sundayAttendance || '',
      wednesdayAttendance: item.wednesdayAttendance || ''
    });
    if (item.sundayAttendance) {
      dateWiseData[dateKey].sundayAttendees.push(`${item.name} (${item.district}구역)`);
    }
    if (item.wednesdayAttendance) {
      dateWiseData[dateKey].wednesdayAttendees.push(`${item.name} (${item.district}구역)`);
    }

    // 구역별 통계
    const dist = item.district;
    if (!districtStats[dist]) {
      districtStats[dist] = {
        totalRecords: 0,
        totalBibleReading: 0,
        sundayCount: 0,
        wednesdayCount: 0,
        participants: new Set()
      };
    }
    districtStats[dist].totalRecords++;
    districtStats[dist].totalBibleReading += item.bibleReading;
    if (item.sundayAttendance) districtStats[dist].sundayCount++;
    if (item.wednesdayAttendance) districtStats[dist].wednesdayCount++;
    districtStats[dist].participants.add(item.name);

    // 개인별 통계
    const key = `${item.district}_${item.name}`;
    if (!personalStats[key]) {
      personalStats[key] = {
        district: item.district,
        name: item.name,
        totalBibleReading: 0,
        daysWithReading: 0,
        sundayCount: 0,
        wednesdayCount: 0
      };
    }
    personalStats[key].totalBibleReading += item.bibleReading;
    if (item.bibleReading > 0) personalStats[key].daysWithReading++;
    if (item.sundayAttendance) personalStats[key].sundayCount++;
    if (item.wednesdayAttendance) personalStats[key].wednesdayCount++;
  });

  // 텍스트 형태로 변환
  let text = `매탄교구 말씀생활 데이터 분석\n\n`;
  if (userName) {
    text += `조회자: ${userName}\n\n`;
  }
  text += `총 기록 수: ${data.length}개\n\n`;

  text += `[구역별 통계]\n`;
  Object.keys(districtStats).sort().forEach((dist) => {
    const stats = districtStats[dist];
    const participantsList = Array.from(stats.participants).sort().join(', ');
    text += `구역 ${dist}: `;
    text += `참여자 ${stats.participants.size}명 (${participantsList}), `;
    text += `성경읽기 총 ${stats.totalBibleReading}장, `;
    text += `주일말씀 ${stats.sundayCount}회, `;
    text += `수요말씀 ${stats.wednesdayCount}회\n`;
  });

  text += `\n[전체 참여자 목록]\n`;
  const allParticipants = Array.from(new Set(data.map(item => `${item.name} (${item.district}구역)`))).sort();
  allParticipants.forEach((participant, index) => {
    text += `${index + 1}. ${participant}\n`;
  });

  // 날짜 형식 변환 함수
  const formatDateForAI = (dateString) => {
    try {
      // YYYY-MM-DD 형식 파싱
      const [year, month, day] = dateString.split('-');
      if (year && month && day) {
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        return {
          original: dateString, // "2026-01-04"
          full: `${year}년 ${monthNum}월 ${dayNum}일`, // "2026년 1월 4일"
          simple: `${monthNum}월 ${dayNum}일`, // "1월 4일"
          numeric: `${monthNum}/${dayNum}` // "1/4"
        };
      }
    } catch (e) {
      // 파싱 실패 시 원본 반환
    }
    return {
      original: dateString,
      full: dateString,
      simple: dateString,
      numeric: dateString
    };
  };

  text += `\n[날짜별 상세 데이터]\n`;
  const sortedDates = Object.keys(dateWiseData).sort();
  sortedDates.forEach((dateKey) => {
    const dateInfo = dateWiseData[dateKey];
    const dateFormats = formatDateForAI(dateKey);
    text += `\n날짜: ${dateFormats.original} (${dateFormats.full}, ${dateFormats.simple}, ${dateFormats.numeric})\n`;
    text += `- 총 기록: ${dateInfo.records.length}건\n`;
    if (dateInfo.sundayAttendees.length > 0) {
      text += `- 주일말씀 참석자: ${dateInfo.sundayAttendees.join(', ')}\n`;
    }
    if (dateInfo.wednesdayAttendees.length > 0) {
      text += `- 수요말씀 참석자: ${dateInfo.wednesdayAttendees.join(', ')}\n`;
    }
    text += `- 해당 날짜 기록:\n`;
    dateInfo.records.forEach((record) => {
      text += `  * ${record.name} (${record.district}구역): `;
      text += `성경읽기 ${record.bibleReading}장`;
      if (record.sundayAttendance) text += `, 주일말씀 참석`;
      if (record.wednesdayAttendance) text += `, 수요말씀 참석`;
      text += `\n`;
    });
  });

  text += `\n[개인별 통계 (전체)]\n`;
  // 성경읽기 장수, 주일말씀 참석 횟수, 수요말씀 참석 횟수를 모두 고려한 정렬
  // 성경읽기가 0이어도 주일말씀/수요말씀 참석이 있으면 포함
  const personalArray = Object.values(personalStats)
    .filter(person => {
      // 성경읽기가 0이어도 주일말씀 또는 수요말씀 참석이 있으면 포함
      return person.totalBibleReading > 0 || person.sundayCount > 0 || person.wednesdayCount > 0;
    })
    .sort((a, b) => {
      // 1순위: 성경읽기 장수
      if (b.totalBibleReading !== a.totalBibleReading) {
        return b.totalBibleReading - a.totalBibleReading;
      }
      // 2순위: 주일말씀 참석 횟수
      if (b.sundayCount !== a.sundayCount) {
        return b.sundayCount - a.sundayCount;
      }
      // 3순위: 수요말씀 참석 횟수
      return b.wednesdayCount - a.wednesdayCount;
    });
  
  personalArray.forEach((person, index) => {
    text += `${index + 1}. ${person.name} (${person.district}구역): `;
    text += `성경읽기 ${person.totalBibleReading}장, `;
    text += `읽은 날 ${person.daysWithReading}일, `;
    text += `주일말씀 ${person.sundayCount}회, `;
    text += `수요말씀 ${person.wednesdayCount}회\n`;
  });
  
  text += `\n총 ${personalArray.length}명의 참여자가 있습니다.\n`;

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
데이터에 없는 정보는 추측하지 말고 "데이터에 해당 정보가 없습니다"라고 답변해주세요.`;

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




