document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");

  if (!target) {
    return;
  }

  event.preventDefault();

  const action = target.dataset.action;

  if (action === "openDate") {
    await webviewApi.postMessage({
      name: "openDate",
      date: target.dataset.date,
    });
    return;
  }

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
    return;
  }

  if (action === "refresh") {
    await webviewApi.postMessage({
      name: "refresh",
    });
  }
});
