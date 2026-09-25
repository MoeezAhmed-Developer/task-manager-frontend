const API = "https://task-manager-backend-1d5u.vercel.app/api";

const taskList = document.querySelector("#taskList");
const modalOverlay = document.querySelector("#modalOverlay");
const taskForm = document.querySelector("#taskForm");
const searchInput = document.querySelector("#searchInput");
const priorityFilter = document.querySelector("#priorityFilter");
const sidebar = document.querySelector("#sidebar");
const toast = document.querySelector("#toast");

let activeStatus = "all";
let searchTimer;

const $ = (selector) => document.querySelector(selector);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function formatDate(date) {
  if (!date) return "No due date";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "No due date";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusText(status) {
  return (
    {
      todo: "To Do",
      "in-progress": "In Progress",
      completed: "Completed",
    }[status] || status
  );
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

async function loadTasks() {
  try {
    const params = new URLSearchParams({
      status: activeStatus,
      priority: priorityFilter.value,
      search: searchInput.value.trim(),
    });

    const data = await request(`${API}/tasks?${params}`);
    renderTasks(data);
  } catch (error) {
    taskList.innerHTML = `<div class="empty"><i class="uil uil-exclamation-triangle"></i><p>${escapeHTML(error.message)}</p></div>`;
  }
}

function renderTasks(tasks) {
  if (!tasks.length) {
    taskList.innerHTML = `
      <div class="empty">
        <i class="uil uil-clipboard-alt"></i>
        <strong>No tasks found</strong>
        <p>Create a new task or change your filters.</p>
      </div>`;
    return;
  }

  taskList.innerHTML = tasks
    .map(
      (task) => `
    <article class="task-card ${task.status === "completed" ? "completed" : ""}">
      <div>
        <div class="task-title">${escapeHTML(task.title)}</div>
        ${task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : ""}
        <div class="meta">
          <span class="badge priority-${task.priority}">${escapeHTML(task.priority)}</span>
          <span class="badge status-badge">${escapeHTML(statusText(task.status))}</span>
          <span class="badge"><i class="uil uil-calendar-alt"></i> ${formatDate(task.dueDate)}</span>
        </div>
      </div>

      <div class="task-actions">
        <button class="icon-btn" title="Change status" aria-label="Change status" onclick="cycleStatus('${task._id}', '${task.status}')">
          <i class="uil uil-check-circle"></i>
        </button>
        <button class="icon-btn" title="Edit task" aria-label="Edit task" onclick="editTask('${task._id}')">
          <i class="uil uil-edit"></i>
        </button>
        <button class="icon-btn delete-btn" title="Delete task" aria-label="Delete task" onclick="deleteTask('${task._id}')">
          <i class="uil uil-trash"></i>
        </button>
      </div>
    </article>
  `,
    )
    .join("");
}

async function loadStats() {
  try {
    const stats = await request(`${API}/stats`);
    $("#totalCount").textContent = stats.total;
    $("#todoCount").textContent = stats.todo;
    $("#progressCount").textContent = stats.inProgress;
    $("#completedCount").textContent = stats.completed;
  } catch {
    // Keep dashboard usable even if stats fail.
  }
}

async function refresh() {
  await Promise.all([loadTasks(), loadStats()]);
}

function openModal(task = null) {
  modalOverlay.classList.remove("hidden");

  if (task) {
    $("#modalTitle").textContent = "Edit Task";
    $("#taskId").value = task._id;
    $("#title").value = task.title || "";
    $("#description").value = task.description || "";
    $("#priority").value = task.priority || "medium";
    $("#status").value = task.status || "todo";
    $("#dueDate").value = task.dueDate
      ? new Date(task.dueDate).toISOString().slice(0, 10)
      : "";
  } else {
    $("#modalTitle").textContent = "Add New Task";
    taskForm.reset();
    $("#taskId").value = "";
    $("#priority").value = "medium";
    $("#status").value = "todo";
  }

  setTimeout(() => $("#title").focus(), 50);
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

async function editTask(id) {
  try {
    const task = await request(`${API}/tasks/${id}`);
    openModal(task);
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteTask(id) {
  if (!confirm("Are you sure you want to delete this task?")) return;

  try {
    await request(`${API}/tasks/${id}`, { method: "DELETE" });
    showToast("Task deleted.");
    refresh();
  } catch (error) {
    showToast(error.message);
  }
}

async function cycleStatus(id, current) {
  const next = {
    todo: "in-progress",
    "in-progress": "completed",
    completed: "todo",
  }[current];

  try {
    await request(`${API}/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    showToast(`Task moved to ${statusText(next)}.`);
    refresh();
  } catch (error) {
    showToast(error.message);
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = $("#taskId").value;

  const payload = {
    title: $("#title").value,
    description: $("#description").value,
    priority: $("#priority").value,
    status: $("#status").value,
    dueDate: $("#dueDate").value || null,
  };

  try {
    await request(id ? `${API}/tasks/${id}` : `${API}/tasks`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    closeModal();
    showToast(id ? "Task updated." : "Task created.");
    refresh();
  } catch (error) {
    showToast(error.message);
  }
});

$("#openAdd").addEventListener("click", () => openModal());
$("#openAddSidebar").addEventListener("click", () => {
  sidebar.classList.remove("open");
  openModal();
});
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) closeModal();
});

$("#menuToggle").addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item")
      .forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeStatus = button.dataset.filterStatus;
    sidebar.classList.remove("open");
    loadTasks();
  });
});

priorityFilter.addEventListener("change", loadTasks);

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTasks, 300);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

refresh();
