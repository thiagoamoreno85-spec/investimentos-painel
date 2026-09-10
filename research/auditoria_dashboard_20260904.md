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

## Notícias — correção de texto e relevância — 04/09/2026

- A ingestão passa a decodificar o charset declarado pelo feed, remover markup, scripts, estilos e entidades HTML antes de enviar conteúdo à análise e à persistência.
- Registros legados com caractere de substituição de codificação são ocultados da listagem para evitar a exibição de texto corrompido; serão naturalmente substituídos por conteúdo reprocessado dos feeds.
- A ordem agora pondera nível de impacto, vínculo com tickers reais, percentual financeiro da carteira atingido, recência e status de leitura. A interface mostra selo de prioridade e percentual de exposição quando há vínculo direto.
- A captura desktop confirmou cartões priorizados por exposição; a captura mobile confirmou que os controles “Marcar lidas” e “Atualizar” ficam completamente visíveis. TypeScript sem erros e 129 testes aprovados.

## Filtro de Maior Exposição — 04/09/2026

- O filtro seleciona o quartil superior de notícias com exposição financeira direta, usando o percentual calculado sobre o valor da carteira e preservando empates no limiar.
- Ele é combinável com categoria, nível de impacto e leitura; portanto, permite restringir, por exemplo, eventos de alto impacto que atinjam as maiores posições.
- O controle foi validado no desktop e está disponível no trilho horizontal de filtros em dispositivos móveis. A regra foi coberta por testes unitários, incluindo ausência de exposição direta.

## Filtro por ativo e preferência persistida — 04/09/2026

- Foi incluído um seletor com os tickers ativos da carteira (com exclusão de caixa), que restringe a lista a itens cujo ticker afetado corresponde ao ativo escolhido, inclusive quando a fonte usa o sufixo `.SA`.
- A última combinação de categoria, impacto, não lidas, maior exposição e ativo selecionado é persistida localmente no navegador e restaurada de forma defensiva na próxima abertura.
- A verificação desktop confirmou a visibilidade do seletor e de todos os filtros; em telas amplas, a barra de filtros passa a quebrar linhas para não ocultar o controle de maior exposição. TypeScript sem erros e 134 testes aprovados.

## Unificação do modo de privacidade — 04/09/2026

- O controle de ocultar/exibir valores passou a ficar disponível no rodapé da navegação em desktop e na barra superior em mobile, persistindo a mesma preferência global já usada pela Visão Geral, Alocação e Patrimônio.
- A cobertura foi ampliada para os resultados e gráficos de Rentabilidade e Aportes, posições e histórico de Transações, totais, gráfico e tabelas de Proventos, análises e snapshots de Melhor Compra, percentual de exposição em Notícias e gráfico de evolução patrimonial.
- A inspeção desktop confirmou o novo controle no sidebar e a integridade visual das telas atualizadas. O comportamento da preferência armazenada foi coberto por testes unitários.

## Metadados e alerta de marcação — renda fixa — 04/09/2026

- A tabela de renda fixa passa a reservar largura própria para emissor, vencimento, custo médio, preço atual, data-base, total e resultado, mantendo rolagem horizontal e sem sobreposição em telas estreitas.
- A data-base é acompanhada de ícone e texto: “Atualizar preço” após 30 dias ou quando inexistente, e “Revisar em breve” entre 15 e 30 dias. A informação não depende exclusivamente de cor.
- As capturas de prévia confirmaram a estrutura desktop e mobile no estado de carregamento da sessão sem autenticação; TypeScript e a suíte unitária validaram a tipagem e os limiares de atualização.

## Adaptação móvel da alocação — 04/09/2026

- A visualização abaixo de `md` passa a utilizar cartões por ativo, priorizando ticker, quantidade, valor atual, lucro/prejuízo e variação diária; para renda fixa, acrescenta custo, preço atual editável, emissor, vencimento e data-base.
- As duas tabelas de alta densidade permanecem disponíveis apenas no desktop. Assim, a leitura móvel não depende de uma tabela horizontal extensa nem apresenta sobreposição de colunas.
- As capturas de prévia nos dois viewports preservaram o estado de carregamento esperado sem erro visual. A confirmação dos cartões com dados reais exige sessão autenticada; a tipagem e a suíte foram validadas antes da captura.

