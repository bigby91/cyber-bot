// crons/utils/aiOrchestrator.js

'use strict';

const { getProvider, getFallbackProvider } = require('../config/providers');
const logger = require('../config/logger');

class AIOrchestrator {
  constructor(options = {}) {
    this.defaultProvider = options.provider || process.env.AI_PROVIDER || 'groq';
    this.maxRetries = Number(options.maxRetries ?? 1);
    this.timeoutMs = Number(options.timeoutMs ?? 30000);
  }

  async generate(prompt, options = {}) {
    const primaryName = options.provider || this.defaultProvider;
    const providers = this.buildProviderChain(primaryName);

    let lastError = null;

    for (let attempt = 0; attempt < providers.length; attempt++) {
      const providerName = providers[attempt];

      try {
        logger.info(`[AI Orchestrator] Trying provider: ${providerName}`);

        const provider = getProvider(providerName);

        const result = await this.withTimeout(provider.generate(prompt, this.normalizeParams(options)), this.timeoutMs);

        if (!this.isValidResponse(result)) {
          throw new Error('AI provider returned an invalid response');
        }

        logger.info(`[AI Orchestrator] Success: ${providerName}`);

        return {
          success: true,
          provider: providerName,
          response: result,
          attempt: attempt + 1,
        };
      } catch (error) {
        lastError = error;

        logger.warn(`[AI Orchestrator] ${providerName} failed: ${error.message}`);

        if (attempt < providers.length - 1) {
          logger.warn(`[AI Orchestrator] Switching to fallback provider`);
        }
      }
    }

    logger.error(`[AI Orchestrator] All providers failed: ${lastError?.message}`);

    return {
      success: false,
      provider: null,
      response: null,
      error: lastError?.message || 'All AI providers failed',
    };
  }

  buildProviderChain(primaryName) {
    const chain = [primaryName];

    try {
      const fallback = getFallbackProvider(primaryName);

      if (fallback && fallback !== primaryName) {
        chain.push(fallback);
      }
    } catch (error) {
      logger.warn(`[AI Orchestrator] Could not determine fallback: ${error.message}`);
    }

    return [...new Set(chain)];
  }

  normalizeParams(options) {
    const params = { ...options };

    delete params.provider;
    delete params.timeoutMs;
    delete params.maxRetries;

    return params;
  }

  isValidResponse(response) {
    if (typeof response !== 'string') {
      return false;
    }

    const cleaned = response.trim();

    if (!cleaned) {
      return false;
    }

    return cleaned.length >= 2;
  }

  async withTimeout(promise, timeoutMs) {
    let timer;

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`AI request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}

const orchestrator = new AIOrchestrator();

module.exports = orchestrator;
module.exports.AIOrchestrator = AIOrchestrator;
