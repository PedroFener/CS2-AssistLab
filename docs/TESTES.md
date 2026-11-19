# Relatório de testes — CS2 AssistLab

Este relatório separa o que foi **executado de verdade** do que **não foi testado**.

## v1.1.0 (AssistLab ESP)

Os resultados de CI vêm do GitHub Actions, execução `44437189411` (commit `922497e`, 19/11/2026). A Release `v1.1.0` foi publicada por essa execução.

### Executado e aprovado

| Teste | Onde | Resultado |
|---|---|---|
| `gsi-dashboard`: 20 testes automatizados. São 11 da ESP: eixos da câmera no padrão Source, entradas inválidas, câmera vertical, projeção (centro, atrás, direita/esquerda, acima), caixas (proporção pela distância, base nos pés), indicadores fora da tela (direita, esquerda, atrás), bearing, frame (aliado/adversário, filtros de bots/aliados/alcance, mortos, sem posição, ordem de desenho), POV inexistente, rótulos sem sobreposição, simulação determinística. Os outros 9 cobrem o servidor: rotas `/esp` e `/lib`, lista branca de arquivos e modo demonstração (gera dados, não grava CSV, desliga com dado real, limpa ao desligar). | Ubuntu, Node 20 (CI) e ambiente de desenvolvimento | 20/20 aprovados |
| Teste de fumaça: `server.mjs` real, 40 payloads do simulador, páginas `/`, `/esp` e `/lib/esp.js` | Ubuntu, Node 20 (CI) | Aprovado: 40 recebidos, 0 rejeitados, 10 jogadores (7 bots) |
| Configurações do app (5 testes) | Ubuntu (Node 20) e Windows (Node 22) (CI) | 5/5 nos dois |
| Empacotamento | Windows (CI), electron-builder 26.18.0 | `AssistLab.exe` (≈110 MB) e `AssistLab-Setup-1.1.0.exe` (≈121 MB) |
| `.exe` empacotado com `--smoke-test`: serviço, payload GSI, radar, painel de controle com o preload, e visão ESP com a demonstração ligada (espera os 10 jogadores e confere que todos os 9 alvos foram classificados em "na tela", "fora da tela" ou "oculto") | Windows (CI), Electron 45.3.4 | Aprovado: "ESP: 10 jogadores, 6 na tela, 3 fora" |
| Visão ESP no navegador com o modo demonstração: renderização, contagem de caixas e indicadores, filtro "Mostrar adversários" (9 visíveis → 4, com 5 ocultos), preferências salvas, troca de POV pelo teclado, link radar ⇄ ESP com o jogador selecionado, sem erros no console | Chrome headless (ambiente de desenvolvimento) | Aprovado, ~60 fps |

### Não testado

- **Com o CS2 de verdade:** a ESP e o radar não foram usados com o jogo. Os pontos a conferir no primeiro uso real são:
  - se a `position` do GSI é mesmo a dos pés;
  - se o `forward` bate com a câmera do jogador;
  - se o GSI funciona ao assistir uma demo `.dem` dentro do CS2.
- **Interface do app num Windows real:** os cliques nos botões novos (visão ESP, demonstração) foram verificados pela lógica e pelo teste automático, não manualmente.
- **Desempenho com muitos jogadores:** testado só com 10.

## v1.0.0

Execução `44434254908`: painel 7/7, fumaça aprovada, configurações 5/5, empacotamento e `--smoke-test` (serviço, radar e painel) aprovados.

## Fora deste repositório

O plugin de servidor (`AssistLab.dll`, CounterStrikeSharp) não faz parte do projeto e não foi compilado.
