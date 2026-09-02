// Разбор ссылки на плейлист + обращения к YouTube Data API v3.

const PlaylistURLParser = {
  /**
   * Достаёт playlistId из произвольной ссылки на YouTube-плейлист
   * (youtube.com/playlist?list=..., youtube.com/watch?v=...&list=..., youtu.be/...?list=...)
   * или принимает уже голый playlistId, вставленный пользователем напрямую.
   */
  extractPlaylistId(input) {
    const trimmed = (input || "").trim();
    if (!trimmed) return null;

    try {
      const url = new URL(trimmed);
      const listId = url.searchParams.get("list");
      if (listId) return listId;
    } catch (e) {
      // Не похоже на URL — пробуем как голый ID ниже.
    }

    if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  },
};

class YouTubeServiceError extends Error {}

const YouTubeService = {
  async fetchPlaylist(playlistId) {
    const meta = await this._fetchPlaylistMeta(playlistId);
    const workouts = await this._fetchAllPlaylistItems(playlistId);

    if (workouts.length === 0) {
      throw new YouTubeServiceError("В этом плейлисте нет видео.");
    }

    return {
      playlistId,
      title: meta.title,
      thumbnailURL: meta.thumbnailURL || workouts[0].thumbnailURL || null,
      workouts,
    };
  },

  async _fetchPlaylistMeta(playlistId) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", playlistId);
    url.searchParams.set("key", CONFIG.YOUTUBE_API_KEY);

    const data = await this._request(url);
    const item = data.items && data.items[0];
    if (!item) {
      throw new YouTubeServiceError("Плейлист не найден. Проверьте ссылку.");
    }

    const thumbs = item.snippet.thumbnails || {};
    const thumbnailURL =
      (thumbs.medium && thumbs.medium.url) ||
      (thumbs.high && thumbs.high.url) ||
      (thumbs.default && thumbs.default.url) ||
      null;

    return { title: item.snippet.title, thumbnailURL };
  },

  async _fetchAllPlaylistItems(playlistId) {
    const results = [];
    let pageToken = null;
    let index = 1;

    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", CONFIG.YOUTUBE_API_KEY);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const data = await this._request(url);

      for (const item of data.items || []) {
        const snippet = item.snippet;
        const videoId = snippet.resourceId && snippet.resourceId.videoId;
        if (!videoId) continue;

        const thumbs = snippet.thumbnails || {};
        const thumbnailURL =
          (thumbs.medium && thumbs.medium.url) ||
          (thumbs.high && thumbs.high.url) ||
          (thumbs.default && thumbs.default.url) ||
          null;

        results.push({
          index: index++,
          videoId,
          title: snippet.title,
          thumbnailURL,
        });
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    return results;
  },

  async _request(url) {
    let response;
    try {
      response = await fetch(url.toString());
    } catch (e) {
      throw new YouTubeServiceError("Ошибка сети: " + e.message);
    }

    if (!response.ok) {
      let message = `YouTube API вернул статус ${response.status}.`;
      try {
        const body = await response.json();
        if (body && body.error && body.error.message) {
          message = body.error.message;
        }
      } catch (e) {
        // тело не JSON — используем сообщение по умолчанию выше
      }
      throw new YouTubeServiceError(message);
    }

    try {
      return await response.json();
    } catch (e) {
      throw new YouTubeServiceError("Неожиданный ответ от YouTube.");
    }
  },
};
