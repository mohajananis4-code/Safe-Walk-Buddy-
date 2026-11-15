const $ = (id) => document.getElementById(id);

const PROFILE_KEY = "swb_profile_v1";
const CONTACTS_KEY = "swb_contacts_v1";
const DURESS_KEY = "swb_duress_v1";

let timerInterval = null;
let journeyEnd = null;
let currentJourney = null;

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY));
  } catch {
    return null;
  }
}

function getContacts() {
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveContacts(list) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
  renderContacts();
}

function showApp() {
  const profile = getProfile();

  $("loginPanel").hidden = !!profile;
  $("appPanel").hidden = !profile;

  if (profile) {
    $("welcomeName").textContent = profile.name;
    renderContacts();
    renderDuress();
  }
}

// PROFILE
$("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = $("userName").value.trim();
  const pin = $("userPin").value.trim();

  if (!name || !/^\d{4,6}$/.test(pin)) {
    alert("Enter a name and a 4–6 digit PIN.");
    return;
  }

  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ name, pin })
  );

  showApp();
});

$("logoutBtn").addEventListener("click", () => {
  if (confirm("Log out on this device?")) {
    localStorage.removeItem(PROFILE_KEY);
    showApp();
  }
});

// TRUSTED CONTACTS
function renderContacts() {
  const list = getContacts();
  const root = $("contactsList");

  root.innerHTML = "";

  if (!list.length) {
    root.innerHTML =
      '<p class="empty-state">No trusted contacts added yet.</p>';
    return;
  }

  list.forEach((contact, index) => {
    const div = document.createElement("div");
    div.className = "contact-item";

    const info = document.createElement("div");

    const strong = document.createElement("strong");
    strong.textContent = contact.name;

    const small = document.createElement("small");
    small.textContent = contact.phone;

    info.append(strong, small);

    const remove = document.createElement("button");
    remove.className = "remove-btn";
    remove.type = "button";
    remove.textContent = "Remove";

    remove.addEventListener("click", () => {
      const updated = getContacts();
      updated.splice(index, 1);
      saveContacts(updated);
    });

    div.append(info, remove);
    root.append(div);
  });
}

$("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = $("contactName").value.trim();
  const phone = $("contactPhone").value.trim();

  if (!name || !phone) return;

  const list = getContacts();

  if (list.length >= 5) {
    alert("You can add up to 5 trusted contacts.");
    return;
  }

  list.push({ name, phone });
  saveContacts(list);

  e.target.reset();
});

// JOURNEY TIMER
function renderJourneyStatus(message, sub) {
  $("journeyStatus").innerHTML = "";

  const strong = document.createElement("strong");
  strong.textContent = message;

  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = sub || "";

  $("journeyStatus").append(strong, p);
}

$("journeyForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const destination = $("destination").value.trim();
  const duration = Number($("duration").value);

  if (!destination) return;

  unlockAudio();
  requestMic();

  currentJourney = {
    start: $("startPoint").value.trim() || "Not specified",
    destination,
    duration,
    startedAt: Date.now()
  };

  journeyEnd = Date.now() + duration * 60000;

  clearInterval(timerInterval);

  // reset any previous demo alert
  $("alertPanel").hidden = true;

  $("timerWrap").hidden = false;

  renderJourneyStatus(
    "Journey in progress",
    `Destination: ${destination}`
  );

  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
});

