# FIAP X — Brief de design para o Stitch

Documento para gerar as telas no Google Stitch. Cada seção tem um **prompt pronto para colar**.
Comece pelo Design System, depois gere uma tela por vez, na ordem apresentada.

> **Estado atual:** as telas já foram geradas e o resultado do Stitch é o que está implementado em
> `apps/web`. O Stitch devolveu uma paleta Material 3 no lugar do monocromático descrito
> originalmente aqui, e essa foi a versão adotada. A seção "Design system" abaixo reflete o que
> está no código; os prompts das seções 3 a 6 são o histórico de como as telas foram geradas.

---

## 1. O produto

Ferramenta interna onde uma pessoa envia arquivos de vídeo e recebe de volta um `.zip` com os
frames extraídos. O processamento é assíncrono: o upload termina, o vídeo entra numa fila e o
status muda sozinho na tela até ficar pronto para download.

**Tom visual:** ferramenta de trabalho, não landing page. Densa em informação, sóbria, com
tipografia pequena e muito alinhamento. Quem usa isso passa o dia olhando uma tabela de status.

**São 4 telas:** Entrar · Biblioteca · Enviar vídeo · Detalhe do vídeo.

---

## 2. Design system

### Paleta

Esquema Material 3 com o magenta institucional da FIAP como cor primária e um teal como
terciária. Os tokens vivem em `apps/web/src/styles/tokens.css` como canais RGB, e o Tailwind os
compõe via `rgb(var(--token) / <alpha-value>)` — é isso que faz `bg-primary/10` funcionar sobre
variáveis.

O acento tem dois passos por causa de contraste: `#ed145b` atrás de texto branco mede 4,33:1,
abaixo dos 4,5:1 que o AA pede para 13px, enquanto `#c10e4a` mede 6,12:1. Por isso `primary` (fundo
de botão) é o tom escuro e `primary-container` é o magenta exato da marca — que é onde ele aparece
descoberto: logo, hover e anel de foco.

| Token                      | Claro     | Escuro    | Uso                                 |
| -------------------------- | --------- | --------- | ----------------------------------- |
| `primary`                  | `#c10e4a` | `#c10e4a` | Fundo do botão primário, link ativo |
| `primary-container`        | `#ed145b` | `#ed145b` | Magenta FIAP: logo, hover, foco     |
| `on-primary`               | `#ffffff` | `#ffffff` | Texto sobre o vermelho              |
| `tertiary`                 | `#006577` | `#74d4ed` | Ação secundária, link "Acompanhar"  |
| `tertiary-container`       | `#008096` | `#008096` | Selo e barra de "Processando"       |
| `success`                  | `#10b981` | `#34d399` | Selo "Concluído"                    |
| `error`                    | `#ba1a1a` | `#ffb4ab` | Selo "Falhou", erro de campo        |
| `error-container`          | `#ffdad6` | `#93000a` | Fundo de alerta                     |
| `surface` / `background`   | `#faf8ff` | `#131316` | Fundo da aplicação                  |
| `surface-container-lowest` | `#ffffff` | `#0e0e11` | Cartões, tabelas, painéis           |
| `surface-container-low`    | `#f5f2fa` | `#1b1b1f` | Sidebar, cabeçalho de fila          |
| `surface-variant`          | `#e3e1e9` | `#48454e` | Canvas atrás do conteúdo            |
| `on-surface`               | `#1b1b20` | `#e5e1e9` | Texto principal                     |
| `secondary`                | `#5f5e60` | `#c8c6c8` | Texto secundário                    |
| `secondary-container`      | `#e2dfe1` | `#46464a` | Bordas e divisórias                 |
| `outline-variant`          | `#e8bcba` | `#48454e` | Borda de campo                      |

O magenta continua reservado para ação primária — nunca decorativo, nunca em fundo de área grande.
O teal aparece só em estado de processamento e em ação secundária.

### Logo

O componente `apps/web/src/components/Logo.tsx` traz os paths oficiais do wordmark, copiados sem
alteração de `https://www.fiap.com.br/svg/fiap.svg`. O **X** não é fonte substituta: foi desenhado
sobre a geometria medida no próprio arquivo — 34,79° da vertical (o mesmo ângulo da diagonal do
**A**) e traço de 2,876 de largura horizontal, na altura de maiúsculas que o F, o I e o P dividem
(0,205 a 27,506).

