# ⚡ CLAWUNiT System Monitor

A retro-futuristic system monitoring dashboard inspired by 1980s CLAWUNiT aesthetics. Real-time visualization of system resources, network activity, and OpenClaw neural interface metrics.

![CLAWUNiT Dashboard](https://img.shields.io/badge/style-CLAWUNiT-00ffff?style=for-the-badge&logo=tron)

## ✨ Features

### Visual Design
- 🎮 **80s CLAWUNiT Aesthetic** - Neon cyan/blue glowing effects
- 🌐 **Animated Grid Background** - 3D perspective grid with continuous animation
- 📺 **Scan Line Effects** - Classic CRT monitor simulation
- ✨ **Glowing Borders** - Animated light sweeps and shimmer effects
- 🔤 **Orbitron Font** - Retro-futuristic typography

### Real-Time Monitoring

#### System Resources
- ⚡ CPU usage (user/system breakdown)
- 💾 Memory utilization
- 💿 Disk space and usage
- 🔋 Power consumption

#### Network & I/O (1-second updates)
- 📡 Network TX/RX rates (KB/s)
- 💾 Disk read/write speeds (KB/s)
- 📊 Real-time latency monitoring

#### Visualizations
- 💓 **Heartbeat Monitor** - Live pulse graph (100ms refresh)
- 📡 **Network Latency Chart** - 2-second ping monitoring
- 📊 Glowing progress bars with shimmer effects

#### OpenClaw Integration
- 🧠 Neural interface metrics
- 🎯 Model selection (Haiku/Sonnet/Opus/Qwen)
- 📈 Token usage tracking
- ⏱️ Session age monitoring

### Audio
- 🎵 Background MIDI player (Taylor Swift tracks)
- 🔊 Ambient music with auto-play

## 🚀 Setup

### Prerequisites
- Node.js (v14 or higher)
- macOS (for system monitoring commands)

### Installation

```bash
# Clone the repository
git clone https://github.com/cyberpatrolunit/tron-dashboard.git
cd tron-dashboard

# Install dependencies
npm install

# Start the server
node server.js
```

The dashboard will be available at `http://localhost:18790`

### Network Access

To access from other devices on your local network, find your IP:

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Then access via: `http://YOUR_IP:18790`

## 🎨 Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla JavaScript + HTML5 + CSS3
- **Charts:** Chart.js
- **Audio:** Tone.js + MIDI playback
- **Fonts:** Orbitron (Google Fonts)

## 📡 API Endpoints

### `/api/stats`
System resource statistics (CPU, memory, disk, network, processes)

### `/api/realtime`
High-frequency real-time metrics (updated every 1 second):
- Network TX/RX rates
- Disk I/O speeds  
- Power consumption

### `/api/openclaw`
OpenClaw neural interface status (model, tokens, session age)

### `/api/model/switch`
POST endpoint to switch AI models

### `/api/cron`
Scheduled tasks from OpenClaw gateway

## 🎮 Features in Detail

### Update Frequencies
- **Realtime metrics:** 1 second (network, disk I/O, power)
- **System stats:** 3 seconds (CPU, memory, disk usage)
- **Heartbeat visual:** 100ms (smooth pulse animation)
- **Network latency:** 2 seconds

### Network Rate Calculation
Uses delta calculation to show actual transfer speeds rather than cumulative totals. Tracks interface state between updates for accurate KB/s measurements.

## 🔧 Configuration

Port and update intervals can be adjusted in `server.js`:

```javascript
const PORT = 18790;  // Dashboard port
```

## 📝 License

MIT License - feel free to use and modify!

## 🙏 Credits

Inspired by the visual aesthetic of CLAWUNiT (1982) and retro-futuristic command centers.

---

**Built with ❤️ and neon cyan**
