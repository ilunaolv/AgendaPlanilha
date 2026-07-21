# Análise da Proposta — Agenda do Prefeito

**Data:** 21/07/2026  
**Versão:** 1.0  
**Status:** Aprovado para implementação

---

## 1. Contextualização

Solicitado pela Secretária e Subsecretário a verificação de proposta de aplicação para visualização dos eventos criados para o Prefeito. A Proposta para visualização dos eventos é criar um PWA com integração com o Google Sheets, Google API e Google Auth, desta forma os eventos seguem sendo adicionados pela planilha, porém a visualização para o Prefeito e as modificações serão feitas direto no aplicativo.

---

## 2. Critérios do Sistema

### ✅ Funcionalidades Implementadas

| Item | Status | Descrição |
|------|--------|-----------|
| Autenticação | ✅ | Login com conta Google (OAuth 2.0) |
| Visualização dia/semana/mês | ✅ | Três modos de visualização com navegação |
| Filtro por status | ✅ | Todos, Confirmados, Não vou, Reservar |
| Ordenação por hora | ✅ | Eventos em ordem cronológica |
| Campo de busca | ✅ | Busca por evento, local ou representante |
| Campo de endereço | ✅ | Integração com Google Maps |
| Notificações automáticas | ✅ | Por nota 9/10 e confirmação de presença |
| Modal de representantes | ✅ | Exibe lista quando "Não vou"/"Reservar" |
| Atualização pendente | ✅ | Avisa nova versão disponível |
| Modo offline | ✅ | Funciona sem internet via cache |
| Tema claro/escuro | ✅ | Alternância de tema |
| Renovação silenciosa | ✅ | Sessão de até 24h sem novo login |

---

## 3. Regras de Notificação

1. **Automática por nota:** Eventos com nota 9 ou 10 ativam notificação automaticamente
2. **Automática por presença:** Ao confirmar "Vou", notificação ativa automaticamente
3. **Modal de representantes:** Ao marcar "Não vou" ou "Reservar" com representantes, exibe modal com lista dos representantes para ciência
4. **Confirmação de leitura:** Modal com botão "Fechar" para garantir que a pessoa viu
5. **Antecedência configurável:** Padrão de 1h antes (ajustável via config)
6. **Validação de horário:** Não permite notificação para eventos já ocorridos ou em andamento
7. **Mensagem dinâmica:** Informa minutos restantes se estiver dentro do período de antecedência

---

## 4. Autenticação e Sessão

- Acesso liberado via Google Auth Platform e compartilhamento do Google Sheets
- Token renovado automaticamente a cada 1h sem necessidade de novo login
- Sessão válida por até 24h
- Se a renovação falhar, nova autenticação será necessária
- Timeout de 15s para carregamento de scripts do Google
- Tratamento de erro com retorno automático para tela de login

---

## 5. Sincronização

- Sincronização automática a cada 5 minutos (configurável via `REFRESH_MIN`)
- Botão de refresh (↻) para atualização manual imediata
- Sincronização ao voltar do background (app minimizado)
- Indicador de última sincronização e quantidade de dias carregados
- Retry automático em caso de erro de rede (2 tentativas)

---

## 6. Atualizações

- Ao subir nova versão, o app exibe "⚠️ Atualização pendente" acima da listagem
- Evita uso em ambiente desatualizado
- Usuário pode clicar para atualizar imediatamente

---

## 6.1. Cache e Performance

### Cache de Autenticação
- Token OAuth salvo em localStorage com renovação silenciosa
- Reduz chamadas desnecessárias ao Google Identity
- Sessão válida por até 24h sem novo login

### Cache de Eventos
- Eventos armazenados em localStorage com TTL de 2 minutos
- Reduz requisições ao Google Sheets API
- Melhora performance em aberturas subsequentes
- Limpeza automática ao fazer logout ou salvar alterações

### Cache de Permissão Negada
- Usuários sem acesso à planilha têm permissão negada cacheada por 10 minutos
- Evita requisições repetidas ao Google que resultariam em 403
- Melhora experiência ao mostrar erro imediato sem espera

