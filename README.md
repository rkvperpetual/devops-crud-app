# Task Manager CRUD Application

A simple task manager built with HTML, CSS, JavaScript, Python Flask and SQLite.

## Features

- Create, read, update and delete tasks
- Task status: Pending, In Progress, Completed
- Filter tasks by status
- Summary counts
- SQLite database stored separately from application code
- Health endpoint at `/healthz`

## Requirements

- Python 3.10+
- pip

## Run locally

```bash
python -m venv .venv
```

Activate the environment:

Windows PowerShell:
```powershell
.venv\Scripts\Activate.ps1
```

Linux / macOS:
```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local data directory and set the database path.

Windows PowerShell:
```powershell
New-Item -ItemType Directory -Force data
$env:DB_PATH = "data/tasks.db"
python app.py
```

Linux / macOS:
```bash
mkdir -p data
DB_PATH=./data/tasks.db python app.py
```

Open http://localhost:5000

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/<id>` | Update a task |
| DELETE | `/api/tasks/<id>` | Delete a task |
| GET | `/healthz` | Application and database health check |

## Database persistence

The app uses the `DB_PATH` environment variable. For the container and future Kubernetes deployment, it defaults to:

```text
/data/tasks.db
```

The Kubernetes PersistentVolumeClaim will later be mounted at `/data`.

**Important:** SQLite is intended for this learning project with one application replica and one persistent volume. Do not run multiple application replicas against the same SQLite database file using a typical shared filesystem. For multi-replica production deployments, use PostgreSQL or another database service.

## Build and run with Docker

```bash
docker build -t devops-task-manager:v1 .
docker run -d \
  --name task-manager \
  -p 5000:5000 \
  -v task-manager-data:/data \
  devops-task-manager:v1
```

Open http://localhost:5000