function updateTimer() {
  if (!journeyEnd) return;

  const ms = Math.max(0, journeyEnd - Date.now());

  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);

  $("timer").textContent =
    `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  if (ms <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;

    renderJourneyStatus("Check-in time reached", "AI is calling you...");
    startAiCall();
  }
}

$("extendBtn").addEventListener("click", () => {
  if (journeyEnd) {
    journeyEnd += 15 * 60000;
    if (!timerInterval) timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }
});

$("endJourneyBtn").addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;

  journeyEnd = null;
  currentJourney = null;

  $("timerWrap").hidden = true;

  renderJourneyStatus(
    "Journey completed",
    "You marked that you arrived safely. Take care!"
  );
});

// VOICE INPUT
$("voiceBtn").addEventListener("click", () => {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    $("aiResult").textContent =
      "Voice input is not supported. Please type your check-in.";
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.interimResults = false;

  $("voiceBtn").textContent = "Listening...";

  recognition.onresult = (event) => {
    $("checkinText").value =
      event.results[0][0].transcript;
  };

  recognition.onerror = () => {
    $("aiResult").textContent =
      "Voice input failed. Please type your check-in.";
  };

  recognition.onend = () => {
    $("voiceBtn").textContent = "🎙 Use voice";
  };

  recognition.start();
});

// GEMINI AI CHECK-IN
$("analyzeBtn").addEventListener("click", async () => {
  const text = $("checkinText").value.trim();

  if (!text) {
    $("aiResult").textContent =
      "Please enter your check-in first.";
    return;
  }

  $("analyzeBtn").disabled = true;
  $("analyzeBtn").textContent = "Checking...";

  try {
    const response = await fetch("/api/ai-checkin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "AI check-in failed.");
    }

    $("aiResult").textContent =
      `AI check-in: ${data.category}. ${data.reply}`;

  } catch (error) {
    $("aiResult").textContent =
      `Could not reach Gemini: ${error.message}`;
  } finally {
    $("analyzeBtn").disabled = false;
    $("analyzeBtn").textContent = "Check with AI";
  }
});

// LOCATION
$("locationBtn").addEventListener("click", () => {
  const output = $("locationResult");

  if (!navigator.geolocation) {
    output.textContent =
      "Location is not supported by this browser.";
    return;
  }

  output.textContent = "Requesting location permission...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const url =
        `https://maps.google.com/?q=${latitude},${longitude}`;

      output.innerHTML = "";

      const message = document.createElement("p");
      message.textContent =
        "Your location link is ready. Share it only with someone you trust.";

      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "call-link";
      link.textContent = "Open map";

      const copy = document.createElement("button");
      copy.className = "call-link";
      copy.type = "button";
      copy.textContent = "Copy location link";

      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(url);
          copy.textContent = "Copied!";
        } catch {
          copy.textContent = "Copy unavailable";
        }
      });

      output.append(message, link, copy);
    },
    () => {
      output.textContent =
        "Unable to get location. Check your browser permission.";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000
    }
  );
});

// EMERGENCY CALL WORKFLOW
$("emergencyBtn").addEventListener("click", () => {
  const contacts = getContacts();
  const output = $("emergencyResult");

  output.innerHTML = "";

  const intro = document.createElement("p");

  intro.textContent = contacts.length
    ? "Choose a trusted contact below. Your phone dialer will open and you must confirm the call."
    : "No trusted contacts saved. In India, call 112 for immediate emergency assistance.";

  output.append(intro);

  contacts.forEach((contact) => {
    const link = document.createElement("a");

    link.className = "call-link";
    link.href =
      `tel:${contact.phone.replace(/[^\d+]/g, "")}`;

    link.textContent = `Call ${contact.name}`;

    output.append(link);
  });

  const emergency = document.createElement("a");

  emergency.className = "call-link";
  emergency.href = "tel:112";
  emergency.textContent = "Call India emergency number 112";

  output.append(emergency);

  if (currentJourney) {
    const details = document.createElement("p");

    details.textContent =
      `Active journey: ${currentJourney.start} → ${currentJourney.destination}.`;

    output.append(details);
  }

  const voice = document.createElement("button");
  voice.className = "secondary-btn full";
  voice.type = "button";
  voice.style.marginTop = "12px";
  voice.textContent = "🎙 Choose by voice";
  voice.addEventListener("click", () => listenEmergencyChoice(output, contacts));
  output.append(voice);

  const status = document.createElement("p");
  status.className = "voice-status";
  output.append(status);

  const confirmBox = document.createElement("div");
  confirmBox.className = "voice-confirm";
  output.append(confirmBox);
});

