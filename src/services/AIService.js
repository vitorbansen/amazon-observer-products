/**
 * Serviço de Inteligência Artificial
 * Utiliza LLM para avaliar a qualidade das ofertas e gerar conteúdo criativo
 */

const { OpenAI } = require('openai');
const Logger = require('../shared/logger/logger');

class AIService {
  constructor() {
    this.logger = new Logger('AIService');
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Avalia a qualidade de uma oferta e gera conteúdo criativo
   * Retorna um score, justificativa, título lapidado e um comentário de impacto
   */
  async evaluateOffer(product) {
    try {
      this.logger.debug(`Avaliando e lapidando oferta: ${product.title.substring(0, 50)}...`);

      const prompt = `Você é um copywriter especialista em grupos de ofertas no WhatsApp (estilo "mão de vaca", "achadinhos", "promo braba").

Avalie a seguinte oferta da Amazon Brasil e gere conteúdo altamente persuasivo para conversão.

Produto: ${product.title}  
Preço Atual: R$ ${product.price}  
Preço Antigo: R$ ${product.oldPrice || 'N/A'}  
Desconto: ${product.discount}%  
Categoria: ${product.category}  
Avaliação: ${product.rating || 'N/A'}  
Prime: ${product.isPrime ? 'Sim' : 'Não'}  

---

Sua tarefa:

1. Dê uma nota de 0 a 100 para a qualidade da oferta  
(considere desconto, utilidade, apelo emocional e facilidade de venda).

2. Defina se a oferta realmente vale a pena:  
is_worthy: true/false

---

3. Crie um "Comentário de Impacto":

REGRAS OBRIGATÓRIAS:
- Máx 5 palavras
- EM CAIXA ALTA
- SEM pontuação no final
- Pode usar emoji RARAMENTE (somente se fizer MUITO sentido)
- Não usar frases genéricas tipo "oferta imperdível"

ESTILO:
- Humor inteligente, direto e brasileiro
- Pode usar trocadilho, exagero leve ou ironia
- Tem que parecer algo que faria alguém clicar NA HORA
- Baseado no BENEFÍCIO ou USO do produto (não no nome)

PENSAMENTO OBRIGATÓRIO:
- "Como esse produto melhora a vida?"
- "Qual situação engraçada ou real ele resolve?"
- "Dá pra fazer trocadilho com isso?"

EXEMPLOS DE NÍVEL (NÃO COPIAR, APENAS REFERÊNCIA):

Air fryer → SUA NOVA ALIADA NA COZINHA  
TV grande → 75 POLEGADAS PRA SUMIR  
Cadeira gamer → CONFORTO DE PRO PLAYER  
Ar-condicionado → CALOR SÓ LÁ FORA 🥶  
Kit treino → PROJETO SHAPE COMEÇA HOJE  
Camiseta → ESTILO SEM ESFORÇO  
Calça → JÁ VAI PRO FRIO  
Vaso sanitário → TRONO DE RESPEITO  

---

4. Crie um "Título Lapidado":

- Descrição clara e direta do produto
- Máx 10 palavras
- Escrita normal (NÃO caixa alta)
- Remover exageros e palavras inúteis
- Tem que dar pra entender em 1 segundo

Exemplo bom:
"Fone Bluetooth JBL Tune 510BT Preto"

---

5. Crie uma justificativa curta:

- 1 linha
- Direta, sem enrolação
- Foco em custo-benefício + atratividade

---

Responda APENAS em JSON:

{
  "score": number,
  "is_worthy": boolean,
  "impact_comment": "STRING EM CAIXA ALTA, CRIATIVA E NÃO GENÉRICA",
  "polished_title": "descrição clara do produto",
  "reason": "justificativa curta e objetiva"
}

---

REGRAS IMPORTANTES:

- Pense como alguém que vive de postar oferta TODO DIA
- Seja direto, vendedor e sem frescura
- Evite padrão repetido (cada comentário deve parecer único)
- NÃO invente informações

Produtos com nota baixa (geralmente não convertem):
- Capas (celular, tablet, relógio)
- Películas e acessórios baratos
- Ebooks e livros
- Itens muito nichados ou técnicos

Produtos com alto potencial:
- Eletrônicos
- Itens para casa
- Cozinha
- Conforto (cadeira, colchão, etc)
- Clima (ar, ventilador)
- Fitness
- Roupas com bom preço

OBJETIVO FINAL:
Fazer a pessoa bater o olho e clicar sem pensar.`;

      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      this.logger.info(`Score IA: ${result.score} - ${result.impact_comment}`);
      
      return result;
    } catch (error) {
      this.logger.error('Erro ao avaliar oferta com IA', error);
      return {
        score: product.discount >= 20 ? 70 : 40,
        is_worthy: product.discount >= 20,
        impact_comment: "OFERTA SELECIONADA",
        polished_title: product.title.substring(0, 60),
        reason: "Fallback: Erro na API"
      };
    }
  }
}

module.exports = AIService;
