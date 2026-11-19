// Utilidades puras para payloads do Game State Integration (GSI) do CS2.
// Sem dependências de Node: usadas pelo servidor, pelo logger e pelos testes.

export const UNITS_TO_METERS = 0.0254; // 1 unidade Hammer ≈ 1 polegada

/** "x, y, z" -> [x, y, z] ou null */
export function parseVec(s) {
  if (typeof s !== "string") return null;
  const v = s.split(",").map((p) => Number(p.trim()));
  return v.length === 3 && v.every(Number.isFinite) ? v : null;
}

/**
 * Heurística de bot. O GSI não traz um campo "is_bot"; jogadores humanos têm
 * SteamID64 (17 dígitos começando com 7656119). Bots aparecem com IDs fora
 * desse padrão ou com o prefixo "BOT" no nome. Pode ser sobrescrita pela lista
 * de SteamIDs humanos conhecidos (knownHumans).
 */
export function isBot(steamId, name, knownHumans) {
  const id = String(steamId ?? "");
  if (knownHumans && knownHumans.has(id)) return false;
  if (/^bot\b/i.test(String(name ?? ""))) return true;
  return !/^7656119\d{10}$/.test(id);
}

export function distanceMeters(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * UNITS_TO_METERS;
}

/** Normaliza allplayers em uma lista de jogadores. */
export function extractPlayers(payload, knownHumans) {
  const all = payload?.allplayers;
  if (!all || typeof all !== "object") return [];
  const out = [];
  for (const [id, pl] of Object.entries(all)) {
    if (!pl || typeof pl !== "object") continue;
    const pos = parseVec(pl.position);
    out.push({
      steamId: id,
      name: String(pl.name ?? id),
      team: pl.team === "CT" || pl.team === "T" ? pl.team : "?",
      bot: isBot(id, pl.name, knownHumans),
      health: Number(pl.state?.health ?? 0),
      kills: Number(pl.match_stats?.kills ?? 0),
      assists: Number(pl.match_stats?.assists ?? 0),
      deaths: Number(pl.match_stats?.deaths ?? 0),
      pos,
      forward: parseVec(pl.forward),
    });
  }
  return out;
}

/** Gera o arquivo gamestate_integration_*.cfg para o cliente CS2. */
export function buildGsiConfig({ uriHost, port, token, name = "AssistLab GSI" }) {
  return `"${name}"
{
    "uri"       "http://${uriHost}:${port}/gsi"
    "timeout"   "1.0"
    "buffer"    "0.0"
    "throttle"  "0.05"
    "heartbeat" "10.0"
    "auth"
    {
        "token" "${token}"
    }
    "output"
    {
        "precision_time"     "3"
        "precision_position" "1"
        "precision_vector"   "3"
    }
    "data"
    {
        "provider"               "1"
        "map"                    "1"
        "round"                  "1"
        "player_id"              "1"
        "player_state"           "1"
        "player_position"        "1"
        "allplayers_id"          "1"
        "allplayers_state"       "1"
        "allplayers_match_stats" "1"
        "allplayers_position"    "1"
        "phase_countdowns"       "1"
    }
}
`;
}
