export default {
  // 1) HTTP handler (required so Cloudflare can "visit" the worker)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Optional manual test: visit /test to send a message immediately
    if (url.pathname === "/test") {
      await sendTelegram(env, `✅ miqaat test: worker is live`);
      return new Response("Sent Telegram test message.", { status: 200 });
    }

    return new Response("OK (miqaat worker running). Try /test", { status: 200 });
  },

  // 2) Cron handler (your actual prayer bot)
  async scheduled(event, env, ctx) {
    const BOT_TOKEN = env.BOT_TOKEN;
    const CHAT_ID = env.CHAT_ID;
    const KV = env.KV;

    const LAT = "1.3521";        // Singapore
    const LON = "103.8198";
    const TIMEZONE = "Asia/Singapore";
    const REMIND_MINUTES = 10;   // change to 0 for quick testing

    const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

    const QURAN_VERSES = [
      { ref: "2:286", text: "Allah does not burden a soul beyond what it can bear." },
      { ref: "13:28", text: "Surely in the remembrance of Allah do hearts find rest." },
      { ref: "94:5-6", text: "With hardship comes ease. With hardship comes ease." },
      { ref: "3:139", text: "Do not lose heart nor fall into despair." },
      { ref: "20:46", text: "Indeed, I am with you both. I hear and I see." }
    ];

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const res = await fetch(
      `https://api.aladhan.com/v1/timings/${today}?latitude=${LAT}&longitude=${LON}&method=3`
    );
    const json = await res.json();
    const timings = json?.data?.timings;
    if (!timings) return;

    const now = new Date();
    const windowMs = 60_000; // ±1 minute

    for (const prayer of PRAYERS) {
      const hhmm = timings[prayer]?.slice(0, 5);
      if (!hhmm) continue;

      // Build a "today at HH:MM" date in Singapore time
      const target = dateInTimeZone(today, hhmm, TIMEZONE);

      // Reminder time = prayer time - REMIND_MINUTES
      const remindAt = new Date(target.getTime() - REMIND_MINUTES * 60_000);

      if (Math.abs(now - remindAt) > windowMs) continue;

      const key = `sent:${today}:${prayer}:${REMIND_MINUTES}`;
      if (await KV.get(key)) continue;

      const verse = QURAN_VERSES[Math.floor(Math.random() * QURAN_VERSES.length)];
      const msg =
`⏰ ${prayer} in ${REMIND_MINUTES} minutes

"${verse.text}"
(Qur’an ${verse.ref})`;

      await sendTelegram(env, msg);
      await KV.put(key, "1", { expirationTtl: 60 * 60 * 36 });
    }
  }
};

// ---- helpers ----

async function sendTelegram(env, text) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.CHAT_ID,
      text,
      disable_web_page_preview: true
    }),
  });
  if (!r.ok) throw new Error(`Telegram error: ${await r.text()}`);
}

// Create a Date for YYYY-MM-DD + HH:MM in a specific timezone
function dateInTimeZone(dateISO, hhmm, timeZone) {
  const [Y, M, D] = dateISO.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);

  // Start with a UTC guess
  const guess = new Date(Date.UTC(Y, M - 1, D, h, m, 0));

  // Adjust so formatting in timeZone matches target
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = fmt.formatToParts(guess);
  const gotH = Number(parts.find(p => p.type === "hour").value);
  const gotM = Number(parts.find(p => p.type === "minute").value);

  const deltaMin = (h * 60 + m) - (gotH * 60 + gotM);
  return new Date(guess.getTime() + deltaMin * 60_000);
}
