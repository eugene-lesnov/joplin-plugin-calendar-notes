document.addEventListener("contextmenu", async (event) => {
  const target = event.target.closest('[data-action="setTaskRepeat"]');

  if (!target || target.dataset.canClearRepeat !== "true") {
    return;
  }

  event.preventDefault();

  await webviewApi.postMessage({
    name: "clearTaskRepeat",
    id: target.dataset.noteId,
  });
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");

  if (!target) {
    return;
  }

  event.preventDefault();

  const action = target.dataset.action;

  if (action === "selectDate") {
    await webviewApi.postMessage({
      name: "selectDate",
      date: target.dataset.date,
    });
    return;
  }

  if (action === "openNote") {
    await webviewApi.postMessage({
      name: "openNote",
      id: target.dataset.noteId,
    });
    return;
  }

  if (action === "createNote") {
    await webviewApi.postMessage({
      name: "createNote",
      date: target.dataset.date,
    });
    return;
  }

  if (action === "createTask") {
    await webviewApi.postMessage({
      name: "createTask",
      date: target.dataset.date,
    });
    return;
  }

  if (action === "toggleTask") {
    await webviewApi.postMessage({
      name: "toggleTask",
      id: target.dataset.noteId,
      completed: target.dataset.completed === "true",
    });
    return;
  }

  if (action === "setTaskRepeat") {
    await webviewApi.postMessage({
      name: "setTaskRepeat",
      id: target.dataset.noteId,
    });
    return;
  }


  if (action === "toggleOverdueTasks") {
    await webviewApi.postMessage({
      name: "toggleOverdueTasks",
    });
    return;
  }

  if (action === "prevMonth") {
    await webviewApi.postMessage({
      name: "prevMonth",
    });
    return;
  }

  if (action === "nextMonth") {
    await webviewApi.postMessage({
      name: "nextMonth",
    });
    return;
  }

  if (action === "today") {
    await webviewApi.postMessage({
      name: "today",
    });
  }
});
