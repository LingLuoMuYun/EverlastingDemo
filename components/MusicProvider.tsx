"use client";

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useToast } from './ToastProvider';
import { useMediaSession } from './useMediaSession';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

type MusicDebugHandle = Record<string, unknown>;

declare global {
  interface Window {
    __musicDebug?: MusicDebugHandle;
  }
}

// 【状态持久化】音量 / 静音 / 播放模式记忆到 localStorage
const STORAGE_KEYS = {
  volume: 'everlasting-music-volume',
  muted: 'everlasting-music-muted',
  playMode: 'everlasting-music-playmode',
  queueState: 'everlasting-music-state',
} as const;

export interface LyricLine {
  time: number;
  text: string;
}

export interface Song {
  id: string | number;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrcUrl: string | null;
  lyrics: LyricLine[] | string;
  album?: string;
  name?: string;
  author?: string;
  pic?: string;
  lrc?: string;
  lyric?: string;
  error?: boolean;
}

interface RawSong {
  id?: string | number;
  title?: string;
  name?: string;
  artist?: string;
  author?: string;
  cover?: string;
  pic?: string;
  url?: string;
  src?: string;
  lrc?: string;
  lyrics?: { lrc?: string; tlyric?: string; yrc?: string | null };
  error?: boolean;
}

function readStored(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式等场景下写入失败不影响播放 */
  }
}

// 【增强版 LRC 歌词解析】
function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText || lrcText.length > 30000) return [];

  const lines = lrcText.split(/\r?\n/);
  const result: LyricLine[] = [];

  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (matches.length > 0) {
      const text = line.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();

      // 剔除控制字符
      const cleanText = text.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "");

      if (cleanText) {
        for (const match of matches) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = match[3] ? parseInt(match[3]) : 0;
          const divisor = match[3] && match[3].length === 3 ? 1000 : 100;
          const time = min * 60 + sec + ms / divisor;
          result.push({ time, text: cleanText });
        }
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

// 🌟 1. 扩充 Context 类型，加入 MusicPage 需要的所有属性
type PlayMode = 'loop' | 'single' | 'random' | 'order';

