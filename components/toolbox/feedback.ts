/** 番茄钟结束反馈：提示音 / 标题闪烁 / 系统通知（失败一律静默） */

export function playFinishSound(enable: boolean) {
  if (!enable) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    [0, 0.28, 0.56].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    });
  } catch {
    // 音效失败静默
  }
}

export function flashTitle(text: string) {
  try {
    const original = document.title;
    document.title = text;
    window.setTimeout(() => {
      document.title = original;
    }, 5000);
  } catch {
    // 静默
  }
}

export function maybeNotify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // 静默
  }
}