// EMERGENCY: CHOOSE BY VOICE
function chooseEmergency(spoken, contacts) {
  const t = spoken.toLowerCase();

  // a saved contact's name was spoken
  const named = contacts.find((c) => t.includes(c.name.toLowerCase()));
  if (named) return { label: `Call ${named.name}`, phone: named.phone };

  const emergencyWords = [
    "112", "one one two", "one twelve", "emergency", "police",
    "ambulance", "helpline", "help line", "போலீஸ்", "அவசர"
  ];
  if (emergencyWords.some((w) => t.includes(w))) {
    return { label: "Call India emergency number 112", phone: "112" };
  }

  const contactWords = [
    "contact", "friend", "family", "trusted", "mom", "dad", "amma", "appa", "நண்பர்"
  ];
  if (contacts.length && contactWords.some((w) => t.includes(w))) {
    return { label: `Call ${contacts[0].name}`, phone: contacts[0].phone };
  }

  return null;
}

function listenEmergencyChoice(output, contacts) {
  const status = output.querySelector(".voice-status");
  const confirmBox = output.querySelector(".voice-confirm");
  confirmBox.innerHTML = "";

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    status.textContent = "Voice is not supported here. Please tap one of the call buttons above.";
    return;
  }

  const startListening = () => {
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    status.textContent = "Listening... say '112' or a contact name.";

    rec.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      const choice = chooseEmergency(spoken, contacts);

      if (!choice) {
        status.textContent = `I heard "${spoken}", but could not match it. Say "112" or a contact name, or tap a button above.`;
        return;
      }

      status.textContent = `I heard "${spoken}". Tap below to confirm the call.`;
      const link = document.createElement("a");
      link.className = "call-confirm";
      link.href = `tel:${choice.phone.replace(/[^\d+]/g, "")}`;
      link.textContent = choice.label;
      confirmBox.append(link);
    };

    rec.onerror = () => {
      status.textContent = "Could not hear you. Tap 'Choose by voice' to try again, or use the buttons above.";
    };

    rec.start();
  };

  if (!window.speechSynthesis) {
    startListening();
    return;
  }

  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      "Do you want to call emergency 112, or a trusted contact?"
    );
    u.lang = "en-IN";
    u.onend = startListening;
    u.onerror = startListening;
    speechSynthesis.speak(u);
  } catch {
    startListening();
  }
}

// SOUND (no audio files needed)
let audioCtx = null;
let ringTimer = null;

// call this inside a user tap so browsers allow sound later
function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (window.speechSynthesis) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    }
  } catch {}
}

function tone(freq, start, dur, vol = 0.25, type = "sine") {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function ringOnce() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  tone(880, t, 0.35);
  tone(660, t + 0.4, 0.35);
  tone(880, t + 0.9, 0.35);
  tone(660, t + 1.3, 0.35);
  try { navigator.vibrate && navigator.vibrate([400, 200, 400]); } catch {}
}

function startRinging(onDone) {
  stopRinging();
  try {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  } catch {}
  let rings = 0;
  ringOnce();
  rings++;
  ringTimer = setInterval(() => {
    if (rings >= 3) {
      stopRinging();
      if (onDone) onDone();
      return;
    }
    ringOnce();
    rings++;
  }, 2500);
}

function stopRinging() {
  clearInterval(ringTimer);
  ringTimer = null;
  try { navigator.vibrate && navigator.vibrate(0); } catch {}
}

function playAlertTone() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    tone(1000, t + i * 0.4, 0.2, 0.3, "square");
  }
}

// ask for mic permission once, inside a user tap, so auto-listen can work later
async function requestMic() {
  try {
    if (!$("autoListen").checked) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {}
}

// AUTO-LISTEN DURING AI CALL
let callRec = null;

function stopCallListening() {
  if (callRec) {
    const rec = callRec;
    callRec = null;
    try { rec.onend = null; rec.abort(); } catch {}
  }
}

function startCallListening() {
  if (!$("autoListen").checked) return;
  if ($("aiCallScreen").hidden) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

  stopCallListening();

  const rec = new SR();
  callRec = rec;
  rec.lang = "en-IN";
  rec.interimResults = false;

  $("callText").textContent = "🎙 Listening... say 'I am safe' or 'I am not safe'";

  rec.onresult = (event) => {
    const spoken = event.results[0][0].transcript;
    $("callReply").value = spoken;
    handleCallReply(spoken);
  };

  rec.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      callRec = null;
      $("callText").textContent =
        "Microphone is blocked. Please allow it, or use the buttons below.";
    }
  };

  rec.onend = () => {
    // keep listening until the call screen closes
    if (callRec === rec && !$("aiCallScreen").hidden) {
      setTimeout(() => {
        if (callRec === rec && !$("aiCallScreen").hidden) startCallListening();
      }, 400);
    }
  };

  try { rec.start(); } catch {}
}

