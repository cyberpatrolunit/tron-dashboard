#!/usr/bin/env node

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 18790;

app.use(express.json());
app.use(express.static(__dirname));

// System stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const [cpu, memory, disk, uptime, network, processes] = await Promise.all([
      execAsync("top -l 1 | grep 'CPU usage' | awk '{print $3, $5}'"),
      execAsync("vm_stat | perl -ne '/page size of (\\d+)/ and $size=$1; /Pages\\s+([^:]+)[^\\d]+(\\d+)/ and printf(\"%s: %.2f GB\\n\", $1, $2 * $size / 1073741824);'"),
      execAsync("df -h / | tail -1 | awk '{print $3, $4, $5}'"),
      execAsync("uptime"),
      execAsync("netstat -ib | awk 'NR>1 {sum+=$7} END {print sum/1024/1024}'"),
      execAsync("ps aux | wc -l")
    ]);

    const cpuParts = cpu.stdout.trim().split(' ');
    const memoryLines = memory.stdout.trim().split('\n');
    const diskParts = disk.stdout.trim().split(' ');
    
    const stats = {
      cpu: {
        user: parseFloat(cpuParts[0]),
        system: parseFloat(cpuParts[1])
      },
      memory: memoryLines.reduce((acc, line) => {
        const [key, value] = line.split(': ');
        if (key && value) acc[key.toLowerCase().replace(/\s+/g, '_')] = value;
        return acc;
      }, {}),
      disk: {
        used: diskParts[0],
        available: diskParts[1],
        percent: diskParts[2]
      },
      uptime: uptime.stdout.trim(),
      network: `${parseFloat(network.stdout.trim()).toFixed(2)} MB received`,
      processes: parseInt(processes.stdout.trim())
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OpenClaw status endpoint
app.get('/api/openclaw', async (req, res) => {
  try {
    // Read sessions.json directly
    const sessionsPath = path.join(process.env.HOME, '.openclaw/agents/main/sessions/sessions.json');
    const sessionsData = JSON.parse(await fs.readFile(sessionsPath, 'utf8'));
    
    // Get the main session - it's a flat object with session keys as properties
    const mainSession = sessionsData['agent:main:main'];

    const tokensUsed = mainSession?.totalTokens || 0;
    const contextTokens = mainSession?.contextTokens || 100000;
    const percentUsed = contextTokens > 0 ? Math.round((tokensUsed / contextTokens) * 100) : 0;

    res.json({
      model: mainSession?.model || 'claude-sonnet-4-5',
      tokens: tokensUsed,
      tokensUsed: percentUsed,
      contextTokens: contextTokens,
      age: mainSession?.updatedAt ? formatAge(Date.now() - mainSession.updatedAt) : '--'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function formatAge(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// Model switch endpoint
app.post('/api/model/switch', async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'Model name required' });
    }

    // Valid model aliases
    const validModels = ['haiku', 'sonnet', 'opus', 'qwen', 'default'];
    if (!validModels.includes(model)) {
      return res.status(400).json({ error: 'Invalid model. Use: haiku, sonnet, opus, or qwen' });
    }

    // Update the session model using OpenClaw session_status tool
    const configPath = path.join(process.env.HOME, '.openclaw/agents/main/sessions/sessions.json');
    const sessionsData = JSON.parse(await fs.readFile(configPath, 'utf8'));
    const mainSession = sessionsData['agent:main:main'];
    
    if (!mainSession) {
      return res.status(404).json({ error: 'Main session not found' });
    }

    // Map aliases to full model names
    const modelMap = {
      'haiku': 'anthropic/claude-haiku-4-5',
      'sonnet': 'anthropic/claude-sonnet-4-5',
      'opus': 'anthropic/claude-opus-4-6',
      'qwen': 'ollama/qwen3:8b',
      'default': 'anthropic/claude-sonnet-4-5'
    };

    mainSession.model = modelMap[model];
    await fs.writeFile(configPath, JSON.stringify(sessionsData, null, 2));

    res.json({ 
      success: true, 
      model: modelMap[model],
      message: `Model switched to ${model}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cron jobs endpoint
app.get('/api/cron', async (req, res) => {
  try {
    const configPath = path.join(process.env.HOME, '.openclaw/openclaw.json');
    let config;
    try {
      config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    } catch (err) {
      return res.json({ jobs: [], error: 'Config not found' });
    }
    
    const token = config?.gateway?.auth?.token;
    if (!token) {
      return res.json({ jobs: [], error: 'No auth token' });
    }
    
    const result = await execAsync(`curl -s http://localhost:18789/api/cron/list -H "Authorization: Bearer ${token}"`);
    const data = JSON.parse(result.stdout || '{"jobs":[]}');
    res.json(data);
  } catch (error) {
    res.json({ jobs: [], error: error.message });
  }
});

// High-frequency real-time stats endpoint
let lastNetworkStats = null;
let lastDiskStats = null;

app.get('/api/realtime', async (req, res) => {
  try {
    const [cpuCores, networkNow, diskIO, power] = await Promise.all([
      // CPU per-core usage (top -l 1)
      execAsync("top -l 2 -n 0 -s 0 | grep 'CPU usage' | tail -1").catch(() => ({ stdout: 'CPU usage: 0% user, 0% sys' })),
      // Network stats
      execAsync("netstat -ib | awk 'NR>1 && $1 ~ /^en/ {print $1,$7,$10}' | head -1").catch(() => ({ stdout: 'en0 0 0' })),
      // Disk I/O
      execAsync("iostat -d -c 2 | tail -1").catch(() => ({ stdout: '0 0' })),
      // Power (requires sudo, fallback if unavailable)
      execAsync("pmset -g batt | grep -Eo '[0-9]+W' | head -1").catch(() => ({ stdout: '0W' }))
    ]);

    // Parse CPU
    const cpuMatch = cpuCores.stdout.match(/(\d+\.?\d*)%\s+user.*?(\d+\.?\d*)%\s+sys/);
    const cpuUser = cpuMatch ? parseFloat(cpuMatch[1]) : 0;
    const cpuSys = cpuMatch ? parseFloat(cpuMatch[2]) : 0;

    // Parse Network
    const netParts = networkNow.stdout.trim().split(/\s+/);
    const netInterface = netParts[0] || 'en0';
    const netRxBytes = parseInt(netParts[1]) || 0;
    const netTxBytes = parseInt(netParts[2]) || 0;
    
    let netRxRate = 0, netTxRate = 0;
    if (lastNetworkStats && lastNetworkStats.interface === netInterface) {
      const timeDiff = (Date.now() - lastNetworkStats.timestamp) / 1000;
      netRxRate = ((netRxBytes - lastNetworkStats.rx) / timeDiff / 1024).toFixed(2); // KB/s
      netTxRate = ((netTxBytes - lastNetworkStats.tx) / timeDiff / 1024).toFixed(2); // KB/s
    }
    lastNetworkStats = { interface: netInterface, rx: netRxBytes, tx: netTxBytes, timestamp: Date.now() };

    // Parse Disk I/O
    const diskParts = diskIO.stdout.trim().split(/\s+/);
    const diskKBRead = parseFloat(diskParts[0]) || 0;
    const diskKBWrite = parseFloat(diskParts[1]) || 0;

    // Power
    const powerMatch = power.stdout.match(/(\d+)W/);
    const powerWatts = powerMatch ? parseInt(powerMatch[1]) : 0;

    res.json({
      cpu: {
        user: cpuUser,
        system: cpuSys,
        total: cpuUser + cpuSys
      },
      network: {
        interface: netInterface,
        rxRate: parseFloat(netRxRate),
        txRate: parseFloat(netTxRate),
        rxRateFormatted: `${netRxRate} KB/s`,
        txRateFormatted: `${netTxRate} KB/s`
      },
      disk: {
        readKBps: diskKBRead.toFixed(2),
        writeKBps: diskKBWrite.toFixed(2)
      },
      power: {
        watts: powerWatts,
        formatted: `${powerWatts}W`
      },
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat message endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Send message to OpenClaw main session via WhatsApp channel
    // This simulates sending from the user's number
    const result = await execAsync(
      `curl -s -X POST http://localhost:18789/api/chat/send ` +
      `-u ":1111" ` +
      `-H "Content-Type: application/json" ` +
      `-d '${JSON.stringify({ message, channel: "whatsapp", to: "+14156974323" }).replace(/'/g, "'\\''")}'`
    );

    // For now, return a simple acknowledgment
    // In production, you'd poll for the response or use WebSocket
    res.json({ 
      success: true, 
      response: "Message sent to OpenClaw session. Response will appear in WhatsApp."
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve chat interface
app.use('/chat', express.static(path.join(__dirname, '../chat')));

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
  console.log(`Chat interface at http://localhost:${PORT}/chat`);
});
