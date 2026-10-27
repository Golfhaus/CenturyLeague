import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.118.0/cors';
import { generatePlayerBatch } from './simulation/batch.ts';
import {
  DEVELOPMENT_MODEL_VERSION,
  GENERATOR_MODEL_VERSION
} from './simulation/config.ts';

type GenerateRequest = {
  action: 'preview' | 'commit';
  competitionCategory: 'men' | 'women';
  count: number;
  seed?: string;
  entryType?: 'founding_pool' | 'entry_window';
  entryClassLabel?: string;
  seasonId?: string;
  activeNameSnapshotHash?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type':'application/json' }
  });
}

function configuredKey(envName: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS', fallbackName: string): string {
  const encoded = Deno.env.get(envName);
  if (encoded) {
    const parsed = JSON.parse(encoded);
    if (parsed.default) return parsed.default;
  }
  const fallback = Deno.env.get(fallbackName);
  if (fallback) return fallback;
  throw new Error(`Missing ${envName} configuration.`);
}

function activeNameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLocaleLowerCase('en-US')}\u0000${lastName.trim().toLocaleLowerCase('en-US')}`;
}

async function hashStrings(values: readonly string[]): Promise<string> {
  const canonical = [...values].sort().join('\n');
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function visiblePlayer(player: any) {
  return {
    firstName:player.firstName,
    lastName:player.lastName,
    competitionCategory:player.competitionCategory,
    dateOfBirth:player.dateOfBirth,
    ageYears:player.ageYears,
    birthplaceCity:player.birthplaceCity,
    birthplaceRegionCode:player.birthplaceRegionCode,
    birthplaceRegionName:player.birthplaceRegionName,
    birthplaceCountryCode:player.birthplaceCountryCode,
    birthplaceCountryName:player.birthplaceCountryName,
    preferredSide:player.preferredSide,
    heightCm:player.heightCm,
    weightKg:player.weightKg,
    primaryArchetype:player.primaryArchetype,
    secondaryArchetype:player.secondaryArchetype || null,
    ratings:Object.fromEntries(
      Object.entries(player.ratings).map(([key, value]) => [key, Math.round(Number(value))])
    ),
    roleRatings:{
      defensive:Math.round(player.roleRatings.defensive * 100) / 100,
      central:Math.round(player.roleRatings.central * 100) / 100,
      attacking:Math.round(player.roleRatings.attacking * 100) / 100,
      overall:Math.round(player.roleRatings.overall * 100) / 100,
      bestRole:player.roleRatings.bestRole
    }
  };
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers:corsHeaders });
    }

    try {
      if (req.method !== 'POST') {
        return json({ error:'Method not allowed.' }, 405);
      }

      const authHeader = req.headers.get('Authorization') ?? '';
      if (!authHeader.startsWith('Bearer ')) {
        return json({ error:'Authenticated session required.' }, 401);
      }
      const token = authHeader.slice('Bearer '.length).trim();
      if (!token) return json({ error:'Authenticated session required.' }, 401);

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const publishableKey = configuredKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
      const secretKey = configuredKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

      const userClient = createClient(supabaseUrl, publishableKey, {
        global:{ headers:{ Authorization:authHeader } },
        auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
      });

      const { data:{ user }, error:userError } = await userClient.auth.getUser(token);
      if (userError || !user) {
        console.warn('generate-players auth rejected', userError?.message ?? 'missing user');
        return json({ error:'Authenticated session is invalid or expired.' }, 401);
      }

      const { data:authorization, error:authorizationError } = await userClient
        .from('app_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (authorizationError) {
        console.error('generate-players authorization lookup failed', authorizationError.message);
        return json({ error:'Unable to verify CenturyLeague authorization.' }, 500);
      }
      if (authorization?.role !== 'commissioner') {
        return json({ error:'Commissioner access is required.' }, 403);
      }

      const supabaseAdmin = createClient(supabaseUrl, secretKey, {
        auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
      });

      const body = await req.json() as GenerateRequest;
      if (!['preview','commit'].includes(body.action)) {
        return json({ error:'action must be preview or commit.' }, 400);
      }

      const competitionCategory = body.competitionCategory;
      const count = Number(body.count);
      if (!['men','women'].includes(competitionCategory)) {
        return json({ error:'competitionCategory must be men or women.' }, 400);
      }
      if (!Number.isInteger(count) || count < 1 || count > 2000) {
        return json({ error:'count must be an integer from 1–2,000.' }, 400);
      }

      const { data:activeNameRows, error:activeNamesError } = await supabaseAdmin
        .from('players')
        .select('first_name, last_name')
        .eq('status', 'active');

      if (activeNamesError) {
        console.error('generate-players active-name lookup failed', activeNamesError.message);
        return json({ error:'Unable to reserve active player names.' }, 500);
      }

      const reservedFullNames = (activeNameRows ?? []).map((row) =>
        activeNameKey(row.first_name, row.last_name)
      );
      const activeNameSnapshotHash = await hashStrings(reservedFullNames);

      if (body.action === 'commit') {
        if (!body.activeNameSnapshotHash) {
          return json({ error:'Preview name snapshot is required before commit.' }, 409);
        }
        if (body.activeNameSnapshotHash !== activeNameSnapshotHash) {
          return json({
            error:'The active player population changed after this preview. Generate a fresh preview before committing.'
          }, 409);
        }
      }

      const { data:leagueState, error:stateError } = await supabaseAdmin
        .from('league_state')
        .select('competition_category, league_status, current_season_id, active_generator_version_id, active_development_model_version')
        .eq('competition_category', competitionCategory)
        .single();

      if (stateError || !leagueState) {
        console.error('generate-players league state failed', stateError?.message ?? 'missing state');
        return json({ error:'CenturyLeague league state is unavailable.' }, 500);
      }
      if (leagueState.league_status !== 'active') {
        return json({ error:`${competitionCategory} league is not initialized for player generation.` }, 409);
      }

      const seasonId = body.seasonId ?? leagueState.current_season_id;
      if (!seasonId) return json({ error:'No active Century season is configured.' }, 409);

      const [{ data:season, error:seasonError }, { data:version, error:versionError }] = await Promise.all([
        supabaseAdmin
          .from('seasons')
          .select('id, competition_category, season_number, season_year, season_month, starts_on, label, event_name')
          .eq('id', seasonId)
          .single(),
        supabaseAdmin
          .from('generator_versions')
          .select('id, version_name, model_version')
          .eq('id', leagueState.active_generator_version_id)
          .single()
      ]);

      if (seasonError || !season?.starts_on) {
        return json({ error:'Requested eligibility season is unavailable.' }, 409);
      }
      if (season.competition_category !== competitionCategory) {
        return json({ error:'Eligibility season belongs to a different league.' }, 409);
      }
      if (versionError || !version) {
        return json({ error:'Active generator version is unavailable.' }, 409);
      }
      if (version.model_version !== GENERATOR_MODEL_VERSION) {
        return json({
          error:'Generator deployment/version mismatch.',
          deployed:GENERATOR_MODEL_VERSION,
          active:version.model_version
        }, 409);
      }
      if (leagueState.active_development_model_version !== DEVELOPMENT_MODEL_VERSION) {
        return json({
          error:'Development deployment/version mismatch.',
          deployed:DEVELOPMENT_MODEL_VERSION,
          active:leagueState.active_development_model_version
        }, 409);
      }

      const entryType = body.entryType ?? 'founding_pool';
      const entryClassLabel = body.entryClassLabel
        ?? (entryType === 'founding_pool' ? 'Founding Player Pool' : `${season.label} Entry Class`);
      const seed = body.seed?.trim() || crypto.randomUUID();

      const batch = generatePlayerBatch({
        seed,
        competitionCategory,
        count,
        seasonStart:season.starts_on,
        entryType,
        entryClassLabel,
        reservedFullNames
      });

      const responseBase = {
        seed,
        action:body.action,
        competitionCategory,
        generatorVersion:version.version_name,
        generatorModelVersion:GENERATOR_MODEL_VERSION,
        developmentModelVersion:DEVELOPMENT_MODEL_VERSION,
        activeNameSnapshotHash,
        season:{
          id:season.id,
          number:season.season_number,
          year:season.season_year,
          month:season.season_month,
          label:season.label,
          eventName:season.event_name
        },
        summary:batch.summary,
        samplePlayers:batch.players.slice(0, Math.min(10, batch.players.length)).map(visiblePlayer)
      };

      if (body.action === 'preview') {
        return json({
          ...responseBase,
          previewPlayers:batch.players.map(visiblePlayer)
        });
      }

      const { data:commitResult, error:commitError } = await supabaseAdmin.rpc(
        'commit_generated_players',
        {
          p_generator_version_id:version.id,
          p_season_id:season.id,
          p_seed:seed,
          p_players:batch.players,
          p_created_by:user.id,
          p_summary:batch.summary
        }
      );

      if (commitError) {
        console.error('commit_generated_players failed', commitError.message);
        return json({ error:'Generated players could not be committed.' }, 500);
      }

      return json({
        ...responseBase,
        committed:true,
        commitResult
      }, 201);
    } catch (error) {
      console.error('generate-players unexpected error', error);
      return json({
        error:error instanceof Error ? error.message : 'Unexpected generation error.'
      }, 400);
    }
  }
};
