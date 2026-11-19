# CS2 AssistLab

Radar administrativo, **Visão ESP do espectador** e estatísticas para partidas privadas de **Counter-Strike 2**, alimentados pelo **Game State Integration (GSI)**, a interface oficial da Valve. Vem como aplicativo Windows (`AssistLab.exe`) e como servidor Node para linha de comando.

O AssistLab **só lê** o que o próprio CS2 envia pelo GSI. Não injeta nada, não lê a memória do jogo, não mexe no processo do CS2 e não interfere no VAC.

> **Importante:** o GSI só manda a posição de **todos** os jogadores quando o CS2 está como **espectador ou GOTV**. Enquanto você joga, ele só manda os seus dados. Por isso o radar é uma ferramenta de **administração e análise**, para quem está assistindo, e não um auxílio para quem está jogando.

## Novidades da v1.1.0: AssistLab ESP

- **Visão ESP do espectador** (`/esp`): uma câmera virtual posicionada no jogador escolhido (POV), montada só com a posição e a direção do olhar que o GSI envia. Mostra:
  - **caixas (bounding boxes)** em perspectiva, com contorno tracejado para bots;
  - **aliados e adversários** do POV em cores diferentes;
  - **nome, distância e barra de vida**;
  - **indicadores fora da tela**: setas na borda apontando para quem está fora do campo de visão, inclusive atrás, com rótulos que não se sobrepõem;
  - **linhas de posição** opcionais, **grade do chão** em perspectiva e **minimapa** girado com o POV olhando para cima.
- **Painel de recursos:** liga e desliga cada item (caixas, nomes, distância, vida, indicadores, linhas, grade, minimapa) e filtra aliados, adversários, bots e humanos. Também ajusta o FOV (50–110°) e o alcance máximo. As escolhas ficam salvas.
- **Troca de POV:** pela lista, pelo seletor ou pelas teclas `Q`/`E`. Se o POV morre, a visão passa para um jogador vivo, de preferência do mesmo time.
- **Integração com o radar:** o link "Visão ESP ↗" no radar abre a ESP já observando o jogador selecionado, e "← Radar" volta com ele selecionado.
- **Modo demonstração:** uma partida simulada de 10 jogadores (3 humanos e 7 bots) no formato real do GSI, para usar a ESP e o radar sem o CS2. Os dados simulados **não vão para os CSV** e o modo desliga sozinho quando chegam dados reais.
- **Movimento suave:** posições interpoladas entre as atualizações do GSI (~10–20 Hz), desenhadas a 60 fps.
- **Atalhos de teclado:** `B` liga/desliga as caixas, `N` os nomes e `M` o minimapa.

> A Visão ESP é uma ferramenta de **espectador**. Ela funciona com os dados que o CS2 entrega a quem está assistindo (espectador, GOTV) e roda numa janela própria, sem sobrepor o jogo. Enquanto você joga, o GSI não envia a posição dos outros jogadores, então ela não tem o que mostrar.

## Recursos

- **Radar ao vivo:** posição, direção do olhar (cone), vida e placar de cada jogador.
- **Bots e humanos:** identificados no radar e nas estatísticas (veja as limitações).
- **Equipes e distâncias:** cores por time (CT/T). Ao clicar em um jogador, o radar mostra a distância até os outros e quem é aliado ou adversário.
- **Telemetria:** taxa de atualização do GSI, idade do último dado, payloads aceitos e rejeitados, CPU e memória do app.
- **Logs CSV:**
  - `events.csv`: mortes, fases e rounds;
  - `rounds.csv`: placar de cada jogador ao fim de cada round;
  - `summary.csv`: placar final, gravado ao encerrar o serviço.
- **Aplicativo Windows:** inicia e encerra o serviço, configura endereço, porta e token, mostra o estado da conexão e gera o arquivo `.cfg` do CS2 já preenchido.
- **Segurança:** o token é obrigatório e gerado aleatoriamente no primeiro uso. O serviço escuta só em `127.0.0.1` por padrão, e o token nunca é repassado ao navegador.

## Downloads

