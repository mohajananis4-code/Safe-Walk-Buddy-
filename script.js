"use strict";

/* =================================
   SAFE WALK BUDDY - JAVASCRIPT
================================= */

// Application data
let profile = null;
let contacts = [];
let countdown = null;
let callSequence = null;
let remaining = 0;
let journeyActive = false;


// Load saved demo data
try {
  profile = JSON.parse(localStorage.getItem("swbProfile"));
  contacts = JSON.parse(localStorage.getItem("swbContacts")) || [];

  if (!Array.isArray(contacts)) {
    contacts = [];
  }
} catch (error) {
  profile = null;
  contacts = [];
}


// Show selected section
function show(sectionId) {
  ["register", "login", "dashboard"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });

  document.getElementById(sectionId).classList.remove("hidden");
}


// Registration
function registerUser() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const pin = document.getElementById("pin").value.trim();

  if (!name || !email || !phone || !/^\d{6}$/.test(pin)) {
    alert("Enter all details and a valid 6-digit PIN.");
    return;
  }

  profile = {
    name: name,
    email: email,
    phone: phone,
    pin: pin,
    created: Date.now()
  };

  localStorage.setItem("swbProfile", JSON.stringify(profile));

  openDashboard();
}


// Login
function loginUser() {
  const enteredPin =
    document.getElementById("loginPin").value.trim();

  if (profile && enteredPin === profile.pin) {
    openDashboard();
  } else {
    alert("Incorrect PIN. Please try again.");
  }
}


// Open Dashboard
function openDashboard() {
  show("dashboard");

  document.getElementById("welcome").textContent =
    "Welcome, " + profile.name + "!";

  renderContacts();
}


// Add Trusted Contact
function addContact() {
  const name =
    document.getElementById("contactName").value.trim();

  const phone =
    document.getElementById("contactPhone").value.trim();

  if (!name || !phone) {
    alert("Enter contact name and phone number.");
    return;
  }

  contacts.push({ name, phone });

  localStorage.setItem("swbContacts", JSON.stringify(contacts));

  document.getElementById("contactName").value = "";
  document.getElementById("contactPhone").value = "";

  renderContacts();
}


// Display Trusted Contacts
function renderContacts() {
  const list = document.getElementById("contacts");
  list.innerHTML = "";

  contacts.forEach(contact => {
    const item = document.createElement("div");

    item.className = "contact";
    item.textContent = contact.name + " — " + contact.phone;

    list.appendChild(item);
  });
}


// Start Journey
function startJourney() {
  const destination =
    document.getElementById("destination").value.trim();

  const minutes =
    Number(document.getElementById("duration").value);

  if (!destination) {
    alert("Please enter your destination.");
    return;
  }

  if (contacts.length === 0) {
    alert("Please add at least one trusted contact.");
    return;
  }

  clearInterval(countdown);
  clearTimeout(callSequence);

  journeyActive = true;

  document.getElementById("journey").classList.remove("hidden");
  document.getElementById("emergency").classList.add("hidden");

  document.getElementById("journeyDestination").textContent =
    destination;

  document.getElementById("journeyStatus").textContent =
    "Journey Active";

  remaining = minutes * 60;

  updateTimer();

  countdown = setInterval(() => {
    remaining--;

    updateTimer();

    if (remaining <= 0) {
      clearInterval(countdown);
      showSafetyCheck();
    }
  }, 1000);
}


// Update Countdown Timer
function updateTimer() {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  document.getElementById("timer").textContent =
    String(mins).padStart(2, "0") + ":" +
    String(secs).padStart(2, "0");
}


// Safety Check
function showSafetyCheck() {
  if (!journeyActive) return;

  document.getElementById("journeyStatus").textContent =
    "Arrival time reached — Safety check required";

  const safe = confirm(
    "Demo Safety Check: Are you safe?"
  );

  if (safe) {
    endJourney();
  } else {
    simulateEmergency();
  }
}


// Emergency Escalation - Demo Only
function simulateEmergency() {
  if (!journeyActive) return;

  clearInterval(countdown);
  clearTimeout(callSequence);

  document.getElementById("emergency").classList.remove("hidden");

  document.getElementById("journeyStatus").textContent =
    "Emergency Active";

  document.getElementById("emergencyMessage").textContent =
    "No safety confirmation received. Demo escalation started.";

  let index = 0;

  function nextCall() {
    if (!journeyActive) return;

    if (index < contacts.length) {
      const contact = contacts[index];

      document.getElementById("callStatus").textContent =
        "DEMO ONLY: Simulating voice call to " +
        contact.name + " (" + contact.phone + ")";

      index++;

      callSequence = setTimeout(nextCall, 2000);

    } else {
      document.getElementById("callStatus").textContent =
        "Demo call sequence completed. Emergency remains active.";
    }
  }

  nextCall();
}


// Confirm User is Safe
function confirmSafe() {
  if (!journeyActive) return;

  alert("Safety confirmed in demo.");

  endJourney();
}


// End Journey
function endJourney() {
  clearInterval(countdown);
  clearTimeout(callSequence);

  journeyActive = false;

  document.getElementById("journey").classList.add("hidden");
  document.getElementById("emergency").classList.add("hidden");

  alert("Journey ended in demo.");
}


// Lock Application
function lockApp() {
  if (journeyActive) {
    alert("Please end your active journey before locking the demo.");
    return;
  }

  show("login");
}


// Initialize Application
function initializeApp() {
  if (!profile) {
    show("register");
    return;
  }

  const twoDays = 2 * 24 * 60 * 60 * 1000;

  if (Date.now() - profile.created < twoDays) {
    openDashboard();
  } else {
    show("login");
  }
}


// Start Application
initializeApp();