Tudo em `currentColor`, então um componente serve tema claro, tema escuro e o rail de ícones. A
variante `mark` mostra só o X, para os 64px do rail.

### Tipografia

- Família: **Inter** (fallback: system sans-serif).
- Escala: 11px (rótulo maiúsculo), 13px (corpo de tabela e botões), 15px (corpo), 17px (subtítulo),
  22px (título de página), 28px (título da tela de login).
- Pesos: 400 para texto corrido, 500 para rótulos e nomes de arquivo, 600 para títulos.
- Números em tabela e métricas usam **numerais tabulares** (alinhamento por coluna).
- Rótulos de cabeçalho de tabela: 11px, maiúsculas, `letter-spacing` 0.04em, cor `gray-400`.

### Forma e espaçamento

- Grade de espaçamento de 4px, nomeada: `xs` 4, `sm` 8, `md`/`gutter` 16, `lg` 24, `xl` 32.
- Raio: `lg` 0.25rem, `xl` 0.5rem em painéis, `full` 0.75rem em campos e botões, `4xl` 2rem em
  itens de navegação e no dropzone, `circle` para pontos e avatares.
- Bordas de 1px em `secondary-container`. Sombras quase imperceptíveis
  (`0 1px 2px rgba(0,0,0,0.05)`) e apenas em elementos flutuantes.
- Altura de linha de tabela: 44px (`row-height`). Densidade alta é intencional.

### Proibido

Gradientes de qualquer tipo · emoji · ilustrações · texto de marketing · sombras difusas coloridas
· fundo vermelho em área grande · uma terceira cor de destaque além do vermelho e do teal.

### Tema

Claro e escuro, alternados pelo atributo `data-theme` no `<html>`. O `ThemeToggle` sempre escreve
um valor explícito — inclusive no modo automático, resolvendo `prefers-color-scheme` na hora —
porque a variante `dark:` do Tailwind está ligada a `[data-theme="dark"]`.

### Prompt — Design System

```
Create a design system for an internal video processing tool. Strictly monochrome plus one accent.

Palette — use only these:
black #0B0B0C, gray-900 #161618, gray-800 #232326, gray-600 #5A5A60, gray-400 #9A9AA0,
gray-200 #E3E3E5, gray-100 #F2F2F3, gray-50 #FAFAFA, white #FFFFFF,
red-500 #EF0D33, red-600 #C40027, red-100 #FDE7EC.

Red is reserved for primary actions and error states only — never decorative, never as a large
background fill. Roughly 90% neutral, 10% red.

Typography: Inter. Sizes 11, 13, 15, 17, 22, 28px. Weights 400/500/600. Tabular numerals in tables
and metrics. Table headers are 11px uppercase, letter-spacing 0.04em, gray-400.

Shape: 4px grid. Radius 4px inputs and buttons, 6px pills, 10px cards. 1px solid gray-200 borders.
Nearly invisible shadows. Dense 44px table rows.

Components to define: primary button (red-500 fill, white text), secondary button (white fill,
gray-200 border), ghost button, text input with visible label above, select, search input,
status pill (small, 6px dot + label), data table, side navigation, empty state, inline alert,
progress bar (2px tall), skeleton loader.

No gradients, no emoji, no illustrations, no large decorative icons, no marketing copy,
no rounded-heavy shapes. This is a work tool, not a landing page.
```

---

## 3. Tela — Entrar

Layout dividido ao meio, sem cartão centralizado.

**Coluna esquerda (fundo `gray-100`, borda direita 1px):** no topo, a marca "FIAP X" em 17px
semibold e abaixo "Processamento de vídeos" em 11px maiúsculo `gray-400`. No centro vertical, o
título "Envie o vídeo. Receba os frames." em 28px, um parágrafo de duas linhas em `gray-600`, e uma
lista numerada de três passos, com os números dentro de círculos de 20px com borda 1px:

1. Envie um ou vários arquivos de uma vez
2. Acompanhe o processamento sem recarregar a página
3. Baixe o .zip assim que ficar pronto

No rodapé, "Hackathon POSTECH SOAT · Fase 5" em 11px `gray-400`.

**Coluna direita (fundo branco):** formulário de largura máxima 336px, centralizado. No topo, um
seletor de duas abas ("Entrar" / "Criar conta") dentro de uma cápsula `gray-100` com borda — a aba
ativa fica branca com sombra sutil. Abaixo, os campos com rótulo visível acima: E-mail e Senha (no
modo "Criar conta" aparece também Nome no topo e um texto auxiliar "Mínimo de 8 caracteres" sob a
senha). Por fim, o botão primário vermelho ocupando a largura toda.

