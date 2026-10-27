import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './lib/supabase';
import GeneratePlayers from './GeneratePlayers';
import PlayerDatabase from './PlayerDatabase';

type View =
  | 'dashboard'
  | 'generate'
  | 'database'
  | 'development'
  | 'retirements'
  | 'settings';

const NAV_ITEMS: { id: View; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Population and season overview' },
  { id: 'generate', label: 'Generate Players', description: 'Single player or population batch' },
  { id: 'database', label: 'Player Database', description: 'Search, filter, inspect and export' },
  { id: 'development', label: 'Development', description: 'Monthly season advancement and career changes' },
  { id: 'retirements', label: 'Retired Players', description: 'Career archive' },
  { id: 'settings', label: 'Generator Settings', description: 'Universal trends for future players' }
];

const PLANNED_CARDS = [
  ['Generate One Player', 'Create one permanent player and inspect the complete generated profile.'],
  ['Generate Population', 'Create a large entry pool using the active universe model.'],
  ['Advance Season', 'Apply one month of development, aging and retirement as one recorded transaction.'],
  ['Export Population', 'Download current player data for spreadsheet analysis.']
];

function LoginPanel() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email) return;
    setSending(true);
    setMessage('');
    const redirectTo = new URL('/CenturyLeague/', window.location.origin).toString();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    setSending(false);
    setMessage(error ? error.message : 'Check your email for the CenturyLeague sign-in link.');
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">CenturyLeague</p>
        <h1>Player Registry</h1>
        <p className="lede">
          The persistent registry for generated Century players, career development,
          team assignments and historical ratings.
        </p>

        {!supabaseConfigured ? (
          <div className="notice warning">
            Supabase environment variables are not configured for this deployment.
          </div>
        ) : (
          <form onSubmit={submit} className="login-form">
            <label>
              Commissioner email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>
            <button type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
        {message && <p className="form-message">{message}</p>}
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [authorization, setAuthorization] = useState<'checking' | 'authorized' | 'unauthorized'>('checking');
  const [role, setRole] = useState<string | null>(null);
  const [activeGenerator, setActiveGenerator] = useState<string>('Century Player Generator v1.0');
  const [currentSeason, setCurrentSeason] = useState<{
    seasonNumber: number;
    label: string;
    eventName: string | null;
  } | null>(null);
  const [metrics, setMetrics] = useState({
    activePlayers:0,
    assignedPlayers:0,
    freeAgents:0,
    retiredPlayers:0
  });

  useEffect(() => {
    if (!supabase) {
      setAuthorization('unauthorized');
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadAuthorization() {
      if (!supabase || !session) {
        setAuthorization('checking');
        setRole(null);
        return;
      }

      const { data: userRow } = await supabase
        .from('app_users')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!userRow) {
        setAuthorization('unauthorized');
        return;
      }

      setRole(userRow.role);
      setAuthorization('authorized');

      const { data: leagueState } = await supabase
        .from('league_state')
        .select('active_generator_version_id, current_season_id, league_status')
        .eq('competition_category', 'men')
        .maybeSingle();

      if (leagueState?.current_season_id) {
        const { data: season } = await supabase
          .from('seasons')
          .select('season_number, label, event_name')
          .eq('id', leagueState.current_season_id)
          .maybeSingle();

        if (season?.season_number && season.label) {
          setCurrentSeason({
            seasonNumber: season.season_number,
            label: season.label,
            eventName: season.event_name
          });
        }
      }

      const [activeResult, assignedResult, freeAgentResult, retiredResult] = await Promise.all([
        supabase.from('players').select('id', { count:'exact', head:true }).eq('competition_category', 'men').eq('status', 'active'),
        supabase.from('players').select('id', { count:'exact', head:true }).eq('competition_category', 'men').eq('status', 'active').not('current_team_id', 'is', null),
        supabase.from('players').select('id', { count:'exact', head:true }).eq('competition_category', 'men').eq('status', 'active').is('current_team_id', null),
        supabase.from('players').select('id', { count:'exact', head:true }).eq('competition_category', 'men').eq('status', 'retired')
      ]);

      setMetrics({
        activePlayers:activeResult.count ?? 0,
        assignedPlayers:assignedResult.count ?? 0,
        freeAgents:freeAgentResult.count ?? 0,
        retiredPlayers:retiredResult.count ?? 0
      });

      if (leagueState?.active_generator_version_id) {
        const { data: version } = await supabase
          .from('generator_versions')
          .select('version_name')
          .eq('id', leagueState.active_generator_version_id)
          .maybeSingle();
        if (version?.version_name) setActiveGenerator(version.version_name);
      }
    }

    loadAuthorization();
  }, [session]);

  const selected = useMemo(() => NAV_ITEMS.find((item) => item.id === view)!, [view]);

  if (!session) return <LoginPanel />;

  if (authorization === 'checking') {
    return <main className="center-message">Checking CenturyLeague authorization…</main>;
  }

  if (authorization === 'unauthorized') {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">Authenticated</p>
          <h1>Access not yet authorized</h1>
          <p className="lede">
            This Supabase account is valid, but it has not yet been added to the CenturyLeague
            commissioner/viewer registry.
          </p>
          <button onClick={() => supabase?.auth.signOut()}>Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">CenturyLeague</p>
          <h1>Player Registry</h1>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>{session.user.email}</span>
          <span className="pill">{role}</span>
          <button className="link-button" onClick={() => supabase?.auth.signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Men’s League · Registry v0.1</p>
            <h2>{selected.label}</h2>
            <p>{selected.description}</p>
          </div>
          <div className="model-chip">
            <span>Active model</span>
            <strong>{activeGenerator}</strong>
          </div>
        </header>

        {view === 'dashboard' ? (
          <>
            <section className="metric-grid">
              <article>
                <span>Active Players</span>
                <strong>{metrics.activePlayers.toLocaleString()}</strong>
                <small>{metrics.freeAgents.toLocaleString()} free agents</small>
              </article>
              <article>
                <span>Assigned to Teams</span>
                <strong>{metrics.assignedPlayers.toLocaleString()}</strong>
                <small>18 × 35 target = 630</small>
              </article>
              <article>
                <span>Retired Players</span>
                <strong>{metrics.retiredPlayers.toLocaleString()}</strong>
                <small>Historical archive</small>
              </article>
              <article>
                <span>Current Season</span>
                <strong>{currentSeason ? `S${currentSeason.seasonNumber}` : '—'}</strong>
                <small>
                  {currentSeason
                    ? `${currentSeason.eventName ?? 'Century season'} · ${currentSeason.label.replace(/^Season \\d+ — /, '')}`
                    : 'Not initialized'}
                </small>
              </article>
            </section>

            <section>
              <div className="section-heading">
                <div>
                  <h3>Commissioner operations</h3>
                  <p>Abilities are generated and developed by the simulation; there is no manual-rating editor.</p>
                </div>
              </div>
              <div className="action-grid">
                {PLANNED_CARDS.map(([title, description]) => (
                  <article className="action-card" key={title}>
                    <h4>{title}</h4>
                    <p>{description}</p>
                    <span className="status-tag">Backend next</span>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : view === 'generate' ? (
          <GeneratePlayers />
        ) : view === 'database' ? (
          <PlayerDatabase />
        ) : (
          <section className="placeholder-panel">
            <span className="status-tag">Planned surface</span>
            <h3>{selected.label}</h3>
            <p>
              The shared simulation model and live database are ready. This screen will be wired to
              privileged registry operations in the next implementation stage.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
