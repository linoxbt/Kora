import React, { useEffect, useState } from 'react';
import type { AuthConfig, AuthProps } from './microsendr-auth.js';
const Auth = React.lazy(() => import('./microsendr-auth.js').then(module => ({ default: module.MicrosendrAuth })));
export function MicrosendrAuth(props: AuthProps) {
  const [config, setConfig] = useState<AuthConfig>();
  useEffect(() => { void fetch('/console/auth/config').then(response => response.json()).then(setConfig).catch(() => setConfig({ enabled: false })); }, []);
  if (!config) return <p className="personal-muted">Loading sign-in…</p>;
  if (!config.enabled || !config.app_id) return <p className="personal-muted">Sign-in is being set up. Please check back soon.</p>;
  return <React.Suspense fallback={<p className="personal-muted">Loading sign-in…</p>}><Auth {...props} config={config}/></React.Suspense>;
}