interface MusicContextType {
  playlist: Song[];
  currentIndex: number;
  currentSong: Song | undefined; // 扩展了 lyrics 属性
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  buffered: number;
  currentLyric: string;
  isLoading: boolean;
  isWaiting: boolean;
  volumeSupported: boolean;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;

  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  playSong: (index: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("正在连接高可用神经云端...");
  const [isLoading, setIsLoading] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [volumeSupported, setVolumeSupported] = useState(true);

  // 🌟 2. 新增音量和播放模式状态（从 localStorage 恢复）
  const [volume, setVolumeState] = useState<number>(() => {
    const stored = Number(readStored(STORAGE_KEYS.volume));
    return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => readStored(STORAGE_KEYS.muted) === '1');
  const [playMode, setPlayMode] = useState<PlayMode>(() => {
    const stored = readStored(STORAGE_KEYS.playMode);
    return stored === 'single' || stored === 'random' || stored === 'order' ? stored : 'loop';
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const failCountRef = useRef<Record<string, number>>({});
  const errorHandledRef = useRef(false);
  const consecutiveFailRef = useRef(0);
  const restoreRef = useRef<number | null>(null);
  const volumeSupportedRef = useRef(true);

  useEffect(() => {
    volumeSupportedRef.current = volumeSupported;
  }, [volumeSupported]);

  // 🌟 开发模式调试句柄：DevTools 里直接查看播放器内部状态（音量/缓冲/错误/Media Session）
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const dbg: MusicDebugHandle = {
      get audio() {
        return audioRef.current;
      },
      get volume() {
        return audioRef.current?.volume ?? null;
      },
      get muted() {
        return audioRef.current?.muted ?? null;
      },
      get playbackRate() {
        return audioRef.current?.playbackRate ?? null;
      },
      get readyState() {
        return audioRef.current?.readyState ?? null;
      },
      get networkState() {
        return audioRef.current?.networkState ?? null;
      },
      get currentTime() {
        return audioRef.current?.currentTime ?? 0;
      },
      get duration() {
        return audioRef.current?.duration || 0;
      },
      get bufferedSeconds() {
        const el = audioRef.current;
        if (!el || el.buffered.length === 0) return 0;
        return el.buffered.end(el.buffered.length - 1);
      },
      get error() {
        return audioRef.current?.error ?? null;
      },
      get mediaSession() {
        return typeof navigator !== "undefined" && "mediaSession" in navigator ? "supported" : "unsupported";
      },
      get playbackState() {
        if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return "n/a";
        return navigator.mediaSession.playbackState;
      },
    };
    window.__musicDebug = dbg;
    return () => {
      delete window.__musicDebug;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const toSongs = (raw: RawSong[]): Song[] =>
      raw
        .filter((song): song is RawSong => Boolean(song && (song.src || song.url) && !song.error))
        .map((song) => ({
          id: song.id || Math.random().toString(),
          title: song.title || song.name || '未知歌曲',
          artist: song.artist || song.author || '未知歌手',
          cover: song.cover || song.pic || 'https://bu.dusays.com/2026/03/24/69c24230a5ff8.jpg',
          src: song.src || song.url || '',
          lrcUrl: null,
          lyrics: song.lyrics?.lrc ? parseLrc(song.lyrics.lrc) : []
        }));

    const applyPlaylist = (songs: Song[]) => {
      if (!isMounted) return;
      if (songs.length > 0) {
        // 尝试恢复上次播放位置（曲库 id 顺序一致才恢复，曲库改过则丢弃）
        try {
          const stored = JSON.parse(readStored(STORAGE_KEYS.queueState) || "null") as {
            playlistIds?: string[];
            index?: number;
            currentTime?: number;
          } | null;
          if (
            stored &&
            Array.isArray(stored.playlistIds) &&
            stored.playlistIds.length === songs.length &&
            stored.playlistIds.every((id, i) => id === String(songs[i].id))
          ) {
            const idx = Math.min(Math.max(0, Number(stored.index) || 0), songs.length - 1);
            setCurrentIndex(idx);
            const storedTime = Number(stored.currentTime);
            if (Number.isFinite(storedTime) && storedTime > 0.5) {
              restoreRef.current = storedTime;
            }
          }
        } catch {
          /* 恢复失败不影响播放 */
        }
        setPlaylist(songs);
      } else {
        setCurrentLyric("正在为你寻找绝世好歌");
      }
      setIsLoading(false);
    };

    const fetchMusicData = async () => {
      try {
        const res = await fetch(`/api/music/library`);
        if (!res.ok) throw new Error(`library ${res.status}`);
        const data = (await res.json()) as { tracks: RawSong[] };
        applyPlaylist(toSongs(data.tracks));
      } catch {
        if (isMounted) { setCurrentLyric("网络初始化失败"); setIsLoading(false); }
      }
    };

    fetchMusicData();
    return () => { isMounted = false; };
  }, []);

  // 🌟 4. 同步音量和静音到 audio 元素（volume 保留"记忆音量"，静音走 muted 属性）
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = volume;
    }
  }, [volume, isMuted]);

  // 🌟 状态持久化：音量 / 静音 / 播放模式
  useEffect(() => {
    // 保留两位小数，避免浮点误差累积
    writeStored(STORAGE_KEYS.volume, String(Math.round(volume * 100) / 100));
  }, [volume]);

  useEffect(() => {
    writeStored(STORAGE_KEYS.muted, isMuted ? '1' : '0');
  }, [isMuted]);

  useEffect(() => {
    writeStored(STORAGE_KEYS.playMode, playMode);
  }, [playMode]);