function speakCall() {
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    startCallListening();
  };

  try {
    if (!window.speechSynthesis) {
      go();
      return;
    }
    speechSynthesis.cancel();
    const en = new SpeechSynthesisUtterance("Are you safe? Please respond.");
    en.lang = "en-IN";
    en.onerror = go;
    const ta = new SpeechSynthesisUtterance("நீங்கள் பாதுகாப்பாக இருக்கிறீர்களா?");
    ta.lang = "ta-IN";
    ta.onend = go;
    ta.onerror = go;
    speechSynthesis.speak(en);
    speechSynthesis.speak(ta);
    setTimeout(go, 9000); // fallback if the voice never finishes
  } catch {
    go();
  }
}

// AI CALL + AUTO ALERT (DEMO)
let callInterval = null;

function setFlow(text) {
  $("flowStatus").textContent = text;
}

function speak(text) {
  try {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    speechSynthesis.speak(u);
  } catch {}
}

function closeCall() {
  clearInterval(callInterval);
  callInterval = null;
  $("aiCallScreen").hidden = true;
  stopCallListening();
  stopRinging();
  try { speechSynthesis.cancel(); } catch {}
}

function startAiCall() {
  $("alertPanel").hidden = true;
  $("alertCard").className = "ai-result";
  $("alertCard").textContent = "";
  setFlow("Timer ended → AI calling...");

  $("aiCallScreen").hidden = false;
  $("callTitle").textContent = "AI is calling you...";
  $("callText").textContent = "Are you safe?";
  $("callReply").value = "";
  startRinging(speakCall);

  let left = 30;
  $("callCountdown").textContent = left;

  clearInterval(callInterval);
  callInterval = setInterval(() => {
    left--;
    $("callCountdown").textContent = left;
    if (left <= 0) sendAlert("No response to AI call");
  }, 1000);
}

