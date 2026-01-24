import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import HymnSearch from './components/HymnSearch';
import HymnScoreViewer from './components/HymnScoreViewer';
import { useHymnCache } from './hooks/useHymnCache';
import { useFavorites } from './hooks/useFavorites';
import './styles/hymn.css';

/**
 * 찬송가 모듈 메인 컴포넌트
 */
const HymnModule = ({ onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState('unified'); // 'unified' | 'grace'
  const [selectedHymn, setSelectedHymn] = useState(null);
  const [viewMode, setViewMode] = useState('search'); // 'search' | 'score'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(0); // 0x, 0.5x, 1x, 1.5x (기본값 0x)
  const [autoScroll, setAutoScroll] = useState(false);
  
  const { getCachedHymn, cacheHymn } = useHymnCache();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();

  // 찬송 모듈 진입 시 화면 꺼짐 방지
  useEffect(() => {
    let wakeLock = null;
    
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('✅ 찬송 모듈: 화면 꺼짐 방지 활성화됨');
          console.log('Wake Lock 객체:', wakeLock);
        } else {
          console.log('❌ 이 브라우저는 Wake Lock API를 지원하지 않습니다.');
        }
      } catch (err) {
        console.error('❌ Wake Lock 요청 실패:', err);
      }
    };

    // 즉시 실행
    requestWakeLock();

    // 문서가 다시 visible 상태가 될 때도 재요청
    const handleVisibilityChange = () => {
      if (!wakeLock && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().then(() => {
          console.log('✅ 찬송 모듈: 화면 꺼짐 방지 해제됨');
        });
      }
    };
  }, []);

  // 화면 꺼짐 방지 (자동 스크롤 시 추가 보호)
  useEffect(() => {
    if (isFullscreen && isLandscape && autoScroll) {
      // Wake Lock API 사용 (지원되는 브라우저에서)
      let wakeLock = null;
      
      const requestWakeLock = async () => {
        try {
          if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('화면 꺼짐 방지 활성화');
          }
        } catch (err) {
          console.log('Wake Lock 요청 실패:', err);
        }
      };

      requestWakeLock();

      return () => {
        if (wakeLock) {
          wakeLock.release();
          console.log('화면 꺼짐 방지 해제');
        }
      };
    }
  }, [isFullscreen, isLandscape, autoScroll]);

  // 화면 방향 감지
  useEffect(() => {
    const updateOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // 찬송가 선택 핸들러 - 악보 전체화면으로 바로 표시
  const handleSelectHymn = async (hymn) => {
    // 새 곡 선택 시 스크롤 설정 초기화
    setScrollSpeed(0);
    setAutoScroll(false);
    
    // 이미 전체 데이터가 있으면 바로 사용 (샘플 데이터인 경우)
    if (hymn.lyrics && hymn.lyrics.length > 0) {
      setSelectedHymn(hymn);
      setViewMode('score');
      setIsFullscreen(true);
      // 캐시에 저장
      cacheHymn(selectedCategory, hymn.number, hymn);
      return;
    }

    // 먼저 캐시 확인
    const cached = getCachedHymn(selectedCategory, hymn.number);
    if (cached) {
      setSelectedHymn(cached);
      setViewMode('score');
      setIsFullscreen(true);
      return;
    }

    // Firebase에서 불러오기
    try {
      const hymnRef = doc(db, 'hymns', `${selectedCategory}_${hymn.number}`);
      const hymnSnap = await getDoc(hymnRef);
      
      if (hymnSnap.exists()) {
        const data = hymnSnap.data();
        const hymnData = {
          ...hymn,
          lyrics: data.lyrics || [],
          scoreImageUrl: data.scoreImageUrl || '',
          scoreImageUrlLandscape: data.scoreImageUrlLandscape || ''
        };
        
        // 캐시에 저장
        cacheHymn(selectedCategory, hymn.number, hymnData);
        setSelectedHymn(hymnData);
        setViewMode('score');
        setIsFullscreen(true);
      } else {
        // Firebase에 없으면 hymn 객체 자체를 사용 (샘플 데이터)
        setSelectedHymn(hymn);
        setViewMode('score');
        setIsFullscreen(true);
        cacheHymn(selectedCategory, hymn.number, hymn);
      }
    } catch (error) {
      console.error('찬송가 불러오기 오류:', error);
      // 오류 발생 시 hymn 객체 자체를 사용 (샘플 데이터)
      setSelectedHymn(hymn);
      setViewMode('score');
      setIsFullscreen(true);
      cacheHymn(selectedCategory, hymn.number, hymn);
    }
  };

  // 닫기 핸들러
  const handleClose = () => {
    setSelectedHymn(null);
    setViewMode('search');
    setIsFullscreen(false);
    setAutoScroll(false);
    if (onClose) {
      onClose();
    }
  };

  // 뒤로가기 핸들러 - 전체화면에서 나가면 바로 검색 화면으로
  const handleBack = () => {
    if (isFullscreen) {
      // 전체화면에서 나갈 때 바로 검색 화면으로
      setIsFullscreen(false);
      setAutoScroll(false);
      setViewMode('search');
      setSelectedHymn(null);
    } else if (viewMode !== 'search') {
      setViewMode('search');
      setSelectedHymn(null);
    } else {
      handleClose();
    }
  };

  // isOpen은 항상 true이므로 제거 (onClose로 제어)

  return (
    <div className={`hymn-module ${isFullscreen ? 'fullscreen' : ''}`}>
      {viewMode === 'search' && (
        <HymnSearch
          category={selectedCategory}
          onSelectHymn={handleSelectHymn}
          favorites={favorites}
          isFavorite={isFavorite}
          onToggleFavorite={(hymn) => {
            if (isFavorite(selectedCategory, hymn.number)) {
              removeFavorite(selectedCategory, hymn.number);
            } else {
              addFavorite(selectedCategory, hymn);
            }
          }}
          onClose={handleClose}
          onCategoryChange={(newCategory) => {
            setSelectedCategory(newCategory);
            setSelectedHymn(null);
          }}
        />
      )}

      {viewMode === 'score' && selectedHymn && (
        <HymnScoreViewer
          hymn={selectedHymn}
          category={selectedCategory}
          isFullscreen={isFullscreen}
          isLandscape={isLandscape}
          scrollSpeed={scrollSpeed}
          autoScroll={autoScroll}
          onBack={handleBack}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          onToggleLandscape={() => setIsLandscape(!isLandscape)}
          onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
          onScrollSpeedChange={setScrollSpeed}
        />
      )}
    </div>
  );
};

export default HymnModule;
