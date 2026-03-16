# Guia de Refatoração - Amazon Observer

Este documento descreve as melhorias implementadas no projeto e como usar o novo código refatorado.

## 📋 Resumo das Melhorias

### 1. **Arquitetura Limpa (Clean Architecture)**
- Separação clara entre camadas: `core` (lógica de negócio), `infra` (implementação técnica), `shared` (utilitários)
- Cada classe tem uma responsabilidade única (Single Responsibility Principle)
- Fácil de testar e manter

### 2. **Configuração Centralizada**
- Todas as constantes estão em `src/shared/constants/config.js`
- Regras de negócio bem documentadas e fáceis de ajustar
- Suporte a variáveis de ambiente via `.env`

### 3. **Logger Estruturado**
- Logs em formato JSON ou texto
- Diferentes níveis: debug, info, warn, error
- Contexto claro para cada log

### 4. **Agendamento Inteligente**
- Garante envio de **5 produtos** nos horários: **08:00, 12:00, 16:00, 20:00**
- Máximo de **20 produtos por dia**
- Reset automático do contador à meia-noite
- Suporta "catch-up" se o sistema iniciar atrasado

### 5. **Curadoria Avançada**
- **Prioridade para categoria "Casa"**: 70% dos produtos vêm de categorias prioritárias
- **Variação de categorias**: Evita enviar muitos produtos da mesma categoria seguidos
- **Filtro de qualidade**: Desconto mínimo de 15%, avaliação mínima de 3.5 estrelas
- **Bloqueio de palavras-chave**: Remove produtos que não convertem (livros, cursos, etc.)

### 6. **Deduplicação Robusta**
- Usa **ASIN** como chave primária (mais confiável que título)
- Histórico persistente em SQLite
- Mantém apenas os últimos 100 produtos
- Não reenvia produtos dos últimos 30 dias

### 7. **Código Limpo**
- Sem comentários gerados por IA
- Sem código redundante ou morto
- Funções bem documentadas com JSDoc
- Nomes descritivos e consistentes

---

## 🗂️ Estrutura de Diretórios

```
src/
├── core/
│   ├── entities/
│   │   └── Product.js              # Entidade de Produto
│   ├── use-cases/
│   │   ├── CuratorService.js       # Lógica de curadoria
│   │   └── SendProductsUseCase.js  # Orquestração de envio
│   └── interfaces/                 # (Para futuras extensões)
│
├── infra/
│   ├── database/
│   │   └── DeduplicationRepository.js  # Persistência de histórico
│   ├── messaging/
│   │   ├── WhatsAppService.js          # Integração com Z-API
│   │   └── ProductMessageFormatter.js  # Formatação de mensagens
│   ├── scraping/
│   │   └── (Será refatorado)
│   └── scheduler/
│       └── ScheduleManager.js      # Agendamento inteligente
│
├── shared/
│   ├── constants/
│   │   └── config.js               # Configurações centralizadas
│   ├── logger/
│   │   └── logger.js               # Logger estruturado
│   └── utils/
│       └── parsers.js              # Funções de parsing
│
├── main.js                         # Ponto de entrada (Composition Root)
├── observer.js                     # (Legado - será descontinuado)
└── scheduler.js                    # (Legado - será descontinuado)
```

---

## 🚀 Como Usar

### Instalação

```bash
npm install
# ou
pnpm install
```

### Configuração

Edite o arquivo `.env`:

```env
# Amazon
AMAZON_AFFILIATE_TAG=kompreaki05-20

# Z-API (WhatsApp)
ZAPI_INSTANCE_ID=seu_instance_id
ZAPI_TOKEN=seu_token
ZAPI_CLIENT_TOKEN=seu_client_token

# WhatsApp
WHATSAPP_GROUP_ID=seu_group_id

# Logging
LOG_LEVEL=info
```

### Iniciar o Scheduler

```bash
npm run start
# ou para modo de teste (executa imediatamente)
npm run start -- --run-now
```

### Verificar Histórico

```bash
npm run history:stats
npm run history:list
npm run history:clear
```

---

## 📊 Configurações Personalizáveis

Edite `src/shared/constants/config.js` para ajustar:

### Horários de Envio
```javascript
SCHEDULE: {
  SEND_TIMES: [8, 12, 16, 20],  // Adicione/remova horários conforme necessário
  PRODUCTS_PER_SEND: 5,
  MAX_PRODUCTS_PER_DAY: 20
}
```

### Filtros de Qualidade
```javascript
CURATION: {
  MIN_DISCOUNT: 15,              // Desconto mínimo em %
  MIN_RATING: 3.5,               // Avaliação mínima
  PRIORITY_CATEGORIES: ['home', 'kitchen', ...],
  SECONDARY_CATEGORIES: ['electronics', ...]
}
```

### Histórico
```javascript
DEDUPLICATION: {
  HISTORY_LIMIT: 100,            // Quantos produtos manter no histórico
  RETENTION_DAYS: 30             // Não reenviar nos últimos 30 dias
}
```

---

## 🔄 Fluxo de Execução

```
1. ScheduleManager aguarda horário configurado (08:00, 12:00, 16:00, 20:00)
   ↓
2. Quando chega o horário, executa scraping via Puppeteer
   ↓
3. CuratorService filtra e organiza produtos:
   - Remove duplicatas (por ASIN)
   - Filtra por qualidade (desconto, avaliação)
   - Prioriza categorias de "Casa"
   - Evita muitos da mesma categoria seguidos
   ↓
4. SendProductsUseCase orquestra o envio:
   - Verifica limite diário
   - Formata mensagens
   - Envia via WhatsApp
   - Registra como enviados
   ↓
5. DeduplicationRepository atualiza histórico
   ↓
6. Logger registra tudo para monitoramento
```

---

## 🛠️ Próximas Melhorias (Roadmap)

- [ ] Refatorar scraper para ser mais resiliente (considerar usar API em vez de Puppeteer)
- [ ] Adicionar testes unitários e de integração
- [ ] Implementar dashboard de monitoramento
- [ ] Adicionar suporte a múltiplos grupos de WhatsApp
- [ ] Implementar sistema de feedback (reações do grupo)
- [ ] Adicionar cache de imagens de produtos
- [ ] Melhorar detecção de "desconto real" vs "desconto artificial"

---

## 📝 Notas Técnicas

### Por que ASIN em vez de Título?
- **ASIN** é o identificador único da Amazon para cada produto
- **Título** pode variar (espaços, pontuação, etc.)
- **ASIN** é mais confiável para deduplicação

### Por que SQLite?
- Leve e sem dependências externas
- Adequado para aplicações de médio porte
- Fácil de fazer backup
- Suporta índices para performance

### Estratégia de Curadoria
- **70% prioritários** (Casa, Cozinha, etc.) + **30% secundários** (Eletrônicos, etc.)
- Garante que o público receba conteúdo relevante
- Evita spam de uma única categoria

---

## 🐛 Troubleshooting

### "WhatsApp não está conectado"
- Verifique `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN` no `.env`
- Certifique-se de que a instância está ativa na Z-API

### "Nenhum produto encontrado"
- Verifique se o scraper consegue acessar a Amazon
- Pode ser bloqueio por IP - considere usar proxy

### "Limite diário atingido"
- O sistema já enviou 20 produtos hoje
- Aguarde até a meia-noite para reset automático

---

## 📞 Suporte

Para dúvidas ou sugestões, consulte a documentação técnica em `ANALISE_E_PROPOSTA.md`.