**Estado de erro:** borda vermelha no campo e mensagem em 11px vermelho logo abaixo dele. Erro do
servidor aparece como faixa `red-100` com texto `red-500` acima do botão.

### Prompt — Entrar

```
Design a sign-in screen for an internal video processing tool, using the design system above.

Split layout, no centered card.

Left half (gray-100 background, 1px right border): brand "FIAP X" at 17px semibold with
"PROCESSAMENTO DE VÍDEOS" beneath in 11px uppercase gray-400. Vertically centered: headline
"Envie o vídeo. Receba os frames." at 28px, a two-line supporting paragraph in gray-600, then a
numbered list of three steps where each number sits in a 20px circle with a 1px border:
"Envie um ou vários arquivos de uma vez", "Acompanhe o processamento sem recarregar a página",
"Baixe o .zip assim que ficar pronto". Footer line "Hackathon POSTECH SOAT · Fase 5" in 11px
gray-400.

Right half (white background): a 336px wide form. At the top, a two-tab segmented control
("Entrar" / "Criar conta") inside a gray-100 rounded container with a 1px border; the active tab is
white with a subtle shadow. Below it, stacked fields with visible labels above each input:
"E-mail" and "Senha". Full-width primary red button labelled "Entrar".

Everything in Portuguese. Dense, quiet, no illustrations.
```

---

## 4. Tela — Biblioteca

Tela principal. Barra lateral fixa à esquerda e tabela ocupando o resto.

**Barra lateral (232px, fundo `gray-100`, borda direita):** marca no topo. Navegação com dois itens
— "Biblioteca" (ativo) e "Enviar vídeo". O item ativo é uma pilha branca com raio 6px e sombra
sutil; os inativos são texto `gray-600`. No rodapé, separados por uma linha 1px: nome e e-mail do
usuário em duas linhas (13px e 11px), e dois botões fantasma pequenos, "Tema: Automático" e "Sair".

**Cabeçalho da página:** título "Biblioteca" em 22px; abaixo, em 13px `gray-600`, a frase
"2 vídeos em andamento · atualizando automaticamente". À direita, botão primário vermelho
"Enviar vídeo".

**Barra de ferramentas:** campo de busca ("Buscar por nome do arquivo", 220px), select de status
("Todos os status"), e, empurrado para a direita, a contagem "12 vídeos" em 13px `gray-400`.

**Tabela** dentro de um painel branco com borda 1px e raio 10px. Cabeçalho `gray-100`. Colunas:

| Coluna  | Alinhamento          | Exemplo                  |
| ------- | -------------------- | ------------------------ |
| Arquivo | esquerda, 500        | `aula-02-introducao.mp4` |
| Status  | esquerda             | selo                     |
| Duração | direita, tabular     | `12:04`                  |
| Frames  | direita, tabular     | `1.284`                  |
| Zip     | direita, tabular     | `48,2 MB`                |
| Enviado | esquerda, `gray-400` | `há 3 minutos`           |
| (ação)  | direita              | botão                    |

**Selos de status** — cápsula pequena com ponto de 6px à esquerda, borda 1px:

- **Na fila** — texto `gray-600`, fundo `gray-100`
- **Processando** — texto `gray-900`, fundo branco, borda `gray-400`, ponto piscando
- **Concluído** — texto `black`, fundo branco, borda `gray-200`, ponto preto sólido
- **Falhou** — texto `red-500`, fundo `red-100`, borda vermelha clara

**Ação por linha:** "Baixar zip" (botão secundário pequeno) quando concluído; "Detalhes" (botão
fantasma pequeno) nos demais casos.

Mostre 6 linhas cobrindo os quatro status.

**Estado vazio:** dentro do painel, centralizado, sem ícone — título "Nenhum vídeo por aqui ainda"
em 15px semibold, parágrafo de duas linhas em `gray-600` com largura máxima de 42 caracteres, e
botão primário "Enviar vídeo" abaixo.

### Prompt — Biblioteca