### Restrição de Acesso
- App valida se SHEET_NAME é exatamente "Prefeito"
- Bloqueia execução se configurado para outra aba
- Garante que apenas a aba correta seja acessada

---

## 7. Prós e Contras da Solução Atual

### ✅ Prós

| Vantagem | Descrição |
|----------|-----------|
| **Rápida implementação** | Pronto para usar, sem necessidade de infraestrutura |
| **Baixo custo** | Apenas Google Cloud gratuito + GitHub Pages |
| **Fácil manutenção** | Código simples em JS puro, sem frameworks |
| **Acesso multiplataforma** | Funciona em qualquer navegador (celular/desktop) |
| **Offline** | Service Worker permite uso sem internet |
| **Escalável** | Google Sheets aguenta milhares de linhas |
| **Segurança** | Autenticação via Google, sem senhas locais |
| **Notificações nativas** | Usa API padrão do navegador/sistema |
| **Versionamento** | Git para controle de alterações |
| **Deploy automático** | GitHub Pages publica automaticamente |

### ❌ Contras

| Desvantagem | Descrição |
|-------------|-----------|
| **Frontend exposto** | Código visível no navegador (sem backend) |
| **Token no cliente** | access_token armazenado no localStorage |
| **Rate limit por usuário** | Cada usuário tem limite próprio de requisições |
| **Sem logs de auditoria** | Não registra quem alterou o quê |
| **Validação limitada** | Dados validados apenas no frontend |
| **Dependência do Google** | Se Google Sheets cair, app para de funcionar |
| **Sem controle de acesso granular** | Qualquer um com acesso à planilha pode ver |
| **Performance com muitos dados** | Lê toda a planilha de uma vez |
| **Limite de notificações** | Notification API tem restrições no iOS/Android |
| **Sem PWA nativo real** | Funciona como site, não como app instalado |

---

## 8. Proposta Futura — Aplicação Interna

### Visão Geral

Migrar o PWA atual para uma aplicação web interna completa com backend .NET 10 e frontend com Sass/SCSS.

### Arquitetura Proposta

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (Sass/SCSS)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Layout    │  │ Components  │  │   Pages     │ │
│  │  _header    │  │  _card      │  │  _agenda    │ │
│  │  _footer    │  │  _modal     │  │  _login     │ │
│  │  _nav       │  │  _button    │  │  _filters   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                   │
│  Stack: HTML5 + Sass + JavaScript (ou TypeScript) │
│  Build: Webpack/Vite + Sass loader                │
└───────────────────────┬───────────────────────────┘
                        │ HTTPS/REST API
