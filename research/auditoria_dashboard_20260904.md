# Auditoria do Dashboard de Investimentos — 04/09/2026

## Escopo e método

Inspeção visual das rotas Visão Geral, Alocação, Rentabilidade, Dashboard Mercado, Notícias, Calendário e Patrimônio, nos viewports desktop de 1440×1000 e mobile de 390×844. A inspeção foi realizada em estado de prévia sem sessão autenticada; por isso, componentes dependentes de consulta ficaram em carregamento ou exibiram o fallback de demonstração. Não houve alteração de dados financeiros.

## Constatações visuais principais

| Prioridade | Constatação | Evidência | Impacto |
|---|---|---|---|
| P0 | A Visão Geral sem sessão exibe alerta de dados de demonstração, cards com loaders e métricas estáticas simultaneamente. | Desktop e mobile mostram "Exibindo dados de demonstração", patrimônio "—", loading no Net Worth/Rent. Hoje e lucros/posições preenchidos. | Pode induzir interpretação equivocada da origem e atualidade dos números. |
| P0 | As telas Alocação e Dashboard Mercado permanecem em carregamento no ambiente de prévia. | Ambas exibiram apenas o spinner em desktop; Alocação também no mobile. | Deve haver timeout, estado de erro e ação de tentar novamente para evitar tela vazia. |
| P1 | A visualização de Notícias possui texto com caracteres corrompidos e HTML aparente no resumo. | Ex.: "B3 n�o" e tags `<a href=...>` visíveis. | Reduz legibilidade e confiança na informação. |
| P1 | Os contadores globais de notícias/alertas estão saturados (99+ e 86), competindo com a navegação. | Sidebar desktop e barra mobile. | Alerta perde prioridade e causa fadiga visual. |
| P1 | A home concentra muitos blocos sequenciais abaixo da dobra inicial. | Alocação, Top 5, patrimônio, moedas, benchmark e calendário em sequência. | A decisão diária exige rolagem excessiva e baixa prioridade explícita. |
| P1 | Os cards no mobile de Patrimônio têm valores monetários cortados horizontalmente. | Valores dos cards Ativos, Passivos e Líquido terminam parcialmente fora do card. | Compromete leitura de valores críticos e acessibilidade. |
| P2 | O gráfico de Lucro/Prejuízo por Classe tem rótulos horizontais excessivos no mobile. | Categorias aparecem parcialmente, com espaço grande de gráfico e baixa leitura. | Visualização pouco eficiente em tela pequena. |
| P2 | Calendário é legível e responsivo, mas não comunica utilidade quando não há eventos. | Grade vazia e seção "Próximos Eventos" sem conteúdo visível. | Falta orientação de próximo passo e contexto temporal. |
| P2 | O sistema visual é coerente, mas os cards têm pouca diferenciação estrutural. | Dark mode com cartões uniformes; azul, verde, vermelho e amarelo disputam atenção. | A hierarquia é funcional, porém ainda genérica para uma central financeira pessoal. |

## Aspectos positivos preserváveis

- Navegação por grupos é clara e o menu móvel apresenta boa estrutura.
- O modo de privacidade, a linguagem de ganho/perda e a divisão por classes são adequados ao uso financeiro.
- A página de Rentabilidade possui hierarquia inicial objetiva, com melhor/pior ativo e lista de ganhos/perdas.
- A página Patrimônio separa ativos, passivos e líquido de modo intuitivo, com bom uso de cor semântica.

## Constatações técnicas confirmadas na revisão de código

- A Home inicia o patrimônio com o `cashBalance`, mas o custo acumulado exclui esse saldo e calcula `profit = patrimony - cost`. A métrica visual de resultado pode, portanto, tratar caixa como lucro.
- Home e Alocação oferecem fallback de `portfolioData` quando `getAssets` não retorna posições; a Home também mantém procedimento de seed acionável por botão. A experiência produtiva deve priorizar estado vazio, pois a política do painel impede criação financeira não confirmada.
- Alocação e Dashboard de Mercado tratam carregamento, mas não expõem estados de erro, timeout ou última leitura válida quando as consultas falham.
- O sanitizador de RSS remove tags e poucas entidades HTML nomeadas, mas não executa decodificação robusta de entidades/UTF-8. Isso explica o HTML residual e a codificação defeituosa observados na interface.
- Rentabilidade não participa do contexto global `BalanceVisibilityContext`; assim, a privacidade é inconsistente fora da Home.
- Patrimônio usa três colunas fixas na síntese móvel, sem contenção adequada de valores extensos; o corte de números visualizado é reproduzível pela estrutura de layout.

## Validação das correções prioritárias — 04/09/2026

- A Visão Geral agora exibe apenas dados reais consolidados, identifica a origem por selo explícito e informa que o resultado exclui saldo de caixa.
- A métrica de resultado usa uma função pura que separa patrimônio, valor investido, custo, resultado dos investimentos e caixa; foram incluídos testes para caixa e registros legados.
- Em caso de indisponibilidade de ativos, caixa ou câmbio, Visão Geral e Alocação deixam de recorrer a valores estáticos e passam a exibir carregamento, falha ou ausência de carteira de maneira explícita.
- As seções de Mercado receberam estados de indisponibilidade com ação de nova tentativa; a captura mostrou o estado de carregamento com mensagem compreensível em desktop e mobile.
- A validação de tipos e a suíte Vitest foram concluídas com êxito: 124 testes aprovados.

## Verificação de consistência entre telas

- Após a unificação do cálculo, o valor de resultado exibido na Visão Geral e em Rentabilidade convergiu para o mesmo número de referência, eliminando a divergência causada pela inclusão indevida de caixa na primeira tela.
- As capturas alternaram entre o estado temporário de carregamento e os dados consolidados conforme a resposta das consultas; o carregamento agora é explicitamente informado e não expõe carteira demonstrativa.
