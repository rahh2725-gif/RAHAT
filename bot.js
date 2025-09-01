const fetch = require("node-fetch");
const { Telegraf } = require("telegraf");

// Telegram Bot Token এবং Chat ID
const BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
const CHAT_ID = "YOUR_CHAT_ID_HERE";

// API URLs
const HISTORY_API = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";
const LIVE_API = "https://api.bdg88zf.com/api/webapi/GetGameIssue";

const bot = new Telegraf(BOT_TOKEN);

// শেষ দেখা round
let lastRound = null;

// Function: History API থেকে শেষ 10 রাউন্ড analysis
async function getHistory() {
  try {
    const res = await fetch(HISTORY_API, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    const data = await res.json();
    const last10 = data.slice(0, 10);

    let colorCount = { Red: 0, Green: 0, Blue: 0 };
    last10.forEach(r => {
      colorCount[r.color] = (colorCount[r.color] || 0) + 1;
    });

    const predicted = Object.keys(colorCount).reduce((a, b) =>
      colorCount[a] > colorCount[b] ? a : b
    );
    const lastRoundData = last10[0];

    return { lastRound: lastRoundData, predicted };
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
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON from LIVE_API:", e.message);
      console.log("Live API Response (debug):", text.substring(0, 200));
      await bot.telegram.sendMessage(
        CHAT_ID,
        `⚠️ Warning: Live API returned invalid JSON.`
      );
      return;
    }

    // Live API structure check
    if (!data || !data.issueNumber) {
      console.error("Live API JSON structure invalid:", data);
      await bot.telegram.sendMessage(
        CHAT_ID,
        `⚠️ Warning: Live API JSON structure invalid.`
      );
      return;
    }

    const currentRound = data.issueNumber;
    const nextRound = data.nextIssueNumber || "N/A"; // যদি থাকে
    const endTime = data.endTime || Date.now() + 60000; // fallback 60s

    // Duplicate round avoid
    if (lastRound === currentRound) return;
    lastRound = currentRound;

    // Get history for prediction
    const { lastRound: prevRoundData, predicted } = await getHistory();
    const now = Date.now();
    const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));

    const message = `
🔔 New Round Started!
Current Round: ${currentRound}
Next Round: ${nextRound}
Time Left: ${timeLeft}s
Previous Round: ${prevRoundData ? prevRoundData.number + ' (' + prevRoundData.color + ')' : 'N/A'}
Predicted Next: ${predicted || 'N/A'}
`;

    await bot.telegram.sendMessage(CHAT_ID, message);
    console.log("Signal sent for round:", currentRound);

  } catch (error) {
    console.error("Live API Fetch Error:", error.message);
    await bot.telegram.sendMessage(CHAT_ID, `⚠️ Warning: Failed to fetch Live API.`);
  }
}

// প্রতি 30 সেকেন্ডে check
setInterval(checkLiveRound, 30000);

bot.launch();
console.log("Telegram Live Prediction Bot Running...");
