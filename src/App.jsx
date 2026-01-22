import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, setDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { queryGeminiAgent, fetchAllNames } from './geminiAgent';
import HymnModule from './hymn/HymnModule';

// 성구암송 섹션 컴포넌트
const BibleMemoSection = ({ selectedDate, onOpenHymn }) => {
  // 기본값은 '이번주', 기존에 저장된 값이 있으면 복원
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'thisWeek';
    const saved = window.localStorage.getItem('bibleMemoActiveTab');
    if (saved === 'lastWeek' || saved === 'thisWeek' || saved === 'nextWeek') {
      return saved;
    }
    return 'thisWeek';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [memos, setMemos] = useState({
    lastWeek: null,
    thisWeek: null,
    nextWeek: null
  });
  const [mp3Urls, setMp3Urls] = useState({
    lastWeek: '',
    thisWeek: '',
    nextWeek: ''
  });
  const [currentIndices, setCurrentIndices] = useState({
    lastWeek: 134,
    thisWeek: 135,
    nextWeek: 136
  });

  // 오디오 플레이어 관련 상태
  const [repeatMode, setRepeatMode] = useState('none'); // 'none' | 'single' | 'all'
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingTab, setCurrentPlayingTab] = useState('thisWeek');
  const audioRef = React.useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
  });

  // 탭 변경 시 마지막 선택 상태를 localStorage 에 저장
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('bibleMemoActiveTab', activeTab);
  }, [activeTab]);

  // 현재 탭 변경 시, 전체 반복이 아닌 경우 재생 탭도 동기화
  useEffect(() => {
    if (repeatMode !== 'all') {
      setCurrentPlayingTab(activeTab);
    }
  }, [activeTab, repeatMode]);

  // 전체 화면 모드일 때 배경 스크롤 잠금
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

  // 화면 방향(가로/세로) 추적
  useEffect(() => {
    if (typeof window === 'undefined') return;

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

  // 인덱스로부터 MP3 파일 경로 생성
  // mp3Url 가져오기 (Firebase에서 로드된 memos에서)
  const getAudioSrc = (tabKey) => {
    return mp3Urls[tabKey] || '';
  };

  // 현재 재생 중인 탭에 맞게 오디오 src 갱신
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const src = getAudioSrc(currentPlayingTab);
    if (!src) return; // mp3Url이 없으면 업데이트 안 함
    if (audio.src === src) return; // 이미 같은 src면 업데이트 안 함
    audio.src = src;
    if (isPlaying) {
      audio
        .play()
        .then(() => {})
        .catch(() => {
          setIsPlaying(false);
        });
    }
  }, [mp3Urls, currentPlayingTab, isPlaying]);

  // 재생/일시정지 토글
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    }
  };

  // 정지 버튼
  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  // 반복 모드 토글: none -> all(A) -> single(1) -> none
  const handleToggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'single';
      return 'none';
    });
  };

  // 전체 반복(all)에서 다음 탭 계산
  const getNextTabForAllRepeat = (tab) => {
    if (tab === 'lastWeek') return 'thisWeek';
    if (tab === 'thisWeek') return 'nextWeek';
    return 'lastWeek';
  };

  // 오디오 종료 시 동작
  const handleEnded = () => {
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(false);
      return;
    }

    if (repeatMode === 'single') {
      // 현재 탭만 반복
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
      return;
    }

    if (repeatMode === 'all') {
      const nextTab = getNextTabForAllRepeat(currentPlayingTab);
      setCurrentPlayingTab(nextTab);
      setActiveTab(nextTab); // 탭/본문도 같이 이동
      // src는 currentPlayingTab 변경으로 useEffect에서 갱신
      setTimeout(() => {
        if (!audioRef.current) return;
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            setIsPlaying(false);
          });
      }, 0);
      return;
    }

    // 반복 없음
    setIsPlaying(false);
  };

  // 인덱스 루프 함수 (1~244 범위)
  const getLoopIndex = (index) => {
    if (index <= 0) {
      // 음수나 0인 경우: 244에서 역순으로 계산
      let result = index;
      while (result <= 0) {
        result += 244;
      }
      return result;
    }
    if (index > 244) {
      // 244 초과인 경우: 1부터 다시 시작
      let result = index;
      while (result > 244) {
        result -= 244;
      }
      return result;
    }
    return index;
  };

  // 주일 기준으로 이번주 인덱스 계산
  const calculateThisWeekIndex = (dateString) => {
    if (!dateString) {
      // 날짜가 없으면 오늘 날짜 기준
      const today = new Date();
      dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    const date = new Date(dateString);
    const dayOfWeek = date.getDay(); // 0 = 일요일
    
    // 주일(일요일)이 아니면 가장 가까운 주일로 조정
    let targetSunday;
    if (dayOfWeek === 0) {
      targetSunday = new Date(date);
    } else {
      // 가장 가까운 과거 주일로 이동
      const daysToSubtract = dayOfWeek;
      targetSunday = new Date(date);
      targetSunday.setDate(date.getDate() - daysToSubtract);
    }

    // 기준 주일: 2026-01-19 (일요일) = 135번
    // 2026-01-26 (일요일) = 136번이 되어야 하므로, 기준은 135번이 맞음
    const baseSunday = new Date('2026-01-19');
    baseSunday.setHours(0, 0, 0, 0); // 시간 정규화
    const baseIndex = 135;

    // 선택한 주일과 기준 주일의 차이 계산 (주 단위)
    targetSunday.setHours(0, 0, 0, 0); // 시간 정규화
    const diffTime = targetSunday - baseSunday;
    const diffWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));

    // 이번주 인덱스 계산
    const thisWeekIndex = baseIndex + diffWeeks;
    
    return getLoopIndex(thisWeekIndex);
  };

  // 날짜 변경 시 인덱스 업데이트
  useEffect(() => {
    const thisWeekIndex = calculateThisWeekIndex(selectedDate);
    const lastWeekIndex = getLoopIndex(thisWeekIndex - 1);
    const nextWeekIndex = getLoopIndex(thisWeekIndex + 1);
    
    setCurrentIndices({
      lastWeek: lastWeekIndex,
      thisWeek: thisWeekIndex,
      nextWeek: nextWeekIndex
    });
  }, [selectedDate]);

  const loadMemos = async () => {
    setLoading(true);
    setError('');
    
    // 현재 주의 일요일 구하기
    const getCurrentWeekSunday = () => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = 일요일
      const diff = dayOfWeek; // 일요일까지의 일수
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - diff);
      sunday.setHours(0, 0, 0, 0);
      return sunday.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    const weekSunday = getCurrentWeekSunday();
    const cacheKey = `bibleMemo_${weekSunday}`;
    const indicesKey = `${cacheKey}_indices_${currentIndices.lastWeek}_${currentIndices.thisWeek}_${currentIndices.nextWeek}`;

    // 캐시 확인 (일주일 동안 유지)
    try {
      const cached = localStorage.getItem(indicesKey);
      if (cached) {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        if (cacheData.timestamp && (now - cacheData.timestamp) < MEMO_CACHE_DURATION) {
          // 캐시된 데이터 사용
          setMemos(cacheData.memos);
          setMp3Urls(cacheData.mp3Urls);
          setLoading(false);
          return;
        } else {
          // 만료된 캐시 삭제
          localStorage.removeItem(indicesKey);
        }
      }
    } catch (error) {
      console.error('캐시 불러오기 오류:', error);
    }

    try {
      const fetchOne = async (index) => {
        const id = String(index);
        try {
          const snap = await getDoc(doc(db, 'bibleMemo', id));
          if (!snap.exists()) return null;
          const data = snap.data();
          return {
            number: data.number || index,
            reference: data.reference || '',
            text: data.text || '',
            mp3Url: data.mp3Url || ''
          };
        } catch (err) {
          console.error(`${index}번 데이터 로딩 오류:`, err);
          return null;
        }
      };

      const { lastWeek: lastIdx, thisWeek: thisIdx, nextWeek: nextIdx } = currentIndices;

      const [lastWeek, thisWeek, nextWeek] = await Promise.all([
        fetchOne(lastIdx),
        fetchOne(thisIdx),
        fetchOne(nextIdx)
      ]);

      const memosData = { lastWeek, thisWeek, nextWeek };
      const mp3UrlsData = {
        lastWeek: lastWeek?.mp3Url || '',
        thisWeek: thisWeek?.mp3Url || '',
        nextWeek: nextWeek?.mp3Url || ''
      };

      setMemos(memosData);
      setMp3Urls(mp3UrlsData);

      // 캐시에 저장 (일주일 동안 유지)
      try {
        const cacheData = {
          memos: memosData,
          mp3Urls: mp3UrlsData,
          timestamp: Date.now()
        };
        localStorage.setItem(indicesKey, JSON.stringify(cacheData));
      } catch (error) {
        console.error('캐시 저장 오류:', error);
      }
    } catch (e) {
      console.error('성구암송 로딩 오류:', e);
      setError('성구암송 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인덱스나 날짜 변경 시 데이터 로딩
  useEffect(() => {
    loadMemos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndices]);

  const renderContent = () => {
    const key =
      activeTab === 'lastWeek' ? 'lastWeek' : activeTab === 'nextWeek' ? 'nextWeek' : 'thisWeek';
    const memo = memos[key];

    if (loading && !memo) {
      return (
        <div className="bible-memo-empty">
          성구암송 내용을 불러오는 중입니다...
        </div>
      );
    }

    if (error) {
      return <div className="bible-memo-empty">{error}</div>;
    }

    if (!memo || !memo.text) {
      if (key === 'nextWeek') {
        return (
          <div className="bible-memo-empty">
            다음주 암송 내용이 아직 업데이트되지 않았습니다.
          </div>
        );
      }
      return (
        <div className="bible-memo-empty">
          아직 암송 내용이 등록되지 않았습니다.
        </div>
      );
    }

    const contentClass =
      key === 'lastWeek'
        ? 'bible-memo-content bible-memo-content-lastWeek'
        : key === 'nextWeek'
        ? 'bible-memo-content bible-memo-content-nextWeek'
        : 'bible-memo-content bible-memo-content-thisWeek';

    // 여러 절인 경우 절별로 구분 처리
    let text = memo.text || '';
    const reference = memo.reference || '';
    let verseCount = 1;
    
    if (reference && (reference.includes('~') || reference.includes('-'))) {
      const verseRangeMatch = reference.match(/(\d+)[~-](\d+)/);
      if (verseRangeMatch) {
        const firstVerseNum = parseInt(verseRangeMatch[1]);
        const secondVerseNum = parseInt(verseRangeMatch[2]);
        verseCount = secondVerseNum - firstVerseNum + 1;
        
        if (!text.includes('\n') && verseCount > 1) {
          const verseEndPatterns = [
            /살겠고\s+/, /없느니라\s+/, /있느니라\s+/, /하시니라\s+/, /하시더라\s+/,
            /하리라\s+/, /하리니\s+/, /하시리라\s+/, /하시리니\s+/, /느니라\s+/,
            /니라\s+/, /더라\s+/, /리라\s+/, /리니\s+/, /느냐\s+/, /냐\s+/,
            /살겠고$/, /없느니라$/, /있느니라$/, /하시니라$/, /하시더라$/,
            /하리라$/, /하리니$/, /느니라$/, /니라$/, /더라$/, /리라$/, /리니$/, /느냐$/, /냐$/
          ];
          
          let splitPoint = -1;
          for (const pattern of verseEndPatterns) {
            const match = text.match(pattern);
            if (match && match.index !== undefined) {
              splitPoint = match.index + match[0].length;
              break;
            }
          }
          
          if (splitPoint === -1) {
            const sentenceEndMatch = text.match(/([^.!?]*[.!?])\s*/);
            if (sentenceEndMatch && sentenceEndMatch.index !== undefined) {
              splitPoint = sentenceEndMatch.index + sentenceEndMatch[0].length;
            } else {
              splitPoint = Math.ceil(text.length / 2);
            }
          }
          
          if (splitPoint > 0 && splitPoint < text.length) {
            const firstVerse = text.substring(0, splitPoint).trim();
            const secondVerse = text.substring(splitPoint).trim();
            if (firstVerse && secondVerse) {
              text = firstVerse + '\n' + secondVerse;
            }
          }
        }
      }
    }

    return (
      <div className={contentClass}>
        <div className="bible-memo-text">
          {text.split('\n').map((line, index) => {
            // 2절 이상인 경우, 앞에 붙은 숫자를 구절보다 조금 작게(위첨자) 표시
            if (verseCount > 1) {
              const match = line.match(/^(\d+)([절\.]*)\s*(.*)$/);
              if (match) {
                const numberPart = `${match[1]}${match[2] || ''}`;
                const verseText = match[3] || '';
                return (
                  <p key={index}>
                    <span className="bible-memo-verse-number">{numberPart}</span>{' '}
                    <span className="bible-memo-verse-text">{verseText}</span>
                  </p>
                );
              }
            }
            return <p key={index}>{line}</p>;
          })}
        </div>
      </div>
    );
  };

  const TabButton = ({ tabKey }) => {
    const labels = {
      lastWeek: '지난주',
      thisWeek: '이번주',
      nextWeek: '다음주'
    };
    
    const isActive = activeTab === tabKey;
    const memo = memos[tabKey];
    const index = currentIndices[tabKey];
    const displayRef = memo?.reference || '';
    
    return (
      <button
        type="button"
        className={`bible-memo-tab ${isActive ? 'active' : ''}`}
        onClick={() => setActiveTab(tabKey)}
      >
        <span className="bible-memo-tab-label">{labels[tabKey]}</span>
        {displayRef && (
          <span className="bible-memo-tab-ref">[{displayRef}]</span>
        )}
      </button>
    );
  };

  return (
    <>
      <section className="bible-memo-section">
        <div className="bible-memo-header">
          <div className="bible-memo-title-row">
            <button
              type="button"
              className="bible-memo-title-zoom-button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title="성구암송 크게 보기"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="8" r="5" />
                <path d="m13 13 3 3" />
              </svg>
            </button>
            <h2 className="bible-memo-title">성구암송</h2>
          </div>
          {/* MP3 플레이어 영역 (기존 UI 유지) */}
          <div className="bible-memo-player">
            <button
              type="button"
              className={`bible-memo-player-button play-pause ${isPlaying ? 'playing' : ''}`}
              onClick={handlePlayPause}
              title={isPlaying ? '일시정지' : '재생'}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <rect x="6" y="4" width="2" height="10" rx="1" />
                  <rect x="10" y="4" width="2" height="10" rx="1" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                  <path d="M6 4l7 5-7 5V4z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="bible-memo-player-button stop"
              onClick={handleStop}
              title="정지"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <rect x="5" y="5" width="8" height="8" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              className={`bible-memo-player-button repeat ${repeatMode}`}
              onClick={handleToggleRepeat}
              title={
                repeatMode === 'all'
                  ? '전체 반복(A)'
                  : repeatMode === 'single'
                  ? '한 구절 반복(1)'
                  : '반복 끄기'
              }
            >
              <span className="bible-memo-repeat-text">
                {repeatMode === 'all' ? 'A' : repeatMode === 'single' ? '1' : 'A'}
              </span>
            </button>
            {/* 찬송가 기능 개발 중 - 임시 주석처리 */}
            {/* {onOpenHymn && (
              <button
                type="button"
                className="bible-memo-player-button hymn"
                onClick={onOpenHymn}
                title="찬송가"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </button>
            )} */}
          </div>
          <audio ref={audioRef} onEnded={handleEnded} className="bible-memo-audio" />
        </div>

        <div className="bible-memo-tabs">
          <TabButton tabKey="lastWeek" />
          <TabButton tabKey="thisWeek" />
          <TabButton tabKey="nextWeek" />
        </div>

        {renderContent()}
      </section>
      {isFullscreen && (
        <div
          className="bible-memo-fullscreen-overlay"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="bible-memo-fullscreen-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="bible-memo-fullscreen-close"
              onClick={() => setIsFullscreen(false)}
              aria-label="성구암송 전체 화면 닫기"
            >
              ✕
            </button>
            <section className="bible-memo-section bible-memo-section-fullscreen">
              <div className="bible-memo-tabs">
                <div className="bible-memo-tabs-container">
                  <TabButton tabKey="lastWeek" />
                  <TabButton tabKey="thisWeek" />
                  <TabButton tabKey="nextWeek" />
                </div>
              </div>
              {renderContent()}
            </section>
          </div>
        </div>
      )}
    </>
  );
};

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAgentScreen, setShowAgentScreen] = useState(false);
  const [password, setPassword] = useState('');
  const [agentQuestion, setAgentQuestion] = useState('');
  const [agentAnswer, setAgentAnswer] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [availableNames, setAvailableNames] = useState([]);
  const [passwordError, setPasswordError] = useState('');
  const [showNoChangesModal, setShowNoChangesModal] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHymnModule, setShowHymnModule] = useState(false);

  // 캐시 관리 (localStorage + 메모리 캐시)
  const BIBLE_READING_CACHE_DURATION = 24 * 60 * 60 * 1000; // 하루 (24시간)
  const MEMO_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 일주일 (7일)
  const CACHE_KEYS = {
    RANKINGS: 'wordLife_rankings_cache',
    RANKINGS_TIMESTAMP: 'wordLife_rankings_timestamp',
    DATE_DATA: 'wordLife_dateData_cache',
    BIBLE_MEMO: 'bibleMemo_cache'
  };

  // 현재 주의 일요일 날짜 구하기 (YYYY-MM-DD 형식)
  const getCurrentWeekSunday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = 일요일
    const diff = dayOfWeek; // 일요일까지의 일수
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - diff);
    sunday.setHours(0, 0, 0, 0);
    return sunday.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const cacheRef = React.useRef({
    rankings: null,
    rankingsTimestamp: null,
    dateData: new Map() // 날짜별 데이터 캐시
  });

  // localStorage에서 캐시 불러오기 (앱 시작 시)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // 순위 캐시 불러오기
      const rankingsCache = localStorage.getItem(CACHE_KEYS.RANKINGS);
      const rankingsTimestamp = localStorage.getItem(CACHE_KEYS.RANKINGS_TIMESTAMP);
      
      if (rankingsCache && rankingsTimestamp) {
        const timestamp = parseInt(rankingsTimestamp);
        const now = Date.now();
        // 순위 캐시도 하루 동안 유지
        if (now - timestamp < BIBLE_READING_CACHE_DURATION) {
          cacheRef.current.rankings = JSON.parse(rankingsCache);
          cacheRef.current.rankingsTimestamp = timestamp;
        } else {
          // 만료된 캐시 삭제
          localStorage.removeItem(CACHE_KEYS.RANKINGS);
          localStorage.removeItem(CACHE_KEYS.RANKINGS_TIMESTAMP);
        }
      }


      // 날짜별 데이터 캐시 불러오기
      const dateDataCache = localStorage.getItem(CACHE_KEYS.DATE_DATA);
      if (dateDataCache) {
        const parsed = JSON.parse(dateDataCache);
        const now = Date.now();
        const validCache = {};
        
        // 만료된 캐시 제거 (성경읽기 데이터는 하루 동안 유지)
        Object.keys(parsed).forEach(key => {
          if (parsed[key].timestamp && (now - parsed[key].timestamp) < BIBLE_READING_CACHE_DURATION) {
            validCache[key] = parsed[key];
          }
        });
        
        // 유효한 캐시만 Map에 저장
        Object.keys(validCache).forEach(key => {
          cacheRef.current.dateData.set(key, validCache[key]);
        });
        
        // 유효한 캐시를 다시 저장
        if (Object.keys(validCache).length !== Object.keys(parsed).length) {
          localStorage.setItem(CACHE_KEYS.DATE_DATA, JSON.stringify(validCache));
        }
      }
    } catch (error) {
      console.error('캐시 불러오기 오류:', error);
    }
  }, []);

  // 날짜 포맷팅 함수
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return { formatted: `${year}년 ${month}월 ${day}일`, dayOfWeek };
  };

  // 날짜 변경 시 데이터 불러오기 (캐시 적용)
  const loadDateData = async (dateString) => {
    if (!district || !name || !dateString) return;
    
    const trimmedName = name.trim();
    const cacheKey = `${dateString}_${district}_${trimmedName}`;
    
    // 캐시 확인 (하루 동안 유지)
    const cached = cacheRef.current.dateData.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < BIBLE_READING_CACHE_DURATION) {
      // 캐시된 데이터 사용
      if (cached.data) {
        setBibleReading(cached.data.bibleReading ? String(cached.data.bibleReading) : '');
        setSundayAttendance(cached.data.sundayAttendance || '');
        setWednesdayAttendance(cached.data.wednesdayAttendance || '');
      } else {
        setBibleReading('');
        setSundayAttendance('');
        setWednesdayAttendance('');
      }
      return;
    }
    
    try {
      const existingQuery = query(
        collection(db, 'wordLife'),
        where('date', '==', dateString),
        where('district', '==', parseInt(district)),
        where('name', '==', trimmedName)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      let latestData = null;
      if (!existingSnapshot.empty) {
        // 최신 데이터 찾기
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
      
      // 캐시에 저장 (메모리 + localStorage)
      const cacheData = {
        data: latestData,
        timestamp: Date.now()
      };
      cacheRef.current.dateData.set(cacheKey, cacheData);
      
      // localStorage에 저장
      try {
        const dateDataCache = localStorage.getItem(CACHE_KEYS.DATE_DATA);
        const dateData = dateDataCache ? JSON.parse(dateDataCache) : {};
        dateData[cacheKey] = cacheData;
        localStorage.setItem(CACHE_KEYS.DATE_DATA, JSON.stringify(dateData));
      } catch (error) {
        console.error('캐시 저장 오류:', error);
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
    if (isSaving) return;
    if (!district || !name) {
      alert('구역과 이름을 입력해주세요.');
      return;
    }
    setShowConfirmModal(true);
  };

  // 확인 모달에서 확인 클릭
  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setIsSaving(true);
    
    const dateString = selectedDate;
    // 이름에서 공백 제거
    const trimmedName = name.trim();
    
    const newData = {
      date: dateString,
      district: parseInt(district),
      name: trimmedName,
      bibleReading: bibleReading ? parseInt(bibleReading) : 0,
      sundayAttendance: sundayAttendance || '',
      wednesdayAttendance: wednesdayAttendance || '',
      timestamp: new Date()
    };

    try {
      // localStorage에 저장
      localStorage.setItem('savedDistrict', district);
      localStorage.setItem('savedName', trimmedName);

      // 같은 날짜+구역+이름의 모든 문서 찾기 (중복 데이터 정리)
      const existingQuery = query(
        collection(db, 'wordLife'),
        where('date', '==', dateString),
        where('district', '==', parseInt(district)),
        where('name', '==', trimmedName)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      let hasChanges = false;
      let existingDocId = null;
      let existingData = null;
      let latestExistingDoc = null;
      let latestExistingTimestamp = null;

      // 같은 날짜+구역+이름의 모든 문서 중 최신 timestamp 찾기
      if (!existingSnapshot.empty) {
        existingSnapshot.docs.forEach(docSnapshot => {
          const docData = docSnapshot.data();
          const docTimestamp = docData.timestamp?.toDate ? docData.timestamp.toDate() : new Date(docData.timestamp);
          
          if (!latestExistingTimestamp || docTimestamp > latestExistingTimestamp) {
            latestExistingTimestamp = docTimestamp;
            latestExistingDoc = docSnapshot;
            existingDocId = docSnapshot.id;
            existingData = docData;
          }
        });
        
        // 최신 문서가 아닌 중복 문서들 삭제 (같은 날짜의 중복만 제거)
        const duplicateDocsToDelete = [];
        existingSnapshot.docs.forEach(docSnapshot => {
          if (docSnapshot.id !== existingDocId) {
            duplicateDocsToDelete.push(docSnapshot.id);
          }
        });
        
        // 중복 문서들 삭제
        for (const docIdToDelete of duplicateDocsToDelete) {
          try {
            await deleteDoc(doc(db, 'wordLife', docIdToDelete));
          } catch (deleteError) {
            console.error('중복 문서 삭제 오류:', deleteError);
          }
        }
        
        // 변경 내용 확인 (최신 문서 기준)
        if (existingData) {
          if (
            existingData.bibleReading !== newData.bibleReading ||
            existingData.sundayAttendance !== newData.sundayAttendance ||
            existingData.wednesdayAttendance !== newData.wednesdayAttendance
          ) {
            hasChanges = true;
          }
        }
      } else {
        // 새 문서인 경우 변경 있음
        hasChanges = newData.bibleReading > 0 || newData.sundayAttendance || newData.wednesdayAttendance;
      }

      if (!hasChanges) {
        // 변경 내용이 없음
        await calculateRankings();
        setShowNoChangesModal(true);
        // 모달 확인 후 순위 화면으로 이동하도록 처리
        return;
      }

      // 문서 ID 생성 (날짜-구역-이름 조합)
      const docId = `${dateString}_${district}_${trimmedName}`;
      
      // 기존 문서가 있으면 업데이트, 없으면 새로 생성
      await setDoc(doc(db, 'wordLife', docId), newData);
      
      // 저장 후 관련 캐시 무효화
      const cacheKey = `${dateString}_${district}_${trimmedName}`;
      cacheRef.current.dateData.delete(cacheKey);
      
      // localStorage에서도 삭제
      try {
        const dateDataCache = localStorage.getItem(CACHE_KEYS.DATE_DATA);
        if (dateDataCache) {
          const dateData = JSON.parse(dateDataCache);
          delete dateData[cacheKey];
          localStorage.setItem(CACHE_KEYS.DATE_DATA, JSON.stringify(dateData));
        }
      } catch (error) {
        console.error('캐시 삭제 오류:', error);
      }
      
      // 순위 캐시도 무효화
      cacheRef.current.rankings = null;
      cacheRef.current.rankingsTimestamp = null;
      try {
        localStorage.removeItem(CACHE_KEYS.RANKINGS);
        localStorage.removeItem(CACHE_KEYS.RANKINGS_TIMESTAMP);
      } catch (error) {
        console.error('순위 캐시 삭제 오류:', error);
      }
      
      // 순위 계산 및 표시
      try {
        await calculateRankings();
        setShowSaveSuccessModal(true);
        // 모달 확인 후 순위 화면으로 이동하도록 처리
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
    } finally {
      setIsSaving(false);
    }
  };

  // 순위 계산 (캐시 적용)
  const calculateRankings = async () => {
    // 캐시 확인 (1분 이내 캐시가 있으면 재사용)
    const now = Date.now();
    if (
      cacheRef.current.rankings &&
      cacheRef.current.rankingsTimestamp &&
      (now - cacheRef.current.rankingsTimestamp) < BIBLE_READING_CACHE_DURATION
    ) {
      setRankings(cacheRef.current.rankings);
      return;
    }

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

      const rankingsData = {
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
      };

      // 캐시에 저장 (메모리 + localStorage)
      const timestamp = Date.now();
      cacheRef.current.rankings = rankingsData;
      cacheRef.current.rankingsTimestamp = timestamp;
      
      // localStorage에 저장
      try {
        localStorage.setItem(CACHE_KEYS.RANKINGS, JSON.stringify(rankingsData));
        localStorage.setItem(CACHE_KEYS.RANKINGS_TIMESTAMP, timestamp.toString());
      } catch (error) {
        console.error('순위 캐시 저장 오류:', error);
      }

      setRankings(rankingsData);
    } catch (error) {
      console.error('순위 계산 중 오류 발생:', error);
      alert('순위 계산 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // 순위 화면에서 뒤로가기
  const handleBackToForm = async () => {
    setShowRanking(false);
    setShowNoChangesModal(false); // 모달 상태 초기화
    setShowSaveSuccessModal(false); // 저장 성공 모달 상태 초기화
    
    // 현재 날짜/구역/이름의 최신 데이터 불러오기
    if (district && name && selectedDate) {
      await loadDateData(selectedDate);
    }
  };

  // 타이틀 클릭 핸들러
  const handleTitleClick = async () => {
    setShowPasswordModal(true);
    setPassword('');
    setPasswordError('');
    // 이름 목록 미리 로드 (패스워드 검증용)
    try {
      const names = await fetchAllNames();
      setAvailableNames(names);
    } catch (error) {
      console.error('이름 목록 로드 오류:', error);
    }
  };

  // 패스워드 검증 및 Agent 화면 진입
  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setPasswordError('패스워드를 입력해주세요.');
      return;
    }

    // DB에 등록된 이름인지 확인 (패스워드로 사용)
    if (!availableNames.includes(password.trim())) {
      setPasswordError('패스워드가 틀립니다.');
      // 2초 후 모달 닫기
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassword('');
        setPasswordError('');
      }, 2000);
      return;
    }

    // 패스워드가 DB에 등록된 이름이면 Agent 화면으로 이동
    setPasswordError('');
    setShowPasswordModal(false);
    setShowAgentScreen(true);
    setPassword(''); // 보안을 위해 패스워드 초기화
  };

  // Agent 질문 처리
  const handleAgentQuery = async () => {
    if (!agentQuestion.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }

    setAgentLoading(true);
    setAgentAnswer('');

    try {
      // 전체 데이터 조회 (userName을 null로 전달, limitCount 제거하여 모든 데이터 조회)
      const result = await queryGeminiAgent(agentQuestion, null, {});
      setAgentAnswer(result.answer);
    } catch (error) {
      console.error('Gemini Agent 오류:', error);
      let errorMessage = '질문 처리 중 오류가 발생했습니다.\n\n';
      
      if (error.message.includes('API 키')) {
        errorMessage += 'Gemini API 키가 설정되지 않았습니다.\n';
        errorMessage += '환경 변수 VITE_GEMINI_API_KEY를 설정해주세요.';
      } else {
        errorMessage += error.message || '알 수 없는 오류가 발생했습니다.';
      }
      
      alert(errorMessage);
      setAgentAnswer('');
    } finally {
      setAgentLoading(false);
    }
  };

  // Agent 화면에서 뒤로가기
  const handleBackFromAgent = () => {
    setShowAgentScreen(false);
    setAgentQuestion('');
    setAgentAnswer('');
    setPasswordError('');
  };

  // Agent 화면
  if (showAgentScreen) {
    return (
      <div className="container">
        <h1>🤖 AI 데이터 분석</h1>
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <div style={{ color: '#4caf50', fontSize: '16px', fontWeight: 'bold' }}>
            ✓ 전체 데이터 조회 가능합니다
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>질문</label>
          <textarea
            value={agentQuestion}
            onChange={(e) => setAgentQuestion(e.target.value)}
            placeholder="예: 내 성경읽기 총합은? / 42구역의 통계는? / 가장 많이 읽은 사람은?"
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '16px',
              resize: 'vertical'
            }}
            disabled={agentLoading}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={handleAgentQuery}
            disabled={agentLoading || !agentQuestion.trim()}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: agentLoading || !agentQuestion.trim() ? '#ccc' : '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: agentLoading || !agentQuestion.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {agentLoading ? '분석 중...' : '질문하기'}
          </button>
        </div>

        {agentAnswer && (
          <div style={{
            padding: '20px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
            minHeight: '200px',
            maxHeight: '500px',
            overflow: 'auto'
          }}>
            <strong style={{ display: 'block', marginBottom: '10px', fontSize: '18px' }}>답변:</strong>
            <div>{agentAnswer}</div>
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <button
            onClick={handleBackFromAgent}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            뒤로가기
          </button>
        </div>
      </div>
    );
  }

  if (showRanking && rankings) {
    return (
      <div className="container">
        <h1 style={{ cursor: 'pointer' }} onClick={handleTitleClick}>매탄교구 말씀생활</h1>
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
      <h1 style={{ cursor: 'pointer' }} onClick={handleTitleClick}>매탄교구 말씀생활</h1>
      <div className="form-section">
        <table className="info-table">
          <tbody>
            <tr>
              <td>일자</td>
              <td>
                <div className="date-input-wrapper">
                  <span className="date-display">
                    {currentDate} ({currentDayOfWeek})
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
                <button
                  className="save-button"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '저장'}
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
              <p><strong>일자:</strong> {currentDate} ({currentDayOfWeek})</p>
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
              <button
                className="confirm-button"
                onClick={handleConfirmSave}
                disabled={isSaving}
              >
                {isSaving ? '저장 중...' : '확인'}
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSaving}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>🔐 패스워드 입력</h3>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
                placeholder="패스워드를 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: passwordError ? '2px solid #f44336' : '1px solid #ddd',
                  fontSize: '16px'
                }}
                autoFocus
              />
              {passwordError && (
                <div style={{ color: '#f44336', fontSize: '14px', marginTop: '5px' }}>{passwordError}</div>
              )}
            </div>
            <div className="modal-buttons">
              <button className="confirm-button" onClick={handlePasswordSubmit}>
                확인
              </button>
              <button className="cancel-button" onClick={() => {
                setShowPasswordModal(false);
                setPassword('');
                setPasswordError('');
              }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoChangesModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>말씀생활 알림</h3>
            <div style={{ marginBottom: '20px', padding: '20px 0' }}>
              <p style={{ fontSize: '16px', textAlign: 'center' }}>변경내용이 없습니다.</p>
            </div>
            <div className="modal-buttons">
              <button className="confirm-button" onClick={() => {
                setShowNoChangesModal(false);
                setShowRanking(true);
              }} style={{ width: '100%' }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveSuccessModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content">
            <h3>말씀생활 알림</h3>
            <div style={{ marginBottom: '20px', padding: '20px 0' }}>
              <p style={{ fontSize: '16px', textAlign: 'center' }}>데이터가 성공적으로 저장되었습니다!</p>
            </div>
            <div className="modal-buttons">
              <button className="confirm-button" onClick={() => {
                setShowSaveSuccessModal(false);
                setShowRanking(true);
              }} style={{ width: '100%' }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 저장 버튼 아래에 성구암송 섹션 표시 */}
      <BibleMemoSection 
        selectedDate={selectedDate} 
        onOpenHymn={() => setShowHymnModule(true)}
      />
      
      {/* 찬송가 모듈 */}
      {showHymnModule && (
        <HymnModule onClose={() => setShowHymnModule(false)} />
      )}
    </div>
  );
}

export default App;

