# CS2 AssistLab

Radar administrativo e estatísticas para partidas privadas de **Counter-Strike 2**, alimentado pelo **Game State Integration (GSI)**, a interface oficial da Valve. Vem como aplicativo Windows (`AssistLab.exe`) e como servidor Node para linha de comando.

O AssistLab **só lê** o que o próprio CS2 envia pelo GSI. Não injeta nada, não lê a memória do jogo, não mexe no processo do CS2 e não interfere no VAC.

> **Importante:** o GSI só manda a posição de **todos** os jogadores quando o CS2 está como **espectador ou GOTV**. Enquanto você joga, ele só manda os seus dados. Por isso o radar é uma ferramenta de **administração e análise**, para quem está assistindo, e não um auxílio para quem está jogando.

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
5. O cartão **Conexão com o CS2** deve mostrar **recebendo dados**. Clique em **Abrir radar** (janela própria) ou **Abrir no navegador**.

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

Use `config/gamestate_integration_assistlab.cfg` como modelo, trocando `TROQUE_ESTE_TOKEN`.

Para testar sem o CS2: `npm run simulate`. O simulador envia 10 jogadores (3 humanos e 7 bots) a 10 Hz.

## Estrutura do repositório

```
gsi-dashboard/            servidor do painel (Node, sem dependências)
  src/server.js           servidor HTTP + SSE, autenticação, estatísticas
  src/gsi.js              parsing do GSI, heurística de bot, gerador de .cfg
  src/statsLogger.js      logs CSV
  public/index.html       radar
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
| Painel | Ubuntu, Node 20 | Testes unitários e de integração, teste de fumaça de ponta a ponta, testes das configurações |
| App Windows | Windows, Node 22 | Instala dependências de versão fixa, testa, empacota, roda o `.exe` com `--smoke-test` e publica os artefatos |
| Release | Ubuntu | A cada push na `main` (e em tags `v*`), publica a Release `v<versão de desktop/package.json>` com os executáveis e o zip de configuração |

Versões fixas: Electron `45.3.4` e electron-builder `26.18.0`. O Electron 45 exige Node 22.12 ou superior para instalar, por isso o job do app usa Node 22.

## Limitações

- **Só espectador:** os dados de todos os jogadores só chegam como espectador ou GOTV (limitação da Valve).
- **Bots por heurística:** o GSI não tem campo "é bot". Humanos têm SteamID64 (`7656119…`, 17 dígitos), e IDs fora desse padrão, ou nomes começando com "BOT", são tratados como bots.
- **Sem mapa de fundo:** o radar usa coordenadas do mundo com enquadramento automático.
- **Taxa de atualização:** limitada pelo `throttle` do `.cfg` (padrão 0,05 s) e pelo próprio CS2.
- **Executável não assinado:** espere o aviso do SmartScreen.

## Testes

O relatório dos testes realizados, com o que roda no CI, está em [`docs/TESTES.md`](docs/TESTES.md).
