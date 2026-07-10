# Feature: Emails "virgens" no Estoque

## Pedido
No Estoque, criar um card onde seleciona serviço e adiciona emails que AINDA NÃO têm
assinatura ("email virgem"). Depois que assinar, vira estoque normal (disponível).

## Plano
1. [DONE] Backend schema: stockAccounts.status já é text livre — vou usar "virgem" como novo valor
   (sem migration de schema necessária, é só um novo valor string).
2. [DONE] POST /api/stock/import: aceita `virgin: boolean` — quando true, insere com status "virgem"
   em vez de "disponivel".
3. [DONE] GET /api/stock/summary: agora retorna também `virginTotal` e `byService[].virgin`.
4. [DONE] PATCH /api/stock/:id/status: aceita "virgem" como status válido (pra edição manual).
5. [DONE] POST /api/stock/:id/activate: novo endpoint — marca uma conta virgem como "disponivel"
   (assinou), opcionalmente atualiza a senha.
6. [TODO] Frontend lib/stock.ts: useActivateStock hook novo (chama /activate).
7. [TODO] Frontend stock.tsx:
   - Terceiro card de visão "Email Virgens" (roxo/azul) ao lado de Disponíveis/Com problema.
   - Toggle stockView vira "disponivel" | "problema" | "virgem".
   - Modal de importação: checkbox/toggle "Email virgem (ainda sem assinatura)" — quando marcado,
     desabilita o campo Cliente (não faz sentido virgem + cliente) e envia virgin=true.
   - Na tabela, quando visão = virgem: mostrar botão "Assinar" (em vez de Tag/UserPlus) que abre
     modal simples pra confirmar/editar a senha e chama useActivateStock.
   - Empty state e contadores considerando virginTotal.
8. [TODO] Build, db:push (não precisa pois é só valor string, mas rodar mesmo assim por garantia),
   restart dev, testar visualmente sem mexer em dados reais (usar dados de teste ou só inspecionar
   via JS/DB direto).
9. [TODO] Deliver.

## Cuidado
- NÃO clicar em botões de ação em cima de linhas de dados reais na tabela sem antes rodar
  `mb snap` para confirmar coordenada exata (já causei 3 renovações acidentais nesta conversa).
- Preferir testar fluxos novos criando dados de teste dedicados e removendo depois, ou inspecionando
  via `bun --env-file=../../.env -e "..."` direto no banco quando for só validar schema/API.
