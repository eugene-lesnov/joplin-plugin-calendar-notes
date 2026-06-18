const CREATE_ACTIONS = new Set(["createNote", "createTask"]);
const PANEL_ROOT_ID = "calendar-notes-root";
const REFRESH_INTERVAL_MS = 15000;
const VISIBLE_NOTES_PATCH_FAST_INTERVAL_MS = 750;
const VISIBLE_NOTES_PATCH_IDLE_INTERVAL_MS = 5000;
const VISIBLE_NOTES_PATCH_FAST_WINDOW_MS = 15000;
const VISIBLE_NOTES_PATCH_MAX_IDS = 30;

let lastPanelHtml = "";
let pendingCreateCount = 0;
let queuedPanelHtml = null;
let panelVersion = 0;
let visibleNotesPatchInFlight = false;
let visibleNotesPatchTimer = null;
let visibleNotesPatchFastUntil = 0;

function applyPanelHtml(html) {
  const root = document.getElementById(PANEL_ROOT_ID);

  if (root && html !== lastPanelHtml && html !== root.innerHTML) {
    root.innerHTML = html;
  }

  lastPanelHtml = html;
}

function applyVisibleNotePatch(message) {
  const items = document.querySelectorAll(".task-title[data-note-id], .day-note[data-note-id]");

  for (const item of items) {
    if (item.dataset.noteId !== message.id) {
      continue;
    }

    item.title = message.title;
    item.textContent = item.closest(".overdue-task-list")
      ? message.overdueText
      : message.text;
  }
}

function applyPanelResponse(response, force = false) {
  if (response?.name === "patchVisibleNote") {
    applyVisibleNotePatch(response);
    return;
  }

  if (response?.name === "patchVisibleNotes") {
    for (const patch of response.patches) {
      applyVisibleNotePatch(patch);
    }
    return;
  }

  if (response?.name !== "setPanelHtml") {
    return;
  }

  if (!force && pendingCreateCount > 0) {
    queuedPanelHtml = response.html;
    return;
  }

  queuedPanelHtml = null;
  applyPanelHtml(response.html);
  activateFastVisibleNotesPatchWindow();
}

function applyQueuedPanelHtml() {
  if (pendingCreateCount === 0 && queuedPanelHtml !== null) {
    applyPanelHtml(queuedPanelHtml);
    queuedPanelHtml = null;
  }
}

function activateFastVisibleNotesPatchWindow() {
  if (!isMobilePanel()) {
    return;
  }

  visibleNotesPatchFastUntil = Date.now() + VISIBLE_NOTES_PATCH_FAST_WINDOW_MS;
}

function getVisibleNoteIds() {
  return Array.from(
    new Set(
      Array.from(document.querySelectorAll(".task-title[data-note-id], .day-note[data-note-id]"))
        .map((item) => item.dataset.noteId)
        .filter(Boolean),
    ),
  ).slice(0, VISIBLE_NOTES_PATCH_MAX_IDS);
}

function scheduleVisibleNotesPatch() {
  if (visibleNotesPatchTimer !== null) {
    clearTimeout(visibleNotesPatchTimer);
  }

  if (!isMobilePanel()) {
    visibleNotesPatchTimer = null;
    return;
  }

  const interval = Date.now() < visibleNotesPatchFastUntil
    ? VISIBLE_NOTES_PATCH_FAST_INTERVAL_MS
    : VISIBLE_NOTES_PATCH_IDLE_INTERVAL_MS;

  visibleNotesPatchTimer = setTimeout(() => {
    visibleNotesPatchTimer = null;
    void patchVisibleNotes();
  }, interval);
}

async function patchVisibleNotes() {
  if (!isMobilePanel() || document.hidden || pendingCreateCount > 0 || visibleNotesPatchInFlight) {
    scheduleVisibleNotesPatch();
    return;
  }

  const ids = getVisibleNoteIds();

  if (ids.length === 0) {
    scheduleVisibleNotesPatch();
    return;
  }

  visibleNotesPatchInFlight = true;

  try {
    applyPanelResponse(await webviewApi.postMessage({
      name: "patchVisibleNotes",
      ids,
    }));
  } finally {
    visibleNotesPatchInFlight = false;
    scheduleVisibleNotesPatch();
  }
}

