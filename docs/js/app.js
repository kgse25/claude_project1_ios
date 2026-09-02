// Контроллер экранов: список программ -> добавление -> детали программы -> плеер.

(function () {
  let programs = Storage.loadPrograms();
  let currentProgramId = null;
  let currentWorkoutIndex = null;

  const views = {
    list: document.getElementById("view-list"),
    add: document.getElementById("view-add"),
    detail: document.getElementById("view-detail"),
    player: document.getElementById("view-player"),
  };

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
  }

  function save() {
    Storage.savePrograms(programs);
  }

  function findProgram(id) {
    return programs.find((p) => p.id === id) || null;
  }

  // ---------------- List view ----------------

  function renderProgramList() {
    const container = document.getElementById("program-list");
    const empty = document.getElementById("empty-state");

    container.innerHTML = "";

    if (programs.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const sorted = [...programs].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));

    for (const program of sorted) {
      const completed = program.workouts.filter((w) => w.isCompleted).length;
      const total = program.workouts.length;

      const row = document.createElement("div");
      row.className = "program-row";
      row.innerHTML = `
        ${program.thumbnailURL
          ? `<img class="program-thumb" src="${escapeHtml(program.thumbnailURL)}" alt="" loading="lazy">`
          : `<div class="program-thumb"></div>`}
        <div class="program-info">
          <div class="title">${escapeHtml(program.title)}</div>
          <div class="progress">${completed}/${total}</div>
        </div>
      `;
      row.addEventListener("click", () => openProgramDetail(program.id));
      container.appendChild(row);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // ---------------- Add program view ----------------

  function openAddView() {
    document.getElementById("playlist-url-input").value = "";
    document.getElementById("add-error").hidden = true;
    document.getElementById("add-spinner").hidden = true;
    setAddBusy(false);
    views.add.hidden = false;
  }

  function closeAddView() {
    views.add.hidden = true;
  }

  function setAddBusy(busy) {
    document.getElementById("add-spinner").hidden = !busy;
    document.getElementById("btn-add-confirm").disabled = busy;
    document.getElementById("btn-add-cancel").disabled = busy;
    document.getElementById("playlist-url-input").disabled = busy;
  }

  async function handleAddConfirm() {
    const input = document.getElementById("playlist-url-input");
    const errorEl = document.getElementById("add-error");
    errorEl.hidden = true;

    const playlistId = PlaylistURLParser.extractPlaylistId(input.value);
    if (!playlistId) {
      errorEl.textContent = "Не удалось найти playlist ID в этой ссылке.";
      errorEl.hidden = false;
      return;
    }

    setAddBusy(true);
    try {
      const fetched = await YouTubeService.fetchPlaylist(playlistId);

      const program = {
        id: crypto.randomUUID(),
        title: fetched.title,
        playlistId: fetched.playlistId,
        thumbnailURL: fetched.thumbnailURL,
        dateAdded: Date.now(),
        workouts: fetched.workouts.map((w) => ({
          index: w.index,
          videoId: w.videoId,
          title: w.title,
          thumbnailURL: w.thumbnailURL,
          isCompleted: false,
          lastPositionSeconds: 0,
        })),
      };

      programs.push(program);
      save();
      closeAddView();
      renderProgramList();
      openProgramDetail(program.id);
    } catch (e) {
      errorEl.textContent = e.message || "Не удалось загрузить плейлист.";
      errorEl.hidden = false;
    } finally {
      setAddBusy(false);
    }
  }

  // ---------------- Detail view ----------------

  function openProgramDetail(programId) {
    currentProgramId = programId;
    const program = findProgram(programId);
    if (!program) return;

    document.getElementById("detail-title").textContent = program.title;
    renderWorkoutGrid();
    showView("detail");
  }

  function renderWorkoutGrid() {
    const program = findProgram(currentProgramId);
    if (!program) return;

    const grid = document.getElementById("workout-grid");
    grid.innerHTML = "";

    const sorted = [...program.workouts].sort((a, b) => a.index - b.index);
    for (const workout of sorted) {
      const cell = document.createElement("button");
      cell.className = "workout-cell" + (workout.isCompleted ? " completed" : "");
      cell.textContent = workout.isCompleted ? "✓" : String(workout.index);
      cell.addEventListener("click", () => openWorkoutPlayer(workout.index));
      grid.appendChild(cell);
    }
  }

  function deleteCurrentProgram() {
    if (!currentProgramId) return;
    if (!confirm("Удалить эту программу вместе с прогрессом?")) return;

    programs = programs.filter((p) => p.id !== currentProgramId);
    save();
    currentProgramId = null;
    renderProgramList();
    showView("list");
  }

  // ---------------- Player view ----------------

  function openWorkoutPlayer(workoutIndex) {
    const program = findProgram(currentProgramId);
    if (!program) return;
    const workout = program.workouts.find((w) => w.index === workoutIndex);
    if (!workout) return;

    currentWorkoutIndex = workoutIndex;

    document.getElementById("player-title").textContent = "Тренировка " + workout.index;
    document.getElementById("player-video-title").textContent = workout.title;
    updateCompleteButton(workout);

    const wrap = document.querySelector(".player-wrap");
    wrap.innerHTML = '<div id="yt-player"></div>';

    showView("player");

    YouTubePlayer.create("yt-player", workout.videoId, workout.lastPositionSeconds, {
      onTimeUpdate: (seconds) => {
        workout.lastPositionSeconds = seconds;
        save();
      },
      onEnded: () => {
        workout.isCompleted = true;
        workout.lastPositionSeconds = 0;
        save();
        updateCompleteButton(workout);
      },
    });
  }

  function updateCompleteButton(workout) {
    const btn = document.getElementById("btn-toggle-complete");
    btn.textContent = workout.isCompleted ? "●" : "○";
    btn.classList.toggle("completed", workout.isCompleted);
  }

  function getCurrentWorkout() {
    const program = findProgram(currentProgramId);
    if (!program) return null;
    return program.workouts.find((w) => w.index === currentWorkoutIndex) || null;
  }

  function toggleCurrentWorkoutComplete() {
    const workout = getCurrentWorkout();
    if (!workout) return;
    workout.isCompleted = !workout.isCompleted;
    if (workout.isCompleted) workout.lastPositionSeconds = 0;
    save();
    updateCompleteButton(workout);
  }

  function closePlayerView() {
    const player = YouTubePlayer;
    const currentTime = player.getCurrentTime();
    const workout = getCurrentWorkout();
    if (workout && currentTime != null) {
      workout.lastPositionSeconds = currentTime;
      save();
    }
    YouTubePlayer.destroy();
    renderWorkoutGrid();
    showView("detail");
  }

  // ---------------- Navigation wiring ----------------

  document.getElementById("btn-add-program").addEventListener("click", openAddView);
  document.getElementById("btn-add-cancel").addEventListener("click", closeAddView);
  document.getElementById("btn-add-confirm").addEventListener("click", handleAddConfirm);
  document.getElementById("btn-delete-program").addEventListener("click", deleteCurrentProgram);
  document.getElementById("btn-toggle-complete").addEventListener("click", toggleCurrentWorkoutComplete);

  document.querySelectorAll(".back-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.backTo;
      if (target === "list") {
        renderProgramList();
        showView("list");
      } else if (target === "detail") {
        closePlayerView();
      }
    });
  });

  // ---------------- Init ----------------

  renderProgramList();
  showView("list");
})();