Na aba **[Releases](../../releases)**:

| Arquivo | O que é |
|---|---|
| `AssistLab.exe` | Versão portátil. Não precisa instalar. |
| `AssistLab-Setup-x.y.z.exe` | Instalador, com atalho na área de trabalho. |
| `CS2-AssistLab-config-e-painel.zip` | Arquivos `.cfg` e o painel para linha de comando. |

Cada build também fica disponível na aba **Actions**, em *Artifacts*.

## Instalação no Windows (10 e 11)

1. Baixe `AssistLab.exe` (portátil) ou o instalador na página de Releases.
2. Abra o arquivo. O executável **não é assinado digitalmente**, então o Windows SmartScreen pode avisar. Clique em **Mais informações → Executar assim mesmo**.
3. O serviço inicia sozinho. No cartão **Arquivo de configuração do CS2**, clique em **Salvar arquivo…** e grave em:
   `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\`
4. Abra (ou reinicie) o CS2 e entre na partida como **espectador** ou assista pela **GOTV**.
5. O cartão **Conexão com o CS2** deve mostrar **recebendo dados**. Clique em **Abrir radar** ou **Abrir visão ESP** (janela própria), ou nos botões equivalentes para abrir no navegador.

**Sem o CS2:** com o serviço iniciado, clique em **Ligar demonstração** e abra a visão ESP ou o radar.

**CS2 em outro computador da rede:**
1. No app, escolha o endereço **Rede local (0.0.0.0)** e salve.
2. Salve o `.cfg` de novo. O app coloca nele o IP deste PC.
3. Copie o `.cfg` para o computador que roda o CS2.
4. Libere a porta (padrão `3010`) no Firewall do Windows.

As configurações ficam em `%APPDATA%\CS2 AssistLab\settings.json` e os logs em `Documentos\CS2 AssistLab\logs`.

## Configuração do servidor CS2

O radar **não precisa de plugin**: funciona com qualquer servidor, porque quem envia os dados é o cliente espectador.

1. Copie `config/servidor-cs2-espectador.cfg` para `game/csgo/cfg/` no servidor dedicado.
2. Defina uma senha em `sv_password` para manter a partida privada.
3. No console do servidor, rode `exec servidor-cs2-espectador`. Isso liga a GOTV, permite câmera livre para espectadores e adiciona bots de teste.
4. Conecte-se como espectador (ou pela GOTV) no computador que roda o AssistLab.

## Linha de comando (sem o app)

Requer Node.js 20 ou superior, sem pacotes extras.

```bash
cd gsi-dashboard
GSI_TOKEN=meu_token_secreto LOG_DIR=./logs node server.mjs
# Windows (PowerShell):
# $env:GSI_TOKEN="meu_token_secreto"; $env:LOG_DIR=".\logs"; node server.mjs
```

| Variável | Padrão | Descrição |
|---|---|---|
| `HOST` | `127.0.0.1` | `0.0.0.0` para aceitar conexões da rede local |
| `PORT` | `3010` | Porta HTTP |
| `GSI_TOKEN` | `assistlab-dev` | Precisa ser igual ao `auth.token` do `.cfg`. **Troque o padrão.** |
| `LOG_DIR` | — | Pasta dos CSV (sem ela, não grava logs) |
| `RAW_LOG` | `0` | `1` grava cada payload em JSONL |
| `DEMO` | `0` | `1` inicia com a partida simulada |

Use `config/gamestate_integration_assistlab.cfg` como modelo, trocando `TROQUE_ESTE_TOKEN`.

Páginas: radar em `http://127.0.0.1:3010/` e visão ESP em `http://127.0.0.1:3010/esp` (aceita `?pov=<steamid>`).

Para testar sem o CS2:
- `DEMO=1 node server.mjs` liga o modo demonstração interno;
- `npm run simulate` envia, como se fosse o CS2, 10 jogadores (3 humanos e 7 bots) a 10 Hz.

## Estrutura do repositório

