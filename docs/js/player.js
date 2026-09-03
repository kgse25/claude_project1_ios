// Обёртка над официальным YouTube IFrame Player API.

const YouTubePlayer = (() => {
  let apiReadyPromise = null;

  function loadAPI() {
    if (window.YT && window.YT.Player) {
      return Promise.resolve();
    }
    if (apiReadyPromise) return apiReadyPromise;

    apiReadyPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previous === "function") previous();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });

    return apiReadyPromise;
  }

  let currentPlayer = null;
  let tickTimer = null;

  function stopTicking() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function startTicking(player, onTimeUpdate) {
    stopTicking();
    tickTimer = setInterval(() => {
      if (player && typeof player.getCurrentTime === "function" && onTimeUpdate) {
        onTimeUpdate(player.getCurrentTime());
      }
    }, 4000);
  }

  /**
   * Создаёт плеер внутри элемента с id === elementId (элемент должен существовать
   * в DOM и быть пустым — YT.Player сам заменит его на <iframe>).
   */
  async function create(elementId, videoId, startSeconds, { onEnded, onTimeUpdate, onError } = {}) {
    await loadAPI();
    destroy();

    currentPlayer = new YT.Player(elementId, {
      videoId: videoId,
      playerVars: {
        start: Math.max(0, Math.floor(startSeconds || 0)),
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onStateChange(e) {
          if (e.data === YT.PlayerState.PLAYING) {
            startTicking(e.target, onTimeUpdate);
          } else {
            stopTicking();
          }
          if (e.data === YT.PlayerState.ENDED) {
            stopTicking();
            if (onEnded) onEnded();
          }
        },
        onError(e) {
          // 2 = неверный ID, 5 = ошибка HTML5-плеера, 100 = видео удалено/приватное,
          // 101/150 = владелец канала запретил встраивание на сторонних сайтах.
          stopTicking();
          if (onError) onError(e.data);
        },
      },
    });

    return currentPlayer;
  }

  function getCurrentTime() {
    if (currentPlayer && typeof currentPlayer.getCurrentTime === "function") {
      try {
        return currentPlayer.getCurrentTime();
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /** Уничтожает текущий плеер (удаляет его iframe из DOM). */
  function destroy() {
    stopTicking();
    if (currentPlayer && typeof currentPlayer.destroy === "function") {
      try {
        currentPlayer.destroy();
      } catch (e) {
        // плеер уже мог быть удалён вместе со своим контейнером
      }
    }
    currentPlayer = null;
  }

  return { create, destroy, getCurrentTime };
})();
