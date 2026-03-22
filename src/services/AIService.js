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

      const prompt = `
        Você é um copywriter especialista em grupos de ofertas no WhatsApp (estilo "mão de vaca", "achadinhos").
        Avalie a seguinte oferta da Amazon Brasil e gere conteúdo para converter vendas.
        
        Produto: ${product.title}
        Preço Atual: R$ ${product.price}
        Preço Antigo: R$ ${product.oldPrice || 'N/A'}
        Desconto: ${product.discount}%
        Categoria: ${product.category}
        Avaliação: ${product.rating || 'N/A'}
        Prime: ${product.isPrime ? 'Sim' : 'Não'}

   
      Sua tarefa:
        1. Dê uma nota de 0 a 100 para a qualidade da oferta (considerando desconto, utilidade e atratividade).
        2. Defina se a oferta realmente vale a pena (is_worthy: true/false).

        3. Crie um "Comentário de Impacto":
          - Veja a categoria que está e comentario para saber exatamente qual é o produto
           -sem ! e sem emojis 
          - Curto (máx 5 palavras)
          - EM CAIXA ALTA
          - Tom chamativo + humor leve ou alto dependendo do produto mas pode fazer trocadilhos
          - Totalmente baseado no produto (uso, benefício ou contexto)
          - Não usar frases genéricas
          - Não repetir padrões fixos
          - Cada resposta deve ser criativa e diferente
          -tenta pegar o trocadilho de acordo com a descrição do produto e o benefício que ele traz, por exemplo, se for um fone de ouvido bluetooth, pode ser "OUÇA SEM FIO" ou "SOM QUE LIBERTA" ou "FONE DE OURO" ou "BLUETOOTH NA VEIA" ou "MÚSICA SEM AMARRAS" ou "SOM QUE TE MOVE" ou "OUÇA O MUNDO" ou "FONE DE OURO" ou "SOM SEM FIO" ou "MÚSICA NA VEIA" ou "OUÇA SEM FIO" ou "SOM QUE LIBERTA" ou "FONE DE OURO" ou "BLUETOOTH NA VEIA" ou "MÚSICA SEM AMARRAS" ou "SOM QUE TE MOVE" ou "OUÇA O MUNDO"

        4. Crie um "Título Lapidado":
          - Deve ser a DESCRIÇÃO CLARA do produto
          - NÃO usar caixa alta (usar escrita normal)
          - Remover palavras inúteis, SEO e exageros do título original
          - Máx 10 palavras
          - Fácil de entender em 1 segundo
          - Ex: "Fone Bluetooth JBL Tune 510BT Preto"

        5. Crie uma justificativa curta explicando a nota (1 linha, direto ao ponto)

        Responda APENAS em formato JSON:
        {
          "score": number,
          "is_worthy": boolean,
          "impact_comment": "STRING EM CAIXA ALTA, CRIATIVA E NÃO GENÉRICA",
          "polished_title": "descrição clara do produto (sem caixa alta)",
          "reason": "justificativa curta e objetiva"
        }

         Regras IMPORTANTES:
    - Seja direto, agressivo e vendedor (estilo grupo de promo mesmo)
    - Evite textos genéricos
    - Pense como alguém que quer fazer o usuário clicar NA HORA e considere usar o emoji aleaatorio de vez enquando
    - Considere custo-benefício, desconto e apelo do produto
    - Não invente informações
    - Se for produtos como Capa de tablet/celular/relogio ou ebook/livros => Nota baixa (geralmente não convertem)
     - Capas (celular, tablet, relógio) => Nota baixa (geralmente não convertem)
      - Películas e acessórios muito baratos => Nota baixa (geralmente não convertem)
      - Ebooks e livros (baixo apelo imediato) => Nota baixa (geralmente não convertem)
      - Itens muito nichados (ex: peças específicas, reposição técnica) => Nota baixa (geralmente não convertem)
      
      `;

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