function ensureSectionList(section) {
  let list = section.querySelector(".selected-day-list");

  if (!list) {
    list = document.createElement("ul");
    list.className = "selected-day-list";
    section.appendChild(list);
  }

  return list;
}

function createOptimisticTaskElement() {
  const item = document.createElement("li");
  item.className = "day-task optimistic-item";
  item.innerHTML = '<span class="task-checkbox optimistic-checkbox"></span><span class="task-title">…</span>';
  return item;
}

function createOptimisticNoteElement() {
  const item = document.createElement("li");
  item.className = "optimistic-item";
  item.innerHTML = '<span class="day-note">…</span>';
  return item;
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function insertOptimisticTask(list, item) {
  const firstCompleted = list.querySelector(".day-task.completed");

  if (firstCompleted) {
    list.insertBefore(item, firstCompleted);
    return;
  }

  list.appendChild(item);
}

function addOptimisticItem(target, action) {
  const section = target.closest(action === "createTask" ? ".day-tasks" : ".day-notes");

  if (!section) {
    return null;
  }

  const list = ensureSectionList(section);

  if (action === "createTask") {
    const item = createOptimisticTaskElement();
    insertOptimisticTask(list, item);
    return item;
  }

  const item = createOptimisticNoteElement();
  list.appendChild(item);
  return item;
}

async function createOptimistically(target, action) {
  const optimisticItem = addOptimisticItem(target, action);
  pendingCreateCount += 1;
  panelVersion += 1;

  try {
    await waitForNextPaint();
    const response = await postActionMessage(target, action);
    pendingCreateCount -= 1;
    panelVersion += 1;
    applyPanelResponse(response, pendingCreateCount === 0);
    applyQueuedPanelHtml();
  } catch (error) {
    pendingCreateCount -= 1;
    panelVersion += 1;
    optimisticItem?.remove();
    applyQueuedPanelHtml();
    console.error("Failed to create calendar item.", error);
  }
}

function isMobilePanel() {
  return document.getElementById(PANEL_ROOT_ID)?.dataset.mobile === "true";
}

async function refreshPanel() {
  if (!isMobilePanel() || document.hidden || pendingCreateCount > 0) {
    return;
  }

  const startedVersion = panelVersion;
  const response = await webviewApi.postMessage({ name: "refresh" });

  if (startedVersion === panelVersion) {
    applyPanelResponse(response);
  }
}

webviewApi.onMessage((event) => {
  const payload = event?.message ?? event;
  if (payload?.name === "setPanelHtml") {
    applyPanelResponse(payload);
  }
});

document.addEventListener("contextmenu", async (event) => {
  const target = event.target.closest('[data-action="setTaskRepeat"]');

  if (!target || target.dataset.canClearRepeat !== "true") {
    return;
  }

  event.preventDefault();

  applyPanelResponse(await webviewApi.postMessage({
    name: "clearTaskRepeat",
    id: target.dataset.noteId,
  }));
});

function updateSelectedDayTaskMarker() {
  const root = document.getElementById(PANEL_ROOT_ID);

  if (!root) {
    return;
  }

  const taskItems = root.querySelectorAll(".day-tasks .day-task");

  if (taskItems.length === 0) {
    return;
  }

  const marker = root.querySelector(
    ".day.selected .day-marker.task-open, .day.selected .day-marker.task-done",
  );

  if (!marker) {
    return;
  }

  const allCompleted = Array.from(taskItems).every((item) =>
    item.classList.contains("completed"),
  );

  marker.classList.toggle("task-done", allCompleted);
  marker.classList.toggle("task-open", !allCompleted);
}

function createReadonlyRepeatLabel(button) {
  const label = document.createElement("span");
  label.className = "task-repeat-label active";
  label.title = button.title.split(".")[0] || button.title;
  label.textContent = button.textContent;
  return label;
}

function updateOptimisticRepeatControl(taskItem, completed) {
  const repeatControl = taskItem?.querySelector(".task-repeat-button");

  if (!repeatControl || !completed) {
    return;
  }

  if (repeatControl.classList.contains("active")) {
    repeatControl.replaceWith(createReadonlyRepeatLabel(repeatControl));
    return;
  }

  repeatControl.remove();
}

function revertOptimisticTaskToggle(target, wasCompleted) {
  const taskItem = target.closest(".day-task");
  target.checked = wasCompleted;
  target.disabled = false;
  target.dataset.completed = wasCompleted ? "true" : "false";
  taskItem?.classList.toggle("completed", wasCompleted);
  taskItem?.removeAttribute("data-pending");
  updateSelectedDayTaskMarker();
}

function applyOptimisticTaskToggle(target) {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  const taskItem = target.closest(".day-task");
  const completed = target.dataset.completed !== "true";

  target.checked = completed;
  target.disabled = true;
  target.dataset.completed = completed ? "true" : "false";
  taskItem?.classList.toggle("completed", completed);
  taskItem?.setAttribute("data-pending", "true");
  updateOptimisticRepeatControl(taskItem, completed);

  updateSelectedDayTaskMarker();
  return true;
}

async function handleTaskToggle(target) {
  if (target.disabled || target.closest(".day-task")?.dataset.pending === "true") {
    return;
  }

  const wasCompleted = target.dataset.completed === "true";

  if (!applyOptimisticTaskToggle(target)) {
    return;
  }
  panelVersion += 1;
  const requestVersion = panelVersion;

  try {
    const response = await webviewApi.postMessage({
      name: "toggleTask",
      id: target.dataset.noteId,
      completed: wasCompleted,
    });

    if (requestVersion === panelVersion) {
      applyPanelResponse(response);
    }
  } catch (error) {
    console.error("Failed to toggle calendar task.", error);

    if (requestVersion === panelVersion) {
      revertOptimisticTaskToggle(target, wasCompleted);
      applyPanelResponse(await webviewApi.postMessage({ name: "refresh" }), true);
    }
  }
}

async function handleAction(target) {
  const action = target.dataset.action;

  if (typeof target.blur === "function") {
    target.blur();
  }

  activateFastVisibleNotesPatchWindow();

  if (CREATE_ACTIONS.has(action)) {
    void createOptimistically(target, action);
    return;
  }

  if (action === "toggleTask") {
    await handleTaskToggle(target);
    return;
  }

  applyPanelResponse(await postActionMessage(target, action));
}

async function postActionMessage(target, action) {
  if (action === "selectDate") {
    return webviewApi.postMessage({
      name: "selectDate",
      date: target.dataset.date,
    });
  }

  if (action === "openNote") {
    return webviewApi.postMessage({
      name: "openNote",
      id: target.dataset.noteId,
    });
  }

  if (action === "createNote") {
    return webviewApi.postMessage({
      name: "createNote",
      date: target.dataset.date,
    });
  }

  if (action === "createTask") {
    return webviewApi.postMessage({
      name: "createTask",
      date: target.dataset.date,
    });
  }

  if (action === "setTaskRepeat") {
    return webviewApi.postMessage({
      name: "setTaskRepeat",
      id: target.dataset.noteId,
    });
  }

  if (action === "toggleOverdueTasks") {
    return webviewApi.postMessage({
      name: "toggleOverdueTasks",
    });
  }

  if (action === "prevMonth") {
    return webviewApi.postMessage({
      name: "prevMonth",
    });
  }

  if (action === "nextMonth") {
    return webviewApi.postMessage({
      name: "nextMonth",
    });
  }

  if (action === "today") {
    return webviewApi.postMessage({
      name: "today",
    });
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");

  if (!target) {
    return;
  }

  event.preventDefault();
  await handleAction(target);
});

document.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = event.target.closest("[data-action]");

  if (!target) {
    return;
  }

  event.preventDefault();
  await handleAction(target);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    activateFastVisibleNotesPatchWindow();
    void refreshPanel();
    if (isMobilePanel()) {
      void patchVisibleNotes();
    }
  }
});

setInterval(() => {
  void refreshPanel();
}, REFRESH_INTERVAL_MS);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    activateFastVisibleNotesPatchWindow();
    void refreshPanel();
    scheduleVisibleNotesPatch();
  });
} else {
  activateFastVisibleNotesPatchWindow();
  void refreshPanel();
  scheduleVisibleNotesPatch();
}