  // 🌟 播放队列持久化：刷新后恢复 index 与进度（2s 防抖）
  useEffect(() => {
    if (playlist.length === 0) return;
    const timer = setTimeout(() => {
      writeStored(
        STORAGE_KEYS.queueState,
        JSON.stringify({
          playlistIds: playlist.map((s) => String(s.id)),
          index: currentIndex,
          currentTime,
          updatedAt: Date.now(),
        })
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [playlist, currentIndex, currentTime]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(!isPlaying);
    }
  };

  // 🌟 5. 重写 nextSong，加入对随机模式的处理
  const nextSong = () => {
    if (playMode === 'random' && playlist.length > 1) {
      const next = Math.floor(Math.random() * playlist.length);
      setCurrentIndex(next === currentIndex ? (next + 1) % playlist.length : next);
    } else if (playMode === 'order') {
      setCurrentIndex((prev) => (prev + 1 < playlist.length ? prev + 1 : prev));
    } else {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
    }
  };

  const prevSong = () => {
    if (playMode === 'random' && playlist.length > 1) {
      const next = Math.floor(Math.random() * playlist.length);
      setCurrentIndex(next === currentIndex ? (next - 1 + playlist.length) % playlist.length : next);
    } else if (playMode === 'order') {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    } else {
      setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    }
  };

  // 🌟 6. 暴露直接播放指定歌曲的方法
  const playSong = (index: number) => {
    setCurrentIndex(index);
    if (!isPlaying) setIsPlaying(true); // 保证切歌后自动播放
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const el = audioRef.current;
      const { currentTime, duration } = el;
      setCurrentTime(currentTime);
      setDuration(duration || 0);
      setProgress((currentTime / (duration || 1)) * 100);
      if (el.buffered.length > 0) {
        const end = el.buffered.end(el.buffered.length - 1);
        setBuffered(duration ? Math.min(100, (end / duration) * 100) : 0);
      }

      if (lyrics.length > 0) {
        const activeLyric = lyrics.slice().reverse().find(l => currentTime >= l.time);
        if (activeLyric && activeLyric.text !== currentLyric) {
          setCurrentLyric(activeLyric.text);
        }
      }
    }
  };

  // 🌟 7. 处理歌曲结束
  const handleEnded = () => {
    if (playMode === 'single' && audioRef.current) {
       audioRef.current.currentTime = 0;
       audioRef.current.play().catch(() => handleError());
    } else if (playMode === 'order' && currentIndex >= playlist.length - 1) {
       setIsPlaying(false); // 顺序播完即停
    } else {
       nextSong();
    }
  };

  const handleLoadedMetadata = () => {
    handleTimeUpdate();
    if (audioRef.current && restoreRef.current !== null) {
      const target = restoreRef.current;
      restoreRef.current = null;
      const duration = audioRef.current.duration || 0;
      if (duration === 0 || target < duration) {
        try {
          audioRef.current.currentTime = target;
        } catch {
          /* 忽略 */
        }
      }
    }
  };

  // 🌟 8. 播放失败兜底：连续失败上限 3 次，否则自动跳歌并提示
  const handleError = () => {
    // play() 被拒与 error 事件可能双触发，同一首歌只处理一次
    if (errorHandledRef.current) return;
    errorHandledRef.current = true;
    if (!currentSong) return;
    const id = String(currentSong.id);
    const count = (failCountRef.current[id] || 0) + 1;
    failCountRef.current[id] = count;
    if (count >= 3) {
      setIsPlaying(false);
      setCurrentLyric("这首歌暂时无法播放，已停止自动跳转");
      showToast("这首歌暂时无法播放，已停止自动跳转", "error");
      return;
    }
    // 歌单里坏歌过多时防止无限跳歌
    consecutiveFailRef.current += 1;
    if (consecutiveFailRef.current >= 8) {
      setIsPlaying(false);
      setCurrentLyric("连续多首无法播放，已停止自动跳转");
      showToast("连续多首无法播放，已停止自动跳转", "error");
      return;
    }
    setCurrentLyric("播放失败，自动跳到下一首...");
    showToast("播放失败，已自动跳到下一首", "warning");
    setIsPlaying(true); // 保持播放态，确保跳歌后链式播放继续（坏源不再打断整条自动播放）
    nextSong();
  };

  // 成功播放/可播放时清除该曲失败计数
  const handlePlaying = () => {
    setIsWaiting(false);
    errorHandledRef.current = false;
    consecutiveFailRef.current = 0;
    if (currentSong) failCountRef.current[String(currentSong.id)] = 0;
  };

  const handleWaiting = () => setIsWaiting(true);

  // 切换歌曲：重置歌词/缓冲并自动开始播放；失败交给 handleError 自动跳歌（不置 isPlaying=false）
  useEffect(() => {
    if (playlist.length === 0) return;
    let isMounted = true;
    errorHandledRef.current = false;
    const currentSong = playlist[currentIndex];
    setLyrics([]);
    setCurrentLyric("♪ 正在缓冲 ♪");
    setIsWaiting(false);
    if (Array.isArray(currentSong.lyrics) && currentSong.lyrics.length > 0) {
      if (isMounted) {
        setLyrics(currentSong.lyrics);
        setCurrentLyric(currentSong.lyrics[0]?.text || "\u266a \u7eaf\u4eab\u97f3\u4e50 \u266a");
      }
    } else if (currentSong.lrcUrl) {
      fetch(currentSong.lrcUrl)
        .then(res => res.text())
        .then(text => {
          if (isMounted) {
             const parsed = parseLrc(text);
             setLyrics(parsed);
             setPlaylist(prev => {
                const newPlaylist = [...prev];
                newPlaylist[currentIndex].lyrics = parsed;
                return newPlaylist;
             });
          }
        })
        .catch(() => { if (isMounted) setCurrentLyric("\u266a \u7eaf\u4eab\u97f3\u4e50 \u266a"); });
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => handleError());
    }
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意只依赖 currentIndex 与长度，避免 playlist 更新触发无限循环
  }, [currentIndex, playlist.length]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setProgress(newProgress);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (newProgress / 100) * audioRef.current.duration;
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.min(1, Math.max(0, val));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) setIsMuted(false);
    if (clamped === 0 && !isMuted) setIsMuted(true);
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const togglePlayMode = () => {
    setPlayMode(prev => {
      if (prev === 'loop') return 'single';
      if (prev === 'single') return 'random';
      if (prev === 'random') return 'order';
      return 'loop';
    });
  };

  const currentSong = playlist[currentIndex];

  // 🌟 预加载下一首（非随机模式），切歌更流畅
  useEffect(() => {
    if (!isPlaying || playlist.length < 2 || playMode === 'random') return;
    const nextIdx =
      playMode === 'order'
        ? currentIndex + 1 < playlist.length
          ? currentIndex + 1
          : -1
        : (currentIndex + 1) % playlist.length;
    if (nextIdx < 0) return;
    const next = playlist[nextIdx];
    if (!next || next.src === currentSong?.src) return;
    const preloadEl = new Audio();
    preloadEl.preload = "metadata";
    preloadEl.src = next.src;
    return () => {
      preloadEl.removeAttribute("src");
      preloadEl.load();
    };
  }, [isPlaying, currentIndex, playlist, playMode, currentSong?.src]);

  const seekTo = (time: number) => {
    const el = audioRef.current;
    if (!el) return;
    const duration = el.duration || 0;
    const clamped = duration > 0 ? Math.max(0, Math.min(time, duration)) : Math.max(0, time);
    try {
      el.currentTime = clamped;
    } catch {
      /* 忽略 */
    }
    setCurrentTime(clamped);
    if (duration > 0) setProgress((clamped / duration) * 100);
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  // 🌟 9. 系统媒体键（Media Session）与键盘快捷键
  useMediaSession(
    { onTogglePlay: togglePlay, onNext: nextSong, onPrev: prevSong, onSeekTo: seekTo, onStop: stopPlayback },
    { currentSong, isPlaying, currentTime, duration }
  );
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onNext: nextSong,
    onPrev: prevSong,
    onSeekBy: (delta) => seekTo(currentTime + delta),
    onVolumeBy: (delta) => setVolume(volume + delta),
    onToggleMute: toggleMute,
  });

