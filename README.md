# TeamPilot - Team Task Manager

TeamPilot is a full-stack task management app for small teams. It includes authentication, role-based permissions, project and task tracking, comments, and a dashboard for progress visibility.

## Tech stack

- Frontend: React 18, Vite, React Router
- Backend: Node.js, Express
- Database: SQLite (`better-sqlite3`)
- Authentication: JWT
- Validation: `express-validator`

## Running the project locally

### Prerequisites

- Node.js 18 or higher
- npm

### 1) Install dependencies

Open two terminals.

Terminal 1 (backend):

```bash
cd backend
npm install
```

Terminal 2 (frontend):

```bash
cd frontend
npm install
```

You can also install both from the project root:

```bash
npm run install:all
```

### 2) Start the servers

Terminal 1 (backend):

```bash
cd backend
npm run dev
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev
```

By default:

- Backend API: `http://localhost:5000`
- Frontend app: `http://localhost:5173` (or next available port)

### 3) Open the app

Visit `http://localhost:5173` in your browser.

## Authentication and roles

- Sign up at `/signup`
- Log in at `/login`
- JWT token is stored in localStorage

Role behavior:

- Admin users can access all projects and the users page
- Members can access only their own assigned projects
- Admins and owners can manage project members

## API overview

### Auth

- `POST /api/auth/signup` - Register a user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `GET /api/auth/users` - List users

### Projects

- `GET /api/projects` - List accessible projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details, tasks, and members
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/members` - Add member
- `DELETE /api/projects/:id/members/:userId` - Remove member

### Tasks

- `GET /api/projects/:projectId/tasks` - List tasks (supports filters)
- `POST /api/projects/:projectId/tasks` - Create task
- `GET /api/tasks/:id` - Get task details with comments
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/comments` - Add comment

### Dashboard

- `GET /api/dashboard` - Get statistics, recent tasks, and overdue tasks

## Database schema

```text
users           -> id, name, email, password, role, created_at
projects        -> id, name, description, status, owner_id, created_at
project_members -> id, project_id, user_id, role, joined_at
tasks           -> id, title, description, status, priority, project_id, assignee_id, creator_id, due_date
task_comments   -> id, task_id, user_id, comment, created_at
```

## Main features

- User authentication (signup and login)
- Role-based access control (admin and member)
- Project and task CRUD
- Kanban and list views for tasks
- Dashboard with summary metrics and overdue items
- Task comments
- Input validation on API endpoints
- Admin user management page

## Environment variables (optional)

Copy `backend/.env.example` to `backend/.env` and set values like:

```env
PORT=5000
JWT_SECRET=your-long-random-secret
```

The app runs without this file using defaults, but a custom `JWT_SECRET` is recommended.
