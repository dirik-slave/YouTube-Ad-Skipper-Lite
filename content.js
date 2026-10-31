/**
 * YouTube Ad Skipper - Lite
 * ISOLATED-world fallback.
 * Runs in the extension's isolated context. Cannot see YouTube's internal
 * player API, so it fast-forwards the ad and simulates clicks on the
 * skip button instead.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------
  // ISOLATED-WORLD FALLBACK
  // ------------------------------------------------------------------

  // Full pointer+mouse sequence so YouTube's listeners react to a synthetic click
  function simulateClick(el) {
    try {
      const opts = { bubbles: true, cancelable: true, view: window, composed: true };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      if (typeof el.click === 'function') el.click();
    } catch (e) {}
  }

  function clickSkipButtons(player) {
    const selectors = [
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-slot',
      '.ytp-ad-skip-button-container',
      '[class*="ytp-ad-skip-button"]',
      '[class*="ytp-skip-ad-button"]'
    ];

    for (const sel of selectors) {
      try {
        player.querySelectorAll(sel).forEach(simulateClick);
      } catch (e) {}
    }

    // Text-based fallback (EN + RU interface)
    try {
      player.querySelectorAll('button, div[role="button"]').forEach((el) => {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'skip' || text.includes('skip ad') || text.startsWith('пропуст')) {
          simulateClick(el);
        }
      });
    } catch (e) {}
  }

  let adActive = false;
  let rateBeforeAd = 1;

  function handleAd() {
    try {
      const player = document.querySelector('.html5-video-player');
      const video = document.querySelector('video.html5-main-video') ||
                    document.querySelector('video');
      if (!player || !video) return;

      const isAd = player.classList.contains('ad-showing') ||
                   player.classList.contains('ad-interrupting');

      if (isAd) {
        if (!adActive) {
          adActive = true;
          rateBeforeAd = video.playbackRate > 2 ? 1 : video.playbackRate;
        }

        // 16x speed + jump to the last frame => unskippable ads end almost instantly
        try { if (video.playbackRate < 16) video.playbackRate = 16; } catch (e) {}
        try {
          if (!isNaN(video.duration) && isFinite(video.duration) &&
              video.currentTime < video.duration) {
            video.currentTime = video.duration - 0.01;
          }
        } catch (e) {}

        clickSkipButtons(player);
      } else if (adActive) {
        // Ad finished: restore the user's normal playback speed
        adActive = false;
        try { if (video.playbackRate > 2) video.playbackRate = rateBeforeAd || 1; } catch (e) {}
      }
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // SCHEDULING - event-driven with light throttling (no high-frequency polling)
  // ------------------------------------------------------------------

  let lastCheck = 0;
  function scheduleAdCheck() {
    const now = Date.now();
    if (now - lastCheck < 150) return;
    lastCheck = now;
    handleAd();
  }

  let hookedVideo = null;
  function hookContentVideo() {
    if (hookedVideo && hookedVideo.isConnected) return;
    const video = document.querySelector('video.html5-main-video') ||
                  document.querySelector('video');
    if (video && video !== hookedVideo) {
      hookedVideo = video;
      ['timeupdate', 'play', 'pause', 'ended', 'loadeddata', 'emptied', 'durationchange']
        .forEach((evt) => {
          try { video.addEventListener(evt, scheduleAdCheck); } catch (e) {}
        });
    }
  }

  function init() {
    hookContentVideo();
    setInterval(hookContentVideo, 2000);

    // DOM mutations (SPA navigation, ad overlays) -> throttled check
    const observer = new MutationObserver(scheduleAdCheck);
    const startObserver = () => observer.observe(document.body, { childList: true, subtree: true });
    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver);

    // Low-frequency safety net
    setInterval(scheduleAdCheck, 1000);
  }

  init();
})();