## Rolagem de ativos na alocação móvel — 04/09/2026

- A versão móvel foi convertida de cartões estáticos para tabela compacta com quatro colunas essenciais: ativo, quantidade, total e L/P.
- O cabeçalho é um bloco fixo independente; apenas a lista de ativos fica dentro de uma área de rolagem vertical de altura limitada. A tabela detalhada permanece reservada ao desktop.
- As capturas de prévia nos formatos móvel e desktop mostraram os estados de carregamento sem regressão visual. A compilação e os testes validaram a estrutura atualizada.

## Controles da lista móvel de alocação — 06/09/2026

- A busca foi transferida para uma barra fixa imediatamente acima da lista móvel, para que permaneça acessível durante a navegação por ativos.
- A ordenação rápida permite alternar entre maior/menor valor, melhor/pior L/P e ordem alfabética. A expansão por linha revela custo médio, preço atual, classe, L/P em reais e, em renda fixa, a data-base da marcação.
- A linha expansível é acessível por teclado; a edição manual de preço permanece disponível apenas para as classes que a permitem. TypeScript e 145 testes Vitest foram aprovados.

## Filtros e preferência da alocação móvel — 06/09/2026

- Foram incluídos atalhos horizontais por classe e o filtro **Apenas perdas**, que restringe a lista móvel aos ativos com L/P negativo. Linhas deficitárias recebem uma borda lateral discreta em vermelho para facilitar a triagem visual.
- A ordenação escolhida pelo usuário é salva localmente e restaurada na próxima abertura com validação de valor, voltando ao padrão de maior valor caso a preferência esteja ausente ou seja inválida.
- A suíte passou a cobrir a lista de ordenações permitidas e a recuperação segura da preferência. TypeScript e 147 testes Vitest foram aprovados.

## Retorno de proventos sobre custo no detalhe do ativo — 06/09/2026

- O detalhe expansível do ativo passou a exibir os proventos de caixa acumulados e o **Yield sobre Custo**, calculado como proventos registrados divididos pelo custo atual da posição.
- Entram no cálculo dividendos, JCP, rendimentos, amortizações e lançamentos classificados como outros — categoria que abrange créditos de aluguel já importados. Bonificações ficam fora por não representarem caixa recebido.
- A interface diferencia carregamento, ausência de histórico e indisponibilidade da consulta, evitando que uma falha seja interpretada como retorno zero. TypeScript e 151 testes Vitest foram aprovados.

## Gráfico anual de proventos no detalhe do ativo — 06/09/2026

- O detalhe expansível da Alocação passou a incluir um gráfico de barras com a evolução anual dos proventos de caixa já recebidos pelo ativo selecionado.
- A série é agrupada pelo ano de pagamento; quando o lançamento não contém data de pagamento, utiliza-se a data-ex como referência explicitamente indicada na interface.
- Dividendos, JCP, rendimentos, amortizações e créditos de aluguel registrados entram no gráfico; bonificações não monetárias permanecem excluídas. O gráfico respeita o modo de privacidade e é mostrado apenas quando há histórico.

## Diagnóstico de carregamento após login — 08/09/2026

- Os dois domínios publicados responderam e redirecionaram corretamente para a autenticação. O problema não é de publicação nem de DNS.
- Os logs de produção registraram retorno XML da fonte do Banco Central em uma consulta que esperava JSON no comparativo de benchmarks. A resposta provocava erro de parse em `getBenchmarkHistory`; outros componentes também não distinguiam falha de carregamento.
- O cliente passou a limitar requisições tRPC a 15 segundos e a encerrar tentativas após uma repetição. O endpoint de benchmarks passou a validar HTTP e `content-type`, aplicar prazo à fonte e preservar a série disponível quando Ibovespa ou CDI falhar. Os cartões afetados agora oferecem estado explícito e ação de nova tentativa, evitando spinner permanente.

## Resiliência específica do carregamento desktop — 09/09/2026

