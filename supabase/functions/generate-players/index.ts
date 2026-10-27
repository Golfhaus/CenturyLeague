import { withSupabase } from 'npm:@supabase/server';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { generatePlayerBatch } from './simulation/batch.ts';
import {
  DEVELOPMENT_MODEL_VERSION,
  GENERATOR_MODEL_VERSION
} from './simulation/config.ts';

type GenerateRequest = {
  action: 'preview' | 'commit';
  menCount: number;
  womenCount: number;
  seed?: string;
  entryType?: 'founding_pool' | 'entry_window';
  entryClassLabel?: string;
  seasonId?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type':'application/json' }
  });
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

const authenticatedHandler = withSupabase(
  { auth:'user' },
  async (req, ctx) => {
    try {
      if (req.method !== 'POST') {
        return json({ error:'Method not allowed.' }, 405);
      }

      const userId = ctx.userClaims?.sub;
      if (!userId) return json({ error:'Authenticated user ID unavailable.' }, 401);

      const { data:authorization, error:authorizationError } = await ctx.supabase
        .from('app_users')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (authorizationError) {
        return json({ error:'Unable to verify CenturyLeague authorization.' }, 500);
      }
      if (authorization?.role !== 'commissioner') {
        return json({ error:'Commissioner access is required.' }, 403);
      }

      const body = await req.json() as GenerateRequest;
      if (!['preview','commit'].includes(body.action)) {
        return json({ error:'action must be preview or commit.' }, 400);
      }

      const menCount = Number(body.menCount);
      const womenCount = Number(body.womenCount);
      if (!Number.isInteger(menCount) || !Number.isInteger(womenCount) || menCount < 0 || womenCount < 0) {
        return json({ error:'menCount and womenCount must be nonnegative integers.' }, 400);
      }
      const total = menCount + womenCount;
      if (total < 1 || total > 2000) {
        return json({ error:'A generation request must contain 1–2,000 players.' }, 400);
      }

      const { data:leagueState, error:stateError } = await ctx.supabaseAdmin
        .from('league_state')
        .select('current_season_id, active_generator_version_id, active_development_model_version')
        .eq('id', 1)
        .single();

      if (stateError || !leagueState) {
        return json({ error:'CenturyLeague season state is unavailable.' }, 500);
      }

      const seasonId = body.seasonId ?? leagueState.current_season_id;
      if (!seasonId) return json({ error:'No active Century season is configured.' }, 409);

      const [{ data:season, error:seasonError }, { data:version, error:versionError }] = await Promise.all([
        ctx.supabaseAdmin
          .from('seasons')
          .select('id, season_number, season_year, season_month, starts_on, label, event_name')
          .eq('id', seasonId)
          .single(),
        ctx.supabaseAdmin
          .from('generator_versions')
          .select('id, version_name, model_version')
          .eq('id', leagueState.active_generator_version_id)
          .single()
      ]);

      if (seasonError || !season?.starts_on) {
        return json({ error:'Requested eligibility season is unavailable.' }, 409);
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
        menCount,
        womenCount,
        seasonStart:season.starts_on,
        entryType,
        entryClassLabel
      });

      const responseBase = {
        seed,
        action:body.action,
        generatorVersion:version.version_name,
        generatorModelVersion:GENERATOR_MODEL_VERSION,
        developmentModelVersion:DEVELOPMENT_MODEL_VERSION,
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
        return json(responseBase);
      }

      const { data:commitResult, error:commitError } = await ctx.supabaseAdmin.rpc(
        'commit_generated_players',
        {
          p_generator_version_id:version.id,
          p_season_id:season.id,
          p_seed:seed,
          p_players:batch.players,
          p_created_by:userId,
          p_summary:batch.summary
        }
      );

      if (commitError) {
        console.error('commit_generated_players failed', commitError);
        return json({ error:'Generated players could not be committed.' }, 500);
      }

      return json({
        ...responseBase,
        committed:true,
        commitResult
      }, 201);
    } catch (error) {
      console.error(error);
      return json({
        error:error instanceof Error ? error.message : 'Unexpected generation error.'
      }, 400);
    }
  }
);

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers:corsHeaders });
    }

    const response = await authenticatedHandler(req);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status:response.status,
      statusText:response.statusText,
      headers
    });
  }
};
