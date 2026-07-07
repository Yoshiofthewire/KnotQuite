/**
 * Thin client for LM Studio's OpenAI-compatible API.
 * LM Studio exposes a local server at http://localhost:1234/v1/chat/completions.
 *
 * Configuration via env vars or scripts/lib/lmstudio.config.json:
 *   LM_STUDIO_HOST (default: "localhost")
 *   LM_STUDIO_PORT (default: 1234)
 *   LM_STUDIO_MODEL (default: whatever is loaded in LM Studio — query it at runtime)
 *   LM_STUDIO_TEMPERATURE (default: 0.7)
 */

const fs = require('fs');
const path = require('path');

// Load config
function loadConfig() {
  const configPath = path.resolve(__dirname, 'lmstudio.config.json');
  const envConfig = {
    host: process.env.LM_STUDIO_HOST || 'localhost',
    port: process.env.LM_STUDIO_PORT || '1234',
    model: process.env.LM_STUDIO_MODEL || null, // will query from server if not set
    temperature: parseFloat(process.env.LM_STUDIO_TEMPERATURE || '0.7'),
  };

  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.warn('Could not parse lmstudio.config.json:', e.message);
    }
  }

  return { ...fileConfig, ...envConfig };
}

// Check if LM Studio server is reachable and get loaded model
async function getServerInfo() {
  const config = loadConfig();
  const url = `http://${config.host}:${config.port}/v1/models`;

  try {
    const res = await fetch(url, { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      reachable: true,
      models: data.data || [],
      config,
    };
  } catch (e) {
    return {
      reachable: false,
      error: e.message,
      config,
    };
  }
}

// Generate puzzle batch via LM Studio
async function generatePuzzleBatch(prompt, n = 10) {
  const serverInfo = await getServerInfo();
  if (!serverInfo.reachable) {
    throw new Error(
      `LM Studio server not reachable at http://${serverInfo.config.host}:${serverInfo.config.port}\n` +
      `Error: ${serverInfo.error}\n` +
      `Make sure LM Studio is running and a model is loaded in the Developer tab.\n` +
      `Start LM Studio → Load a model (e.g. Gemma 3) → Check the Developer tab shows a running server.`
    );
  }

  // Pick first available model, or use configured one
  let model = serverInfo.config.model;
  if (!model && serverInfo.models.length > 0) {
    model = serverInfo.models[0].id;
    console.log(`No model specified, using: ${model}`);
  }
  if (!model) {
    throw new Error('No model loaded in LM Studio. Load one from the UI and try again.');
  }

  const url = `http://${serverInfo.config.host}:${serverInfo.config.port}/v1/chat/completions`;
  const messages = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  const payload = {
    model,
    messages,
    temperature: serverInfo.config.temperature,
    max_tokens: 4000, // generous for multiple puzzles
  };

  console.log(`Calling LM Studio: POST ${url}`);
  console.log(`Model: ${model}, Temperature: ${serverInfo.config.temperature}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LM Studio API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const responseText = data.choices[0]?.message?.content || '';
  return responseText;
}

module.exports = {
  loadConfig,
  getServerInfo,
  generatePuzzleBatch,
};
