import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

type PlayerRow = {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  competition_category: string | null;
  birthplace_city: string | null;
  birthplace_region_code: string | null;
  birthplace_country_code: string | null;
  primary_archetype: string | null;
  secondary_archetype: string | null;
  status: string | null;
  current_team_name: string | null;
  overall_rating: number | null;
  defensive_rating: number | null;
  central_rating: number | null;
  attacking_rating: number | null;
  best_role: string | null;
};

function label(value: string | null) {
  if (!value) return '—';
  return value.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

export default function PlayerDatabase() {
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('active');
  const [minOverall, setMinOverall] = useState('');

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      setLoading(true);
      setError('');
      const { data, error:queryError } = await supabase
        .from('player_registry')
        .select(
          'id, first_name, last_name, competition_category, birthplace_city, birthplace_region_code, birthplace_country_code, primary_archetype, secondary_archetype, status, current_team_name, overall_rating, defensive_rating, central_rating, attacking_rating, best_role'
        )
        .order('overall_rating', { ascending:false })
        .limit(5000);

      setLoading(false);
      if (queryError) {
        setError(queryError.message);
        return;
      }
      setRows((data ?? []) as PlayerRow[]);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const min = minOverall === '' ? null : Number(minOverall);
    return rows.filter((row) => {
      const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.toLowerCase();
      if (needle && !name.includes(needle)) return false;
      if (category !== 'all' && row.competition_category !== category) return false;
      if (status !== 'all' && row.status !== status) return false;
      if (min !== null && Number.isFinite(min) && (row.overall_rating ?? 0) < min) return false;
      return true;
    });
  }, [rows, search, category, status, minOverall]);

  function exportCsv() {
    const headers = [
      'Player','League','Status','Birthplace','Primary Archetype','Secondary Archetype',
      'Overall','Defensive','Central','Attacking','Best Role','Team'
    ];
    const lines = [
      headers.map(csvCell).join(','),
      ...filtered.map((row) => [
        `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
        row.competition_category,
        row.status,
        [row.birthplace_city, row.birthplace_region_code ?? row.birthplace_country_code].filter(Boolean).join(', '),
        label(row.primary_archetype),
        label(row.secondary_archetype),
        row.overall_rating,
        row.defensive_rating,
        row.central_rating,
        row.attacking_rating,
        row.best_role,
        row.current_team_name
      ].map(csvCell).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'century-player-registry.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="database-panel">
      <div className="database-toolbar">
        <div>
          <p className="eyebrow">Read-only abilities</p>
          <h3>Player population</h3>
          <p>{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} players shown</p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0}>Export filtered CSV</button>
      </div>

      <div className="filter-grid">
        <label>
          Search name
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player name" />
        </label>
        <label>
          League
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
            <option value="exited_pool">Exited pool</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Minimum Overall
          <input
            inputMode="numeric"
            value={minOverall}
            onChange={(event) => setMinOverall(event.target.value.replace(/[^0-9]/g, ''))}
            placeholder="1–20"
          />
        </label>
      </div>

      {error && <div className="notice warning">{error}</div>}
      {loading ? (
        <div className="table-empty">Loading player registry…</div>
      ) : filtered.length === 0 ? (
        <div className="table-empty">No players match the current filters.</div>
      ) : (
        <div className="table-scroll">
          <table className="player-table">
            <thead>
              <tr>
                <th>Player</th><th>League</th><th>Birthplace</th><th>Profile</th>
                <th>OVR</th><th>DEF</th><th>CEN</th><th>ATT</th><th>Best Role</th><th>Team</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id ?? `${row.first_name}-${row.last_name}`}>
                  <td><strong>{row.first_name} {row.last_name}</strong></td>
                  <td className="capitalize">{row.competition_category}</td>
                  <td>{row.birthplace_city}, {row.birthplace_region_code ?? row.birthplace_country_code}</td>
                  <td>
                    {label(row.primary_archetype)}
                    {row.secondary_archetype ? <small> / {label(row.secondary_archetype)}</small> : null}
                  </td>
                  <td className="rating-cell">{row.overall_rating}</td>
                  <td>{row.defensive_rating}</td>
                  <td>{row.central_rating}</td>
                  <td>{row.attacking_rating}</td>
                  <td className="capitalize">{row.best_role}</td>
                  <td>{row.current_team_name ?? 'Free Agent'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
