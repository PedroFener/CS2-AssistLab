# Relatório de testes — CS2 AssistLab v1.0.0

Este relatório separa o que foi **executado de verdade** do que **não foi testado**. Os resultados de CI vêm do GitHub Actions, execução `44434254908` (commit `e02b8bb`, 19/11/2026).

## Executado e aprovado

| Teste | Onde | Resultado |
|---|---|---|
| `gsi-dashboard`: 7 testes unitários e de integração (parsing, heurística de bot, gerador de `.cfg`, validação, servidor com rejeição 400/401, SSE, estatísticas, CSV, porta ocupada) | Ubuntu, Node 20 (CI) e ambiente de desenvolvimento | 7/7 aprovados |
| `gsi-dashboard`: teste de fumaça (sobe `server.mjs` como processo real e envia 40 payloads simulados com 10 jogadores, sendo 7 bots) | Ubuntu, Node 20 (CI) | Aprovado: 40 recebidos, 0 rejeitados, 10 Hz, 10 jogadores, 7 bots, CSV criados, resumo gravado ao encerrar |
| `desktop`: 5 testes das configurações (padrões, validação, arquivo corrompido, persistência) | Ubuntu, Node 20 e Windows, Node 22 (CI) | 5/5 aprovados nos dois |
| Empacotamento com electron-builder 26.18.0 | Windows (CI) | `AssistLab.exe` portátil (≈110 MB) e `AssistLab-Setup-1.0.0.exe` (≈121 MB) gerados |
| Teste do executável empacotado (`CS2 AssistLab.exe --smoke-test`): sobe o serviço, recebe um payload GSI, carrega o radar e o painel de controle (com o preload) em janelas ocultas | Windows (CI), Electron 45.3.4 | Aprovado |
| Interface do painel de controle renderizada com API simulada | Chrome headless (ambiente de desenvolvimento) | Sem erros de JavaScript |
| Radar renderizado com dados simulados (10 jogadores) | Chrome headless (ambiente de desenvolvimento) | 60 fps, sem erros |

## Não testado

- **Com o CS2 de verdade:** nenhum teste usou o jogo. O formato dos payloads segue a documentação do GSI e bibliotecas conhecidas. Valide o primeiro uso com o cartão **Conexão com o CS2** no app.
- **Heurística de bot com bots reais:** não foi conferida em partida.
- **Uso interativo do `.exe`:** botões, salvar o `.cfg` e abrir o navegador foram testados só pela lógica e pela renderização, não clicando num Windows real.
- **Executável não assinado:** o SmartScreen vai avisar no primeiro uso.

## Fora deste repositório

O plugin de servidor (`AssistLab.dll`, CounterStrikeSharp) da versão anterior **não faz parte** desta entrega e não foi compilado.
