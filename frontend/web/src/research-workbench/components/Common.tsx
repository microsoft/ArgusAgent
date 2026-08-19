import { useQuery } from '@tanstack/react-query';
import {
  Download,
  ExternalLink,
  File,
  FileCode2,
  FileImage,
  FileText,
  LoaderCircle,
  Radio,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import type { ArtifactInfo, EventMsg } from '../types';
import {
  compactPath,
  cx,
  eventDetail,
  eventRole,
  eventTitle,
  formatBytes,
  formatClock,
  statusTone,
  type Tone,
} from '../utils';

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cx('badge', `badge--${tone}`, className)}>
      {dot ? <span className={cx('badge__dot', tone === 'live' && 'is-pulsing')} /> : null}
      {children}
    </span>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx('panel', className)}>
      {title || eyebrow || action ? (
        <header className="panel__header">
          <div className="panel__heading">
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            {title ? <div className="panel__title">{title}</div> : null}
          </div>
          {action ? <div className="panel__action">{action}</div> : null}
        </header>
      ) : null}
      <div className={cx('panel__body', bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon = File,
  title,
  description,
  action,
}: {
  icon?: typeof File;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon size={19} /></span>
      <div className="empty-state__title">{title}</div>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = '加载中' }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <LoaderCircle size={15} className="spin" /> {label}
    </span>
  );
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx('markdown', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noreferrer">{label}<ExternalLink size={11} /></a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function EventTimeline({
  events,
  limit = 24,
  empty = '还没有可展示的实时事件',
  dense = false,
}: {
  events: EventMsg[];
  limit?: number;
  empty?: string;
  dense?: boolean;
}) {
  const rows = events.slice(-limit).reverse();
  if (!rows.length) return <EmptyState icon={Radio} title={empty} />;
  return (
    <div className={cx('event-list', dense && 'event-list--dense')}>
      {rows.map((event, index) => {
        const role = eventRole(event);
        const title = eventTitle(event);
        const detail = eventDetail(event, dense ? 180 : 480);
        const tone = statusTone(String(event.status ?? event.kind ?? event.type ?? ''));
        return (
          <article className="event-row" key={`${event.type}-${event.ts}-${event.message_id ?? index}`}>
            <div className={cx('event-row__marker', `event-row__marker--${tone}`)} />
            <div className="event-row__content">
              <div className="event-row__meta">
                <span className={cx('role-label', `role-label--${role}`)}>{role}</span>
                <time>{formatClock(event.ts)}</time>
              </div>
              <div className="event-row__title">{title}</div>
              {detail ? <div className="event-row__detail">{detail}</div> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function artifactIcon(item: ArtifactInfo) {
  if (item.kind === 'image') return FileImage;
  if (['text', 'markdown', 'json', 'table', 'html'].includes(item.kind)) return FileCode2;
  return FileText;
}

export function ArtifactList({
  artifacts,
  selected,
  onSelect,
  empty = '暂无已注册产物',
}: {
  artifacts: ArtifactInfo[];
  selected?: string | null;
  onSelect: (item: ArtifactInfo) => void;
  empty?: string;
}) {
  if (!artifacts.length) return <EmptyState icon={FileText} title={empty} description="Argus 注册或 Reviewer 认证产物后会自动出现在这里。" />;
  return (
    <div className="artifact-list">
      {artifacts.map((item) => {
        const Icon = artifactIcon(item);
        return (
          <button
            type="button"
            key={item.path}
            className={cx('artifact-row', selected === item.path && 'is-selected')}
            onClick={() => onSelect(item)}
          >
            <Icon size={15} />
            <span className="artifact-row__main">
              <strong>{item.name}</strong>
              <small title={item.path}>{compactPath(item.path)}</small>
            </span>
            <span className="artifact-row__size">{formatBytes(item.size)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ArtifactViewer({
  sid,
  artifact,
  fill = true,
}: {
  sid: string;
  artifact: ArtifactInfo | null;
  fill?: boolean;
}) {
  const textLike = artifact && ['text', 'markdown', 'html', 'json', 'table'].includes(artifact.kind);
  const detail = useQuery({
    queryKey: ['v2-artifact-detail', sid, artifact?.path, artifact?.mtime],
    queryFn: ({ signal }) => api.artifact(sid, artifact!.path, signal),
    enabled: Boolean(artifact?.exists && textLike),
  });
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaError, setMediaError] = useState('');
  const media = Boolean(artifact && ['image', 'pdf', 'audio', 'video'].includes(artifact.kind));

  useEffect(() => {
    setMediaUrl('');
    setMediaError('');
    if (!artifact?.exists || !media) return;
    const controller = new AbortController();
    let objectUrl = '';
    api.artifactBlob(sid, artifact.path, false, controller.signal).then(
      (blob) => {
        objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
      },
      (error: Error) => setMediaError(error.message),
    );
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artifact?.exists, artifact?.mtime, artifact?.path, media, sid]);

  const language = useMemo(() => artifact?.name.split('.').pop()?.toUpperCase() ?? '', [artifact?.name]);

  if (!artifact) {
    return <div className={cx('artifact-viewer', fill && 'artifact-viewer--fill')}><EmptyState title="选择一个文件预览" description="这里只展示 Argus 后端允许读取的项目产物。" /></div>;
  }

  const download = async () => {
    const blob = await api.artifactBlob(sid, artifact.path, true);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cx('artifact-viewer', fill && 'artifact-viewer--fill')}>
      <header className="artifact-viewer__bar">
        <div className="artifact-viewer__identity">
          <strong>{artifact.name}</strong>
          <span title={artifact.path}>{artifact.path}</span>
        </div>
        <div className="artifact-viewer__tools">
          <Badge tone="neutral">{language || artifact.kind}</Badge>
          <button className="icon-button" type="button" onClick={() => void download()} aria-label="下载文件" title="下载">
            <Download size={15} />
          </button>
        </div>
      </header>
      {artifact.why ? <div className="artifact-viewer__why">{artifact.why}</div> : null}
      <div className="artifact-viewer__content">
        {detail.isLoading || (media && !mediaUrl && !mediaError) ? <Spinner label="正在读取产物" /> : null}
        {detail.isError ? <div className="inline-error">{detail.error.message}</div> : null}
        {mediaError ? <div className="inline-error">{mediaError}</div> : null}
        {detail.data?.kind === 'markdown' ? <Markdown>{detail.data.preview || '（空文件）'}</Markdown> : null}
        {detail.data && ['text', 'html', 'json', 'table'].includes(detail.data.kind) ? (
          <pre className="code-preview">{detail.data.preview || '（空文件）'}{detail.data.truncated ? '\n\n… 预览已截断' : ''}</pre>
        ) : null}
        {artifact.kind === 'image' && mediaUrl ? <img className="media-preview" src={mediaUrl} alt={artifact.why || artifact.name} /> : null}
        {artifact.kind === 'pdf' && mediaUrl ? <embed className="pdf-preview" src={`${mediaUrl}#toolbar=0&view=FitH`} type="application/pdf" /> : null}
        {artifact.kind === 'audio' && mediaUrl ? <audio controls src={mediaUrl} /> : null}
        {artifact.kind === 'video' && mediaUrl ? <video className="video-preview" controls src={mediaUrl} /> : null}
        {artifact.kind === 'binary' ? <EmptyState title="该二进制文件仅支持下载" /> : null}
      </div>
      <footer className="artifact-viewer__footer">
        <span>{artifact.source?.replaceAll('_', ' ') || 'artifact'}</span>
        <span>{formatBytes(artifact.size)}</span>
      </footer>
    </div>
  );
}
