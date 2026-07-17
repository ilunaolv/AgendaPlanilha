# Agenda do Prefeito — PWA

PWA simples que exibe a aba **Prefeito** da planilha como uma agenda diária,
com login via Google e sincronização automática dos eventos.

## Como funciona

- O app autentica o usuário com **Google OAuth** (conta Google).
- Lê a aba configurada de uma **Planilha Google (Google Sheets)** via
  Google Sheets API (somente leitura).
- Mostra os eventos do dia selecionado (navegação ‹ Hoje ›), com horário,
  notas, presença e representante.
- Atualiza sozinho a cada 15 min e ao reabrir o app. Funciona offline
  (service worker) com o último cache.
- Pode ser instalado no celular/computador (ícone na tela inicial).

## 0. Preparar a planilha (passo obrigatório)

A API do Google Sheets **não lê arquivos `.xlsx` do Drive** diretamente.
Você precisa de uma **Planilha Google**. Opções:

**Opção A — converter (recomendado, mantém tudo no Drive):**
1. No Google Drive, clique em **Novo → Mais → Google Planilhas** (ou abra o
   `agenda.xlsx` e em *Abrir com → Planilhas Google*; depois *Arquivo → Salvar
   como Planilha do Google*).
2. Certifique-se de que a aba se chama exatamente `Prefeito (Em testes)`
   (ou mude `SHEET_NAME` em `app.js`).
3. A estrutura esperada das colunas é: **A=Data** (serial do Excel),
   **B=Horário**, **C=Evento**, **D=Nota**, **E=Presença**, **F=Representante**.
   O app **escreve** na planilha, então adicione duas colunas (o cabeçalho é
   opcional, o app só usa a posição):
   - **G = Substituto** (quem vai no lugar quando Presença = "Não")
   - **H = Histórico** (registro automático de quem editou e quando)
   Certifique-se de que não há colunas mescladas ocupando G/H.

**Pegar o ID da planilha:** abra a Planilha Google. A URL é
`https://docs.google.com/spreadsheets/d/ID_AQUI/edit`. Copie o `ID_AQUI`.

## 1. Criar o projeto e as credenciais no Google Cloud

1. Acesse https://console.cloud.google.com/ e crie um projeto.
2. **Ative a API:** Menu → *APIs e serviços → Biblioteca* → procure
   "Google Sheets API" → **Ativar**.
3. **Crie a tela de consentimento OAuth:** *APIs e serviços → Tela de
   consentimento OAuth* → tipo Externo → preencha nome/email → salve.
   (Para uso próprio, adicione seu e-mail como "Usuário de teste".)
4. **Crie a credencial:** *APIs e serviços → Credenciais → Criar credencial →
   ID do cliente OAuth* → tipo **Aplicativo Web**.
5. Em **Origens JavaScript autorizadas** adicione a URL onde o app vai rodar,
   por exemplo:
   - `http://localhost:8080`
   - `https://SEU-SITE.github.io` (se publicar)
6. Copie o **Client ID** gerado.

## 2. Configurar o app

Edite `app.js` e preencha:

```js
const CONFIG = {
  CLIENT_ID: "SEU_CLIENT_ID.apps.googleusercontent.com",
  SPREADSHEET_ID: "ID_DA_PLANILHA",
  SHEET_NAME: "Prefeito (Em testes)",
  ...
};
```

Compartilhe a Planilha Google com a conta que vai usar no login (ou deixe
"Qualquer pessoa com o link pode visualizar").

> **Escopo de escrita:** o `app.js` usa o escopo
> `https://www.googleapis.com/auth/spreadsheets` (leitura **e** escrita) para
> gravar presença, substituto e histórico. Na primeira vez, o Google pedirá
> permissão de edição — é esperado.

## 3. Rodar localmente

O PWA precisa ser servido por HTTP (não `file://`). Exemplo:

```bash
# Python
python -m http.server 8080
# ou Node
npx serve .
```

Abra `http://localhost:8080`, clique em **Entrar com Google**, permita o acesso.

## 4. Publicar / Instalar

- Para instalar no celular: sirva por HTTPS (GitHub Pages, Netlify, Vercel…),
  abra no Chrome/Safari, menu → "Adicionar à tela inicial".
- O manifest e o service worker já estão prontos (`manifest.webmanifest`, `sw.js`).

## Arquivos

- `index.html` — interface
- `app.js` — auth OAuth + Sheets API + lógica da agenda
- `sw.js` — service worker (cache/offline)
- `manifest.webmanifest` — metadados do PWA
- `icon.svg` — ícone

## Próximos passos possíveis

- Adicionar filtro por representante / presença.
- Modo "semana" ou "mês".
- Notificações de lembrete antes de cada evento.
