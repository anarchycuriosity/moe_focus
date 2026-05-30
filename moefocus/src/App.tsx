// ===== MoeFocus 根组件 =====
// Phase 1: HashRouter + MainLayout (标题栏/侧边栏) + AnimeBackground
// Phase 2: 内嵌 TodayPage (DndContext 在 TodayPage 内部)
// Phase 7: SakuraParticles (樱花粒子) + PhotoFrame (相框装饰)

import { HashRouter } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { AnimeBackground } from './components/layout/AnimeBackground'
import { SakuraParticles } from './components/widgets/SakuraParticles'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AppRoutes } from './routes'

export function App(): JSX.Element
{
  return (
    <HashRouter>
      <ErrorBoundary>
        <AnimeBackground />
        <MainLayout>
          <AppRoutes />
        </MainLayout>
        <SakuraParticles />
      </ErrorBoundary>
    </HashRouter>
  )
}
