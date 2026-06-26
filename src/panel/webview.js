const CREATE_ACTIONS = new Set(["createNote", "createTask"]);
const PANEL_ROOT_ID = "calendar-notes-root";
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

function keyOf(node) {
  if (node.nodeType !== 1) {
    return null;
  }

  return node.getAttribute("data-date")
    || node.getAttribute("data-tag-id")
    || (node.tagName === "LI" ? node.getAttribute("data-note-id") : null)
    || null;
}

function nodeMatches(a, b) {
  if (a.nodeType !== b.nodeType) {
    return false;
  }

  if (a.nodeType === 1) {
    return a.tagName === b.tagName;
  }

  return true;
}

function morphAttributes(fromEl, toEl) {
  const toAttrs = toEl.attributes;

  for (let i = 0; i < toAttrs.length; i++) {
    const attr = toAttrs[i];

    if (fromEl.getAttribute(attr.name) !== attr.value) {
      fromEl.setAttribute(attr.name, attr.value);
    }
  }

  const fromAttrs = fromEl.attributes;

  for (let i = fromAttrs.length - 1; i >= 0; i--) {
    const name = fromAttrs[i].name;

    if (!toEl.hasAttribute(name)) {
      fromEl.removeAttribute(name);
    }
  }
}

function syncFormState(el) {
  if (el.tagName !== "INPUT") {
    return;
  }

  const type = el.getAttribute("type");

  if (type === "checkbox" || type === "radio") {
    el.checked = el.hasAttribute("checked");
  }

  el.disabled = el.hasAttribute("disabled");
}

function morphNode(fromNode, toNode) {
  if (
    fromNode.nodeType !== toNode.nodeType
    || (fromNode.nodeType === 1 && fromNode.tagName !== toNode.tagName)
  ) {
    fromNode.parentNode.replaceChild(toNode, fromNode);
    return;
  }

  if (fromNode.nodeType === 3 || fromNode.nodeType === 8) {
    if (fromNode.nodeValue !== toNode.nodeValue) {
      fromNode.nodeValue = toNode.nodeValue;
    }
    return;
  }

  if (fromNode.nodeType !== 1) {
    return;
  }

  morphAttributes(fromNode, toNode);
  syncFormState(fromNode);
  morphChildren(fromNode, toNode);
}

function morphChildren(fromEl, toEl) {
  const originalChildren = [];
  const oldKeyed = new Map();

  for (let node = fromEl.firstChild; node; node = node.nextSibling) {
    originalChildren.push(node);
    const key = keyOf(node);

    if (key !== null) {
      oldKeyed.set(key, node);
    }
  }

  const claimed = new Set();
  let cursor = fromEl.firstChild;
  let newChild = toEl.firstChild;

  while (newChild) {
    const nextNew = newChild.nextSibling;
    const newKey = keyOf(newChild);
    let match = null;

    if (newKey !== null) {
      if (oldKeyed.has(newKey)) {
        match = oldKeyed.get(newKey);
        oldKeyed.delete(newKey);
      }
    } else if (
      cursor
      && !claimed.has(cursor)
      && keyOf(cursor) === null
      && nodeMatches(cursor, newChild)
    ) {
      match = cursor;
    }

    if (match) {
      claimed.add(match);

      if (match === cursor) {
        cursor = cursor.nextSibling;
      } else {
        fromEl.insertBefore(match, cursor);
      }

      morphNode(match, newChild);
    } else {
      fromEl.insertBefore(newChild, cursor);
    }

    newChild = nextNew;
  }

  for (const child of originalChildren) {
    if (!claimed.has(child)) {
      fromEl.removeChild(child);
    }
  }
}

function morphPanelHtml(root, html) {
  try {
    const parsed = document.createElement("div");
    parsed.innerHTML = html;
    morphChildren(root, parsed);
    return true;
  } catch (error) {
    console.error("Calendar panel morph failed, falling back to innerHTML.", error);
    return false;
  }
}

function applyPanelHtml(html) {
  const root = document.getElementById(PANEL_ROOT_ID);

  if (root && html !== lastPanelHtml) {
    if (isMobilePanel() && root.firstChild) {
      if (!morphPanelHtml(root, html)) {
        root.innerHTML = html;
      }
    } else {
      root.innerHTML = html;
    }
  }

  lastPanelHtml = html;
}

