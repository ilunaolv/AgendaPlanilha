# Agenda do Prefeito — PWA

PWA simples que exibe a aba **Prefeito** da planilha como uma agenda (Dia /
Semana / Mês), com login via Google e sincronização automática dos eventos.

## Como funciona

- Autentica o usuário com **Google OAuth** (conta Google).
- Lê a aba configurada de uma **Planilha Google (Google Sheets)** via Sheets API.
- Mostra os eventos com horário, nota, presença e representante.
- Ordena por **nota (10→0)** e, empatando, por horário.
- Modos **Dia / Semana / Mês**, tema claro/escuro e funciona offline (service worker).
- Ao marcar "Não vou", permite informar quem vai no lugar (grava na coluna F).

## 0. Preparar a planilha (passo obrigatório)

A API do Google Sheets **não lê arquivos `.xlsx` do Drive** diretamente.
Você precisa de uma **Planilha Google** (Aplicativo Web do Drive →
*Abrir com → Planilhas Google* → *Arquivo → Salvar como Planilha do Google*).

Estrutura de colunas esperada:

- **A = Data** (texto por extenso, ex: `19 de jul.`, ou `dd/mm/aaaa`, ou serial)
- **B = Horário**
- **C = Evento**
- **D = Nota** (0–10)
- **E = Presença** (Sim / Não / Reservar)
- **F = Representante** (usado também como substituto quando "Não")

## 1. Criar projeto e credencial no Google Cloud

1. https://console.cloud.google.com → novo projeto.
2. Ative a **Google Sheets API**.
3. **Tela de consentimento OAuth** → Externo → adicione seu e-mail em *Usuários de teste*.
4. **Credenciais → Criar → ID do cliente OAuth** → tipo **Aplicativo Web**.
5. Em **Origens JavaScript autorizadas** adicione:
   - `http://localhost:8080` (teste local)
   - `https://ilunaolv.github.io` (GitHub Pages — inclua também a URL exata da página)
6. Copie o **Client ID**.

## 2. Configurar o app

Edite `app.js` (topo, `CONFIG`):

```js
CLIENT_ID: "SEU_CLIENT_ID.apps.googleusercontent.com",
SPREADSHEET_ID: "ID_DA_PLANILHA",   // trecho da URL entre /d/ e /edit
SHEET_NAME: "Prefeito (Em testes)",
```

Compartilhe a Planilha Google com a conta que vai usar no login.

> **Escopo de escrita:** usa `.../auth/spreadsheets` (leitura e escrita) para
> gravar presença/substituto. Na primeira vez o Google pede permissão — esperado.

## 3. Rodar localmente

```bash
python -m http.server 8080   # ou: npx serve .
```

Abra `http://localhost:8080` → **Entrar com Google**.

## 4. Publicar no GitHub Pages (teste)

O repositório já está em `https://github.com/ilunaolv/AgendaPlanilha`.

1. No repo, **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Branch: **main**, pasta: **/ (root)** → Save.
3. Aguarde o build. URL: **https://ilunaolv.github.io/AgendaPlanilha/**
4. Confirme no Google Cloud que a **Origem JavaScript autorizada** inclui
   `https://ilunaolv.github.io` (e a URL exata acima).
5. Abra no celular (Chrome/Safari) → menu → **Adicionar à tela inicial**.

Arquivos ignorados pelo `.gitignore`: `agenda.xlsx`, `~$agenda.xlsx`, etc.

## Arquivos

- `index.html` — interface
- `app.js` — auth OAuth + Sheets API + lógica da agenda
- `sw.js` — service worker (cache/offline)
- `manifest.webmanifest` — metadados do PWA
- `icon.svg` — ícone
- `.nojekyll` — evita processamento Jekyll no Pages

## Próximos passos

- Filtro por representante / presença.
- Busca por evento.
- Notificações de lembrete.
- Mover `CLIENT_ID`/`SPREADSHEET_ID` para `config.js` (fora do git) antes de tornar público.
