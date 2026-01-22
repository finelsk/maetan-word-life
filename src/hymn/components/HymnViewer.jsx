import React from 'react';

/**
 * 찬송가 가사 뷰어 컴포넌트
 */
const HymnViewer = ({ hymn, onBack, onViewScore, isFavorite, onToggleFavorite }) => {
  return (
    <div className="hymn-viewer">
      <div className="hymn-viewer-header">
        <button className="hymn-back-btn" onClick={onBack}>← 뒤로</button>
        <h3 className="hymn-viewer-title">
          {hymn.number}장. {hymn.title}
        </h3>
        <button
          className={`hymn-favorite-btn ${isFavorite ? 'active' : ''}`}
          onClick={onToggleFavorite}
        >
          ⭐
        </button>
      </div>

      <div className="hymn-viewer-content">
        <div className="hymn-viewer-tabs">
          <button
            className="hymn-viewer-tab active"
            onClick={() => {}}
          >
            가사
          </button>
          <button
            className="hymn-viewer-tab"
            onClick={onViewScore}
          >
            악보
          </button>
        </div>

        <div className="hymn-lyrics">
          {hymn.lyrics && hymn.lyrics.length > 0 ? (
            hymn.lyrics.map((verse, index) => (
              <div key={index} className="hymn-verse">
                <div className="verse-number">{index + 1}</div>
                <div className="verse-text">
                  {verse.split('\n').map((line, lineIndex) => (
                    <p key={lineIndex}>{line}</p>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="hymn-no-lyrics">가사 정보가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HymnViewer;