```
Design the main library screen of an internal video processing tool, using the design system above.

Fixed left sidebar, 232px, gray-100 background with a 1px right border: brand "FIAP X" with
"VÍDEOS" beneath in 11px uppercase. Navigation with two items, "Biblioteca" (active) and
"Enviar vídeo" — the active one is a white pill with 6px radius and a subtle shadow. At the bottom,
above a 1px divider: user name at 13px and e-mail at 11px gray-400, plus two small ghost buttons
"Tema: Automático" and "Sair".

Main area: page title "Biblioteca" at 22px with the subtitle "2 vídeos em andamento · atualizando
automaticamente" at 13px gray-600. Primary red button "Enviar vídeo" on the right of the header.

Toolbar below: a 220px search input placeholder "Buscar por nome do arquivo", a status select
showing "Todos os status", and right-aligned count "12 vídeos" in 13px gray-400.

Then a dense data table inside a white panel with 1px border and 10px radius. Header row in
gray-100, 11px uppercase gray-400 labels. Columns: Arquivo (left, medium weight), Status,
Duração (right, tabular), Frames (right, tabular), Zip (right, tabular), Enviado (left, gray-400),
and a right-aligned action button. Rows are 44px tall with 1px dividers.

Status pills are small capsules with a 6px dot and a 1px border:
"Na fila" gray, "Processando" white with gray-400 border, "Concluído" white with a solid black dot,
"Falhou" in red-500 on red-100.

Row action: small secondary button "Baixar zip" for completed rows, small ghost button "Detalhes"
otherwise.

Show 6 rows with realistic Portuguese filenames like "aula-02-introducao.mp4" and values like
"12:04", "1.284", "48,2 MB", "há 3 minutos". Cover all four statuses.

Everything in Portuguese. Information-dense, no illustrations, no emoji.
```

---

## 5. Tela — Enviar vídeo

Mesma barra lateral, com "Enviar vídeo" ativo.

**Cabeçalho:** título "Enviar vídeo" e subtítulo "Os arquivos entram na fila assim que o envio
termina. Você pode fechar esta página depois disso." À direita, botão secundário "Ver biblioteca".

**Linha de opção:** rótulo "Extrair 1 frame a cada" seguido de um select mostrando "20 segundos".
À direita, "2 envios em andamento" em `gray-400`.

**Área de soltar:** retângulo largo com **borda tracejada 1px** `gray-400`, raio 10px, fundo
branco, 48px de respiro vertical, conteúdo centralizado e **sem ícone**: título "Arraste seus vídeos
para cá" em 15px medium, abaixo "mp4, mov, avi, mkv, webm · até 500 MB por arquivo · vários de uma
vez" em 13px `gray-400`, e um botão primário vermelho "Escolher arquivos".

**Fila de envios**, abaixo, num painel branco. Cada item ocupa duas linhas:

- Linha 1: nome do arquivo à esquerda (13px medium, truncado com reticências); à direita, em 11px
  `gray-400`, o tamanho, o estado e o percentual — por exemplo `24,8 MB · Enviando 67%` — seguido
  de um botão fantasma "Cancelar".
- Linha 2: barra de progresso de 2px de altura ocupando toda a largura, trilho `gray-100` e
  preenchimento **vermelho**.

Mostre quatro itens em estados diferentes: enviando 67%, enviando 23%, concluído a 100% com o link
"Acompanhar" no lugar do "Cancelar", e um com falha — este exibe uma terceira linha com a mensagem
"O arquivo excede o limite de 500 MB." em 11px vermelho.

No cabeçalho da fila: "Envios desta sessão" à esquerda e botão fantasma "Limpar concluídos" à
direita.

### Prompt — Enviar vídeo

```
Design the upload screen of an internal video processing tool, using the design system above.
Same 232px left sidebar as the library screen, with "Enviar vídeo" active.

Header: title "Enviar vídeo" at 22px, subtitle "Os arquivos entram na fila assim que o envio
termina. Você pode fechar esta página depois disso." Secondary button "Ver biblioteca" on the right.

Options row: label "Extrair 1 frame a cada" next to a select showing "20 segundos". Right-aligned
text "2 envios em andamento" in gray-400.

Drop area: a wide rectangle with a 1px DASHED gray-400 border, 10px radius, white background, 48px
of vertical breathing room, centered content and NO icon. Title "Arraste seus vídeos para cá" at
15px medium, below it "mp4, mov, avi, mkv, webm · até 500 MB por arquivo · vários de uma vez" at
13px gray-400, then a primary red button "Escolher arquivos".

Below, an upload queue in a white panel with 1px border. Each item takes two lines: line one has
the truncated filename on the left at 13px medium, and on the right, in 11px gray-400, the size,
state and percentage such as "24,8 MB · Enviando 67%" followed by a small ghost "Cancelar" button.
Line two is a full-width 2px progress bar with a gray-100 track and a RED fill.

Show four items: uploading at 67%, uploading at 23%, one finished at 100% where "Cancelar" is
replaced by an "Acompanhar" link, and one failed showing a third line with the red 11px message
"O arquivo excede o limite de 500 MB."

Queue header: "Envios desta sessão" on the left, ghost button "Limpar concluídos" on the right.

Everything in Portuguese. No icons in the drop zone, no illustrations, no emoji.
```

