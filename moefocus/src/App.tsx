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
