const STORAGE_KEY = "chagok-study-notes-v1";
const SUBJECT_COLORS = ["#6d5dfc", "#2ca58d", "#e17b55", "#4978d0", "#d45d8d", "#9a6b3f"];

const seedState = {
  subjects: [
    { id: "korean", name: "국어", color: "#e17b55" },
    { id: "math", name: "수학", color: "#6d5dfc" },
    { id: "english", name: "영어", color: "#2ca58d" },
  ],
  notes: [
    {
      id: crypto.randomUUID(),
      title: "오늘 배운 내용을 기록해 보세요",
      content:
        "메모 카드를 누르면 내용을 수정할 수 있어요.\n과목과 태그를 붙이고, 중요한 메모는 별표로 표시해 보세요.",
      subjectId: "math",
      tags: ["사용법", "첫메모"],
      favorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  theme: "light",
};

const storedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
let state = storedState || seedState;
let currentFilter = { type: "all", value: null };
let editingId = null;
let draftTimer = null;

const $ = (selector) => document.querySelector(selector);
const noteGrid = $("#note-grid");
const emptyState = $("#empty-state");
const editorDialog = $("#editor-dialog");
const subjectDialog = $("#subject-dialog");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

function getSubject(id) {
  return state.subjects.find((subject) => subject.id === id) || {
    name: "미분류",
    color: "#8b8994",
  };
}

function filteredNotes() {
  const query = $("#search").value.trim().toLowerCase();
  const sort = $("#sort-select").value;
  let notes = [...state.notes];

  if (currentFilter.type === "favorite") {
    notes = notes.filter((note) => note.favorite);
  } else if (currentFilter.type === "subject") {
    notes = notes.filter((note) => note.subjectId === currentFilter.value);
  }

  if (query) {
    notes = notes.filter((note) =>
      [note.title, note.content, ...(note.tags || [])].join(" ").toLowerCase().includes(query),
    );
  }

  notes.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "ko");
    return b[sort === "created" ? "createdAt" : "updatedAt"] -
      a[sort === "created" ? "createdAt" : "updatedAt"];
  });

  return notes;
}

