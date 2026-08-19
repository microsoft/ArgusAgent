import { Activity, ArrowRight, Clock3, FolderKanban, Inbox, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, EmptyState } from '../components/Common';
import type { ProjectRow } from '../types';
import { formatDuration } from '../utils';

export function ProjectHubPage({
  projects,
  loading,
  onOpen,
  onStartFromInbox,
}: {
  projects: ProjectRow[];
  loading: boolean;
  onOpen: (sid: string) => void;
  onStartFromInbox: (sid: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [inboxTarget, setInboxTarget] = useState(projects[0]?.id ?? '');
  useEffect(() => { if (!inboxTarget && projects[0]) setInboxTarget(projects[0].id); }, [inboxTarget, projects]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => `${project.display_name} ${project.label} ${project.objective} ${project.workdir}`.toLowerCase().includes(needle));
  }, [projects, query]);
  const running = projects.filter((project) => project.daemon_alive).length;

  return (
    <div className="project-hub">
      <section className="project-hub__hero">
        <div>
          <div className="eyebrow">ARGUS PROJECTS</div>
          <h1>研究项目</h1>
          <p>每个项目拥有独立的 Argus 任务、代码目录、文献证据、实验进程和论文工作区。</p>
        </div>
        <div className="project-intake-start"><select aria-label="选择收信箱目标项目" value={inboxTarget} onChange={(event) => setInboxTarget(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.display_name || project.label || project.id}</option>)}</select><button className="button button--primary button--large" type="button" disabled={!inboxTarget} onClick={() => inboxTarget && onStartFromInbox(inboxTarget)}><Sparkles size={16} />从零散想法开始</button></div>
      </section>

      <section className="project-hub__summary">
        <div><FolderKanban size={18} /><span>全部项目</span><strong>{projects.length}</strong></div>
        <div><Activity size={18} /><span>正在运行</span><strong>{running}</strong></div>
        <div><Clock3 size={18} /><span>累计前台状态</span><strong>{projects.some((item) => item.daemon_alive) ? 'Live' : 'Idle'}</strong></div>
      </section>

      <div className="project-hub__toolbar">
        <h2>所有项目</h2>
        <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、目标或工作目录" /></label>
      </div>

      {loading ? <div className="project-grid">{[0, 1, 2].map((item) => <div className="project-card project-card--skeleton" key={item} />)}</div> : null}
      {!loading && !visible.length ? <EmptyState icon={FolderKanban} title="没有匹配的项目" /> : null}
      <div className="project-grid">
        {visible.map((project) => (
          <button type="button" className="project-card" key={project.id} onClick={() => onOpen(project.id)}>
            <div className="project-card__top">
              <span className={`project-card__mark ${project.daemon_alive ? 'is-live' : ''}`}><FolderKanban size={19} /></span>
              <Badge tone={project.daemon_alive ? 'live' : 'neutral'} dot>{project.daemon_alive ? 'Running' : 'Stopped'}</Badge>
            </div>
            <div className="project-card__copy">
              <h3>{project.display_name || project.label || project.id}</h3>
              <p>{project.current_task || project.objective || '尚未设置研究目标'}</p>
            </div>
            <div className="project-card__facts">
              <div><span>当前角色</span><strong>{project.active_role || '—'}</strong></div>
              <div><span>运行时间</span><strong>{formatDuration(project.uptime_seconds)}</strong></div>
              <div><span>待办</span><strong>{project.unfinished_tasks ?? 0}</strong></div>
            </div>
            <div className="project-card__footer">
              <code>{project.workdir || project.launch_cwd || project.id}</code>
              <span>进入项目 <ArrowRight size={14} /></span>
            </div>
          </button>
        ))}
      </div>

      <button className="project-inbox-cta" type="button" disabled={!inboxTarget} onClick={() => inboxTarget && onStartFromInbox(inboxTarget)}>
        <span><Inbox size={20} /></span>
        <div><strong>还没有完整研究目标？</strong><p>先把导师消息、组会笔记或临时想法放进科研收信箱，由 AI 提取知识点并生成第一版 Argus Prompt。</p></div>
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