  // 🌟 4.1 监听原生 volumechange，回写 state，防止 UI 与 audio 状态失步
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const sync = () => {
      // iOS 等平台 volume 只读（恒为 1），禁止回写覆盖用户记忆的音量
      if (!volumeSupportedRef.current) return;
      setVolumeState(Math.round(el.volume * 100) / 100);
    };
    el.addEventListener('volumechange', sync);
    return () => el.removeEventListener('volumechange', sync);
  }, [currentSong?.id]);

  // 🌟 4.2 iOS Safari 等平台禁止 JS 修改 volume，做特性检测供 UI 降级
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const prev = el.volume;
    el.volume = 0.3;
    const supported = Math.abs(el.volume - 0.3) < 0.001;
    setVolumeSupported(supported);
    el.volume = prev;
  }, [currentSong?.id]);

  return (
    <MusicContext.Provider value={{
        playlist, currentIndex, currentSong, isPlaying, progress, currentTime, duration, buffered, currentLyric, isLoading,
        isWaiting, volumeSupported,
        volume, isMuted, playMode, // 暴露新状态
        togglePlay, nextSong, prevSong, handleSeek,
        playSong, setVolume, toggleMute, togglePlayMode // 暴露新方法
    }}>
      {children}
      {currentSong && (
        <audio
          ref={audioRef}
          src={currentSong.src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded} // 使用我们重写的结束处理
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onCanPlay={handlePlaying}
          onError={handleError}
          onProgress={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />
      )}
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
};