```
gsi-dashboard/            servidor do painel (Node, sem dependências)
  src/server.js           servidor HTTP + SSE, autenticação, estatísticas
  src/gsi.js              parsing do GSI, heurística de bot, gerador de .cfg
  src/statsLogger.js      logs CSV
  src/esp.js              câmera virtual, projeção, caixas, indicadores, filtros
  src/simulator.js        partida simulada no formato GSI (modo demonstração)
  public/index.html       radar
  public/esp.html         visão ESP e painel de recursos
  test/                   testes unitários, de integração e de fumaça
desktop/                  aplicativo Windows (Electron)
  main.js                 processo principal: serviço, janelas, IPC, --smoke-test
  preload.cjs             ponte segura com a interface
  renderer/               painel de controle
  src/settings.js         configurações persistentes
config/                   arquivos .cfg (cliente e servidor)
docs/TESTES.md            relatório dos testes
.github/workflows/        build, testes e Release automáticos
```

## Compilação

```bash
# Testes do painel
cd gsi-dashboard && npm test && npm run smoke

# App Windows (em Windows, Node 22+)
cd desktop
npm install
npm test
npm start          # rodar em modo de desenvolvimento
npm run dist       # gera dist/AssistLab.exe e dist/AssistLab-Setup-*.exe
```

**GitHub Actions** (`.github/workflows/build.yml`):

| Job | Ambiente | O que faz |
|---|---|---|
| Painel | Ubuntu, Node 20 | 20 testes unitários e de integração (inclui a matemática da ESP e o modo demonstração), teste de fumaça de ponta a ponta, testes das configurações |
| App Windows | Windows, Node 22 | Instala dependências de versão fixa, testa, empacota, roda o `.exe` com `--smoke-test` (serviço, radar, painel e visão ESP com a demonstração) e publica os artefatos |
| Release | Ubuntu | A cada push na `main` (e em tags `v*`), publica a Release `v<versão de desktop/package.json>` com os executáveis e o zip de configuração |

Versões fixas: Electron `45.3.4` e electron-builder `26.18.0`. O Electron 45 exige Node 22.12 ou superior para instalar, por isso o job do app usa Node 22.

## Limitações

**Da Visão ESP (o que o GSI não fornece):**
- **Sem paredes nem geometria:** o GSI não envia o mapa. A ESP não sabe se alguém está atrás de uma parede, e a "visão" é um espaço vazio com grade.
- **Caixas estimadas:** não há ossos nem hitbox. A caixa usa altura fixa de jogador em pé (72 unidades, olhos a 64) e não reflete agachamento nem pulo. Para o GSI, a posição do jogador é a dos pés (premissa não confirmada em jogo).
- **Mira não exata:** o `forward` do GSI tem a direção do olhar com 3 casas decimais. A câmera virtual aproxima a visão do jogador, mas o FOV real depende da resolução e das configurações dele.
- **Sem armas, granadas ou utilitários na ESP.** O GSI até envia alguns desses dados, mas eles não são desenhados nesta versão.
- **Demos `.dem`:** não há leitor de arquivos de demo. Ao assistir uma demo dentro do CS2, o GSI deve funcionar como na GOTV, mas isso **não foi testado**.
- **Páginas sem senha:** o token protege só o envio de dados (`/gsi`). As páginas do radar e da ESP abrem sem senha. Com `0.0.0.0`, qualquer pessoa na sua rede local consegue abri-las.

**Gerais:**

- **Só espectador:** os dados de todos os jogadores só chegam como espectador ou GOTV (limitação da Valve).
- **Bots por heurística:** o GSI não tem campo "é bot". Humanos têm SteamID64 (`7656119…`, 17 dígitos), e IDs fora desse padrão, ou nomes começando com "BOT", são tratados como bots.
- **Sem mapa de fundo:** o radar usa coordenadas do mundo com enquadramento automático.
- **Taxa de atualização:** limitada pelo `throttle` do `.cfg` (padrão 0,05 s) e pelo próprio CS2.
- **Executável não assinado:** espere o aviso do SmartScreen.

## Testes

O relatório dos testes realizados, com o que roda no CI, está em [`docs/TESTES.md`](docs/TESTES.md).