function compareTaskSortKeys(first, second) {
  const firstAlarmTime = Number(first.dataset.alarmTime || 0);
  const secondAlarmTime = Number(second.dataset.alarmTime || 0);
  const firstHasAlarm = firstAlarmTime > 0;
  const secondHasAlarm = secondAlarmTime > 0;

  if (firstHasAlarm !== secondHasAlarm) {
    return firstHasAlarm ? -1 : 1;
  }

  if (firstHasAlarm && firstAlarmTime !== secondAlarmTime) {
    return firstAlarmTime - secondAlarmTime;
  }

  const firstCreatedTime = Number(first.dataset.createdTime || 0);
  const secondCreatedTime = Number(second.dataset.createdTime || 0);

  if (firstCreatedTime !== secondCreatedTime) {
    return firstCreatedTime - secondCreatedTime;
  }

  return (first.dataset.sortTitle || "").localeCompare(second.dataset.sortTitle || "");
}

function reorderSelectedDayTask(taskItem) {
  const list = taskItem.closest(".day-tasks .selected-day-list");

  if (!list) {
    return;
  }

  const completed = taskItem.classList.contains("completed");
  const target = Array.from(list.children).find((item) =>
    item !== taskItem
    && item.classList.contains("day-task")
    && item.classList.contains("completed") === completed
    && compareTaskSortKeys(taskItem, item) < 0,
  );

  if (target) {
    list.insertBefore(taskItem, target);
    return;
  }

  const nextGroupItem = completed
    ? null
    : list.querySelector(".day-task.completed");

  if (nextGroupItem) {
    list.insertBefore(taskItem, nextGroupItem);
  } else {
    list.appendChild(taskItem);
  }
}

function updateTaskAlarmOverdueState(taskItem, message) {
  const alarm = taskItem.querySelector(".task-alarm");

  if (!(alarm instanceof HTMLElement)) {
    return;
  }

  const alarmTime = Number(message.alarmTime || 0);
  const overdue = !message.completed && alarmTime > 0 && alarmTime < Date.now();

  alarm.classList.toggle("overdue", overdue);
}

function applyTaskCompletionPatch(message) {
  if (!isMobilePanel() || !message.isTodo) {
    return;
  }

  const taskItems = document.querySelectorAll(".day-task[data-note-id]");

  for (const taskItem of taskItems) {
    if (taskItem.dataset.noteId !== message.id) {
      continue;
    }

    taskItem.removeAttribute("data-pending");
    taskItem.classList.toggle("completed", message.completed);
    taskItem.dataset.sortTitle = message.title;
    taskItem.dataset.alarmTime = String(message.alarmTime || 0);

    const checkbox = taskItem.querySelector(".task-checkbox[data-note-id]");

    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = message.completed;
      checkbox.disabled = false;
      checkbox.dataset.completed = message.completed ? "true" : "false";
      checkbox.title = message.title;
    }

    updateTaskAlarmOverdueState(taskItem, message);
    reorderSelectedDayTask(taskItem);
  }

  updateSelectedDayTaskMarker();
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

  applyTaskCompletionPatch(message);
}

function applyPanelResponse(response, force = false) {
  if (response?.name === "patchVisibleNote") {
    if (pendingCreateCount === 0) {
      applyVisibleNotePatch(response);
    }
    return;
  }

  if (response?.name === "patchVisibleNotes") {
    if (pendingCreateCount === 0) {
      for (const patch of response.patches) {
        applyVisibleNotePatch(patch);
      }
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
    visibleNotesPatchTimer = null;
  }

  if (!isMobilePanel() || document.hidden) {
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
  if (!isMobilePanel() || document.hidden) {
    return;
  }

  if (pendingCreateCount > 0 || visibleNotesPatchInFlight) {
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

webviewApi.onMessage((event) => {
  applyPanelResponse(event?.message ?? event);
  scheduleVisibleNotesPatch();
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

function applyOptimisticDateSelection(target) {
  const root = document.getElementById(PANEL_ROOT_ID);

  if (!root) {
    return;
  }

  const wasSelected = target.classList.contains("selected");

  for (const day of root.querySelectorAll(".day.selected")) {
    day.classList.remove("selected");
  }

  if (!wasSelected) {
    target.classList.add("selected");
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

  if (action === "selectDate") {
    applyOptimisticDateSelection(target);
    panelVersion += 1;
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

  if (action === "toggleTaggedTasks") {
    return webviewApi.postMessage({
      name: "toggleTaggedTasks",
    });
  }

  if (action === "toggleTaggedTaskGroup") {
    const tagId = target.dataset.tagId;

    if (!tagId) {
      return;
    }

    return webviewApi.postMessage({
      name: "toggleTaggedTaskGroup",
      tagId,
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
  if (document.hidden) {
    return;
  }

  activateFastVisibleNotesPatchWindow();
  webviewApi.postMessage({ name: "panelVisible" });

  if (isMobilePanel()) {
    void patchVisibleNotes();
  }
});

function startWebviewLoops() {
  activateFastVisibleNotesPatchWindow();
  webviewApi.postMessage({ name: "panelVisible" });
  scheduleVisibleNotesPatch();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startWebviewLoops);
} else {
  startWebviewLoops();
}
