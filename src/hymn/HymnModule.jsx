import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import HymnSearch from './components/HymnSearch';
import HymnViewer from './components/HymnViewer';
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
  const [viewMode, setViewMode] = useState('search'); // 'search' | 'lyrics' | 'score'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30); // 초 단위
  const [autoScroll, setAutoScroll] = useState(false);
  
  const { getCachedHymn, cacheHymn } = useHymnCache();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();

  // 화면 꺼짐 방지
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

  // 찬송가 선택 핸들러
  const handleSelectHymn = async (hymn) => {
    // 이미 전체 데이터가 있으면 바로 사용 (샘플 데이터인 경우)
    if (hymn.lyrics && hymn.lyrics.length > 0) {
      setSelectedHymn(hymn);
      setViewMode('lyrics');
      // 캐시에 저장
      cacheHymn(selectedCategory, hymn.number, hymn);
      return;
    }

    // 먼저 캐시 확인
    const cached = getCachedHymn(selectedCategory, hymn.number);
    if (cached) {
      setSelectedHymn(cached);
      setViewMode('lyrics');
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
        setViewMode('lyrics');
      } else {
        // Firebase에 없으면 hymn 객체 자체를 사용 (샘플 데이터)
        setSelectedHymn(hymn);
        setViewMode('lyrics');
        cacheHymn(selectedCategory, hymn.number, hymn);
      }
    } catch (error) {
      console.error('찬송가 불러오기 오류:', error);
      // 오류 발생 시 hymn 객체 자체를 사용 (샘플 데이터)
      setSelectedHymn(hymn);
      setViewMode('lyrics');
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

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (isFullscreen) {
      setIsFullscreen(false);
      setAutoScroll(false);
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
      {!isFullscreen && (
        <div className="hymn-module-header">
          <button className="hymn-close-btn" onClick={handleClose}>✕</button>
          <h2>🎵 찬송가</h2>
          <div className="hymn-category-tabs">
            <button
              className={selectedCategory === 'unified' ? 'active' : ''}
              onClick={() => {
                setSelectedCategory('unified');
                setSelectedHymn(null);
                setViewMode('search');
              }}
            >
              통합 찬송가
            </button>
            <button
              className={selectedCategory === 'grace' ? 'active' : ''}
              onClick={() => {
                setSelectedCategory('grace');
                setSelectedHymn(null);
                setViewMode('search');
              }}
            >
              은혜찬송가
            </button>
          </div>
        </div>
      )}

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
        />
      )}

      {viewMode === 'lyrics' && selectedHymn && (
        <HymnViewer
          hymn={selectedHymn}
          onBack={handleBack}
          onViewScore={() => setViewMode('score')}
          isFavorite={isFavorite(selectedCategory, selectedHymn.number)}
          onToggleFavorite={() => {
            if (isFavorite(selectedCategory, selectedHymn.number)) {
              removeFavorite(selectedCategory, selectedHymn.number);
            } else {
              addFavorite(selectedCategory, selectedHymn);
            }
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
