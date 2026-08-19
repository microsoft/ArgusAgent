import { FileCheck2, Github, Globe2, PackageCheck, Presentation, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '../components/Common';
import { useWorkbenchText } from '../useWorkbenchText';
import type { WorkspacePageProps } from './pageTypes';

const FUTURE_MODULES = [
  { icon: Github, title: 'GitHub Repository', zhDetail: 'README、LICENSE、CITATION.cff、环境文件、Secret Scan 与人工确认后的仓库创建。', enDetail: 'Prepare README, LICENSE, CITATION.cff, environment files, secret scanning, and an approved repository.', zhItems: ['选择账户与可见性', '生成发布清单', '预览 Git diff', '人工批准后 push'], enItems: ['Choose account and visibility', 'Generate release manifest', 'Preview Git diff', 'Push after approval'] },
  { icon: Presentation, title: 'Academic Poster', zhDetail: '从最终稿、图表和结果中生成可审阅的学术海报。', enDetail: 'Generate a reviewable academic poster from the final paper, figures, and results.', zhItems: ['A0/A1 与横竖版', '机构 Logo 与主题', '图表布局', 'PDF / PNG / SVG'], enItems: ['A0/A1 portrait or landscape', 'Institution logo and theme', 'Figure layout', 'PDF / PNG / SVG'] },
  { icon: Globe2, title: 'Project Page', zhDetail: '生成论文项目宣传页和可部署的静态站点。', enDetail: 'Generate a paper project page and deployable static site.', zhItems: ['方法与结果展示', '交互式图表', 'Paper / Code / Model', '预览后部署'], enItems: ['Methods and results', 'Interactive charts', 'Paper / Code / Model', 'Deploy after preview'] },
] as const;

export function ReleasePage(props: WorkspacePageProps) {
  const { text } = useWorkbenchText();
  return (
    <div className="ros-page release-page">
      <header className="ros-page-header"><div><div className="eyebrow">RESULTS RELEASE</div><h1>{text('成果发布', 'Results release')}</h1><p>{text('未来用于把研究工作整理成 GitHub 仓库、学术海报和项目宣传页。当前只展示规划，不执行发布。', 'Plan a GitHub repository, academic poster, and project page. This view does not publish anything yet.')}</p></div><Badge tone="warn">{text('敬请期待', 'Planned')}</Badge></header>
      <section className="release-hero"><span><Sparkles size={28} /></span><div><div className="eyebrow">PLANNED WORKSPACE</div><h2>{text('从研究产物到可审核的公开成果', 'From research artifacts to reviewable public outputs')}</h2><p>{text('后续将调用受审计的 AI Agent 基于真实工作区生成发布补丁和视觉资产，但任何外部创建、push 或部署都需要人工批准。', 'Audited agents will generate release patches and visual assets from the real workspace, while every external create, push, or deploy requires approval.')}</p></div></section>
      <div className="release-module-grid">{FUTURE_MODULES.map((module) => { const Icon = module.icon; const items = text(module.zhItems.join('\n'), module.enItems.join('\n')).split('\n'); return <article className="release-module" key={module.title}><header><span><Icon size={20} /></span><Badge tone="neutral">{text('规划中', 'Planned')}</Badge></header><h3>{module.title}</h3><p>{text(module.zhDetail, module.enDetail)}</p><ul>{items.map((item) => <li key={item}><FileCheck2 size={13} />{item}</li>)}</ul></article>; })}</div>
      <section className="release-flow"><div><PackageCheck size={18} /><strong>{text('扫描批准的工作区', 'Scan approved workspace')}</strong><small>{props.snapshot.session.workdir || props.project.workdir}</small></div><b>→</b><div><Sparkles size={18} /><strong>{text('生成发布计划', 'Generate release plan')}</strong><small>{text('只生成补丁，不直接发布', 'Generate patches without publishing')}</small></div><b>→</b><div><ShieldCheck size={18} /><strong>{text('安全与匿名检查', 'Safety and anonymity checks')}</strong><small>{text('Secrets、License、身份信息', 'Secrets, licenses, and identity')}</small></div><b>→</b><div><Github size={18} /><strong>{text('人工批准', 'Human approval')}</strong><small>{text('之后才允许外部 push / deploy', 'Required before push or deploy')}</small></div></section>
      <section className="release-boundary"><ShieldCheck size={18} /><div><strong>{text('当前边界', 'Current boundary')}</strong><p>{text('页面没有可点击的假发布按钮，也没有合成进度。等 release manifest、异步 Job、Secret Scan 和审批记录后再启用。', 'There are no fake publish controls or synthetic progress indicators. Publishing stays disabled until manifests, async jobs, secret scanning, and approval records exist.')}</p></div></section>
    </div>
  );
}
