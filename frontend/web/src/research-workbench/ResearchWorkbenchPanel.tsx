import {
  BookOpen,
  Code2,
  FileText,
  FlaskConical,
  FolderKanban,
  Inbox,
  Megaphone,
  MessagesSquare,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { EmptyState, Spinner } from './components/Common';
import { CopilotPage } from './pages/CopilotPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { IdePage } from './pages/IdePage';
import { InboxPage } from './pages/InboxPage';
import { LiteraturePage } from './pages/LiteraturePage';
import type { WorkspacePageProps } from './pages/pageTypes';
import { PaperPage } from './pages/PaperPage';
import { ProjectOverviewPage } from './pages/ProjectOverviewPage';
import { ReviewerPage } from './pages/ReviewerPage';
import { ReleasePage } from './pages/ReleasePage';
import type { PageId } from './types';
import { useArgusData, useProjects } from './useArgusData';
import './styles.css';

const MODULES = [
  ['overview', '项目概览', 'Project overview', FolderKanban],
  ['experiments', '实验进程', 'Experiments', FlaskConical],
  ['copilot', 'Research Copilot', 'Research Copilot', MessagesSquare],
  ['literature', '文献中心', 'Literature', BookOpen],
  ['inbox', '科研收信箱', 'Research inbox', Inbox],
  ['ide', 'AI IDE', 'AI IDE', Code2],
  ['paper', '论文工作区', 'Paper', FileText],
  ['reviewer', '模拟审稿', 'Reviewer', ShieldCheck],
  ['release', '成果发布', 'Release', Megaphone],
] as const satisfies ReadonlyArray<readonly [PageId, string, string, typeof FolderKanban]>;

export function ResearchWorkbenchPanel({ sid, active }: { sid: string; active: boolean }) {
  const { locale } = useI18n();
  const [page, setPage] = useState<PageId>('overview');
  const projectsQ = useProjects(active);
  const projects = projectsQ.data?.projects ?? [];
  const project = useMemo(() => projects.find((item) => item.id === sid) ?? null, [projects, sid]);
  const data = useArgusData(sid, active);
  const controlError = data.controls.start.error || data.controls.stop.error;
  const pageProps: WorkspacePageProps | null = project && data.snapshot.data ? {
    sid,
    project,
    snapshot: data.snapshot.data,
    status: data.status.data,
    events: data.events,
    transcript: data.transcript.data ?? [],
    artifacts: data.artifacts.data ?? [],
    gitDiff: data.gitDiff.data,
    journal: data.journal.data ?? [],
    connected: data.connected,
    snapshotUpdatedAt: data.snapshot.dataUpdatedAt,
    refresh: data.refresh,
    controls: {
      start: async () => { try { return await data.controls.start.mutateAsync(); } catch { return null; } },
      stop: async (drain) => { try { return await data.controls.stop.mutateAsync(drain); } catch { return null; } },
      busy: data.controls.start.isPending || data.controls.stop.isPending,
      error: controlError instanceof Error ? controlError.message : '',
    },
    navigate: setPage,
  } : null;

  const content = (() => {
    if (!pageProps) return null;
    if (page === 'overview') return <ProjectOverviewPage {...pageProps} />;
    if (page === 'experiments') return <ExperimentsPage {...pageProps} />;
    if (page === 'copilot') return <CopilotPage {...pageProps} />;
    if (page === 'literature') return <LiteraturePage {...pageProps} />;
    if (page === 'inbox') return <InboxPage {...pageProps} />;
    if (page === 'ide') return <IdePage {...pageProps} />;
    if (page === 'paper') return <PaperPage {...pageProps} />;
    if (page === 'reviewer') return <ReviewerPage {...pageProps} />;
    return <ReleasePage {...pageProps} />;
  })();

  return (
    <section className="integrated-workbench flex min-h-0 flex-1 flex-col bg-transparent text-ink">
      <nav className="workbench-module-tabs shrink-0 border-b border-line/60 px-3 py-2" aria-label={locale === 'zh-CN' ? '科研工作台模块' : 'Research workbench modules'}>
        <div className="flex flex-wrap gap-1">
          {MODULES.map(([id, zh, en, Icon]) => (
            <button
              key={id}
              type="button"
              className="workbench-module-tab"
              data-selected={page === id}
              onClick={() => setPage(id)}
            >
              <Icon size={14} />
              <span>{locale === 'zh-CN' ? zh : en}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className="ros-content min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {projectsQ.isError || data.snapshot.isError && !data.snapshot.data ? (
          <EmptyState title={locale === 'zh-CN' ? '工作台读取失败' : 'Workbench unavailable'} description="Argus API did not return the selected project." />
        ) : !pageProps ? (
          <div className="boot-state"><Spinner label={locale === 'zh-CN' ? '正在载入工作台' : 'Loading workbench'} /></div>
        ) : content}
      </div>
    </section>
  );
}
