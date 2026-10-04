import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { request } from './api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    request('/bootstrap').then(setView, (e) => setError(e.message));
  }, []);

  // Runs a mutation and replaces the view with the server's recomputed one.
  const mutate = useCallback(async (path, options) => {
    try {
      setView(await request(path, options));
      setError(null);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, []);

  return <AppContext.Provider value={{ view, error, mutate, clearError: () => setError(null) }}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}

// Minimal hash router: #/path?x=y
export function useRoute() {
  const parse = () => {
    const hash = window.location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = hash.split('?');
    return { path, params: Object.fromEntries(new URLSearchParams(query)) };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onHash = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
