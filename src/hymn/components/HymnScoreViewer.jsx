import React, { useEffect, useRef, useState } from 'react';

/**
 * 찬송가 악보 뷰어 컴포넌트
 */
const HymnScoreViewer = ({
  hymn,
  category,
  isFullscreen,
  isLandscape,
  scrollSpeed,
  autoScroll,
  onBack,
  onToggleFullscreen,
  onToggleLandscape,
  onToggleAutoScroll,
  onScrollSpeedChange
}) => {
  const imageRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPausedByTouch, setIsPausedByTouch] = useState(false);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const touchStartRef = useRef(null);

  // 이미지 URL 결정
  const imageUrl = isLandscape && hymn.scoreImageUrlLandscape
    ? hymn.scoreImageUrlLandscape
    : hymn.scoreImageUrl;

  // hymn 변경 시 상태 초기화
  useEffect(() => {
    setIsAtEnd(false);
    setIsPausedByTouch(false);
    setImageLoaded(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [hymn.number, category]);

  // 악보 화면에서 화면 꺼짐 방지
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('🎵 악보 화면: 화면 꺼짐 방지 활성화됨');
          
          // Wake Lock이 해제되면 다시 요청
          wakeLockRef.current.addEventListener('release', () => {
            console.log('🎵 Wake Lock이 해제됨');
            wakeLockRef.current = null;
          });
        }
      } catch (err) {
        console.error('❌ Wake Lock 요청 실패:', err.message);
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log('🎵 악보 화면: 화면 꺼짐 방지 해제됨');
        } catch (err) {
          console.error('❌ Wake Lock 해제 실패:', err);
        }
      }
    };

    // 악보 화면 진입 시 Wake Lock 요청
    requestWakeLock();

    // 페이지 visibility 변경 시 Wake Lock 재요청
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 컴포넌트 언마운트 시 Wake Lock 해제
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  // 자동 스크롤
  useEffect(() => {
    // 터치로 일시정지 중이거나, 끝에 도달했거나, 속도가 0이면 스크롤 안함
    if (autoScroll && isFullscreen && isLandscape && imageLoaded && scrollSpeed > 0 && !isPausedByTouch && !isAtEnd) {
      const container = scrollContainerRef.current;
      if (!container) return;

      // 배속에 따른 스크롤 속도 계산
      const baseSpeed = 1; // 기본 픽셀/프레임
      const scrollStep = baseSpeed * scrollSpeed;

      scrollIntervalRef.current = setInterval(() => {
        const isAtBottom = Math.abs(
          container.scrollHeight - container.scrollTop - container.clientHeight
        ) < 2; // 2px 이내면 끝으로 간주
        
        if (isAtBottom) {
          // 끝에 도달하면 멈춤
          setIsAtEnd(true);
        } else {
          container.scrollTop += scrollStep;
        }
      }, 16); // 약 60fps

      return () => {
        if (scrollIntervalRef.current) {
          clearInterval(scrollIntervalRef.current);
        }
      };
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    }
  }, [autoScroll, isFullscreen, isLandscape, imageLoaded, scrollSpeed, isPausedByTouch, isAtEnd]);

  // 전체화면 모드일 때 배경 스크롤 잠금
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isFullscreen]);

  // 터치 이벤트 핸들러 (회전된 화면에 맞춰 조정)
  const handleTouchStart = (e) => {
    if (!isLandscape || !isFullscreen) return;
    
    // 이미지 컨텍스트 메뉴 방지
    e.preventDefault();
    
    touchStartRef.current = {
      x: e.touches[0].clientX, // 회전된 화면에서는 X가 스크롤 방향
      scrollTop: scrollContainerRef.current.scrollTop
    };
    
    // 터치 시작 시 일시정지
    if (autoScroll && scrollSpeed > 0) {
      setIsPausedByTouch(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isLandscape || !isFullscreen || !touchStartRef.current) return;
    
    // 이미지 컨텍스트 메뉴 및 기본 동작 방지
    e.preventDefault();
    
    const container = scrollContainerRef.current;
    if (!container) return;

    // 회전된 화면에서는 X축 이동이 스크롤 (방향 반대로)
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    container.scrollTop = touchStartRef.current.scrollTop + deltaX;
    
    // 스와이프로 이동하면 끝 상태 해제
    if (isAtEnd) {
      setIsAtEnd(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isLandscape || !isFullscreen) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    // 끝에서 뒤로 스와이프하면 처음으로
    if (isAtEnd && container.scrollTop < container.scrollHeight - container.clientHeight - 50) {
      container.scrollTop = 0;
      setIsAtEnd(false);
    }

    // 터치 종료 시 다시 스크롤 재개
    setIsPausedByTouch(false);
    touchStartRef.current = null;
  };

  // 처음으로 이동 핸들러
  const handleScrollToTop = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = 0;
      setIsAtEnd(false);
    }
  };

  return (
    <div className={`hymn-score-viewer ${isFullscreen ? 'fullscreen' : ''} ${isLandscape ? 'landscape' : 'portrait'}`}>
      {!isFullscreen && (
        <div className="hymn-score-header">
          <button className="hymn-back-btn" onClick={onBack}>← 뒤로</button>
          <h3 className="hymn-score-title">
            {hymn.number}장. {hymn.title} - 악보
          </h3>
        </div>
      )}

      {/* 가로 모드가 아닐 때만 컨트롤 표시 */}
      {!isLandscape && (
        <div className="hymn-score-controls">
          <button
            className="hymn-score-control-btn"
            onClick={() => {
              if (isFullscreen) {
                // 전체화면에서 나가는 경우 바로 검색 화면으로
                onBack();
              } else {
                onToggleFullscreen();
              }
            }}
            title="전체화면"
          >
            {isFullscreen ? '⤓ 나가기' : '⤢ 전체화면'}
          </button>
          {isFullscreen && (
            <button
              className="hymn-score-control-btn"
              onClick={onToggleLandscape}
              title="가로 모드"
            >
              🔄 가로
            </button>
          )}
        </div>
      )}

      {/* 가로 모드 전체화면 오버레이 */}
      {isFullscreen && isLandscape ? (
        <div className="hymn-landscape-overlay">
          <div className="hymn-landscape-container">
            <button
              className="hymn-landscape-close"
              onClick={onBack}
              aria-label="가로 화면 닫기"
            >
              ✕
            </button>
            <div className="hymn-landscape-controls">
              <button
                className="hymn-landscape-control-btn"
                onClick={onToggleLandscape}
                title="세로 모드"
              >
                📱 세로
              </button>
              <div className="hymn-landscape-speed-control">
                <button
                  className={`hymn-speed-btn ${scrollSpeed === 0 ? 'active' : ''}`}
                  onClick={() => {
                    onScrollSpeedChange(0);
                    setIsAtEnd(false);
                  }}
                >
                  0x
                </button>
                <button
                  className={`hymn-speed-btn ${scrollSpeed === 0.5 ? 'active' : ''}`}
                  onClick={() => {
                    onScrollSpeedChange(0.5);
                    if (!autoScroll) onToggleAutoScroll();
                    setIsAtEnd(false);
                  }}
                >
                  0.5x
                </button>
                <button
                  className={`hymn-speed-btn ${scrollSpeed === 1 ? 'active' : ''}`}
                  onClick={() => {
                    onScrollSpeedChange(1);
                    if (!autoScroll) onToggleAutoScroll();
                    setIsAtEnd(false);
                  }}
                >
                  1x
                </button>
                <button
                  className={`hymn-speed-btn ${scrollSpeed === 1.5 ? 'active' : ''}`}
                  onClick={() => {
                    onScrollSpeedChange(1.5);
                    if (!autoScroll) onToggleAutoScroll();
                    setIsAtEnd(false);
                  }}
                >
                  1.5x
                </button>
              </div>
            </div>
            <div
              ref={scrollContainerRef}
              className="hymn-landscape-score-container"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => e.preventDefault()} // 컨텍스트 메뉴 방지
            >
              {imageError ? (
                <div className="hymn-score-error">
                  악보 이미지를 불러올 수 없습니다.
                </div>
              ) : (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={`${hymn.number}장 ${hymn.title} 악보`}
                  className="hymn-landscape-score-image"
                  onLoad={() => {
                    setImageLoaded(true);
                    // 이미지 로드 후 스크롤 가능 여부 확인
                    if (scrollContainerRef.current) {
                      console.log('Container scrollHeight:', scrollContainerRef.current.scrollHeight);
                      console.log('Container clientHeight:', scrollContainerRef.current.clientHeight);
                    }
                  }}
                  onError={() => setImageError(true)}
                  onContextMenu={(e) => e.preventDefault()} // 이미지 컨텍스트 메뉴 방지
                  style={{ pointerEvents: 'none' }} // 이미지 직접 상호작용 방지
                />
              )}
            </div>
            
            {/* 처음으로 이동 버튼 (끝에 도달했을 때 표시) */}
            {isAtEnd && (
              <button
                className="hymn-scroll-to-top-btn"
                onClick={handleScrollToTop}
                title="처음으로"
              >
                ⬆️ 처음으로
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className={`hymn-score-container ${isFullscreen ? 'fullscreen' : ''}`}
        >
          {imageError ? (
            <div className="hymn-score-error">
              악보 이미지를 불러올 수 없습니다.
            </div>
          ) : (
            <img
              ref={imageRef}
              src={imageUrl}
              alt={`${hymn.number}장 ${hymn.title} 악보`}
              className="hymn-score-image"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              style={{
                width: '100%',
                height: 'auto',
                maxWidth: '100%'
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default HymnScoreViewer;
