const fetch = require("node-fetch");
const { Telegraf } = require("telegraf");

// Telegram Bot Token এবং Chat ID
const BOT_TOKEN = "8034233581:AAHA_fQAHggXWucU54cqTdmCxYjGKKSHQZk";
const CHAT_ID = "7933110913";

// API URLs
const HISTORY_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";
const LIVE_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M.json";

const bot = new Telegraf(BOT_TOKEN);

// শেষ দেখা round
let lastRound = null;

// Function: History API থেকে শেষ N রাউন্ড analysis
async function getHistory() {
  try {
    const res = await fetch(HISTORY_API, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });
    const data = await res.json();
    const last10 = data.slice(0, 10);

    let colorCount = { Red: 0, Green: 0, Blue: 0 };
    last10.forEach(r => {
      colorCount[r.color] = (colorCount[r.color] || 0) + 1;
    });

    let predicted = Object.keys(colorCount).reduce((a, b) => colorCount[a] > colorCount[b] ? a : b);
    const lastRound = last10[0];

    return { lastRound, predicted };
  } catch (error) {
    console.error("History API Error:", error.message);
    return { lastRound: null, predicted: null };
  }
}

// Function: Live round check
async function checkLiveRound() {
  try {
    const res = await fetch(LIVE_API, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.error("Failed to parse JSON from LIVE_API:", e.message);
      await bot.telegram.sendMessage(CHAT_ID, `⚠️ Warning: Live API returned invalid JSON.`);
      return;
    }

    const currentRound = data.current.issueNumber;
    const nextRound = data.next.issueNumber;
    const endTime = data.current.endTime;
    const previousRoundNumber = data.previous.issueNumber;

    if (lastRound !== currentRound) {
      lastRound = currentRound;

      const { lastRound: prevRoundData, predicted } = await getHistory();
      const now = Date.now();
      const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));

      const message = `
🔔 New Round Started!
Current Round: ${currentRound}
Next Round: ${nextRound}
Time Left: ${timeLeft}s
Previous Round: ${prevRoundData ? prevRoundData.number + ' (' + prevRoundData.color + ')' : previousRoundNumber}
Predicted Next: ${predicted || 'N/A'}
`;

      await bot.telegram.sendMessage(CHAT_ID, message);
      console.log("Signal sent for round:", currentRound);
    }
  } catch (error) {
    console.error("Live API Fetch Error:", error.message);
    await bot.telegram.sendMessage(CHAT_ID, `⚠️ Warning: Failed to fetch Live API.`);
  }
}

// প্রতি 30 সেকেন্ডে check
setInterval(checkLiveRound, 30000);

bot.launch();
console.log("Telegram Live Prediction Bot Running...");
