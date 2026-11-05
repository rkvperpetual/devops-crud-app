import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# In Kubernetes, we will mount a PersistentVolumeClaim at /data.
DB_PATH = os.environ.get("DB_PATH", "/data/tasks.db")


@contextmanager
def get_db_connection():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=10000")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    with get_db_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending', 'In Progress', 'Completed')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/healthz")
def health_check():
    try:
        with get_db_connection() as connection:
            connection.execute("SELECT 1")
        return jsonify({"status": "healthy"}), 200
    except sqlite3.Error:
        return jsonify({"status": "unhealthy"}), 500


@app.get("/api/tasks")
def get_tasks():
    with get_db_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM tasks ORDER BY id DESC"
        ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/tasks")
def create_task():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()

    if not title:
        return jsonify({"error": "Task title is required."}), 400
    if len(title) > 100:
        return jsonify({"error": "Title must be 100 characters or fewer."}), 400
    if len(description) > 500:
        return jsonify({"error": "Description must be 500 characters or fewer."}), 400

    with get_db_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO tasks (title, description) VALUES (?, ?)",
            (title, description)
        )
        task_id = cursor.lastrowid
        row = connection.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return jsonify(dict(row)), 201


@app.put("/api/tasks/<int:task_id>")
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    status = str(data.get("status", "Pending")).strip()

    allowed_statuses = {"Pending", "In Progress", "Completed"}
    if not title:
        return jsonify({"error": "Task title is required."}), 400
    if len(title) > 100:
        return jsonify({"error": "Title must be 100 characters or fewer."}), 400
    if len(description) > 500:
        return jsonify({"error": "Description must be 500 characters or fewer."}), 400
    if status not in allowed_statuses:
        return jsonify({"error": "Invalid task status."}), 400

    with get_db_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        if existing is None:
            return jsonify({"error": "Task not found."}), 404

        connection.execute(
            """UPDATE tasks
               SET title = ?, description = ?, status = ?
               WHERE id = ?""",
            (title, description, status, task_id)
        )
        row = connection.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    return jsonify(dict(row))


@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    with get_db_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM tasks WHERE id = ?", (task_id,)
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Task not found."}), 404

    return jsonify({"message": "Task deleted successfully."})


initialize_database()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
