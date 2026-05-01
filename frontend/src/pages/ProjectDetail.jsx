import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { format, parseISO, isPast } from 'date-fns';

const StatusBadge = ({ s }) => <span className={`badge badge-${s}`}>{s.replace('_', ' ')}</span>;
const PriorityBadge = ({ p }) => <span className={`badge badge-${p}`}>{p}</span>;

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function TaskModal({ onClose, onSave, members, task }) {
  const [form, setForm] = useState(task || { title: '', description: '', status: 'todo', priority: 'medium', assigneeId: '', dueDate: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await onSave(form); onClose(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" required placeholder="Task title"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="Details..."
                value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Assignee</label>
                <select className="form-select" value={form.assigneeId || ''} onChange={e => setForm(p => ({ ...p, assigneeId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input"
                  value={form.dueDate || form.due_date || ''} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMemberModal({ onClose, onAdd, existingIds }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/users').then(res => setUsers(res.data.users.filter(u => !existingIds.includes(u.id))));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) return toast.error('Select a user');
    setLoading(true);
    try { await onAdd(Number(userId), role); onClose(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Add Member</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">User</label>
              <select className="form-select" value={userId} onChange={e => setUserId(e.target.value)} required>
                <option value="">Select user...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Project Role</label>
              <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');

  const load = () => api.get(`/projects/${id}`).then(res => setData(res.data)).catch(() => navigate('/projects')).finally(() => setLoading(false));
  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data) return null;

  const { project, members, tasks } = data;
  const isOwnerOrAdmin = project.owner_id === user.id || user.role === 'admin';

  const handleCreateTask = async (form) => {
    await api.post(`/projects/${id}/tasks`, form);
    toast.success('Task created!');
    load();
  };

  const handleUpdateTask = async (form) => {
    await api.put(`/tasks/${editTask.id}`, form);
    toast.success('Task updated!');
    load();
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await api.delete(`/tasks/${taskId}`);
    toast.success('Task deleted');
    load();
  };

  const handleAddMember = async (userId, role) => {
    await api.post(`/projects/${id}/members`, { userId, role });
    toast.success('Member added!');
    load();
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    await api.delete(`/projects/${id}/members/${userId}`);
    toast.success('Member removed');
    load();
  };

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {});

  const statusLabels = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: '8px' }} onClick={() => navigate('/projects')}>← Back</button>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">{project.description}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className={`badge badge-${project.status}`}>{project.status}</span>
          <button className="btn btn-primary" onClick={() => { setEditTask(null); setShowTaskModal(true); }}>+ New Task</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {['tasks', 'members'].map(tab => (
          <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setActiveTab(tab)} style={{ textTransform: 'capitalize' }}>
            {tab} {tab === 'tasks' ? `(${tasks.length})` : `(${members.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button className={`btn btn-sm ${view === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('kanban')}>⊞ Kanban</button>
            <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('list')}>≡ List</button>
          </div>

          {view === 'kanban' ? (
            <div className="kanban-board">
              {STATUSES.map(status => (
                <div key={status} className="kanban-col">
                  <div className="kanban-col-header">
                    <span>{statusLabels[status]}</span>
                    <span style={{ background: 'var(--surface2)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                      {tasksByStatus[status].length}
                    </span>
                  </div>
                  {tasksByStatus[status].length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0', fontSize: '12px' }}>Empty</div>
                  )}
                  {tasksByStatus[status].map(task => (
                    <div key={task.id} className="task-card" onClick={() => { setEditTask(task); setShowTaskModal(true); }}>
                      <div className="task-title">{task.title}</div>
                      {task.description && <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px' }}>{task.description.slice(0, 60)}{task.description.length > 60 ? '...' : ''}</div>}
                      <div className="task-meta">
                        <PriorityBadge p={task.priority} />
                        {task.assignee_name && <span style={{ fontSize: '11px', color: 'var(--text3)' }}>→ {task.assignee_name}</span>}
                        {task.due_date && <span style={{ fontSize: '11px', color: isPast(parseISO(task.due_date)) && task.status !== 'done' ? 'var(--danger)' : 'var(--text3)' }}>📅 {format(parseISO(task.due_date), 'MMM d')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              {tasks.length === 0 ? (
                <div className="empty-state"><p>No tasks yet. Create the first one!</p></div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Assignee</th>
                      <th>Due Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr key={task.id}>
                        <td style={{ fontWeight: 500 }}>{task.title}</td>
                        <td><StatusBadge s={task.status} /></td>
                        <td><PriorityBadge p={task.priority} /></td>
                        <td style={{ color: 'var(--text2)', fontSize: '13px' }}>{task.assignee_name || '—'}</td>
                        <td style={{ fontSize: '12px', color: task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done' ? 'var(--danger)' : 'var(--text3)' }}>
                          {task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditTask(task); setShowTaskModal(true); }}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'members' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700' }}>Team Members</h2>
            {isOwnerOrAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowMemberModal(true)}>+ Add Member</button>
            )}
          </div>
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Global Role</th><th>Project Role</th><th>Joined</th>{isOwnerOrAdmin && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>{m.name.charAt(0).toUpperCase()}</div>
                      <span style={{ fontWeight: 500 }}>{m.name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: '13px' }}>{m.email}</td>
                  <td><span className={`badge badge-${m.global_role}`}>{m.global_role}</span></td>
                  <td><span className={`badge badge-${m.project_role}`}>{m.project_role}</span></td>
                  <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{format(new Date(m.joined_at), 'MMM d, yyyy')}</td>
                  {isOwnerOrAdmin && (
                    <td>
                      {m.id !== project.owner_id && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.id)}>Remove</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          task={editTask}
          members={members}
          onClose={() => { setShowTaskModal(false); setEditTask(null); }}
          onSave={editTask ? handleUpdateTask : handleCreateTask}
        />
      )}

      {showMemberModal && (
        <AddMemberModal
          existingIds={members.map(m => m.id)}
          onClose={() => setShowMemberModal(false)}
          onAdd={handleAddMember}
        />
      )}
    </div>
  );
}