┌───────────────────────▼───────────────────────────┐
│              Backend (.NET 10 / C#)                │
│  ┌─────────────────────────────────────────────┐  │
│  │              API Layer                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ Auth     │  │ Events   │  │ Sync     │  │  │
│  │  │ Ctrl     │  │ Ctrl     │  │ Service  │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │           Business Logic Layer (BLL)         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ Event    │  │ User     │  │ Notif    │  │  │
│  │  │ Service  │  │ Service  │  │ Service  │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │         Data Access Layer (DAL)              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ Sheets   │  │ Cache    │  │ Logs     │  │  │
│  │  │ Repo     │  │ Redis    │  │ DB       │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────┬───────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐
   │Google   │   │  Redis   │   │ SQL      │
   │Sheets   │   │  Cache   │   │ Server   │
   │API      │   │          │   │ (Logs)   │
   └─────────┘   └──────────┘   └──────────┘
```

### Tecnologias Propostas

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | HTML5 + Sass/SCSS | Melhor organização de estilos, variáveis, mixins |
| **Backend** | .NET 10 (C#) | Performance, tipagem forte, ecossistema maduro |
| **BLL** | C# Classes/Interfaces | Regras de negócio centralizadas e testáveis |
| **API** | REST/JSON | Padrão aberto, fácil integração |
| **Cache** | Redis | Performance, sessões, dados temporários |
| **Logs** | SQL Server / PostgreSQL | Auditoria, rastreabilidade |
| **Auth** | Google OAuth + JWT | Token JWT para sessão interna |
| **Deploy** | IIS / Docker | Hospedagem interna |

### Funcionalidades Adicionais com Backend

| Funcionalidade | Descrição |
|----------------|-----------|
| **Log de auditoria** | Registra todas as alterações (quem, quando, o quê) |
| **Controle de acesso** | Perfis: Admin, Editor, Leitor |
| **Validação server-side** | Dados validados antes de salvar na planilha |
| **Cache inteligente** | Dados em cache para não sobrecarregar Google Sheets |
| **Push notifications** | Notificações via Firebase/APNS (app fechado) |
| **Histórico de presença** | Relatórios de comparecimento |
| **Exportação** | PDF, Excel, iCal dos eventos |
| **Dashboard** | Estatísticas de presença, eventos mais frequentes |
| **API própria** | Integração com outros sistemas internos |
| **Backup automático** | Backup da planilha em banco interno |

### Migração do Frontend

**Estrutura de pastas sugerida:**

```
AgendaPrefeito/
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   │   ├── scss/
│   │   │   │   ├── _variables.scss
│   │   │   │   ├── _mixins.scss
│   │   │   │   ├── _header.scss
│   │   │   │   ├── _card.scss
│   │   │   │   ├── _modal.scss
│   │   │   │   └── main.scss
│   │   │   └── images/
│   │   ├── components/
│   │   │   ├── Header.js
│   │   │   ├── EventCard.js
│   │   │   ├── Modal.js
│   │   │   └── FilterBar.js
│   │   ├── pages/
│   │   │   ├── Agenda.js
│   │   │   ├── Login.js
│   │   │   └── Settings.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── auth.js
│   │   │   └── notifications.js
│   │   ├── utils/
│   │   │   ├── dates.js
│   │   │   └── storage.js
│   │   ├── app.js
│   │   └── index.html
│   ├── package.json
│   ├── webpack.config.js
│   └── sass-loader.config.js
│
└── backend/
    ├── src/
    │   ├── AgendaPrefeito.API/
    │   │   ├── Controllers/
    │   │   │   ├── AuthController.cs
    │   │   │   ├── EventsController.cs
    │   │   │   ├── SyncController.cs
    │   │   │   └── NotificationsController.cs
    │   │   ├── Program.cs
    │   │   ├── appsettings.json
    │   │   └── Startup.cs
    │   ├── AgendaPrefeito.BLL/
    │   │   ├── Services/
    │   │   │   ├── EventService.cs
    │   │   │   ├── UserService.cs
    │   │   │   ├── NotificationService.cs
    │   │   │   └── SyncService.cs
    │   │   ├── Interfaces/
    │   │   │   ├── IEventService.cs
    │   │   │   ├── IUserService.cs
    │   │   │   └── ISyncService.cs
    │   │   └── Models/
    │   │       ├── Event.cs
    │   │       ├── User.cs
    │   │       └── Notification.cs
    │   ├── AgendaPrefeito.DAL/
    │   │   ├── Repositories/
    │   │   │   ├── EventRepository.cs
    │   │   │   ├── LogRepository.cs
    │   │   │   └── CacheRepository.cs
    │   │   ├── Contexts/
    │   │   │   └── AppDbContext.cs
    │   │   └── Entities/
    │   │       ├── EventEntity.cs
    │   │       ├── LogEntity.cs
    │   │       └── UserEntity.cs
    │   └── AgendaPrefeito.Tests/
    │       ├── BLL.Tests/
    │       └── API.Tests/
    ├── Dockerfile
    └── docker-compose.yml
```

### Integração com APLI (BLL .NET 10)

**O que é a APLI:**
- APLI = Aplicação Interna da prefeitura
- BLL = Business Logic Layer (camada de regras de negócio)
- .NET 10 = versão mais recente do framework

**Como seria a integração:**

```csharp
// Exemplo de classe BLL para eventos
namespace AgendaPrefeito.BLL.Services
{
    public class EventService : IEventService
    {
        private readonly IEventRepository _repo;
        private readonly INotificationService _notif;
        
        public async Task<Event> CreateAsync(EventDto dto)
        {
            // Validação de regras de negócio
            if (dto.Note >= 9)
            {
                dto.NotificationEnabled = true;
            }
            
            // Salvar no repositório
            var ev = await _repo.CreateAsync(dto);
            
            // Log de auditoria
            await _logService.LogAsync("CREATE", ev.Id, dto.UserId);
            
            // Notificar se necessário
            if (dto.NotificationEnabled)
            {
                await _notif.ScheduleAsync(ev);
            }
            
            return ev;
        }
        
        public async Task<List<Event>> GetByDateAsync(DateTime date)
        {
            // Regra: só eventos futuros ou de hoje
            var events = await _repo.GetByDateAsync(date);
            return events.OrderBy(e => e.Time).ToList();
        }
    }
}
```

**Vantagens da integração com APLI:**

| Vantagem | Descrição |
|----------|-----------|
| **Reaproveitamento** | Usa mesma autenticação/usuários do sistema interno |
| **Segurança** | Token JWT com roles e permissões |
| **Auditoria** | Logs centralizados no banco interno |
| **Performance** | Cache Redis, sem sobrecarga no Google Sheets |
| **Escalabilidade** | Suporta milhares de usuários |
| **Integração** | API única para todos os sistemas |
| **Manutenibilidade** | Código organizado em camadas |

---

## 9. Roadmap de Implementação

### Fase 1 — Atual (Concluída)
- [x] PWA com Google Sheets
- [x] Autenticação Google
- [x] Notificações básicas
- [x] Filtros e busca
- [x] Integração Maps

### Fase 2 — Curto prazo (1-2 meses)
- [ ] Migração para Sass/SCSS
- [ ] Refatoração do frontend (componentização)
- [ ] Testes automatizados (Jest/Cypress)

### Fase 3 — Médio prazo (3-6 meses)
- [ ] Backend .NET 10
- [ ] API REST
- [ ] BLL com regras de negócio
- [ ] Autenticação JWT + Google
- [ ] Cache Redis
- [ ] Logs de auditoria

### Fase 4 — Longo prazo (6-12 meses)
- [ ] Integração com APLI
- [ ] Dashboard administrativo
- [ ] Relatórios e exportação
- [ ] Push notifications via Firebase
- [ ] App nativo (opcional)

---

## 10. Recomendações

### Imediatas
1. **Manter solução atual** enquanto a Phase 2 não começa
2. **Documentar processos** da planilha (quem altera, quem confere)
3. **Padronizar dados** na planilha (formato de data, horário, endereço)

### Futuras
1. **Iniciar Phase 2** (Sass) em paralelo, pois não interfere no funcionamento
2. **Planejar backend** junto com equipe de TI da prefeitura
3. **Definir escopo da APLI** antes de iniciar integração
4. **Fazer POC** da integração com .NET 10 antes de migrar tudo

---

**Documento elaborado em:** 21/07/2026  
**Responsável:** Equipe de Desenvolvimento  
**Aprovação:** Secretária e Subsecretário

---

## 11. Prompt para Recriar o Projeto do Zero (Estado Atual)

Use este prompt para reconstruir o projeto exatamente como está hoje:

```
Crie um PWA chamado "Agenda do Prefeito" com as seguintes especificações:

1. AUTHENTICATION:
   - Login com Google OAuth 2.0
   - Token salvo em localStorage com expiração
   - Logout funcional
   - Renovação silenciosa de token (sessão de até 24h)
   - Bloqueio de acesso se não tiver permissão na planilha (erro 403/401)

2. GOOGLE SHEETS INTEGRATION:
   - Ler dados da planilha usando Google Sheets API v4
   - Colunas: Data | Horário | Evento | Nota | Presença | Quem vai no lugar | Local
   - Suportar data em formato Excel serial (ex: 45934) ou texto (DD/MM/AAAA)
   - Salvar alterações (presença, participantes, local) de volta na planilha
   - Retry automático em caso de erro de rede (2 tentativas)
   - Timeout de 15s para requisições

3. UI/UX:
   - Tema escuro/claro com alternância
   - Layout mobile-first responsivo
   - Três modos de visualização: Dia, Semana, Mês
   - Navegação entre datas com botões ‹ › e botão Hoje
   - Indicador visual no botão "Hoje" quando for o dia atual
   - Filtro por status: Todos, Confirmados, Não vou, Reservar
   - Busca por texto no nome do evento, local ou representante
   - Ordenação dos eventos por horário (cronológica)
   - Cores de nota: 1-6 cinza, 7-8 laranja, 9-10 azul

4. EVENT CARDS:
   - Mostrar horário, título, nota, local, representantes
   - Badges coloridos por status (verde=Sim, vermelho=Não, amarelo=Reservar)
   - Botões de ação: Vou, Não vou, Reservar
   - Botão "Selecionar representante/acompanhante" (sempre visível)
   - Ícone de notificação 🔕/🔔 por evento
   - Botão de local com link para Google Maps

5. NOTIFICAÇÕES:
   - Notificação por evento (ícone no card)
   - Ativação automática se nota 9 ou 10
   - Ativação automática ao confirmar "Vou"
   - Ao marcar "Não vou" ou "Reservar" com representantes, exibir modal com:
     - Nome do evento
     - Data, horário e local
     - Lista de representantes que irão comparecer
     - Botão "Fechar" para confirmação de leitura
   - Notificação nativa do sistema 1h antes do evento
   - Botão de teste de notificação no header
   - Padrão Google: usa Notification API nativa do navegador
   - Validação: não permite notificação para eventos já ocorridos
   - Mensagem dinâmica: informa minutos restantes se estiver dentro de 1h
   - Persistência da preferência em localStorage

6. GOOGLE MAPS:
   - Modal para informar local do evento
   - Link "Abrir no Google Maps" quando já houver endereço
   - Abre o Maps automaticamente ao salvar local

7. OFFLINE/CACHE:
   - Service Worker para cache
   - Botão "Atualização pendente" se cache desatualizado
   - Funciona offline com dados em cache

8. CONFIGURAÇÕES:
   - Arquivo config.js separado com:
     - CLIENT_ID (Google OAuth)
     - SPREADSHEET_ID (ID da planilha)
     - SHEET_NAME (nome da aba)
     - SCOPES (escopo da API)
     - REFRESH_MIN (intervalo de atualização)
     - PEOPLE (lista de pessoas para o picker)
     - NOTIF_ADVANCE_MIN (minutos de antecedência da notificação)
   - Arquivo config.example.js como template

9. TECNOLOGIAS:
   - HTML/CSS/JS puro (sem frameworks)
   - PWA com manifest e service worker
   - Compatível com iOS/Safari
   - GitHub Pages para deploy

10. BRANCHES SUGERIDAS:
    - main: versão estável
    - melhorias: funcionalidades novas
    - modelo-inicial: cópia limpa da main

Crie todos os arquivos necessários, com código limpo, comentado e pronto para uso.
```

---

## 12. Estrutura do Projeto

```
AgendaPlanilha/
├── index.html               # Página principal do app
├── app.js                   # Lógica do aplicativo
├── config.js                # Configurações (não commitado)
├── config.example.js        # Exemplo de configuração
├── manifest.webmanifest     # Arquivo PWA
├── sw.js                    # Service Worker (cache offline)
├── icon.svg                 # Ícone do app
├── PROMPT_PROJETO.md        # Documentação do projeto
├── ANALISE_PROPOSTA.md      # Este documento
└── .github/
    └── workflows/           # Deploy automático (se houver)
```
