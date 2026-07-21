# Agenda do Prefeito — Prompt e Passo a Passo Completo

Este documento serve para você recriar todo o projeto do zero, exatamente como está agora, com todas as funcionalidades implementadas até aqui.

---

## O que é esse projeto?

É um aplicativo web (PWA) para a agenda do prefeito. Ele lê uma planilha do Google Sheets e mostra os compromissos do dia, permitindo confirmar presença, informar locais e receber notificações.

---

## Funcionalidades implementadas

1. **Login com Google** — acesso seguro usando conta Google
2. **Sincronização com Google Sheets** — lê automaticamente os dados da planilha
3. **Visualização por dia, semana e mês** — navegação entre períodos
4. **Confirmação de presença** — botões "Vou", "Não vou" e "Reservar"
5. **Selecionar representante/acompanhante** — modal com lista de nomes cadastrados + campo “Outro…” (sempre visível no card)
6. **Integração com Google Maps** — modal de local com link para Maps e abertura automática ao salvar
7. **Notificações por evento** — notificação nativa do browser quando faltar 1h para o evento
8. **Notificação de teste** — sino no header para ativar/desativar e testar permissão
9. **Modal de notificação múltipla** — quando há vários avisos próximos, navega entre eles sem loop
10. **Filtro por status** — ver apenas confirmados, não vou ou reservar
11. **Busca por evento** — campo de pesquisa por texto
12. **Indicador de hoje** — destaca o dia atual no botão "Hoje"
13. **Atualização pendente** — avisa dentro do app quando tem nova versão e atualiza sem sair
14. **Bloqueio por permissão** — se não tiver acesso à planilha, não entra
15. **Tema claro/escuro** — alternância de tema
16. **Modo offline** — funciona mesmo sem internet (cache)
17. **Ordenação por horário** — eventos listados em ordem cronológica
18. **Cores de nota** — 1-6 cinza, 7-8 laranja, 9-10 azul
19. **Validação de notificação** — impede notificação de evento já ocorrido

---

## Estrutura do projeto

```
AgendaPlanilha/
├── index.html            # Página principal do app
├── app.js                # Lógica do aplicativo
├── config.js             # Configurações (não commitado)
├── config.example.js     # Exemplo de configuração
├── manifest.webmanifest  # Arquivo PWA
├── sw.js                 # Service Worker (cache offline)
├── icon.svg              # Ícone do app
└── PROMPT_PROJETO.md     # Documento para recriar o projeto
```

---

## Passo a passo para criar do zero

### Passo 1: Criar o projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto
3. Vá em "APIs e Serviços" > "Credenciais"
4. Crie uma credencial OAuth 2.0 (tipo Aplicativo Web)
5. Adicione as URIs de redirecionamento:
   - `https://ilunaolv.github.io/AgendaPlanilha/`
   - `http://localhost:5500` (para testes locais)
6. Anote o **Client ID**
7. Vá em "APIs e Serviços" > "Biblioteca"
8. Ative as APIs:
   - Google Sheets API
   - Google Identity and Access Management (IAM) API (se necessário)

### Passo 2: Criar a planilha no Google Sheets

1. Crie uma planilha no Google Sheets
2. Compartilhe com as contas que terão acesso
3. Estruture assim:
   - **Linha 1 (cabeçalho):** Data | Horário | Evento | Nota | Presença | Quem vai no lugar | Local
   - **Colunas:**
     - A: Data (formato DD/MM/AAAA ou Excel serial)
     - B: Horário (ex: 08:00, 09:30)
     - C: Evento (título do compromisso)
     - D: Nota (número de 1 a 10)
     - E: Presença (Sim / Não / Reservar)
     - F: Quem vai no lugar (nomes separados por vírgula)
     - G: Local (endereço)
4. Anote o **ID da planilha** (na URL: `docs.google.com/spreadsheets/d/`**`ESTE_ID`**`/edit`)

### Passo 3: Configurar o GitHub Pages

1. Crie um repositório no GitHub (ex: `AgendaPlanilha`)
2. Vá em Settings > Pages
3. Em "Source", selecione a branch `main`
4. O site ficará disponível em: `https://ilunaolv.github.io/AgendaPlanilha/`

