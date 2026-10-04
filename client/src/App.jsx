import { AppProvider, useApp, useRoute } from './state.jsx';
import Logo from './components/Logo.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Assistant from './pages/Assistant.jsx';
import Compare from './pages/Compare.jsx';
import Workspace from './pages/Workspace.jsx';
import Deadlines from './pages/Deadlines.jsx';
import Scholarships from './pages/Scholarships.jsx';
import Exams from './pages/Exams.jsx';
import Documents from './pages/Documents.jsx';
import Profile from './pages/Profile.jsx';
import Sources from './pages/Sources.jsx';

const NAV = [
  ['/', 'Dashboard'],
  ['/assistant', 'Assistant'],
  ['/compare', 'Compare'],
  ['/deadlines', 'Deadlines'],
  ['/scholarships', 'Scholarships'],
  ['/exams', 'Exams'],
  ['/documents', 'Documents'],
  ['/profile', 'Profile'],
  ['/sources', 'Sources'],
];

function Shell() {
  const { view, error, clearError } = useApp();
  const route = useRoute();

  let page;
  if (!view) page = <p className="muted">{error ? `Could not load: ${error}` : 'Loading…'}</p>;
  else if (route.path.startsWith('/app/')) page = <Workspace id={decodeURIComponent(route.path.slice(5))} />;
  else
    page =
      {
        '/': <Dashboard />,
        '/assistant': <Assistant />,
        '/compare': <Compare />,
        '/deadlines': <Deadlines />,
        '/scholarships': <Scholarships />,
        '/exams': <Exams />,
        '/documents': <Documents />,
        '/profile': <Profile />,
        '/sources': <Sources />,
      }[route.path] || <p>Page not found.</p>;

  const active = (path) => (path === '/' ? route.path === '/' : route.path.startsWith(path)) || (path === '/compare' && route.path.startsWith('/app/'));

  return (
    <div className="layout">
      <nav className="sidebar">
        <a className="brand" href="#/">
          <Logo />
        </a>
        <ul>
          {NAV.map(([path, name]) => (
            <li key={path}>
              <a href={`#${path}`} className={active(path) ? 'active' : ''}>
                {name}
              </a>
            </li>
          ))}
        </ul>
        {view && <div className="sidebar-foot muted small">Today: {view.today}</div>}
      </nav>
      <main className="content">
        {error && view && (
          <div className="alert" onClick={clearError}>
            {error} <span className="muted">(click to dismiss)</span>
          </div>
        )}
        {page}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
