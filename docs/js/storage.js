// Локальное хранилище прогресса (программы + тренировки) в localStorage.
//
// Program = { id, title, playlistId, thumbnailURL, dateAdded, workouts: [Workout] }
// Workout = { index, videoId, title, thumbnailURL, isCompleted, lastPositionSeconds }

const STORAGE_KEY = "gymtracker.programs";

const Storage = {
  loadPrograms() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load programs from localStorage", e);
      return [];
    }
  },

  savePrograms(programs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
  },
};
