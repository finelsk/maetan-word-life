import { useState, useEffect } from 'react';

const FAVORITES_KEY = 'hymn_favorites';

/**
 * 즐겨찾기 관리 훅
 */
export const useFavorites = () => {
  const [favorites, setFavorites] = useState([]);

  // 초기 로드 시 즐겨찾기 불러오기
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (error) {
      console.error('즐겨찾기 불러오기 오류:', error);
    }
  }, []);

  // 즐겨찾기 추가
  const addFavorite = (category, hymn) => {
    if (typeof window === 'undefined') return;

    const favorite = {
      category,
      number: hymn.number,
      title: hymn.title,
      firstLine: hymn.firstLine,
      addedAt: Date.now()
    };

    const newFavorites = [...favorites, favorite];
    setFavorites(newFavorites);
    
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (error) {
      console.error('즐겨찾기 저장 오류:', error);
    }
  };

  // 즐겨찾기 제거
  const removeFavorite = (category, number) => {
    if (typeof window === 'undefined') return;

    const newFavorites = favorites.filter(
      fav => !(fav.category === category && fav.number === number)
    );
    setFavorites(newFavorites);
    
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    } catch (error) {
      console.error('즐겨찾기 저장 오류:', error);
    }
  };

  // 즐겨찾기 여부 확인
  const isFavorite = (category, number) => {
    return favorites.some(
      fav => fav.category === category && fav.number === number
    );
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite
  };
};
