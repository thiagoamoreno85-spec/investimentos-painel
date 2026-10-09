# Auditoria de Quantitativos — Renda Variável Nacional

**Data-base:** 09/10/2026, após a compra de 26 ações de AXIA3 (ordem AXIA3F).  
**Escopo:** confronto entre a planilha/imagem enviada e a coluna `assets.totalQuantity` do painel, seguido de reconstrução independente do saldo a partir de `transactions`.  
**Alterações realizadas:** nenhuma.

## 1. Resultado do confronto de posição atual

A tabela de posição atual do painel está alinhada com todos os quantitativos legíveis na imagem recebida. Não há ticker duplicado entre os ativos analisados.

| Ativo | Planilha | Painel (`assets.totalQuantity`) | Diferença | Situação |
|---|---:|---:|---:|---|
| SUZB3 | 773 | 773 | 0 | Confere |
| KLBN11 | 582 | 582 | 0 | Confere |
| BRAV3 | 1.232 | 1.232 | 0 | Confere |
| CMIN3 | 18.457 | 18.457 | 0 | Confere |
| VALE3 | 1.376 | 1.376 | 0 | Confere |
| BPAC11 | 1.147 | 1.147 | 0 | Confere |
| INBR32 | 1.037 | 1.037 | 0 | Confere |
| BBAS3 | 2.146 | 2.146 | 0 | Confere |
| BBDC4 | 1.182 | 1.182 | 0 | Confere |
| CXSE3 | 1.216 | 1.216 | 0 | Confere |
| AXIA7 | 186 | 186 | 0 | Confere |
| AURE3 | 353 | 353 | 0 | Confere |
| KEPL3 | 4.672 | 4.672 | 0 | Confere |
| TTEN3 | 1.275 | 1.275 | 0 | Confere |
| AGRO3 | 735 | 735 | 0 | Confere |
| SOJA3 | 0 | 0 | 0 | Confere (posição zerada) |
| MBRF3 | 4.130 | 4.130 | 0 | Confere |
| FLRY3 | 645 | 645 | 0 | Confere |
| SBSP3 | 3.585 | 3.585 | 0 | Confere |
| ORVR3 | 2.712 | 2.712 | 0 | Confere |
| CYRE3 | 2.679 | 2.679 | 0 | Confere |
| CYRE4 | 507 | 507 | 0 | Confere |
| ZAVI11 | 146 | 146 | 0 | Confere |
| XPML11 | 115 | 115 | 0 | Confere |

> **AXIA3:** o número correspondente não está legível na captura. O painel registra **1.104 ações**, já incluindo a compra de 26 ações efetuada em 09/10/2026. A reconstrução pelas transações também resulta em 1.104 ações.

## 2. Inconsistências na trilha histórica de transações

Embora os saldos exibidos no painel coincidam com a planilha, a reconstrução por compras menos vendas não reproduz a quantidade atual em nove ativos. Isso demonstra que houve ajustes diretos na posição, eventos societários ou operações históricas não espelhadas integralmente em `transactions`.

| Ativo | Posição atual | Saldo reconstruído por transações | Diferença atual − histórico |
|---|---:|---:|---:|
| KLBN11 | 582 | 572 | +10 |
| CMIN3 | 18.457 | 18.357 | +100 |
| BPAC11 | 1.147 | 1.122 | +25 |
| CXSE3 | 1.216 | 1.143 | +73 |
| KEPL3 | 4.672 | 4.732 | -60 |
| TTEN3 | 1.275 | 1.215 | +60 |
| FLRY3 | 645 | 630 | +15 |
| SBSP3 | 3.585 | 6.093 | -2.508 |
| XPML11 | 115 | 116 | -1 |

## 3. Interpretação

- **Fundamento verificado:** o cartão de patrimônio e a tela de alocação usam a posição atual cadastrada em `assets.totalQuantity`; para os ativos confrontados, esses quantitativos são compatíveis com a planilha enviada.
- **Fragilidade identificada:** a trilha `transactions` não está conciliada com nove saldos atuais. A maior divergência é SBSP3, com 2.508 ações a menos no cadastro atual do que na soma de transações.
- **Impacto provável:** a divergência histórica não altera, por si só, a quantidade exibida hoje. Porém pode distorcer reconstruções de preço médio, resultado histórico, rentabilidade e qualquer rotina que recalcule posições exclusivamente a partir das transações.
- **Hipótese ainda não comprovada:** parte das diferenças pode decorrer de desdobramentos, ajustes manuais antigos, transferências de custódia ou operações não importadas. A origem documental de cada diferença não foi comprovada nesta auditoria.

## 4. Conclusão e plano seguro

A divergência de saldo reportada **não decorre dos quantitativos atuais** da lista confrontada: todos os números legíveis da planilha coincidem com o cadastro atual do painel. A investigação deve prosseguir sobre (i) preços/cotações e moedas, (ii) saldo de caixa com data-base e (iii) a conciliação das nove trilhas transacionais listadas acima.

Nenhuma posição, preço, custo, transação, provento, caixa ou patrimônio foi modificado por esta auditoria.
