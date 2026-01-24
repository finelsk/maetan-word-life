import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';
import { sampleHymns } from '../data/sampleHymns';

/**
 * 찬송가 검색 컴포넌트
 */
const HymnSearch = ({ category, onSelectHymn, favorites, isFavorite, onToggleFavorite, onClose, onCategoryChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  // localStorage에서 마지막 선택한 검색 타입 불러오기
  const [searchType, setSearchType] = useState(() => {
    const saved = localStorage.getItem('hymnSearchType');
    return saved || 'all';
  });
  const [hymns, setHymns] = useState([]);
  const [filteredHymns, setFilteredHymns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  // 검색 타입 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('hymnSearchType', searchType);
  }, [searchType]);

  // Firebase에서 찬송가 목록 불러오기
  useEffect(() => {
    loadHymns();
  }, [category]);

  const loadHymns = async () => {
    // localStorage에서 캐시된 데이터 확인 (영구 캐시)
    const cacheKey = `hymns_${category}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        console.log(`캐시된 ${category} 찬송가 데이터 사용`);
        setHymns(parsed.data);
        setFilteredHymns(parsed.data);
        setLoading(false);
        return;
      } catch (e) {
        console.error('캐시 파싱 오류:', e);
      }
    }

    setLoading(true);
    try {
      const hymnsRef = collection(db, 'hymns');
      const q = query(
        hymnsRef,
        where('category', '==', category),
        orderBy('number', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      let hymnsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        number: doc.data().number,
        title: doc.data().title || '',
        firstLine: doc.data().firstLine || '',
        ...doc.data()
      }));
      
      // Firebase에 데이터가 없으면 샘플 데이터 사용
      if (hymnsList.length === 0) {
        console.log('Firebase에 데이터가 없어 샘플 데이터를 사용합니다.');
        const sampleData = sampleHymns[category] || [];
        hymnsList = sampleData.map(hymn => ({
          id: `${category}_${hymn.number}`,
          category: category,
          ...hymn
        }));
      }
      
      // localStorage에 영구 캐시 저장
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: hymnsList
        }));
        console.log(`${category} 찬송가 데이터 영구 캐시됨`);
      } catch (e) {
        console.error('캐시 저장 오류:', e);
      }
      
      setHymns(hymnsList);
      setFilteredHymns(hymnsList);
    } catch (error) {
      console.error('찬송가 목록 불러오기 오류:', error);
      // 오류 발생 시에도 샘플 데이터 사용
      console.log('오류 발생으로 샘플 데이터를 사용합니다.');
      const sampleData = sampleHymns[category] || [];
      const hymnsList = sampleData.map(hymn => ({
        id: `${category}_${hymn.number}`,
        category: category,
        ...hymn
      }));
      setHymns(hymnsList);
      setFilteredHymns(hymnsList);
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터링
  useEffect(() => {
    if (!searchQuery.trim()) {
      if (showFavorites) {
        const favHymns = favorites
          .filter(fav => fav.category === category)
          .map(fav => {
            const hymn = hymns.find(h => h.number === fav.number);
            return hymn;
          })
          .filter(Boolean);
        setFilteredHymns(favHymns);
      } else {
        setFilteredHymns(hymns);
      }
      return;
    }

    const query = searchQuery.toLowerCase();
    let filtered = hymns;

    if (searchType === 'number') {
      filtered = hymns.filter(hymn => 
        hymn.number.toString().includes(query)
      );
    } else if (searchType === 'title') {
      filtered = hymns.filter(hymn => 
        hymn.title.toLowerCase().includes(query) ||
        hymn.firstLine.toLowerCase().includes(query)
      );
    } else {
      // 전체 검색 (번호 + 제목)
      filtered = hymns.filter(hymn => 
        hymn.number.toString().includes(query) ||
        hymn.title.toLowerCase().includes(query) ||
        hymn.firstLine.toLowerCase().includes(query)
      );
    }

    setFilteredHymns(filtered.slice(0, 50)); // 최대 50개
  }, [searchQuery, searchType, hymns, showFavorites, favorites, category]);

  // 검색 placeholder 동적 생성
  const getPlaceholder = () => {
    if (searchType === 'number') return '장 검색...';
    if (searchType === 'title') return '제목 검색...';
    return '번호, 제목 검색...';
  };

  // 번호 검색인 경우 숫자 키보드 활성화
  const getInputMode = () => {
    return searchType === 'number' ? 'numeric' : 'text';
  };

  return (
    <div className="hymn-search">
      <div className="hymn-search-controls">
        <div className="hymn-filter-row">
          <button
            className={category === 'unified' ? 'active' : ''}
            onClick={() => onCategoryChange && onCategoryChange('unified')}
          >
            통합
          </button>
          <button
            className={category === 'grace' ? 'active' : ''}
            onClick={() => onCategoryChange && onCategoryChange('grace')}
          >
            은혜
          </button>
          <div className="hymn-divider"></div>
          <button
            className={searchType === 'all' ? 'active' : ''}
            onClick={() => setSearchType('all')}
          >
            전체
          </button>
          <button
            className={searchType === 'number' ? 'active' : ''}
            onClick={() => setSearchType('number')}
          >
            번호
          </button>
          <button
            className={searchType === 'title' ? 'active' : ''}
            onClick={() => setSearchType('title')}
          >
            제목
          </button>
          <div style={{ flex: 1 }}></div>
          {onClose && (
            <button
              className="hymn-close-btn-top"
              onClick={onClose}
              title="닫기"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="hymn-search-input-row">
          <div className="hymn-search-input-wrapper">
            <input
              type="text"
              inputMode={getInputMode()}
              className="hymn-search-input"
              placeholder={getPlaceholder()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="hymn-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>
          <button
            className={`hymn-favorite-toggle ${showFavorites ? 'active' : ''}`}
            onClick={() => setShowFavorites(!showFavorites)}
            title="즐겨찾기"
          >
            ⭐
          </button>
        </div>
      </div>

      {loading ? (
        <div className="hymn-loading">로딩 중...</div>
      ) : (
        <div className="hymn-search-results">
          {filteredHymns.length === 0 ? (
            <div className="hymn-no-results">검색 결과가 없습니다.</div>
          ) : (
            filteredHymns.map((hymn) => (
              <div
                key={hymn.id || hymn.number}
                className="hymn-search-item"
                onClick={() => onSelectHymn(hymn)}
              >
                <div className="hymn-item-number">{hymn.number}</div>
                <div className="hymn-item-title">{hymn.title}</div>
                <button
                  className={`hymn-item-favorite ${isFavorite(category, hymn.number) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(hymn);
                  }}
                >
                  ⭐
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default HymnSearch;