### Passo 4: Criar o arquivo config.js

Na raiz do projeto, crie `config.js`:

```javascript
window.AGENDACONFIG = {
  CLIENT_ID: "SEU_CLIENT_ID_AQUI.googleusercontent.com",
  SPREADSHEET_ID: "ID_DA_SUA_PLANILHA_AQUI",
  SHEET_NAME: "Nome da Aba",
  SCOPES: "https://www.googleapis.com/auth/spreadsheets",
  REFRESH_MIN: 5,
  NOTIF_ADVANCE_MIN: 60,
  PEOPLE: ["João", "Maria", "Pedro"]
};
```

### Passo 5: Criar o arquivo index.html

Crie o arquivo HTML com a estrutura básica, header, estilos CSS e containers para login, app e loading.

### Passo 6: Criar o arquivo app.js

Implemente toda a lógica:
- Gerenciamento de autenticação com Google OAuth
- Leitura e escrita na planilha via Google Sheets API v4
- Renderização dos eventos em cards
- Modais para local e participantes
- Notificações com Notification API
- Filtros e busca
- Tema claro/escuro
- Navegação dia/semana/mês
- Botão de atualização pendente com reload automático
- Validação de eventos já ocorridos

### Passo 7: Criar os arquivos PWA

- `manifest.webmanifest` — configurações do app instalável
- `sw.js` — service worker para cache offline e atualização

### Passo 8: Testar localmente

1. Instale a extensão "Live Server" no VS Code
2. Clique com botão direito no `index.html` > "Open with Live Server"
3. Teste login, sincronização, filtros, notificações

### Passo 9: Deploy

1. Commit e push para o GitHub
2. O GitHub Pages publica automaticamente
3. Teste no celular: `https://ilunaolv.github.io/AgendaPlanilha/`

---

## Prompt para recriar do zero

Use este prompt para reconstruir o projeto completo:

