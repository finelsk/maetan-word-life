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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 이미지 URL 결정
  const imageUrl = isLandscape && hymn.scoreImageUrlLandscape
    ? hymn.scoreImageUrlLandscape
    : hymn.scoreImageUrl;

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && isFullscreen && isLandscape && imageLoaded) {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollStep = 1; // 픽셀 단위
      const interval = scrollSpeed * 1000 / (container.scrollHeight - container.clientHeight); // 초 단위를 밀리초로 변환

      scrollIntervalRef.current = setInterval(() => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
          // 끝에 도달하면 처음으로
          container.scrollTop = 0;
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
  }, [autoScroll, isFullscreen, isLandscape, imageLoaded, scrollSpeed]);

  // 전체화면 모드일 때 배경 스크롤 잠금
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isFullscreen]);

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

      <div className="hymn-score-controls">
        <button
          className="hymn-score-control-btn"
          onClick={onToggleFullscreen}
          title="전체화면"
        >
          {isFullscreen ? '⤓ 나가기' : '⤢ 전체화면'}
        </button>
        {isFullscreen && (
          <>
            <button
              className="hymn-score-control-btn"
              onClick={onToggleLandscape}
              title="가로 모드"
            >
              {isLandscape ? '📱 세로' : '🔄 가로'}
            </button>
            {isLandscape && (
              <>
                <button
                  className={`hymn-score-control-btn ${autoScroll ? 'active' : ''}`}
                  onClick={onToggleAutoScroll}
                  title="자동 스크롤"
                >
                  {autoScroll ? '⏸ 정지' : '▶ 재생'}
                </button>
                <div className="hymn-scroll-speed-control">
                  <label>스크롤 속도:</label>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={scrollSpeed}
                    onChange={(e) => onScrollSpeedChange(Number(e.target.value))}
                  />
                  <span>{scrollSpeed}초</span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className={`hymn-score-container ${isFullscreen ? 'fullscreen' : ''} ${isLandscape ? 'landscape' : 'portrait'}`}
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
              width: isLandscape ? 'auto' : '100%',
              height: isLandscape ? '100%' : 'auto',
              maxWidth: isLandscape ? 'none' : '100%',
              maxHeight: isLandscape ? '100%' : 'none'
            }}
          />
        )}
      </div>
    </div>
  );
};

export default HymnScoreViewer;