- O cliente passou a usar um `AbortController` compatível para limitar requisições sem depender de `AbortSignal.timeout` ou `AbortSignal.any`, APIs de suporte desigual entre navegadores desktop.
- As consultas tRPC deixaram de compartilhar uma única resposta HTTP. Uma fonte lenta de benchmark, rentabilidade ou cotação não pode mais reter a resposta que contém os ativos centrais da carteira.
- A política de autenticação diferencia erro de rede de sessão efetivamente ausente: apenas uma falha de autenticação confirmada redireciona ao login; demais falhas recebem ação de nova tentativa. A inspeção desktop exibiu a Visão Geral com dados consolidados; no mobile, o estado sem ativos é explícito e não há carregamento permanente.

## Dashboard de Mercado — cartões de posição e variação mensal — 10/09/2026

- A aba **Minha Carteira** foi reorganizada em cartões expansíveis com preço, desempenho diário, variação mensal e valor da posição visíveis na camada inicial.
- Ao expandir o ativo, a interface apresenta quantidade, preço médio, lucro/prejuízo percentual e em valor, base de cálculo e data do fechamento de referência. A variação mensal é estritamente de preço, sem proventos, aportes ou custos.
- A prévia desktop e mobile preservou a estrutura de navegação; como o preview não possui sessão autenticada, a validação dos cartões com posições reais será realizada no domínio publicado após o checkpoint. Os valores novos usam a máscara global de privacidade.

## Dashboard de Mercado — lista de uma linha por ativo e abas de classe — 10/09/2026

- A visualização **Minha Carteira** foi estruturada com oito abas de classe: RV Nacional, Fundos, RV EUA, Criptomoedas, Renda Fixa, Urânio, Índia e Caixa.
- Cada aba mantém apenas ativos da classe selecionada e apresenta uma linha expansível por ativo, preservando preço, variações diária e mensal, valor de posição e os detalhes financeiros já existentes.
- As abas usam rolagem horizontal controlada em mobile e exibem contador de ativos por classe. Os previews desktop e mobile confirmaram que a navegação principal do Mercado permaneceu responsiva; a inspeção dos dados da aba requer sessão autenticada.

## Dashboard de Mercado — ordenação por variação mensal — 10/09/2026

- A lista de cada classe passou a oferecer os controles **Maiores altas** e **Maiores baixas**, usando a variação mensal de preço já exibida na coluna “Mês”. O primeiro ordena da maior alta à menor; o segundo, da maior baixa à maior.
- Ativos sem preço histórico suficiente permanecem ao final da ordenação, para que a ausência de série não seja interpretada como variação de 0,00%.
- Os previews desktop e mobile mantiveram a página responsiva; a conferência automatizada aprovou a ordenação mensal, o desempate por ticker e a preservação do critério de rendimento acumulado.

## Dashboard de Mercado — destaques de variação mensal extrema — 10/09/2026

- A lista de ativos passa a realçar altas mensais estritamente superiores a **+5%** com borda lateral, fundo verde reforçado e selo textual **“Alta mensal forte”**. Baixas estritamente inferiores a **−5%** recebem o equivalente em vermelho e o selo **“Queda mensal forte”**.
- A identificação textual permanece visível no detalhe expandido, evitando que o significado do alerta dependa somente de cor. Valores exatamente em +5,00% ou −5,00% mantêm estilo neutro.
- As prévias desktop e mobile preservaram a estrutura do Dashboard de Mercado; a inspeção dos cards com posições reais requer sessão autenticada. A regra de limiar foi validada por testes unitários.

## Novo diagnóstico de acesso publicado — 10/09/2026

- O domínio principal respondeu e encaminhou ao fluxo oficial de autenticação, mas os logs de produção registraram apenas **“Missing session cookie”**. Não houve erro de aplicação ou indisponibilidade do servidor.
- A inspeção da tela de autenticação no navegador do usuário excedeu o tempo de resposta, portanto a conclusão do login manual é necessária para restabelecer a sessão antes de validar o painel autenticado.

## Recuperação de sessão no navegador — 10/09/2026

- A proteção de rotas passou a fazer somente uma tentativa automática de autenticação por sessão do navegador. Se o callback voltar sem o cookie protegido, a aplicação deixa de exibir carregamento contínuo e mostra uma tela de recuperação com as instruções de cookies, navegação privada e bloqueadores.
- A validação automatizada cobriu a tentativa inicial, a prevenção de ciclo após callback sem sessão e a não interferência em sessão válida ou falha de rede. A prévia desktop permaneceu acessível e sem tela de carregamento permanente.
