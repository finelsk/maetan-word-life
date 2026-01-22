import { useState, useEffect } from 'react';

const CACHE_KEY_PREFIX = 'hymn_cache_';
const CACHE_EXPIRY_DAYS = 30;

/**
 * 찬송가 로컬 캐싱 훅
 */
export const useHymnCache = () => {
  const [cache, setCache] = useState({});

  // 초기 로드 시 캐시 불러오기
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem('hymn_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // 만료된 캐시 제거
        const now = Date.now();
        const filtered = {};
        Object.keys(parsed).forEach(key => {
          if (parsed[key].expiry > now) {
            filtered[key] = parsed[key];
          }
        });
        setCache(filtered);
        if (Object.keys(filtered).length !== Object.keys(parsed).length) {
          localStorage.setItem('hymn_cache', JSON.stringify(filtered));
        }
      }
    } catch (error) {
      console.error('캐시 불러오기 오류:', error);
    }
  }, []);

  // 캐시에 저장
  const cacheHymn = (category, number, data) => {
    if (typeof window === 'undefined') return;

    try {
      const key = `${category}_${number}`;
      const expiry = Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      
      const newCache = {
        ...cache,
        [key]: {
          data,
          expiry
        }
      };

      setCache(newCache);
      localStorage.setItem('hymn_cache', JSON.stringify(newCache));
    } catch (error) {
      console.error('캐시 저장 오류:', error);
      // localStorage 용량 초과 시 오래된 항목 제거
      if (error.name === 'QuotaExceededError') {
        clearOldCache();
      }
    }
  };

  // 캐시에서 불러오기
  const getCachedHymn = (category, number) => {
    const key = `${category}_${number}`;
    const cached = cache[key];
    
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    return null;
  };

  // 오래된 캐시 제거
  const clearOldCache = () => {
    if (typeof window === 'undefined') return;

    try {
      const now = Date.now();
      const filtered = {};
      Object.keys(cache).forEach(key => {
        if (cache[key].expiry > now) {
          filtered[key] = cache[key];
        }
      });
      setCache(filtered);
      localStorage.setItem('hymn_cache', JSON.stringify(filtered));
    } catch (error) {
      console.error('캐시 정리 오류:', error);
    }
  };

  // 전체 캐시 삭제
  const clearCache = () => {
    if (typeof window === 'undefined') return;
    setCache({});
    localStorage.removeItem('hymn_cache');
  };

  return {
    cacheHymn,
    getCachedHymn,
    clearCache
  };
};
