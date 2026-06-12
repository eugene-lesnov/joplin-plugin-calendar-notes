const CREATE_ACTIONS = new Set(["createNote", "createTask"]);
const PANEL_ROOT_ID = "calendar-notes-root";
const REFRESH_INTERVAL_MS = 15000;

let lastPanelHtml = "";
let pendingCreateCount = 0;
let queuedPanelHtml = null;
let panelVersion = 0;

function applyPanelHtml(html) {
  const root = document.getElementById(PANEL_ROOT_ID);

  if (root && html !== lastPanelHtml && html !== root.innerHTML) {
    root.innerHTML = html;
  }

  lastPanelHtml = html;
}

function applyPanelResponse(response, force = false) {
  if (response?.name !== "setPanelHtml") {
    return;
  }

  if (!force && pendingCreateCount > 0) {
    queuedPanelHtml = response.html;
    return;
  }

  queuedPanelHtml = null;
  applyPanelHtml(response.html);
}

function applyQueuedPanelHtml() {
  if (pendingCreateCount === 0 && queuedPanelHtml !== null) {
    applyPanelHtml(queuedPanelHtml);
    queuedPanelHtml = null;
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

function addOptimisticItem(target, action) {
  const section = target.closest(action === "createTask" ? ".day-tasks" : ".day-notes");

  if (!section) {
    return null;
  }

  const item = action === "createTask"
    ? createOptimisticTaskElement()
    : createOptimisticNoteElement();

  ensureSectionList(section).appendChild(item);
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
    applyPanelHtml(payload.html);
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

function applyOptimisticTaskToggle(target) {
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const completed = target.dataset.completed !== "true";
  target.checked = completed;
  target.dataset.completed = completed ? "true" : "false";
  target.closest(".day-task")?.classList.toggle("completed", completed);

  updateSelectedDayTaskMarker();
}

async function handleTaskToggle(target) {
  const wasCompleted = target.dataset.completed === "true";

  applyOptimisticTaskToggle(target);
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
      applyPanelResponse(await webviewApi.postMessage({ name: "refresh" }), true);
    }
  }
}

async function handleAction(target) {
  const action = target.dataset.action;

  if (typeof target.blur === "function") {
    target.blur();
  }

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
    void refreshPanel();
  }
});

setInterval(() => {
  void refreshPanel();
}, REFRESH_INTERVAL_MS);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void refreshPanel());
} else {
  void refreshPanel();
}
