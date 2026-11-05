const taskForm = document.getElementById("task-form");
const taskIdInput = document.getElementById("task-id");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const statusInput = document.getElementById("task-status");
const taskList = document.getElementById("task-list");
const taskFilter = document.getElementById("task-filter");
const formMessage = document.getElementById("form-message");

let tasks = [];

document.getElementById("today-date").textContent =
    new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date());

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function showMessage(message = "") {
    formMessage.textContent = message;
}

function updateSummary() {
    document.getElementById("total-count").textContent = tasks.length;
    document.getElementById("progress-count").textContent =
        tasks.filter(task => task.status === "In Progress").length;
    document.getElementById("completed-count").textContent =
        tasks.filter(task => task.status === "Completed").length;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderTasks() {
    taskList.replaceChildren();

    const filter = taskFilter.value;
    const visibleTasks = filter === "All"
        ? tasks
        : tasks.filter(task => task.status === filter);

    updateSummary();

    if (visibleTasks.length === 0) {
        const empty = createElement(
            "p",
            "empty-state",
            filter === "All"
                ? "No tasks yet. Add your first task using the form."
                : `No ${filter.toLowerCase()} tasks found.`
        );
        taskList.appendChild(empty);
        return;
    }

    visibleTasks.forEach(task => {
        const item = createElement("article", "task-item");
        const main = createElement("div", "task-main");
        const title = createElement("h3", "task-title", task.title);
        const description = createElement(
            "p",
            "task-description",
            task.description || "No description provided."
        );

        const meta = createElement("div", "task-meta");
        const statusClass = task.status === "Completed"
            ? "status status-completed"
            : task.status === "In Progress"
                ? "status status-in-progress"
                : "status";

        meta.appendChild(createElement("span", statusClass, task.status));
        meta.appendChild(createElement("span", "", `Created: ${task.created_at}`));

        main.append(title, description, meta);

        const actions = createElement("div", "task-actions");
        const editButton = createElement("button", "text-button", "Edit");
        editButton.type = "button";
        editButton.addEventListener("click", () => startEditing(task));

        const deleteButton = createElement("button", "text-button delete-button", "Delete");
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteTask(task.id));

        actions.append(editButton, deleteButton);
        item.append(main, actions);
        taskList.appendChild(item);
    });
}

async function loadTasks() {
    try {
        tasks = await apiRequest("/api/tasks");
        renderTasks();
    } catch (error) {
        taskList.replaceChildren(
            createElement("p", "empty-state", `Unable to load tasks: ${error.message}`)
        );
    }
}

function resetForm() {
    taskForm.reset();
    taskIdInput.value = "";
    statusInput.classList.add("hidden");
    document.getElementById("status-label").classList.add("hidden");
    document.getElementById("form-heading").textContent = "Add a task";
    document.getElementById("submit-button").textContent = "Add task";
    document.getElementById("cancel-button").classList.add("hidden");
    showMessage();
}

function startEditing(task) {
    taskIdInput.value = task.id;
    titleInput.value = task.title;
    descriptionInput.value = task.description;
    statusInput.value = task.status;

    statusInput.classList.remove("hidden");
    document.getElementById("status-label").classList.remove("hidden");
    document.getElementById("form-heading").textContent = "Edit task";
    document.getElementById("submit-button").textContent = "Save changes";
    document.getElementById("cancel-button").classList.remove("hidden");
    showMessage();

    titleInput.focus();
    document.querySelector(".form-panel").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

taskForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage();

    const id = taskIdInput.value;
    const payload = {
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        status: id ? statusInput.value : "Pending"
    };

    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;

    try {
        await apiRequest(id ? `/api/tasks/${id}` : "/api/tasks", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });

        resetForm();
        await loadTasks();
    } catch (error) {
        showMessage(error.message);
    } finally {
        submitButton.disabled = false;
    }
});

async function deleteTask(id) {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
        await apiRequest(`/api/tasks/${id}`, { method: "DELETE" });
        if (taskIdInput.value === String(id)) resetForm();
        await loadTasks();
    } catch (error) {
        window.alert(error.message);
    }
}

document.getElementById("cancel-button").addEventListener("click", resetForm);
taskFilter.addEventListener("change", renderTasks);

loadTasks();
