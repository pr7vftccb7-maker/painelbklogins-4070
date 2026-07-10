# Painel de Assinaturas — Design System

## Conceito
Painel administrativo escuro e moderno para gerenciar assinaturas de streaming. Visual "control room": denso mas organizado, com cores de marca dos serviços como identidade visual e acentos vibrantes para status.

## Tipografia
- **Display / títulos**: "Sora" (600/700)
- **Corpo / tabelas**: "Plus Jakarta Sans" (400/500/600)
- Números de datas e telas usam tabular-nums.

## Cores (dark-first)
- `--bg`: #0B0D12 (fundo base)
- `--surface`: #14171F (cards, tabelas)
- `--surface-2`: #1C202B (hover / linhas alternadas)
- `--border`: #262B38
- `--text`: #EDF0F6
- `--text-muted`: #8A92A6
- `--accent`: #6D5EF6 (roxo elétrico — ações primárias)
- Status:
  - Ativa → verde #2FBF71
  - Caída → vermelho #F0484B
  - Atualizar Pagamento → âmbar #F5A524
  - Vencida → laranja-vermelho #FF6B35
  - Cancelada → cinza #6B7280

## Cores de marca (grid de serviços)
- Netflix #E50914 · Disney+ #113CCF · HBO Max #7B2FF7 · Prime Video #00A8E1 · Spotify #1DB954 · Globoplay #FF4C00 · Globoplay+Telecine #E8113C · Premiere #00A94F · Youtube Premium #FF0000 · Paramount+ #0064FF

## Layout
- Sidebar fixa à esquerda (logo, navegação: Início, Contas Vencidas com badge, Configurações, Sair).
- Conteúdo principal com header (título da seção + ações).
- Grid de serviços: cards com faixa de cor da marca, nome, contagem de contas e quantas vencendo.
- Detalhe do serviço: tabela densa com colunas email, senha, cliente, vencimento, telas extra, forma de pagamento, status, ações.

## Componentes
- Cards de serviço com barra superior colorida e brilho sutil no hover.
- Badges de status pill com cor de fundo suave (10% opacidade) + texto na cor cheia.
- Tabela com header sticky, linhas com hover, zebra sutil.
- Modais para adicionar/editar conta.
- Botão primário roxo, secundário outline.

## UX
- Renovação: botão "Renovou" avança 1 mês mantendo o mesmo dia (30/06 → 30/07), com clamp para fim de mês.
- Contas vencidas: computadas por data (dueDate <= hoje). Badge com contador na sidebar.
- Aviso no dia do vencimento; notificação Telegram para o admin.
- Senhas ocultas por padrão com toggle de visualização.

## Motion
- Reveal escalonado no carregamento de páginas (Motion).
- Transições suaves de hover nos cards e linhas.
