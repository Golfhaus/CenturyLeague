import { useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

type SamplePlayer = {
  firstName: string;
  lastName: string;
  competitionCategory: 'men' | 'women';
  dateOfBirth: string;
  ageYears: number;
  birthplaceCity: string;
  birthplaceRegionCode: string | null;
  birthplaceRegionName: string | null;
  birthplaceCountryCode: string;
  birthplaceCountryName: string;
  preferredSide: string;
  heightCm: number;
  weightKg: number;
  primaryArchetype: string;
  secondaryArchetype: string | null;
  ratings: Record<string, number>;
  roleRatings: {
    defensive: number;
    central: number;
    attacking: number;
    overall: number;
    bestRole: string;
  };
};

type GenerationResponse = {
  seed: string;
  action: 'preview' | 'commit';
  generatorVersion: string;
  generatorModelVersion: string;
  developmentModelVersion: string;
  season: {
    id: string;
    number: number;
    year: number;
    month: number;
    label: string;
    eventName: string | null;
  };
  summary: {
    generatedCount: number;
    menCount: number;
    womenCount: number;
    averageOverall: number;
    averageAgeYears: number;
    talentClasses: Record<string, number>;
    archetypes: Record<string, number>;
    entryAges: Record<string, number>;
    birthplaceTiers: Record<string, number>;
    internationalCount: number;
  };
  samplePlayers: SamplePlayer[];
  committed?: boolean;
  commitResult?: {
    batchId?: string;
    generatedCount?: number;
  };
};

const ATTRIBUTE_LABELS: Record<string,string> = {
  speed:'Speed',
  acceleration:'Acceleration',
  agility:'Agility',
  strength:'Strength',
  verticalLeap:'Vertical Leap',
  stamina:'Stamina',
  durability:'Durability',
  recovery:'Recovery',
  kickingPower:'Kicking Power',
  kickingAccuracy:'Kicking Accuracy',
  kickingOnRun:'Kicking on the Run',
  oppositeSideSkill:'Opposite-Side Skill',
  handPassing:'Hand-Passing',
  ballCarrying:'Ball Carrying',
  evasion:'Evasion',
  aerialMarking:'Aerial Marking',
  contestedPossession:'Contested Possession',
  groundBallSkill:'Ground-Ball Skill',
  tackling:'Tackling',
  defensiveSpoiling:'Defensive Spoiling',
  awareness:'Awareness',
  decisionMaking:'Decision-Making',
  anticipation:'Anticipation',
  composure:'Composure',
  discipline:'Discipline'
};

function archetypeLabel(value: string) {
  return value.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

export default function GeneratePlayers() {
  const [menCount, setMenCount] = useState('0');
  const [womenCount, setWomenCount] = useState('0');
  const [preview, setPreview] = useState<GenerationResponse | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState('');
  const [committed, setCommitted] = useState<GenerationResponse | null>(null);

  const men = Number(menCount) || 0;
  const women = Number(womenCount) || 0;
  const total = men + women;

  const previewStillMatches = useMemo(
    () => preview
      ? preview.summary.menCount === men && preview.summary.womenCount === women
      : false,
    [preview, men, women]
  );

  function updateCount(setter: (value: string) => void, value: string) {
    if (!/^\d*$/.test(value)) return;
    setter(value);
    setPreview(null);
    setCommitted(null);
    setError('');
  }

  async function invoke(action: 'preview' | 'commit', seed?: string) {
    if (!supabase) return;
    setBusy(action);
    setError('');

    const { data, error:invokeError } = await supabase.functions.invoke<GenerationResponse>(
      'generate-players',
      {
        body:{
          action,
          menCount:men,
          womenCount:women,
          seed,
          entryType:'founding_pool',
          entryClassLabel:'Founding Player Pool'
        }
      }
    );

    setBusy(null);

    if (invokeError) {
      setError(invokeError.message);
      return null;
    }
    if (!data) {
      setError('The generator returned no data.');
      return null;
    }
    return data;
  }

  async function previewPlayers() {
    const result = await invoke('preview');
    if (result) {
      setPreview(result);
      setCommitted(null);
    }
  }

  async function commitPlayers() {
    if (!preview || !previewStillMatches) return;
    const result = await invoke('commit', preview.seed);
    if (result) setCommitted(result);
  }

  return (
    <div className="generate-stack">
      <section className="generator-panel">
        <div className="section-heading">
          <div>
            <span className="status-tag">Founding Player Pool</span>
            <h3>Generate permanent players</h3>
            <p>
              Set the men’s and women’s population counts. Previewing creates nothing in the database;
              committing uses the exact preview seed and makes that population permanent.
            </p>
          </div>
        </div>

        <div className="preset-row">
          <button onClick={() => { setMenCount('1'); setWomenCount('0'); setPreview(null); }}>
            One men’s player
          </button>
          <button onClick={() => { setMenCount('0'); setWomenCount('1'); setPreview(null); }}>
            One women’s player
          </button>
          <span>Founding target under discussion: 900 total</span>
        </div>

        <div className="count-grid">
          <label>
            Men’s players
            <input
              inputMode="numeric"
              value={menCount}
              onChange={(event) => updateCount(setMenCount, event.target.value)}
            />
          </label>
          <label>
            Women’s players
            <input
              inputMode="numeric"
              value={womenCount}
              onChange={(event) => updateCount(setWomenCount, event.target.value)}
            />
          </label>
          <div className="total-box">
            <span>Total</span>
            <strong>{total.toLocaleString()}</strong>
          </div>
        </div>

        <div className="generator-actions">
          <button
            className="primary-button"
            disabled={busy !== null || total < 1 || total > 2000}
            onClick={previewPlayers}
          >
            {busy === 'preview' ? 'Generating preview…' : 'Preview generation'}
          </button>
          <p>
            No individual ability can be edited before or after generation.
          </p>
        </div>

        {error && <div className="notice warning">{error}</div>}
      </section>

      {preview && (
        <section className="preview-panel">
          <div className="preview-header">
            <div>
              <p className="eyebrow">Preview locked</p>
              <h3>{preview.summary.generatedCount.toLocaleString()} generated players</h3>
              <p>
                {preview.season.label}
                {preview.season.eventName ? ` · ${preview.season.eventName}` : ''}
              </p>
            </div>
            <div className="seed-chip">
              <span>Reproducible seed</span>
              <code>{preview.seed}</code>
            </div>
          </div>

          <div className="metric-grid compact">
            <article>
              <span>Men</span>
              <strong>{preview.summary.menCount}</strong>
              <small>Generated</small>
            </article>
            <article>
              <span>Women</span>
              <strong>{preview.summary.womenCount}</strong>
              <small>Generated</small>
            </article>
            <article>
              <span>Avg Overall</span>
              <strong>{preview.summary.averageOverall.toFixed(1)}</strong>
              <small>Role-weighted</small>
            </article>
            <article>
              <span>International</span>
              <strong>{preview.summary.internationalCount}</strong>
              <small>~1% target</small>
            </article>
          </div>

          <div className="sample-grid">
            {preview.samplePlayers.map((player, index) => (
              <article className="player-card" key={`${player.firstName}-${player.lastName}-${index}`}>
                <div className="player-card-title">
                  <div>
                    <h4>{player.firstName} {player.lastName}</h4>
                    <p>
                      {archetypeLabel(player.primaryArchetype)}
                      {player.secondaryArchetype ? ` / ${archetypeLabel(player.secondaryArchetype)}` : ''}
                    </p>
                  </div>
                  <strong>{player.roleRatings.overall.toFixed(1)}</strong>
                </div>
                <dl className="player-meta">
                  <div><dt>League</dt><dd>{player.competitionCategory}</dd></div>
                  <div><dt>Birthplace</dt><dd>{player.birthplaceCity}, {player.birthplaceRegionCode ?? player.birthplaceCountryCode}</dd></div>
                  <div><dt>DOB</dt><dd>{player.dateOfBirth}</dd></div>
                  <div><dt>Body</dt><dd>{player.heightCm.toFixed(1)} cm · {player.weightKg.toFixed(1)} kg</dd></div>
                  <div><dt>Best role</dt><dd>{player.roleRatings.bestRole}</dd></div>
                  <div><dt>Preferred side</dt><dd>{player.preferredSide}</dd></div>
                </dl>
                {preview.samplePlayers.length === 1 && (
                  <div className="ratings-grid">
                    {Object.entries(player.ratings).map(([key, value]) => (
                      <div key={key}>
                        <span>{ATTRIBUTE_LABELS[key] ?? key}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="commit-box">
            <div>
              <h4>Make this preview permanent</h4>
              <p>
                This writes the exact seeded population above to CenturyLeague. There is no reroll or
                individual-rating adjustment after commit.
              </p>
            </div>
            <button
              className="dangerous-button"
              disabled={busy !== null || !previewStillMatches || Boolean(committed)}
              onClick={commitPlayers}
            >
              {busy === 'commit'
                ? 'Committing…'
                : committed
                  ? 'Committed'
                  : `Commit ${preview.summary.generatedCount.toLocaleString()} players`}
            </button>
          </div>

          {committed && (
            <div className="notice success">
              Permanent generation completed. Batch {committed.commitResult?.batchId ?? 'recorded'} contains{' '}
              {committed.commitResult?.generatedCount ?? committed.summary.generatedCount} players.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