function sendAlert(reason, silent = false) {
  closeCall();
  if (!silent) playAlertTone();
  $("alertPanel").hidden = false;
  setFlow(`Timer ended → AI called → ${reason} → Contacts alerted`);

  const profile = getProfile();
  const contacts = getContacts();
  const card = $("alertCard");
  card.className = "ai-result alert-card";
  card.innerHTML = "";

  const title = document.createElement("strong");
  title.textContent = silent
    ? "Silent alert sent to trusted contacts"
    : "Alert sent to trusted contacts";
  const tag = document.createElement("span");
  tag.className = "demo-tag";
  tag.textContent = "DEMO";
  title.append(tag);

  const lines = document.createElement("p");
  lines.textContent =
    `User: ${profile ? profile.name : "Unknown"} | ` +
    `Contacts: ${contacts.length ? contacts.map(c => c.name).join(", ") : "none added"} | ` +
    `Reason: ${reason} | Time: ${new Date().toLocaleTimeString()}` +
    (currentJourney ? ` | Trip: ${currentJourney.start} → ${currentJourney.destination}` : "");

  const loc = document.createElement("p");
  loc.textContent = "Getting last location...";

  card.append(title, lines, loc);

  if (silent) {
    const note = document.createElement("p");
    note.textContent =
      "Silent alert: the user's screen shows a normal confirmation. This card is what trusted contacts and the helpline dashboard would see.";
    card.append(note);

    // make the user's screen look normal
    clearInterval(timerInterval);
    timerInterval = null;
    journeyEnd = null;
    currentJourney = null;
    $("timerWrap").hidden = true;
    renderJourneyStatus("Journey completed", "Thanks for checking in. Take care!");
  }

  if (!navigator.geolocation) {
    loc.textContent = "Location not supported.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const a = document.createElement("a");
      a.href = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Last known location";
      loc.textContent = "";
      loc.append(a);
    },
    () => { loc.textContent = "Location unavailable (permission not given)."; },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

$("callSafeBtn").addEventListener("click", () => {
  closeCall();
  $("endJourneyBtn").click();
  $("alertPanel").hidden = false;
  setFlow("Timer ended → AI called → User confirmed safe");
  $("alertCard").className = "ai-result alert-card safe";
  $("alertCard").textContent = "User confirmed they are safe. No alert sent.";
});

$("callExtendBtn").addEventListener("click", () => {
  closeCall();
  journeyEnd = Date.now() + 15 * 60000;
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  renderJourneyStatus("Journey in progress", "Extended by 15 minutes.");
  setFlow("AI called → User extended time");
});

$("callHelpBtn").addEventListener("click", () => sendAlert("User pressed Need help"));

// DURESS WORD
function getDuress() {
  return localStorage.getItem(DURESS_KEY) || "";
}

function renderDuress() {
  $("duressResult").textContent = getDuress()
    ? "Duress word is set (hidden for safety)."
    : "No duress word set.";
}

$("saveDuressBtn").addEventListener("click", () => {
  const word = $("duressWord").value.trim();
  if (word.length < 3) {
    $("duressResult").textContent = "Use a word with at least 3 characters.";
    return;
  }
  localStorage.setItem(DURESS_KEY, word);
  $("duressWord").value = "";
  renderDuress();
});

function handleCallReply(text) {
  const reply = (text || "").trim().toLowerCase();
  const word = getDuress().toLowerCase();

  if (!reply) return;

  // 1. duress word -> silent alert
  if (word && reply.includes(word)) {
    sendAlert("Duress word used", true);
    return;
  }

  // 2. user says they are NOT safe / need help -> alert (checked before "safe")
  const danger = [
    "not safe", "unsafe", "un safe", "not ok", "not okay", "help",
    "danger", "scared", "afraid", "following me", "attack",
    "பாதுகாப்பு இல்ல", "பாதுகாப்பாக இல்ல", "பாதுகாப்பா இல்ல",
    "உதவி", "பயம்", "ஆபத்து"
  ];
  if (danger.some((w) => reply.includes(w))) {
    sendAlert("User said they are not safe");
    return;
  }

  // 3. user says they are safe -> same as tapping "I'm safe"
  const safe = [
    "safe", "fine", "okay", "all good", "reached", "arrived",
    "பாதுகாப்பாக", "பாதுகாப்பா", "நலம்"
  ];
  if (safe.some((w) => reply.includes(w))) {
    $("callSafeBtn").click();
    return;
  }

  $("callText").textContent =
    "Reply not recognised. Say or type 'I am safe' / 'I am not safe', or use the buttons.";
}

$("callSendBtn").addEventListener("click", () => {
  handleCallReply($("callReply").value);
});

$("callReply").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleCallReply($("callReply").value);
});

$("callVoiceBtn").addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $("callText").textContent = "Voice not supported. Please type your reply.";
    return;
  }
  const rec = new SR();
  rec.lang = "en-IN";
  rec.interimResults = false;
  $("callVoiceBtn").textContent = "Listening...";
  rec.onresult = (event) => {
    const spoken = event.results[0][0].transcript;
    $("callReply").value = spoken;
    handleCallReply(spoken);
  };
  rec.onerror = () => {
    $("callText").textContent = "Could not hear you. Please type your reply.";
  };
  rec.onend = () => {
    $("callVoiceBtn").textContent = "🎙 Speak";
  };
  rec.start();
});

$("alertCloseBtn").addEventListener("click", () => {
  $("alertPanel").hidden = true;
});

// remember the auto-listen choice
try {
  const saved = localStorage.getItem("swb_autolisten_v1");
  if (saved !== null) $("autoListen").checked = saved === "1";
} catch {}

$("autoListen").addEventListener("change", () => {
  try {
    localStorage.setItem("swb_autolisten_v1", $("autoListen").checked ? "1" : "0");
  } catch {}
});

// INITIALIZE
showApp();
