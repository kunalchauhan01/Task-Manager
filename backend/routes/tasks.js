const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects/:projectId/tasks
router.get('/projects/:projectId/tasks', authenticate, requireProjectAccess, (req, res) => {
  const { status, priority, assignee } = req.query;
  let query = `
    SELECT t.*, u.name as assignee_name, u.email as assignee_email, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.creator_id = c.id
    WHERE t.project_id = ?
  `;
  const params = [req.params.projectId];

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
  if (assignee) { query += ' AND t.assignee_id = ?'; params.push(assignee); }

  query += ' ORDER BY t.created_at DESC';
  const tasks = db.prepare(query).all(...params);
  res.json({ tasks });
});

// POST /api/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', authenticate, requireProjectAccess, [
  body('title').trim().notEmpty().withMessage('Task title required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assigneeId').optional().isInt(),
  body('dueDate').optional().isISO8601()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, status = 'todo', priority = 'medium', assigneeId, dueDate } = req.body;

  // Validate assignee is a project member
  if (assigneeId) {
    const isMember = db.prepare(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.params.projectId, assigneeId);
    if (!isMember) return res.status(400).json({ error: 'Assignee must be a project member' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, creator_id, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description, status, priority, req.params.projectId, assigneeId || null, req.user.id, dueDate || null);

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.creator_id = c.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ task });
});

// GET /api/tasks/:id
router.get('/tasks/:id', authenticate, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.creator_id = c.id
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comments = db.prepare(`
    SELECT tc.*, u.name as user_name
    FROM task_comments tc JOIN users u ON tc.user_id = u.id
    WHERE tc.task_id = ?
    ORDER BY tc.created_at ASC
  `).all(req.params.id);

  res.json({ task, comments });
});

// PUT /api/tasks/:id
router.put('/tasks/:id', authenticate, [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assigneeId').optional(),
  body('dueDate').optional()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Check access
  const membership = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.user.id);

  if (!membership && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No access to this task' });
  }

  const {
    title = task.title,
    description = task.description,
    status = task.status,
    priority = task.priority,
    assigneeId = task.assignee_id,
    dueDate = task.due_date
  } = req.body;

  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?,
    assignee_id = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, status, priority, assigneeId || null, dueDate || null, req.params.id);

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.creator_id = c.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json({ task: updated });
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', authenticate, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (task.creator_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only task creator or admin can delete' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

// POST /api/tasks/:id/comments
router.post('/tasks/:id/comments', authenticate, [
  body('comment').trim().notEmpty().withMessage('Comment cannot be empty')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const result = db.prepare(
    'INSERT INTO task_comments (task_id, user_id, comment) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, req.body.comment);

  const comment = db.prepare(`
    SELECT tc.*, u.name as user_name FROM task_comments tc
    JOIN users u ON tc.user_id = u.id WHERE tc.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ comment });
});

// GET /api/dashboard - Summary stats for current user
router.get('/dashboard', authenticate, (req, res) => {
  let projectsQuery, tasksQuery;

  if (req.user.role === 'admin') {
    projectsQuery = `SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM projects`;
    tasksQuery = `SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN due_date < date('now') AND status != 'done' THEN 1 ELSE 0 END) as overdue
      FROM tasks`;
  } else {
    projectsQuery = `SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM projects WHERE owner_id = ${req.user.id} OR id IN (
        SELECT project_id FROM project_members WHERE user_id = ${req.user.id}
      )`;
    tasksQuery = `SELECT COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN due_date < date('now') AND status != 'done' THEN 1 ELSE 0 END) as overdue
      FROM tasks WHERE assignee_id = ${req.user.id} OR creator_id = ${req.user.id}`;
  }

  const projectStats = db.prepare(projectsQuery).get();
  const taskStats = db.prepare(tasksQuery).get();

  // Recent tasks
  const recentTasks = req.user.role === 'admin'
    ? db.prepare(`
        SELECT t.*, u.name as assignee_name, p.name as project_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        JOIN projects p ON t.project_id = p.id
        ORDER BY t.updated_at DESC LIMIT 10
      `).all()
    : db.prepare(`
        SELECT t.*, u.name as assignee_name, p.name as project_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        JOIN projects p ON t.project_id = p.id
        WHERE t.assignee_id = ? OR t.creator_id = ?
        ORDER BY t.updated_at DESC LIMIT 10
      `).all(req.user.id, req.user.id);

  // Overdue tasks
  const overdueTasks = req.user.role === 'admin'
    ? db.prepare(`
        SELECT t.*, u.name as assignee_name, p.name as project_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        JOIN projects p ON t.project_id = p.id
        WHERE t.due_date < date('now') AND t.status != 'done'
        ORDER BY t.due_date ASC LIMIT 10
      `).all()
    : db.prepare(`
        SELECT t.*, u.name as assignee_name, p.name as project_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        JOIN projects p ON t.project_id = p.id
        WHERE (t.assignee_id = ? OR t.creator_id = ?)
        AND t.due_date < date('now') AND t.status != 'done'
        ORDER BY t.due_date ASC LIMIT 10
      `).all(req.user.id, req.user.id);

  res.json({ projectStats, taskStats, recentTasks, overdueTasks });
});

module.exports = router;
