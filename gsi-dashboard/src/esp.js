// Núcleo da "Visão ESP" do espectador: projeta jogadores do GSI numa câmera
// virtual posicionada no jogador observado (POV). Funções puras, usadas pela
// página /esp no navegador e pelos testes no Node.
//
// Convenção do mundo (Source 2): X para frente, Y para a esquerda, Z para cima.
// Distâncias em unidades Hammer (1 unidade ≈ 2,54 cm).

export const UNITS_TO_METERS = 0.0254;
export const PLAYER_HEIGHT = 72;   // altura do hull em pé
export const EYE_HEIGHT = 64;      // altura dos olhos em pé
export const BOX_ASPECT = 0.45;    // largura/altura da caixa

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-9 ? null : [v[0] / l, v[1] / l, v[2] / l];
}

export function distanceMeters(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * UNITS_TO_METERS;
}

/**
 * Câmera a partir da posição (pés) e do vetor "forward" que o GSI envia.
 * fovDeg é o FOV vertical; width/height em pixels.
 */
export function makeCamera({ position, forward, fovDeg = 74, width, height, eyeHeight = EYE_HEIGHT }) {
  if (!position || !forward || !(width > 0) || !(height > 0)) return null;
  let f = norm(forward);
  if (!f) return null;
  const worldUp = [0, 0, 1];
  // Olhando quase na vertical: usa o eixo Y como referência para não degenerar.
  let r = norm(cross(f, worldUp)) ?? norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const fov = Math.min(Math.max(fovDeg, 20), 140) * Math.PI / 180;
  return {
    eye: [position[0], position[1], position[2] + eyeHeight],
    f, r, u, width, height,
    focal: (height / 2) / Math.tan(fov / 2),
    near: 4,
  };
}

/** Coordenadas no espaço da câmera: x = direita, y = cima, z = profundidade. */
export function toCamera(cam, p) {
  const d = sub(p, cam.eye);
  return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)];
}

/** Projeta um ponto do mundo. Retorna {x, y, z} ou null se estiver atrás da câmera. */
export function project(cam, p) {
  const [x, y, z] = toCamera(cam, p);
  if (z < cam.near) return null;
  return { x: cam.width / 2 + (x / z) * cam.focal, y: cam.height / 2 - (y / z) * cam.focal, z };
}

/** Caixa 2D (bounding box) de um jogador em pé na posição "feet". */
export function boundingBox(cam, feet, height = PLAYER_HEIGHT) {
  const a = project(cam, feet);
  const b = project(cam, [feet[0], feet[1], feet[2] + height]);
  if (!a || !b) return null;
  const h = Math.abs(a.y - b.y);
  const w = h * BOX_ASPECT;
  const cx = (a.x + b.x) / 2;
  return { x: cx - w / 2, y: Math.min(a.y, b.y), w, h, depth: a.z };
}

export function intersectsScreen(box, cam, margin = 0) {
  return box.x + box.w >= -margin && box.y + box.h >= -margin &&
         box.x <= cam.width + margin && box.y <= cam.height + margin;
}

/**
 * Indicador de borda para quem está fora da tela: ponto na elipse interna da
 * tela, na direção do jogador, e o ângulo da seta (radianos, 0 = direita).
 */
export function offscreenIndicator(cam, p, inset = 36) {
  let [x, y, z] = toCamera(cam, p);
  if (z < 0) { x = -x; y = -y; }           // atrás: espelha para apontar o lado certo
  if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) y = -1; // exatamente atrás: seta para baixo
  const angle = Math.atan2(-y, x);        // eixo y da tela cresce para baixo
  const rx = cam.width / 2 - inset, ry = cam.height / 2 - inset;
  return { x: cam.width / 2 + Math.cos(angle) * rx, y: cam.height / 2 + Math.sin(angle) * ry, angle, behind: z < 0 };
}

/** Ângulo horizontal (graus) entre a direção do POV e o alvo; positivo = à direita. */
export function bearingDeg(cam, p) {
  const [x, , z] = toCamera(cam, p);
  return Math.atan2(x, z) * 180 / Math.PI;
}

export const DEFAULT_FEATURES = Object.freeze({
  boxes: true, names: true, distance: true, health: true, offscreen: true,
  allies: true, adversaries: true, bots: true, humans: true,
  grid: true, minimap: true, snaplines: false,
});

export function relationOf(pov, p) {
  return p.team === pov.team ? "ally" : "adversary";
}

/**
 * Monta a lista do que desenhar a partir dos jogadores (formato de extractPlayers)
 * e do POV escolhido. Não desenha nada: só calcula, para poder ser testado.
 */
export function buildEspFrame({ players, povId, width, height, fovDeg = 74, features = DEFAULT_FEATURES, maxDistanceM = Infinity }) {
  const pov = players.find((p) => p.steamId === povId) ?? null;
  if (!pov || !pov.pos || !pov.forward) return { pov, cam: null, items: [], offscreen: [], hidden: 0 };
  const cam = makeCamera({ position: pov.pos, forward: pov.forward, fovDeg, width, height });
  if (!cam) return { pov, cam: null, items: [], offscreen: [], hidden: 0 };

  const items = [], offscreen = [];
  let hidden = 0;
  for (const p of players) {
    if (p.steamId === pov.steamId || !p.pos || p.health <= 0) continue;
    const relation = relationOf(pov, p);
    if ((relation === "ally" && !features.allies) || (relation === "adversary" && !features.adversaries) ||
        (p.bot && !features.bots) || (!p.bot && !features.humans)) { hidden++; continue; }
    const distM = distanceMeters(pov.pos, p.pos);
    if (distM > maxDistanceM) { hidden++; continue; }

    const box = boundingBox(cam, p.pos);
    const base = { player: p, relation, distM, bearing: bearingDeg(cam, p.pos) };
    if (box && intersectsScreen(box, cam)) items.push({ ...base, box });
    else offscreen.push({ ...base, indicator: offscreenIndicator(cam, [p.pos[0], p.pos[1], p.pos[2] + PLAYER_HEIGHT / 2]) });
  }
  items.sort((a, b) => b.distM - a.distM); // desenha do mais longe para o mais perto
  spreadLabels(offscreen, cam);
  return { pov, cam, items, offscreen, hidden };
}

/**
 * Evita que os rótulos dos indicadores de borda se sobreponham: em cada lado
 * da tela, ordena por altura e afasta os vizinhos pelo menos "gap" pixels.
 * Grava labelX/labelY em cada item (a seta continua no lugar exato).
 */
export function spreadLabels(offscreen, cam, gap = 16, pull = 26) {
  const sides = [[], []];
  for (const o of offscreen) {
    const ind = o.indicator;
    o.labelX = ind.x - Math.cos(ind.angle) * pull;
    o.labelY = ind.y - Math.sin(ind.angle) * pull;
    sides[ind.x < cam.width / 2 ? 0 : 1].push(o);
  }
  for (const side of sides) {
    side.sort((a, b) => a.labelY - b.labelY);
    for (let i = 1; i < side.length; i++) {
      if (side[i].labelY - side[i - 1].labelY < gap) side[i].labelY = side[i - 1].labelY + gap;
    }
    // se passou do fundo da tela, empurra o grupo para cima
    const over = side.length ? side[side.length - 1].labelY - (cam.height - 8) : 0;
    if (over > 0) for (const o of side) o.labelY -= over;
  }
  return offscreen;
}
