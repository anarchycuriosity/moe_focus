import { useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { AnimeBackground } from './components/layout/AnimeBackground'
import { SakuraParticles } from './components/widgets/SakuraParticles'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AppRoutes } from './routes'
import { init_theme } from './styles/theme'

export function App(): JSX.Element
{
  useEffect(() =>
  {
    init_theme()
  }, [])

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