---

## 6. Tela — Detalhe do vídeo

Mesma barra lateral.

**Cabeçalho:** um link de migalha "Biblioteca" em 13px acima do título; título com o nome do
arquivo em 22px; abaixo, em 13px `gray-600`, "Enviado em 01/09/2026 15:42 · 1 frame a cada 20s". À
direita, o selo de status e, ao lado, o botão primário vermelho "Baixar zip".

**Faixa de erro** (apenas quando o status é Falhou): logo abaixo do cabeçalho, faixa `red-100` com
borda vermelha clara e texto `red-500`: "ffmpeg exited with code 183: Invalid data found when
processing input".

**Grade de métricas:** quatro blocos lado a lado, separados por linhas de 1px, dentro de um único
contêiner com borda e raio 10px. Cada bloco tem um rótulo de 11px maiúsculo `gray-400` e um valor
de 17px com numerais tabulares:

| Duração | Frames | Tamanho do zip | Intervalo |
| ------- | ------ | -------------- | --------- |
| 12:04   | 1.284  | 48,2 MB        | 20s       |

**Linha do tempo:** título de seção "Linha do tempo" em 13px semibold `gray-600`, seguido de uma
lista vertical com uma linha guia de 1px à esquerda. Cada evento é um ponto de 9px sobre a linha,
com rótulo em 13px medium e horário relativo em 11px `gray-400` abaixo. Os pontos são vazados com
borda cinza, exceto o de conclusão (preenchido preto) e o de falha (preenchido vermelho).

Eventos: "Recebido — há 6 minutos", "Processando — há 5 minutos", "Concluído — há 2 minutos".

### Prompt — Detalhe do vídeo

```
Design a video detail screen for an internal video processing tool, using the design system above.
Same 232px left sidebar.

Header: a small "Biblioteca" breadcrumb link at 13px above the title, then the filename
"aula-02-introducao.mp4" at 22px, then "Enviado em 01/09/2026 15:42 · 1 frame a cada 20s" at 13px
gray-600. On the right, a "Concluído" status pill next to a primary red button "Baixar zip".

Metrics strip: four blocks side by side separated by 1px lines, inside one container with a 1px
border and 10px radius. Each block has an 11px uppercase gray-400 label above a 17px value in
tabular numerals: "Duração 12:04", "Frames 1.284", "Tamanho do zip 48,2 MB", "Intervalo 20s".

Below, a section heading "Linha do tempo" at 13px semibold gray-600, followed by a vertical
timeline with a 1px guide line on the left. Each event is a 9px dot on the line, with a 13px medium
label and an 11px gray-400 relative time beneath it. Dots are hollow with a gray border, except the
completion dot which is solid black. Events: "Recebido — há 6 minutos", "Processando — há 5
minutos", "Concluído — há 2 minutos".

Also produce a variant of this screen in the failed state: no download button, and an inline alert
directly under the header on red-100 background with a light red border and red-500 text reading
"ffmpeg exited with code 183: Invalid data found when processing input". In that variant the last
timeline dot is solid red and reads "Falhou".

Everything in Portuguese. Dense, quiet, no illustrations, no emoji.
```

---

## 7. Ordem sugerida no Stitch

1. Cole o prompt do **Design System** e deixe o Stitch fixar tokens e componentes.
2. Gere a **Biblioteca** — é a tela que define a linguagem visual do produto.
3. Gere **Detalhe do vídeo** (peça as duas variantes, concluído e falhou).
4. Gere **Enviar vídeo**.
5. Gere **Entrar** por último; ela é a mais independente.

Se alguma tela sair colorida demais ou com cara de página de marketing, reforce no prompt:

> Reduce to black, white, gray and a single red accent. Red only on the primary button and error
> states. Remove any illustration, icon-heavy area, gradient or marketing copy. Increase density:
> smaller type, tighter rows, more visible 1px borders.
