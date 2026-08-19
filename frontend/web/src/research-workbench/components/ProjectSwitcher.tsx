import { Check, ChevronDown, FolderKanban } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ProjectRow } from '../types';
import { cx, formatDuration } from '../utils';

export function ProjectSwitcher({ projects, activeId, onSelect }: { projects: ProjectRow[]; activeId: string; onSelect: (sid: string) => void }) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<Array<HTMLButtonElement | null>>([]);
  const active = projects.find((project) => project.id === activeId);
  useEffect(() => {
    if (!open) return;
    const initial = Math.max(0, projects.findIndex((project) => project.id === activeId));
    setFocused(initial);
    requestAnimationFrame(() => options.current[initial]?.focus());
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); } };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); window.removeEventListener('keydown', onKey); };
  }, [activeId, open, projects]);
  const moveFocus = (next: number) => {
    const index = (next + projects.length) % projects.length;
    setFocused(index); options.current[index]?.focus();
  };
  const choose = (index: number) => { const project = projects[index]; if (!project) return; onSelect(project.id); setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  return (
    <div ref={root} className="custom-project-switcher">
      <button ref={trigger} type="button" className={cx('project-switcher-trigger', open && 'is-open')} onClick={() => setOpen((value) => !value)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }} aria-haspopup="listbox" aria-expanded={open}>
        <span className={cx('status-dot', active?.daemon_alive && 'is-live')} />
        <strong>{active?.display_name || active?.label || activeId}</strong>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="project-switcher-popover" role="listbox" aria-label="切换项目" onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(focused + 1); } else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(focused - 1); } else if (event.key === 'Home') { event.preventDefault(); moveFocus(0); } else if (event.key === 'End') { event.preventDefault(); moveFocus(projects.length - 1); } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(focused); } }}>
          <header><span>ARGUS PROJECTS</span><strong>切换研究项目</strong></header>
          <div>
            {projects.map((project) => {
              const selected = project.id === activeId;
              return (
                <button ref={(element) => { options.current[projects.indexOf(project)] = element; }} key={project.id} type="button" role="option" aria-selected={selected} tabIndex={focused === projects.indexOf(project) ? 0 : -1} className={selected ? 'is-selected' : ''} onFocus={() => setFocused(projects.indexOf(project))} onClick={() => choose(projects.indexOf(project))}>
                  <span className={cx('project-option-icon', project.daemon_alive && 'is-live')}><FolderKanban size={16} /></span>
                  <span className="project-option-copy"><strong>{project.display_name || project.label || project.id}</strong><small>{project.workdir || project.launch_cwd || project.id}</small><em>{project.daemon_alive ? `${project.active_role || 'agent'} · ${formatDuration(project.uptime_seconds)}` : 'Stopped'}</em></span>
                  {selected ? <Check size={15} /> : <span className={cx('project-option-status', project.daemon_alive && 'is-live')} />}
                </button>
              );
            })}
          </div>
          <footer><span>{projects.filter((project) => project.daemon_alive).length} running</span><span>{projects.length} total</span></footer>
        </div>
      ) : null}
    </div>
  );
}
