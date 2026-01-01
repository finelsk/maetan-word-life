import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, setDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

function App() {
  const [selectedDate, setSelectedDate] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState('');
  const [district, setDistrict] = useState('');
  const [name, setName] = useState('');
  const [bibleReading, setBibleReading] = useState('');
  const [sundayAttendance, setSundayAttendance] = useState('');
  const [wednesdayAttendance, setWednesdayAttendance] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [rankings, setRankings] = useState(null);

  // 날짜 포맷팅 함수
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return { formatted: `${year}년 ${month}월 ${day}일`, dayOfWeek };
  };

  // 날짜 변경 시 데이터 불러오기
  const loadDateData = async (dateString) => {
    if (!district || !name || !dateString) return;
    
    try {
      const existingQuery = query(
        collection(db, 'wordLife'),
        where('date', '==', dateString),
        where('district', '==', parseInt(district)),
        where('name', '==', name)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // 최신 데이터 찾기
        let latestData = null;
        let latestTimestamp = null;
        
        existingSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          if (!latestTimestamp || timestamp > latestTimestamp) {
            latestTimestamp = timestamp;
            latestData = data;
          }
        });
        
        if (latestData) {
          // 입력 필드에 데이터 표시
          setBibleReading(latestData.bibleReading ? String(latestData.bibleReading) : '');
          setSundayAttendance(latestData.sundayAttendance || '');
          setWednesdayAttendance(latestData.wednesdayAttendance || '');
        }
      } else {
        // 데이터가 없으면 초기화
        setBibleReading('');
        setSundayAttendance('');
        setWednesdayAttendance('');
      }
    } catch (error) {
      console.error('데이터 불러오기 오류:', error);
    }
  };

  // 날짜 변경 핸들러
  const handleDateChange = async (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    
    const { formatted, dayOfWeek } = formatDate(newDate);
    setCurrentDate(formatted);
    setCurrentDayOfWeek(dayOfWeek);
    
    // 날짜 변경 시 해당 날짜의 데이터 불러오기
    if (district && name) {
      await loadDateData(newDate);
    }
  };

  // 초기 날짜 설정
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    setSelectedDate(dateString);
    const { formatted, dayOfWeek } = formatDate(dateString);
    setCurrentDate(formatted);
    setCurrentDayOfWeek(dayOfWeek);
    
    // localStorage에서 이전 입력값 불러오기
    const savedDistrict = localStorage.getItem('savedDistrict');
    const savedName = localStorage.getItem('savedName');
    if (savedDistrict) setDistrict(savedDistrict);
    if (savedName) setName(savedName);
  }, []);

  // 구역이나 이름이 변경되면 해당 날짜의 데이터 불러오기
  useEffect(() => {
    if (selectedDate && district && name) {
      loadDateData(selectedDate);
    } else {
      // 구역이나 이름이 없으면 입력 필드 초기화
      setBibleReading('');
      setSundayAttendance('');
      setWednesdayAttendance('');
    }
  }, [district, name, selectedDate]);

  // 주일인지 확인 (일요일 = 0)
  const isSunday = () => {
    if (!selectedDate) return false;
    const date = new Date(selectedDate);
    return date.getDay() === 0;
  };

  // 수요일인지 확인 (수요일 = 3)
  const isWednesday = () => {
    if (!selectedDate) return false;
    const date = new Date(selectedDate);
    return date.getDay() === 3;
  };

  // 저장 버튼 클릭
  const handleSave = () => {
    if (!district || !name) {
      alert('구역과 이름을 입력해주세요.');
      return;
    }
    setShowConfirmModal(true);
  };

  // 확인 모달에서 확인 클릭
  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    
    const dateString = selectedDate;
    
    const newData = {
      date: dateString,
      district: parseInt(district),
      name: name,
      bibleReading: bibleReading ? parseInt(bibleReading) : 0,
      sundayAttendance: sundayAttendance || '',
      wednesdayAttendance: wednesdayAttendance || '',
      timestamp: new Date()
    };

    try {
      // localStorage에 저장
      localStorage.setItem('savedDistrict', district);
      localStorage.setItem('savedName', name);

      // 동일한 날짜/구역/이름의 기존 문서 찾기
      const existingQuery = query(
        collection(db, 'wordLife'),
        where('date', '==', dateString),
        where('district', '==', parseInt(district)),
        where('name', '==', name)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      let hasChanges = false;
      let existingDocId = null;
      let existingData = null;

      if (!existingSnapshot.empty) {
        existingDocId = existingSnapshot.docs[0].id;
        existingData = existingSnapshot.docs[0].data();
        
        // 변경 내용 확인
        if (
          existingData.bibleReading !== newData.bibleReading ||
          existingData.sundayAttendance !== newData.sundayAttendance ||
          existingData.wednesdayAttendance !== newData.wednesdayAttendance
        ) {
          hasChanges = true;
        }
      } else {
        // 새 문서인 경우 변경 있음
        hasChanges = newData.bibleReading > 0 || newData.sundayAttendance || newData.wednesdayAttendance;
      }

      if (!hasChanges) {
        // 변경 내용이 없음
        alert('변경내용이 없습니다.');
        await calculateRankings();
        setShowRanking(true);
        return;
      }

      // 문서 ID 생성 (날짜-구역-이름 조합)
      const docId = `${dateString}_${district}_${name}`;
      
      // 기존 문서가 있으면 업데이트, 없으면 새로 생성
      await setDoc(doc(db, 'wordLife', docId), newData);
      
      // 순위 계산 및 표시
      try {
        await calculateRankings();
        setShowRanking(true);
        alert('데이터가 성공적으로 저장되었습니다!');
      } catch (rankingError) {
        console.error('순위 계산 오류:', rankingError);
        alert('데이터는 저장되었지만 순위 계산 중 오류가 발생했습니다.');
      }
      
      // 폼 초기화
      setBibleReading('');
      setSundayAttendance('');
      setWednesdayAttendance('');
    } catch (error) {
      console.error('저장 중 오류 발생:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      console.error('전체 오류:', error);
      
      let errorMessage = `저장 중 오류가 발생했습니다.\n\n`;
      errorMessage += `오류 코드: ${error.code || '알 수 없음'}\n`;
      errorMessage += `오류 메시지: ${error.message}\n\n`;
      
      if (error.code === 'permission-denied') {
        errorMessage += 'Firestore 보안 규칙을 확인해주세요.';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Firestore Database가 생성되지 않았거나 연결할 수 없습니다.';
      } else {
        errorMessage += 'Firebase 설정과 Firestore Database가 올바르게 설정되었는지 확인해주세요.';
      }
      
      alert(errorMessage);
    }
  };

  // 순위 계산
  const calculateRankings = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'wordLife'));
      // 동일한 날짜/구역/이름의 경우 최신 데이터만 사용 (중복 제거)
      const dataMap = new Map();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.date}_${data.district}_${data.name}`;
        if (!dataMap.has(key) || data.timestamp > dataMap.get(key).timestamp) {
          dataMap.set(key, data);
        }
      });
      const allData = Array.from(dataMap.values());

      // 구역별 수요말씀 참석 집계 (인원 수 합계)
      // 수요일에 참석한 인원을 구역별로 합산
      const districtStats = {};
      
      allData.forEach(record => {
        if (record.wednesdayAttendance) {
          const dist = record.district;
          if (!districtStats[dist]) {
            districtStats[dist] = { total: 0, online: 0 };
          }
          
          // (온라인 + 현장참석) 인원 수 합산
          if (record.wednesdayAttendance === '현장참석' || record.wednesdayAttendance === '온라인') {
            districtStats[dist].total++;
          }
          
          // 온라인만 인원 수 합산
          if (record.wednesdayAttendance === '온라인') {
            districtStats[dist].online++;
          }
        }
      });
      
      // 현장참석 집계 = (현장+온라인) - 온라인
      Object.keys(districtStats).forEach(dist => {
        districtStats[dist].onSite = districtStats[dist].total - districtStats[dist].online;
      });

      // 구역 순위 계산 (동일 점수일 때 같은 순위 부여)
      const assignDistrictRanks = (sortedArray, valueField) => {
        if (sortedArray.length === 0) return [];
        
        const ranked = [];
        let currentRank = 1;
        let previousValue = null;
        
        for (let i = 0; i < sortedArray.length; i++) {
          const item = sortedArray[i];
          const currentValue = item[valueField];
          
          // 이전 값과 다르면 순위 증가
          if (previousValue !== null && currentValue !== previousValue) {
            currentRank = i + 1;
          }
          
          ranked.push({
            ...item,
            rank: currentRank
          });
          
          previousValue = currentValue;
        }
        
        return ranked;
      };

      const districtRankingTotal = assignDistrictRanks(
        Object.entries(districtStats)
          .map(([dist, stats]) => ({
            district: parseInt(dist),
            total: stats.total,
            onSite: stats.onSite
          }))
          .sort((a, b) => b.total - a.total),
        'total'
      );

      const districtRankingOnSite = assignDistrictRanks(
        Object.entries(districtStats)
          .map(([dist, stats]) => ({
            district: parseInt(dist),
            total: stats.total,
            onSite: stats.onSite
          }))
          .sort((a, b) => b.onSite - a.onSite),
        'onSite'
      );

      // 개인별 집계 (동일한 날짜의 경우 최신 데이터만 사용)
      const personalStats = {};
      const dateMap = new Map(); // 날짜별 최신 데이터 추적
      
      allData.forEach(record => {
        const dateKey = `${record.date}_${record.district}_${record.name}`;
        if (!dateMap.has(dateKey) || 
            (record.timestamp && dateMap.get(dateKey).timestamp < record.timestamp)) {
          dateMap.set(dateKey, record);
        }
      });
      
      // 최신 데이터만 사용하여 집계
      dateMap.forEach(record => {
        const key = `${record.district}-${record.name}`;
        if (!personalStats[key]) {
          personalStats[key] = {
            name: record.name,
            district: record.district,
            bibleReading: 0,
            bibleReadingDays: 0,
            sundayCount: 0,
            wednesdayCount: 0
          };
        }
        if (record.bibleReading > 0) {
          personalStats[key].bibleReading += record.bibleReading;
          personalStats[key].bibleReadingDays++;
        }
        if (record.sundayAttendance) {
          personalStats[key].sundayCount++;
        }
        if (record.wednesdayAttendance) {
          personalStats[key].wednesdayCount++;
        }
      });

      // 개인 순위 계산
      // 동일 점수일 때 같은 순위를 부여하는 함수
      const assignRanks = (sortedArray) => {
        if (sortedArray.length === 0) return [];
        
        const ranked = [];
        let currentRank = 1;
        let previousValue = null;
        
        for (let i = 0; i < sortedArray.length; i++) {
          const item = sortedArray[i];
          
          // 이전 값과 다르면 순위 증가
          if (previousValue !== null && item.value !== previousValue) {
            currentRank = i + 1;
          }
          
          ranked.push({
            ...item,
            rank: currentRank
          });
          
          previousValue = item.value;
        }
        
        return ranked;
      };

      const personalBibleRanking = assignRanks(
        Object.values(personalStats)
          .map(stat => ({
            name: stat.name,
            district: stat.district,
            value: stat.bibleReading
          }))
          .sort((a, b) => b.value - a.value)
      );

      const personalDailyRanking = assignRanks(
        Object.values(personalStats)
          .map(stat => ({
            name: stat.name,
            district: stat.district,
            value: stat.bibleReadingDays
          }))
          .sort((a, b) => b.value - a.value)
      );

      const personalSundayRanking = assignRanks(
        Object.values(personalStats)
          .map(stat => ({
            name: stat.name,
            district: stat.district,
            value: stat.sundayCount
          }))
          .sort((a, b) => b.value - a.value)
      );

      const personalWednesdayRanking = assignRanks(
        Object.values(personalStats)
          .map(stat => ({
            name: stat.name,
            district: stat.district,
            value: stat.wednesdayCount
          }))
          .sort((a, b) => b.value - a.value)
      );

      // 현재 사용자의 순위 찾기
      const currentUserKey = `${parseInt(district)}-${name}`;
      const currentUserStats = personalStats[currentUserKey] || {
        bibleReading: 0,
        bibleReadingDays: 0,
        sundayCount: 0,
        wednesdayCount: 0
      };

      // 동일 순위 범위를 계산하는 함수
      const getRankRange = (ranking, targetRank) => {
        const sameRankItems = ranking.filter(item => Number(item.rank) === targetRank);
        if (sameRankItems.length <= 1) {
          return `${targetRank}위`;
        }
        
        // 동일 순위가 여러 명인 경우, 최소 순위와 최대 순위 계산
        let minRank = targetRank;
        let maxRank = targetRank;
        
        // ranking 배열에서 해당 순위의 첫 번째와 마지막 인덱스 찾기
        for (let i = 0; i < ranking.length; i++) {
          if (Number(ranking[i].rank) === targetRank) {
            minRank = i + 1; // 배열 인덱스 + 1이 실제 순위
            break;
          }
        }
        
        for (let i = ranking.length - 1; i >= 0; i--) {
          if (Number(ranking[i].rank) === targetRank) {
            maxRank = i + 1; // 배열 인덱스 + 1이 실제 순위
            break;
          }
        }
        
        if (minRank === maxRank) {
          return `${targetRank}위`;
        } else {
          return `${minRank}위~${maxRank}위`;
        }
      };

      const myBibleRankItem = personalBibleRanking.find(
        r => r.name === name && r.district === parseInt(district)
      );
      const myBibleRank = myBibleRankItem ? myBibleRankItem.rank : null;
      const myBibleRankRange = myBibleRank ? getRankRange(personalBibleRanking, myBibleRank) : null;

      const myDailyRankItem = personalDailyRanking.find(
        r => r.name === name && r.district === parseInt(district)
      );
      const myDailyRank = myDailyRankItem ? myDailyRankItem.rank : null;
      const myDailyRankRange = myDailyRank ? getRankRange(personalDailyRanking, myDailyRank) : null;

      const mySundayRankItem = personalSundayRanking.find(
        r => r.name === name && r.district === parseInt(district)
      );
      const mySundayRank = mySundayRankItem ? mySundayRankItem.rank : null;
      const mySundayRankRange = mySundayRank ? getRankRange(personalSundayRanking, mySundayRank) : null;

      const myWednesdayRankItem = personalWednesdayRanking.find(
        r => r.name === name && r.district === parseInt(district)
      );
      const myWednesdayRank = myWednesdayRankItem ? myWednesdayRankItem.rank : null;
      const myWednesdayRankRange = myWednesdayRank ? getRankRange(personalWednesdayRanking, myWednesdayRank) : null;

      // 개인순위에서 1위와 바로 내 앞 순위만 찾기
      const getTopAndAboveRanks = (ranking, myRank, myName, myDistrict) => {
        const topRank = ranking.length > 0 ? ranking[0] : null;
        const aboveRanks = [];
        
        // 내 순위가 2위 이상인 경우에만 바로 앞 순위 찾기
        if (myRank && myRank > 1) {
          const myRankNum = Number(myRank);
          
          // 내 순위보다 작은 순위 중 가장 큰 순위를 찾기
          // 예: 내가 5위이고 4위가 없으면, 3위를 찾아야 함
          let maxRankBeforeMe = 0;
          let beforeMeItem = null;
          
          for (let i = 0; i < ranking.length; i++) {
            const item = ranking[i];
            const itemRank = Number(item.rank);
            
            // 내 순위보다 작은 순위 중 가장 큰 순위 찾기
            if (itemRank < myRankNum && itemRank > maxRankBeforeMe) {
              maxRankBeforeMe = itemRank;
              beforeMeItem = item;
            }
          }
          
          // 바로 앞 순위를 찾았으면 추가
          if (beforeMeItem) {
            aboveRanks.push(beforeMeItem);
          }
        }
        
        return {
          top: topRank,
          above: aboveRanks
        };
      };

      // 성경읽기에 참여중인 전체 인원 계산 (bibleReading > 0인 사람)
      const totalParticipants = Object.values(personalStats).filter(
        stat => stat.bibleReading > 0
      ).length;

      setRankings({
        totalParticipants: totalParticipants,
        district: {
          total: districtRankingTotal,
          onSite: districtRankingOnSite
        },
        personal: {
          bibleReading: {
            value: currentUserStats.bibleReading,
            rank: myBibleRank > 0 ? myBibleRank : null,
            rankRange: myBibleRankRange,
            topAndAbove: getTopAndAboveRanks(personalBibleRanking, myBibleRank, name, parseInt(district))
          },
          dailyReading: {
            value: currentUserStats.bibleReadingDays,
            rank: myDailyRank > 0 ? myDailyRank : null,
            rankRange: myDailyRankRange,
            topAndAbove: getTopAndAboveRanks(personalDailyRanking, myDailyRank, name, parseInt(district))
          },
          sunday: {
            value: currentUserStats.sundayCount,
            rank: mySundayRank > 0 ? mySundayRank : null,
            rankRange: mySundayRankRange,
            topAndAbove: getTopAndAboveRanks(personalSundayRanking, mySundayRank, name, parseInt(district))
          },
          wednesday: {
            value: currentUserStats.wednesdayCount,
            rank: myWednesdayRank > 0 ? myWednesdayRank : null,
            rankRange: myWednesdayRankRange,
            topAndAbove: getTopAndAboveRanks(personalWednesdayRanking, myWednesdayRank, name, parseInt(district))
          }
        }
      });
    } catch (error) {
      console.error('순위 계산 중 오류 발생:', error);
      alert('순위 계산 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // 순위 화면에서 뒤로가기
  const handleBackToForm = async () => {
    setShowRanking(false);
    
    // 현재 날짜/구역/이름의 최신 데이터 불러오기
    if (district && name && selectedDate) {
      await loadDateData(selectedDate);
    }
  };

  if (showRanking && rankings) {
    return (
      <div className="container">
        <h1>매탄교구 말씀생활</h1>
        <div className="ranking-section">
          <div className="ranking-header">
            <h2>순위</h2>
          </div>
          
          {rankings.totalParticipants !== undefined && (
            <div className="total-participants">
              <span className="participants-label">현재 함께 믿음의 경주 중인 형제 자매 : </span>
              <span className="participants-count">{rankings.totalParticipants}명</span>
            </div>
          )}
          
          <div className="ranking-cards-container">
            <div className="district-ranking-card">
              <div className="card-header">
                <h3>구역순위</h3>
                <span className="card-subtitle">수요말씀 참석</span>
              </div>
              <div className="district-stats">
                <div className="stat-item">
                  <div className="stat-label">(현장+온라인)</div>
                  <div className="stat-value">
                    {rankings.district.total && rankings.district.total.length > 0 ? (
                      <div className="district-ranking-list">
                        {rankings.district.total.map((item, index) => {
                          const rankClass = item.rank === 1 ? 'rank-1' : (item.rank >= 2 && item.rank <= 3 ? 'rank-2-3' : '');
                          return (
                            <div key={index} className="district-rank-item">
                              <span className={`rank-number-large ${rankClass}`}>{item.rank}위</span>
                              <span className={`rank-badge ${rankClass}`}>{item.district}구역</span>
                              <span className="rank-count">{item.total}명</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="no-data">-</span>
                    )}
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">(온라인제외)</div>
                  <div className="stat-value">
                    {rankings.district.onSite && rankings.district.onSite.length > 0 ? (
                      <div className="district-ranking-list">
                        {rankings.district.onSite.map((item, index) => {
                          const rankClass = item.rank === 1 ? 'rank-1' : (item.rank >= 2 && item.rank <= 3 ? 'rank-2-3' : '');
                          return (
                            <div key={index} className="district-rank-item">
                              <span className={`rank-number-large ${rankClass}`}>{item.rank}위</span>
                              <span className={`rank-badge ${rankClass}`}>{item.district}구역</span>
                              <span className="rank-count">{item.onSite}명</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="no-data">-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="personal-ranking-card">
            <div className="card-header">
              <h3>개인순위</h3>
            </div>
            <div className="personal-stats">
              <div className="personal-stat-item">
                <div className="personal-stat-icon">📖</div>
                <div className="personal-stat-content">
                  <div className="personal-stat-label">성경읽기</div>
                  <div className="personal-stat-value">
                    <span className="value-number">{rankings.personal.bibleReading.value}</span>
                    <span className="value-unit">장</span>
                  </div>
                  {rankings.personal.bibleReading.topAndAbove && (
                    <div className="personal-stat-others">
                      {rankings.personal.bibleReading.topAndAbove.top && (
                        <div className="other-rank-item">
                          1위 : {rankings.personal.bibleReading.topAndAbove.top.value}장({rankings.personal.bibleReading.topAndAbove.top.name})
                        </div>
                      )}
                      {rankings.personal.bibleReading.topAndAbove.above.map((item, idx) => (
                        <div key={idx} className="other-rank-item">
                          {item.rank}위 : {item.value}장({item.name})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="personal-stat-rank">
                  {rankings.personal.bibleReading.rankRange ? (
                    <span className="rank-number">{rankings.personal.bibleReading.rankRange}</span>
                  ) : (
                    <span className="no-rank">-</span>
                  )}
                </div>
              </div>
              
              <div className="personal-stat-item">
                <div className="personal-stat-icon">📅</div>
                <div className="personal-stat-content">
                  <div className="personal-stat-label">매일읽기</div>
                  <div className="personal-stat-value">
                    <span className="value-number">{rankings.personal.dailyReading.value}</span>
                    <span className="value-unit">일</span>
                  </div>
                  {rankings.personal.dailyReading.topAndAbove && (
                    <div className="personal-stat-others">
                      {rankings.personal.dailyReading.topAndAbove.top && (
                        <div className="other-rank-item">
                          1위 : {rankings.personal.dailyReading.topAndAbove.top.value}일({rankings.personal.dailyReading.topAndAbove.top.name})
                        </div>
                      )}
                      {rankings.personal.dailyReading.topAndAbove.above.map((item, idx) => (
                        <div key={idx} className="other-rank-item">
                          {item.rank}위 : {item.value}일({item.name})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="personal-stat-rank">
                  {rankings.personal.dailyReading.rankRange ? (
                    <span className="rank-number">{rankings.personal.dailyReading.rankRange}</span>
                  ) : (
                    <span className="no-rank">-</span>
                  )}
                </div>
              </div>
              
              <div className="personal-stat-item">
                <div className="personal-stat-icon">⛪</div>
                <div className="personal-stat-content">
                  <div className="personal-stat-label">주일말씀</div>
                  <div className="personal-stat-value">
                    <span className="value-number">{rankings.personal.sunday.value}</span>
                    <span className="value-unit">회</span>
                  </div>
                  {rankings.personal.sunday.topAndAbove && (
                    <div className="personal-stat-others">
                      {rankings.personal.sunday.topAndAbove.top && (
                        <div className="other-rank-item">
                          1위 : {rankings.personal.sunday.topAndAbove.top.value}회({rankings.personal.sunday.topAndAbove.top.name})
                        </div>
                      )}
                      {rankings.personal.sunday.topAndAbove.above.map((item, idx) => (
                        <div key={idx} className="other-rank-item">
                          {item.rank}위 : {item.value}회({item.name})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="personal-stat-rank">
                  {rankings.personal.sunday.rankRange ? (
                    <span className="rank-number">{rankings.personal.sunday.rankRange}</span>
                  ) : (
                    <span className="no-rank">-</span>
                  )}
                </div>
              </div>
              
              <div className="personal-stat-item">
                <div className="personal-stat-icon">⛪</div>
                <div className="personal-stat-content">
                  <div className="personal-stat-label">수요말씀</div>
                  <div className="personal-stat-value">
                    <span className="value-number">{rankings.personal.wednesday.value}</span>
                    <span className="value-unit">회</span>
                  </div>
                  {rankings.personal.wednesday.topAndAbove && (
                    <div className="personal-stat-others">
                      {rankings.personal.wednesday.topAndAbove.top && (
                        <div className="other-rank-item">
                          1위 : {rankings.personal.wednesday.topAndAbove.top.value}회({rankings.personal.wednesday.topAndAbove.top.name})
                        </div>
                      )}
                      {rankings.personal.wednesday.topAndAbove.above.map((item, idx) => (
                        <div key={idx} className="other-rank-item">
                          {item.rank}위 : {item.value}회({item.name})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="personal-stat-rank">
                  {rankings.personal.wednesday.rankRange ? (
                    <span className="rank-number">{rankings.personal.wednesday.rankRange}</span>
                  ) : (
                    <span className="no-rank">-</span>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>

          <button className="back-button" onClick={handleBackToForm}>
            입력 화면으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>매탄교구 말씀생활</h1>
      
      <div className="form-section">
        <table className="info-table">
          <tbody>
            <tr>
              <td>일자</td>
              <td>
                <div className="date-input-wrapper">
                  <span className="date-display">
                    {currentDate} ({currentDayOfWeek}요일)
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    className="date-input"
                    title="날짜 선택"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td>구역</td>
              <td>
                <select 
                  value={district} 
                  onChange={(e) => setDistrict(e.target.value)}
                  className="input-field"
                >
                  <option value="">선택하세요</option>
                  <option value="41">41</option>
                  <option value="42">42</option>
                  <option value="43">43</option>
                </select>
              </td>
            </tr>
            <tr>
              <td>이름</td>
              <td>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="이름을 입력하세요"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <table className="activity-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>입력</th>      
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>*성경읽기</td>
              <td>
                <div className="bible-reading-input">
                  <span className="bible-label">성경</span>
                  <input
                    type="number"
                    value={bibleReading}
                    onChange={(e) => setBibleReading(e.target.value)}
                    className="input-field bible-input"
                    min="0"
                    placeholder="0"
                  />
                  <span className="bible-unit">장</span>
                </div>
              </td>
            </tr>
            {isSunday() && (
              <tr>
                <td>주일말씀참석</td>
                <td>
                  <div className="button-group">
                    <button
                      type="button"
                      className={sundayAttendance === '현장참석' ? 'active' : ''}
                      onClick={() => setSundayAttendance('현장참석')}
                    >
                      <span className="button-text-multiline">
                        <span>현  장</span>
                        <span>참  석</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={sundayAttendance === '온라인' ? 'active' : ''}
                      onClick={() => setSundayAttendance('온라인')}
                    >
                      온라인
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {isWednesday() && (
              <tr>
                <td>수요말씀참석</td>
                <td>
                  <div className="button-group">
                    <button
                      type="button"
                      className={wednesdayAttendance === '현장참석' ? 'active' : ''}
                      onClick={() => setWednesdayAttendance('현장참석')}
                    >
                      <span className="button-text-multiline">
                        <span>현  장</span>
                        <span>참  석</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={wednesdayAttendance === '온라인' ? 'active' : ''}
                      onClick={() => setWednesdayAttendance('온라인')}
                    >
                      온라인
                    </button>
                  </div>
                </td>
              </tr>
            )}
            <tr>
              <td colSpan="2">
                <button className="save-button" onClick={handleSave}>
                  저장
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>입력 내용 확인</h3>
            <div className="confirm-info">
              <p><strong>일자:</strong> {currentDate} ({currentDayOfWeek}요일)</p>
              <p><strong>구역:</strong> {district}구역</p>
              <p><strong>이름:</strong> {name}</p>
              <p><strong>성경읽기:</strong> {bibleReading || 0}장</p>
              {isSunday() && (
                <p><strong>주일말씀:</strong> {sundayAttendance || '없음'}</p>
              )}
              {isWednesday() && (
                <p><strong>수요말씀:</strong> {wednesdayAttendance || '없음'}</p>
              )}
            </div>
            <div className="modal-buttons">
              <button className="confirm-button" onClick={handleConfirmSave}>
                확인
              </button>
              <button className="cancel-button" onClick={() => setShowConfirmModal(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;

