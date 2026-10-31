/**
 * YouTube Ad Skipper - Lite
 * MAIN-world engine.
 * Runs in the page context so it can call YouTube's internal player API
 * (#movie_player.skipAd) which is not visible from content scripts.
 *
 * Executed by the browser directly (declarative "world": "MAIN"),
 * so it is NOT blocked by YouTube's CSP.
 */
(function () {
  'use strict';

  let lastAttempt = 0;

  function skipNow() {
    try {
      const player = document.getElementById('movie_player') ||
                     document.querySelector('.html5-video-player');
      if (!player) return;

      // Act ONLY while an ad is actually on screen (cheap class check)
      if (!player.classList.contains('ad-showing') &&
          !player.classList.contains('ad-interrupting')) return;

      // Throttle skip attempts to at most one per 150ms
      const now = Date.now();
      if (now - lastAttempt < 150) return;
      lastAttempt = now;

      // a) YouTube's native skip API
      if (typeof player.skipAd === 'function') {
        try { player.skipAd(); } catch (e) {}
      }

      // b) Fallback: click the skip button inside the ad module
      const adModule = player.querySelector('.ytp-ad-module');
      if (adModule) {
        const btn = adModule.querySelector(
          '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot'
        );
        if (btn && typeof btn.click === 'function') {
          try { btn.click(); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // Media events fire only while the video is actually playing
  function hookVideo() {
    const video = document.querySelector('video.html5-main-video') ||
                  document.querySelector('video');
    if (video && !video.__ytAdSkipperPageHooked) {
      try {
        video.__ytAdSkipperPageHooked = true;
        video.addEventListener('timeupdate', skipNow);
        video.addEventListener('play', skipNow);
        video.addEventListener('durationchange', skipNow);
      } catch (e) {}
    }
  }

  hookVideo();
  setInterval(hookVideo, 2000);  // re-hook if the <video> element is replaced
  setInterval(skipNow, 1000);    // slow safety net
})();
