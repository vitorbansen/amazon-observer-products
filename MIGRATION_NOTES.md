# Notas de Migração - Código Legado para Nova Arquitetura

## 📌 Status da Refatoração

### ✅ Refatorado (Novo Código)
- `src/core/entities/Product.js` - Entidade de Produto
- `src/core/use-cases/CuratorService.js` - Lógica de curadoria
- `src/core/use-cases/SendProductsUseCase.js` - Caso de uso de envio
- `src/infra/database/DeduplicationRepository.js` - Repositório de deduplicação
- `src/infra/messaging/WhatsAppService.js` - Serviço de WhatsApp
- `src/infra/messaging/ProductMessageFormatter.js` - Formatador de mensagens
- `src/infra/scheduler/ScheduleManager.js` - Gerenciador de agendamento
- `src/shared/constants/config.js` - Configurações centralizadas
- `src/shared/logger/logger.js` - Logger estruturado
- `src/shared/utils/parsers.js` - Funções de parsing
- `src/main.js` - Ponto de entrada refatorado

### ⚠️ Legado (Será Descontinuado)
- `src/observer.js` - Será substituído por `src/main.js`
- `src/scheduler.js` - Será substituído por `ScheduleManager`
- `src/services/zapiService.js` - Será substituído por `WhatsAppService`
- `src/services/deduplication.js` - Será substituído por `DeduplicationRepository`
- `src/manage-history.js` - Será refatorado
- `src/services/teste.js` - Arquivo de teste (remover)

### 🔄 Parcialmente Refatorado
- `src/pages/goldbox.js` - Scraper (mantém funcionalidade, mas será melhorado)
- `src/browser/browser.js` - Inicialização do Puppeteer (será melhorado)
- `src/extractors/extractor.js` - Funções de parsing (migradas para `parsers.js`)
- `src/services/amazonAffiliate.service.js` - Geração de links (será integrado)
- `src/storage/storage.js` - Persistência (será integrado ao repositório)

---

## 🔄 Plano de Migração Gradual

### Fase 1: Usar Novo Código (Atual)
```bash
npm run start  # Usa src/main.js com nova arquitetura
```

### Fase 2: Remover Código Legado
Após validar que tudo funciona:

```bash
rm src/observer.js
rm src/scheduler.js
rm src/manage-history.js
rm src/services/zapiService.js
rm src/services/deduplication.js
rm src/services/teste.js
```

### Fase 3: Refatorar Scraper
Melhorar `src/pages/goldbox.js` para:
- Ser mais resiliente a mudanças no DOM
- Usar melhor tratamento de erros
- Implementar retry automático
- Adicionar logging estruturado

### Fase 4: Adicionar Testes
Criar suíte de testes:
- Testes unitários para `CuratorService`
- Testes de integração para `SendProductsUseCase`
- Testes para `DeduplicationRepository`

---

## 🔀 Diferenças Principais

### Deduplicação

**Antes (Legado):**
```javascript
// Comparação por título normalizado
const normalized = title.toLowerCase().replace(/[^\w\s]/g, '');
const alreadySent = await dedup.wasRecentlySent(title);
```

**Depois (Novo):**
```javascript
// Comparação por ASIN (mais confiável)
const alreadySent = await deduplicationRepository.wasAlreadySent(product.asin);
```

### Agendamento

**Antes (Legado):**
```javascript
// Cron a cada 2 horas
cron.schedule('0 0 9-23/2 * * *', () => {
  executeObserver();
});
```

**Depois (Novo):**
```javascript
// Horários específicos com limite diário
SCHEDULE: {
  SEND_TIMES: [8, 12, 16, 20],
  PRODUCTS_PER_SEND: 5,
  MAX_PRODUCTS_PER_DAY: 20
}
```

### Curadoria

**Antes (Legado):**
```javascript
// Filtro básico por desconto
const filtered = products.filter(p => p.discount >= 20);
```

**Depois (Novo):**
```javascript
// Curadoria inteligente
const filtered = curatorService.filterByQuality(products);
const organized = curatorService.organizeForSending(filtered);
// - Prioriza categorias de "Casa"
// - Evita repetição de categorias
// - Filtra por avaliação e desconto
```

### Logging

**Antes (Legado):**
```javascript
console.log('❌ Erro durante a execução:', err);
```

**Depois (Novo):**
```javascript
logger.error('Erro durante a execução', err);
// Formato: JSON ou texto estruturado
// Contexto claro e rastreável
```

---

## 📝 Checklist de Migração

- [ ] Validar que `src/main.js` funciona corretamente
- [ ] Testar agendamento nos horários corretos (08:00, 12:00, 16:00, 20:00)
- [ ] Verificar que deduplicação por ASIN funciona
- [ ] Confirmar que limite diário de 20 produtos é respeitado
- [ ] Testar curadoria com prioridade para "Casa"
- [ ] Validar formatação de mensagens no WhatsApp
- [ ] Verificar logs estruturados
- [ ] Remover código legado
- [ ] Adicionar testes unitários
- [ ] Documentar configurações personalizadas

---

## 🚨 Possíveis Problemas e Soluções

### Problema: "ASIN não encontrado em alguns produtos"
**Solução:** Melhorar o scraper para extrair ASIN de forma mais confiável. Adicionar fallback para URL.

### Problema: "Produtos não estão sendo enviados"
**Solução:** Verificar:
1. Conexão com WhatsApp (Z-API)
2. Limite diário foi atingido?
3. Todos os produtos foram filtrados?

### Problema: "Muitos produtos da mesma categoria"
**Solução:** Ajustar `MAX_SAME_CATEGORY_CONSECUTIVE` em `config.js`.

### Problema: "Scraper falha frequentemente"
**Solução:** Implementar retry automático e melhorar seletores CSS.

---

## 📚 Referências

- Documentação completa: `REFACTORING_GUIDE.md`
- Análise técnica: `ANALISE_E_PROPOSTA.md`
- Configurações: `src/shared/constants/config.js`
