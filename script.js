const $ = (id) => document.getElementById(id);

const PROFILE_KEY = "swb_profile_v1";
const CONTACTS_KEY = "swb_contacts_v1";

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

  currentJourney = {
    start: $("startPoint").value.trim() || "Not specified",
    destination,
    duration,
    startedAt: Date.now()
  };

  journeyEnd = Date.now() + duration * 60000;

  clearInterval(timerInterval);

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

    renderJourneyStatus(
      "Check-in time reached",
      "Please confirm your arrival or contact someone you trust if you need help."
    );
  }
}

$("extendBtn").addEventListener("click", () => {
  if (journeyEnd) {
    journeyEnd += 15 * 60000;
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
});

// INITIALIZE
showApp();