function renderSubjects() {
  const list = $("#subject-list");
  list.innerHTML = state.subjects
    .map((subject) => {
      const count = state.notes.filter((note) => note.subjectId === subject.id).length;
      const active =
        currentFilter.type === "subject" && currentFilter.value === subject.id ? "active" : "";
      return `
        <button class="subject-item ${active}" data-subject="${subject.id}">
          <span class="subject-dot" style="--dot:${subject.color}"></span>
          ${escapeHtml(subject.name)}
          <b>${count}</b>
        </button>`;
    })
    .join("");

  $("#note-subject").innerHTML = state.subjects
    .map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`)
    .join("");

  list.querySelectorAll(".subject-item").forEach((button) => {
    button.addEventListener("click", () => {
      const subject = getSubject(button.dataset.subject);
      currentFilter = { type: "subject", value: button.dataset.subject };
      setView(subject.name, "SUBJECT NOTES", `${subject.name} 공부 기록만 모아봤어요.`);
      setActiveNavigation();
      render();
      closeSidebar();
    });
  });
}

function renderNotes() {
  const notes = filteredNotes();
  noteGrid.innerHTML = notes
    .map((note) => {
      const subject = getSubject(note.subjectId);
      return `
        <article class="note-card" data-id="${note.id}" style="--accent:${subject.color}">
          <div class="note-card-top">
            <span class="subject-pill">${escapeHtml(subject.name)}</span>
            <button class="favorite-button ${note.favorite ? "active" : ""}"
              data-favorite="${note.id}" aria-label="중요 메모 표시">${note.favorite ? "★" : "☆"}</button>
          </div>
          <h2>${escapeHtml(note.title)}</h2>
          <p class="note-preview">${escapeHtml(note.content)}</p>
          <div class="note-card-footer">
            <div class="tags">
              ${(note.tags || []).slice(0, 3).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("")}
            </div>
            <time class="note-date">${formatDate(note.updatedAt)}</time>
          </div>
        </article>`;
    })
    .join("");

  emptyState.hidden = notes.length > 0;
  noteGrid.hidden = notes.length === 0;

  noteGrid.querySelectorAll(".note-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-favorite]")) return;
      openEditor(card.dataset.id);
    });
  });

  noteGrid.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", () => toggleFavorite(button.dataset.favorite));
  });
}

function renderCounts() {
  $("#all-count").textContent = state.notes.length;
  $("#favorite-count").textContent = state.notes.filter((note) => note.favorite).length;
}

function render() {
  renderCounts();
  renderSubjects();
  renderNotes();
  saveState();
}

function setView(title, eyebrow, description) {
  $("#view-title").textContent = title;
  $("#view-eyebrow").textContent = eyebrow;
  $("#view-description").textContent = description;
}

function setActiveNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === currentFilter.type);
  });
}

function openEditor(id = null) {
  editingId = id;
  const note = state.notes.find((item) => item.id === id);
  $("#dialog-title").textContent = note ? "메모 수정" : "새 메모";
  $("#note-title").value = note?.title || "";
  $("#note-content").value = note?.content || "";
  $("#note-tags").value = note?.tags?.join(", ") || "";
  $("#note-subject").value =
    note?.subjectId ||
    (currentFilter.type === "subject" ? currentFilter.value : state.subjects[0]?.id);
  $("#delete-note").hidden = !note;
  $("#save-status").textContent = "작성하는 동안 자동 저장됩니다";
  editorDialog.showModal();
  setTimeout(() => $("#note-title").focus(), 50);
}

function saveNote(showMessage = true) {
  const title = $("#note-title").value.trim();
  const content = $("#note-content").value.trim();
  if (!title || !content) return false;

  const values = {
    title,
    content,
    subjectId: $("#note-subject").value,
    tags: $("#note-tags")
      .value.split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean),
    updatedAt: Date.now(),
  };

  if (editingId) {
    const index = state.notes.findIndex((note) => note.id === editingId);
    state.notes[index] = { ...state.notes[index], ...values };
  } else {
    const note = {
      id: crypto.randomUUID(),
      ...values,
      favorite: false,
      createdAt: Date.now(),
    };
    state.notes.unshift(note);
    editingId = note.id;
  }

  render();
  if (showMessage) showToast("메모를 저장했어요");
  return true;
}

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  $("#save-status").textContent = "입력 중...";
  draftTimer = setTimeout(() => {
    if (saveNote(false)) {
      $("#save-status").textContent = "자동 저장됨";
    }
  }, 700);
}

function deleteNote() {
  if (!editingId || !confirm("이 메모를 삭제할까요?")) return;
  state.notes = state.notes.filter((note) => note.id !== editingId);
  editorDialog.close();
  render();
  showToast("메모를 삭제했어요");
}

function toggleFavorite(id) {
  const note = state.notes.find((item) => item.id === id);
  note.favorite = !note.favorite;
  note.updatedAt = Date.now();
  render();
  showToast(note.favorite ? "중요 메모로 표시했어요" : "중요 표시를 해제했어요");
}

function addSubject() {
  const name = $("#subject-name").value.trim();
  if (!name) return;
  if (state.subjects.some((subject) => subject.name === name)) {
    showToast("이미 있는 과목이에요");
    return;
  }

  state.subjects.push({
    id: crypto.randomUUID(),
    name,
    color: SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length],
  });
  $("#subject-name").value = "";
  render();
  showToast(`${name} 과목을 추가했어요`);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $("#theme-icon").textContent = state.theme === "dark" ? "☀" : "☾";
  $("#theme-label").textContent = state.theme === "dark" ? "라이트 모드" : "다크 모드";
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function openSidebar() {
  $("#sidebar").classList.add("open");
  $("#scrim").classList.add("show");
}

function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#scrim").classList.remove("show");
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = { type: button.dataset.filter, value: null };
    if (button.dataset.filter === "favorite") {
      setView("중요 메모", "FAVORITES", "꼭 기억할 내용만 빠르게 확인하세요.");
    } else {
      setView("모든 메모", "MY NOTES", "오늘 배운 것을 한 줄이라도 남겨보세요.");
    }
    setActiveNavigation();
    render();
    closeSidebar();
  });
});

["#new-note", "#mobile-new-note", "#empty-new-note"].forEach((selector) => {
  $(selector).addEventListener("click", () => openEditor());
});

$("#search").addEventListener("input", renderNotes);
$("#sort-select").addEventListener("change", renderNotes);
$("#add-subject").addEventListener("click", () => subjectDialog.showModal());
$("#delete-note").addEventListener("click", deleteNote);
$("#menu-button").addEventListener("click", openSidebar);
$("#scrim").addEventListener("click", closeSidebar);

$("#theme-toggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
});

$("#note-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (saveNote()) editorDialog.close();
});

["#note-title", "#note-content", "#note-tags", "#note-subject"].forEach((selector) => {
  $(selector).addEventListener("input", scheduleDraftSave);
});

$("#subject-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  addSubject();
  subjectDialog.close();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#search").focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    openEditor();
  }
});

applyTheme();
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