```
Crie um PWA chamado "Agenda do Prefeito" com as seguintes especificações:

1. AUTHENTICATION:
   - Login com Google OAuth 2.0
   - Token salvo em localStorage com expiração
   - Logout funcional
   - Bloqueio de acesso se não tiver permissão na planilha (erro 403/401)
   - Restrição de aba: app bloqueia se SHEET_NAME for diferente de "Prefeito"

2. GOOGLE SHEETS INTEGRATION:
   - Ler dados da planilha usando Google Sheets API v4
   - Colunas: Data | Horário | Evento | Nota | Presença | Quem vai no lugar | Local
   - Suportar data em formato Excel serial (ex: 45934) ou texto (DD/MM/AAAA)
   - Salvar alterações (presença, participantes, local) de volta na planilha
   - Retry automático em caso de erro de rede
   - Cache de autenticação para reduzir chamadas ao Google
   - Cache de eventos em localStorage (TTL de 2 minutos)
   - Cache de permissão negada (TTL de 10 minutos) para evitar requisições repetidas

3. UI/UX:
   - Tema escuro/claro com alternância
   - Layout mobile-first responsivo
   - Três modos de visualização: Dia, Semana, Mês
   - Navegação entre datas com botões ‹ › e botão Hoje
   - Indicador visual no botão Hoje quando for o dia atual
   - Filtro por status: Todos, Confirmados, Não vou, Reservar
   - Busca por texto no nome do evento, local ou participantes
   - Ordenação dos eventos por horário (cronológica)

4. EVENT CARDS:
   - Mostrar horário, título, nota, local, participantes
   - Badges coloridos por status (verde=Sim, vermelho=Não, amarelo=Reservar)
   - Botões de ação: Vou, Não vou, Reservar
   - Botão "Selecionar representante/acompanhante" sempre visível, abre modal com:
     - Lista de pessoas pré-cadastradas (PEOPLE)
     - Campo "Outro..." para digitar nome customizado
   - Botão de local: se vazio, abre modal para informar endereço; se preenchido, abre link Google Maps

5. NOTIFICAÇÕES:
   - Sino no header para ativar/desativar notificações nativas
   - Ao ativar, solicita permissão Notification e já verifica eventos próximos
   - Agendamento automático: checa eventos dentro do intervalo NOTIF_ADVANCE_MIN
   - Notificação nativa do sistema faltando NOTIF_ADVANCE_MIN para o evento
   - Modal automático para eventos com representantes (Não/Reservar)
   - Modal automático também para eventos sem representantes, se notificações ativadas
   - Modal múltiplo: se houver vários avisos, permite navegar entre eles
   - Sem loop: trava de navegação, botão "Próximo aviso (N restantes)" e no último mostra "Fechar"
   - Validação: não permite notificação para eventos já ocorridos
   - Persistência da preferência em localStorage (notifEnabled)
   - Dentro do modal: mostra nome do evento, data, horário, local, lista de representantes
   - Botão "Fechar" apenas no último aviso; clique fora fecha também

6. GOOGLE MAPS:
   - Modal para informar local do evento
   - Link "Abrir no Google Maps" quando já houver endereço
   - Abre o Maps automaticamente ao salvar local

7. OFFLINE/CACHE:
   - Service Worker para cache com nome de versão
   - Cache de autenticação para reduzir chamadas ao Google
   - Cache de eventos em localStorage (TTL de 2 minutos)
   - Cache de permissão negada (TTL de 10 minutos) para evitar requisições repetidas
   - Botão "Atualização pendente" se versão do app mudou
   - Funciona offline com dados em cache
   - Limpeza automática de cache ao fazer logout ou salvar evento
   - Botão de atualização pendente: força update do SW e recarrega a página

8. CONFIGURAÇÕES:
   - Arquivo config.js separado com:
     - CLIENT_ID (Google OAuth)
     - SPREADSHEET_ID (ID da planilha)
     - SHEET_NAME (nome da aba, deve ser exatamente "Prefeito")
     - SCOPES (escopo da API)
     - REFRESH_MIN (intervalo de atualização)
     - NOTIF_ADVANCE_MIN (minutos de antecedência da notificação)
     - PEOPLE (lista de pessoas para o picker)
   - Arquivo config.example.js como template
   - Restrição de acesso: app bloqueia se SHEET_NAME for diferente de "Prefeito"

9. TECNOLOGIAS:
   - HTML/CSS/JS puro (sem frameworks)
   - PWA com manifest e service worker
   - Compatível com iOS/Safari
   - GitHub Pages para deploy

10. BRANCHES SUGERIDAS:
    - main: versão estável
    - melhorias: funcionalidades novas
    - modelo-inicial: cópia limpa da main

11. VALIDAÇÕES:
    - Não notificar eventos passados
    - Impedir clique duplicado na navegação do modal de notificação
    - Garantir que modal de múltiplos avisos sempre fecha no último item
    - Garantir que botão "Atualização pendente" aparece quando APP_BUILD mudar e só some após clique/atualização

Crie todos os arquivos necessários, com código limpo, comentado e pronto para uso.
```

---

## Explicação detalhada para pessoa leiga

### O que é um PWA?
É um site que se comporta como um aplicativo instalado no celular. Você acessa pelo navegador, mas pode "adicionar à tela inicial" e funciona mesmo offline.

### O que é o Google OAuth?
É o sistema de login do Google. O usuário clica em "Entrar com Google", autoriza o app, e conseguimos acessar a planilha em nome dele.

### O que é a Google Sheets API?
É a forma de o app conversar com a planilha do Google. O app lê os dados, mostra na tela, e quando você altera algo, ele salva de volta na planilha.

### Como funciona a sincronização?
O app busca os dados da planilha de 5 em 5 minutos (configurável). Quando você altera algo, ele salva imediatamente e recarrega para mostrar atualizado.

### O que é o Service Worker?
É um arquivo que roda em segundo plano no navegador. Ele guarda os dados do app no celular para funcionar mesmo sem internet.

### Como funciona o cache do app?
O app usa 3 tipos de cache para melhorar performance:

1. **Cache de autenticação:** salva o token do Google para não precisar logar toda hora
2. **Cache de eventos:** guarda os eventos por 2 minutos para não ficar consultando o Google Sheets toda vez
3. **Cache de permissão negada:** se o usuário não tiver acesso à planilha, cacheia essa informação por 10 minutos para não ficar consultando o Google repetidamente

