import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { format, parseISO, isPast } from 'date-fns';

const StatusBadge = ({ s }) => <span className={`badge badge-${s}`}>{s.replace('_', ' ')}</span>;
const PriorityBadge = ({ p }) => <span className={`badge badge-${p}`}>{p}</span>;

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const navigate = useNavigate();

  useEffect(() => {
    // Get all tasks from all accessible projects
    api.get('/projects').then(async res => {
      const projects = res.data.projects;
      const allTasks = [];
      for (const proj of projects) {
        try {
          const r = await api.get(`/projects/${proj.id}/tasks`);
          r.data.tasks.forEach(t => allTasks.push({ ...t, project_name: proj.name }));
        } catch {}
      }
      setTasks(allTasks);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = tasks.filter(t => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Tasks</h1>
          <p className="page-subtitle">{tasks.length} tasks across all your projects</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select className="form-select" style={{ width: '160px' }} value={filters.status}
          onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select className="form-select" style={{ width: '160px' }} value={filters.priority}
          onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        {(filters.status || filters.priority) && (
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ status: '', priority: '' })}>Clear filters</button>
        )}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✓</div>
          <p>No tasks found</p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${task.project_id}`)}>
                  <td style={{ fontWeight: 500, maxWidth: '220px' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: '13px' }}>{task.project_name}</td>
                  <td><StatusBadge s={task.status} /></td>
                  <td><PriorityBadge p={task.priority} /></td>
                  <td style={{ color: 'var(--text2)', fontSize: '13px' }}>{task.assignee_name || '—'}</td>
                  <td>
                    {task.due_date ? (
                      <span style={{ fontSize: '12px', color: isPast(parseISO(task.due_date)) && task.status !== 'done' ? 'var(--danger)' : 'var(--text3)', fontWeight: isPast(parseISO(task.due_date)) && task.status !== 'done' ? 600 : 400 }}>
                        {format(parseISO(task.due_date), 'MMM d, yyyy')}
                        {isPast(parseISO(task.due_date)) && task.status !== 'done' && ' ⚠'}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
