const GROQ_API_KEY = process.env.GROQ_API_KEY;

const DEFAULT_PARAMS = {
  model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.1,
  max_tokens: parseInt(process.env.GROQ_MAX_TOKENS, 10) || 2000,
  top_p: parseFloat(process.env.GROQ_TOP_P) || 0.85,
};

class GroqProvider {
  constructor() {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set');
    }
    this.name = 'Groq';
  }

  async generate(prompt, overrideParams = {}) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...DEFAULT_PARAMS,
        ...overrideParams,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

module.exports = { GroqProvider, DEFAULT_PARAMS };