Quando você faz logout ou salva uma alteração, o cache é limpo automaticamente.

### Como funciona a restrição de aba?
O app verifica se a configuração `SHEET_NAME` é exatamente "Prefeito". Se for diferente, o app bloqueia o acesso e exibe uma mensagem de erro. Isso garante que apenas a aba correta seja acessada.

### Como funcionam as notificações?
O app usa a **Notification API nativa do navegador** (padrão Google):
- Quando você ativa o sino no header, o app solicita permissão e já verifica eventos próximos
- Quando faltar 1h para o evento, o navegador exibe uma notificação nativa do sistema
- No Android: aparece na barra de notificações como qualquer app
- No iPhone: aparece como notificação do sistema (iOS 16.4+)
- A notificação mostra: horário e título do evento
- Se houver vários eventos próximos, abre modal para revisar um por um

### Como funciona a atualização pendente?
O app compara a versão interna com a versão salva no navegador:
- Se for diferente, mostra o botão "Atualização pendente" dentro do app
- Ao clicar, ele atualiza o Service Worker e recarrega a página automaticamente
- Não precisa mais sair do app para ver melhorias

### Por que 3 branches?
- **main**: sempre tem a versão que está funcionando, pronta para usar
- **melhorias**: onde testamos coisas novas antes de aprovar
- **modelo-inicial**: uma cópia de segurança da versão inicial

### Como testar localmente?
1. Abra o projeto no VS Code
2. Instale a extensão "Live Server"
3. Clique direito no `index.html` > "Open with Live Server"
4. O app abre no navegador em `http://localhost:5500`

### Como publicar?
1. Crie um repositório no GitHub
2. Suba os arquivos com Git
3. Vá em Settings > Pages > selecione a branch main
4. O GitHub publica automaticamente em alguns minutos

---

## Comandos Git úteis

```bash
# Ver status
git status

# Adicionar arquivos
git add .

# Commit
git commit -m "mensagem"

# Push
git push origin main

# Criar branch
git checkout -b nome-da-branch

# Mudar de branch
git checkout main
git checkout melhorias

# Ver branches
git branch

# Deletar branch
git branch -d nome-da-branch
```

---

## Checklist de configuração

- [ ] Projeto criado no Google Cloud
- [ ] OAuth 2.0 configurado com as URLs corretas
- [ ] Google Sheets API ativada
- [ ] Planilha criada e compartilhada
- [ ] ID da planilha copiado
- [ ] Client ID copiado
- [ ] config.js criado com as credenciais
- [ ] Repositório GitHub criado
- [ ] GitHub Pages configurado
- [ ] Testado no celular
- [ ] Notificações testadas

---

## Problemas comuns

### Não consigo fazer login
- Verifique se o Client ID está correto no config.js
- Verifique se a URL está nas "Origens JS" do Google Cloud
- Verifique se a Google Sheets API está ativada

### Planilha não carrega
- Verifique se o ID da planilha está correto
- Verifique se a conta está compartilhada na planilha
- Verifique se o nome da aba está correto

### Notificações não funcionam no iPhone
- O iOS exige interação do usuário primeiro (toque no sino)
- Toque no sino e autorize
- Feche e reabra o app
- No iOS 16.4+, notificações funcionam se o app estiver instalado na tela inicial
- No Android, funciona normalmente em segundo plano

### Notificações não aparecem na tela do celular
- Verifique se o app tem permissão de notificação (Configurações > Apps > Navegador > Notificações)
- No Android, certifique-se que o app está adicionado à tela inicial (instalado como PWA)
- Notificações só aparecem se o evento estiver a menos de 1h

### Modal de notificação com vários avisos entra em loop
- O app agora trava a navegação entre avisos
- No último aviso aparece "Fechar"
- O contador de restantes nunca fica negativo

### App não atualiza
- Clique no botão "Atualização pendente" no próprio app
- Ele atualiza automaticamente sem precisar sair

### Atualização pendente não aparece
- Verifique se a versão no código mudou
- O app detecta automaticamente quando há atualização

---

## Contato e suporte

Para dúvidas sobre o Google Cloud: https://cloud.google.com/docs
Para dúvidas sobre GitHub Pages: https://docs.github.com/pt/pages
