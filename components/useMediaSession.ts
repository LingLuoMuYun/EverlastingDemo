"use client";

import { useEffect, useRef } from "react";
import type { Song } from "./MusicProvider";

interface MediaSessionHandlers {
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekTo: (time: number) => void;
  onStop: () => void;
}

interface MediaSessionMeta {
  currentSong: Song | undefined;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

/**
 * 把播放状态同步到系统媒体控制（锁屏/通知栏/系统媒体键）：
 * - 元数据与封面；播放/暂停/切歌/快进快退/跳转/停止动作
 * - playbackState 与 setPositionState 进度同步
 * - 部分浏览器对个别 action 抛 TypeError，逐个 try/catch 忽略
 */
export function useMediaSession(handlers: MediaSessionHandlers, meta: MediaSessionMeta) {
  const handlersRef = useRef(handlers);
  const metaRef = useRef(meta);

  useEffect(() => {
    handlersRef.current = handlers;
    metaRef.current = meta;
  });

  // 动作处理器只注册一次，通过 ref 读取最新回调
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const safe = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* 该动作不支持则忽略 */
      }
    };

    safe("play", () => handlersRef.current.onTogglePlay());
    safe("pause", () => handlersRef.current.onTogglePlay());
    safe("nexttrack", () => handlersRef.current.onNext());
    safe("previoustrack", () => handlersRef.current.onPrev());
    safe("seekbackward", () => handlersRef.current.onSeekTo(metaRef.current.currentTime - 10));
    safe("seekforward", () => handlersRef.current.onSeekTo(metaRef.current.currentTime + 10));
    safe("seekto", (d) => {
      if (typeof d.seekTime === "number") handlersRef.current.onSeekTo(d.seekTime);
    });
    safe("stop", () => handlersRef.current.onStop());

    return () => {
      (["play", "pause", "nexttrack", "previoustrack", "seekbackward", "seekforward", "seekto", "stop"] as MediaSessionAction[]).forEach(
        (action) => safe(action, null)
      );
    };
  }, []);

  // 元数据（封面/标题/歌手/专辑）
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    const song = meta.currentSong;
    if (!song) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album || "",
        artwork: song.cover ? [{ src: song.cover, sizes: "512x512", type: "image/jpeg" }] : [],
      });
    } catch {
      /* 忽略 */
    }
  }, [meta.currentSong]);

  // 播放状态与进度
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.playbackState = meta.isPlaying ? "playing" : "paused";
      if (meta.duration > 0 && "setPositionState" in ms) {
        ms.setPositionState({
          duration: meta.duration,
          playbackRate: 1,
          position: Math.min(meta.currentTime, meta.duration),
        });
      }
    } catch {
      /* 忽略 */
    }
  }, [meta.isPlaying, meta.currentTime, meta.duration]);
}
