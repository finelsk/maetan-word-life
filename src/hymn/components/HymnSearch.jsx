import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';
import { sampleHymns } from '../data/sampleHymns';

/**
 * 찬송가 검색 컴포넌트
 */
const HymnSearch = ({ category, onSelectHymn, favorites, isFavorite, onToggleFavorite }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all'); // 'all' | 'number' | 'title' | 'lyrics'
  const [hymns, setHymns] = useState([]);
  const [filteredHymns, setFilteredHymns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  // Firebase에서 찬송가 목록 불러오기
  useEffect(() => {
    loadHymns();
  }, [category]);

  const loadHymns = async () => {
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
    } else if (searchType === 'lyrics') {
      // 가사 검색은 Firebase에서 처리하거나 클라이언트에서 처리
      filtered = hymns.filter(hymn => {
        const lyrics = hymn.lyrics || [];
        return lyrics.some(line => line.toLowerCase().includes(query));
      });
    } else {
      // 전체 검색
      filtered = hymns.filter(hymn => 
        hymn.number.toString().includes(query) ||
        hymn.title.toLowerCase().includes(query) ||
        hymn.firstLine.toLowerCase().includes(query) ||
        (hymn.lyrics || []).some(line => line.toLowerCase().includes(query))
      );
    }

    setFilteredHymns(filtered.slice(0, 50)); // 최대 50개
  }, [searchQuery, searchType, hymns, showFavorites, favorites, category]);

  return (
    <div className="hymn-search">
      <div className="hymn-search-controls">
        <div className="hymn-search-input-wrapper">
          <input
            type="text"
            className="hymn-search-input"
            placeholder="찬송가 번호, 제목, 가사로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className={`hymn-favorite-toggle ${showFavorites ? 'active' : ''}`}
            onClick={() => setShowFavorites(!showFavorites)}
            title="즐겨찾기"
          >
            ⭐
          </button>
        </div>
        
        <div className="hymn-search-type-buttons">
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
          <button
            className={searchType === 'lyrics' ? 'active' : ''}
            onClick={() => setSearchType('lyrics')}
          >
            가사
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
                <div className="hymn-item-content">
                  <div className="hymn-item-title">{hymn.title}</div>
                  {hymn.firstLine && (
                    <div className="hymn-item-first-line">{hymn.firstLine}</div>
                  )}
                </div>
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
