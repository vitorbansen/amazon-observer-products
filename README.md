# Amazon Brasil Observer

Script em Node.js utilizando Puppeteer para observar ofertas públicas da Amazon Brasil, extrair produtos com desconto ≥ 11% e salvar em JSON.

## 🚀 Como usar

1.  **Instale as dependências:**
    ```bash
    pnpm install
    ```

2.  **Execute o observador:**
    ```bash
    node src/observer.js
    ```

3.  **Verifique os resultados:**
    As ofertas filtradas serão salvas em `data/offers.json`.

## 🏗️ Estrutura do Projeto

- `src/browser/`: Configuração do Puppeteer.
- `src/pages/`: Lógica de navegação e extração por página (Goldbox, Cupons).
- `src/extractors/`: Funções utilitárias para processamento de dados (preços, ASIN, descontos).
- `src/storage/`: Persistência de dados em JSON evitando duplicatas.
- `src/observer.js`: Script principal que coordena o fluxo.

## 🛠️ Requisitos Técnicos Atendidos

- Modo headless.
- User-Agent realista.
- Sem login.
- Delays aleatórios.
- Tratamento de erros e seletores dinâmicos.
- Cálculo de desconto real: `((preco_antigo - preco_atual) / preco_antigo) * 100`.
- Filtro de desconto ≥ 20%.
- Persistência sem duplicidade por ASIN.
