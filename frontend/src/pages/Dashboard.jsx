import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { format, isPast, parseISO } from 'date-fns';

const StatusBadge = ({ status }) => <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
const PriorityBadge = ({ priority }) => <span className={`badge badge-${priority}`}>{priority}</span>;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard').then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data) return <div>Failed to load dashboard</div>;

  const { projectStats, taskStats, recentTasks, overdueTasks } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user.name} 👋</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-value">{projectStats.total || 0}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{projectStats.active || 0}</div>
          <div className="stat-label">Active Projects</div>
        </div>
        <div className="stat-card info">
          <div className="stat-value">{taskStats.total || 0}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{taskStats.in_progress || 0}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{taskStats.done || 0}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{taskStats.overdue || 0}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent Tasks */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700' }}>Recent Tasks</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>View all →</button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <p>No tasks yet</p>
            </div>
          ) : (
            recentTasks.slice(0, 6).map(task => (
              <div key={task.id} className="task-card" onClick={() => navigate(`/projects/${task.project_id}`)}>
                <div className="task-title">{task.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>
                  {task.project_name}
                </div>
                <div className="task-meta">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  {task.due_date && (
                    <span style={{ fontSize: '11px', color: isPast(parseISO(task.due_date)) && task.status !== 'done' ? 'var(--danger)' : 'var(--text3)' }}>
                      Due {format(parseISO(task.due_date), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Overdue Tasks */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--danger)' }}>⚠ Overdue Tasks</h2>
            <span className="badge badge-urgent">{overdueTasks.length}</span>
          </div>
          {overdueTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <div className="icon">✅</div>
              <p>All caught up!</p>
            </div>
          ) : (
            overdueTasks.map(task => (
              <div key={task.id} className="task-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                onClick={() => navigate(`/projects/${task.project_id}`)}>
                <div className="task-title">{task.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>{task.project_name}</div>
                <div className="task-meta">
                  <StatusBadge status={task.status} />
                  <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '600' }}>
                    Due {format(parseISO(task.due_date), 'MMM d, yyyy')}
                  </span>
                  {task.assignee_name && (
                    <span style={{ fontSize: '11px', color: 'var(--text3)' }}>→ {task.assignee_name}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Status breakdown */}
      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Task Status Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'To Do', value: taskStats.todo || 0, color: '#94a3b8' },
            { label: 'In Progress', value: taskStats.in_progress || 0, color: 'var(--info)' },
            { label: 'In Review', value: taskStats.review || 0, color: 'var(--warning)' },
            { label: 'Done', value: taskStats.done || 0, color: 'var(--success)' },
          ].map(item => (
            <div key={item.label} style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: item.color, fontFamily: 'DM Mono, monospace' }}>{item.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>{item.label}</div>
              <div style={{ height: '3px', background: item.color, borderRadius: '2px', marginTop: '10px', opacity: 0.6 }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
