const form = document.getElementById('planner-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const exportBtn = document.getElementById('exportMaps');

let lastPlan = null;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = collectPayload();

  if (!validatePayload(payload)) return;

  const apiKey = value('apiKey');
  const model = 'gemini-1.5-flash';
  if (!apiKey) {
    status('Please provide your Gemini API key.', true);
    return;
  }

  status('Asking Gemini to build your optimized itinerary...');

  try {
    const plan = normalizePlan(await generatePlan(payload, apiKey, model));
    lastPlan = plan;
    renderPlan(plan);
    exportBtn.disabled = plan.googleMapsWaypoints.length < 2;
    status('Plan generated. Review tie-break choices, then export to Google Maps.');
  } catch (error) {
    console.error(error);
    status(error.message || 'Could not generate plan. Please try again.', true);
  }
});

exportBtn.addEventListener('click', () => {
  if (!lastPlan || lastPlan.googleMapsWaypoints.length < 2) {
    status('At least two valid waypoints are required to export a route.', true);
    return;
  }

  const waypoints = lastPlan.googleMapsWaypoints;
  const mapUrl = new URL('https://www.google.com/maps/dir/');
  mapUrl.searchParams.set('api', '1');
  mapUrl.searchParams.set('origin', waypoints[0]);
  mapUrl.searchParams.set('destination', waypoints[waypoints.length - 1]);

  const middleStops = waypoints.slice(1, -1);
  if (middleStops.length) {
    mapUrl.searchParams.set('waypoints', middleStops.join('|'));
  }

  mapUrl.searchParams.set('travelmode', toGoogleTravelMode('Mixed'));
  window.open(mapUrl.toString(), '_blank', 'noopener');
});

function collectPayload() {
  return {
    location: value('location'),
    startTime: value('startTime'),
    endTime: value('endTime'),
    preferences: value('preferences'),
    travelMode: 'Mixed',
  };
}

function validatePayload(payload) {
  if (!payload.location) {
    status('Please enter your current location.', true);
    return false;
  }
  if (payload.startTime >= payload.endTime) {
    status('End time must be later than start time.', true);
    return false;
  }
  return true;
}

function normalizePlan(plan) {
  const safePlan = plan && typeof plan === 'object' ? plan : {};
  return {
    summary: safeText(safePlan.summary) || 'No summary returned.',
    itinerary: normalizeArray(safePlan.itinerary),
    ties: normalizeArray(safePlan.ties),
    comfortAdvice: normalizeStringArray(safePlan.comfortAdvice),
    reviews: normalizeArray(safePlan.reviews),
    googleMapsWaypoints: normalizeStringArray(safePlan.googleMapsWaypoints).filter(Boolean),
  };
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStringArray(value) {
  return normalizeArray(value).map((item) => safeText(item)).filter(Boolean);
}

async function generatePlan(payload, apiKey, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = `You are SmartTravel AI. Create a professional, efficient, tourist-friendly itinerary.\n\nUser Input:\n${JSON.stringify(payload, null, 2)}\n\nReturn ONLY valid JSON with this schema:\n{\n  "summary": "short paragraph",\n  "itinerary": [\n    {\n      "time": "09:00 - 10:00",\n      "place": "string",\n      "why": "benefit/reason",\n      "smartTip": "comfort or money-saving note"\n    }\n  ],\n  "ties": [\n    {\n      "title": "e.g. Sunset View vs Museum Slot",\n      "reason": "why these conflict",\n      "optionA": {"name": "string", "bestFor": "string"},\n      "optionB": {"name": "string", "bestFor": "string"},\n      "defaultSelection": "A or B"\n    }\n  ],\n  "comfortAdvice": ["practical discomfort-avoidance tip"],\n  "reviews": [\n    {\n      "destination": "string",\n      "crowdInsight": "what travelers say",\n      "buyingTip": "where/when to buy",\n      "avoid": "mistake to avoid"\n    }\n  ],\n  "googleMapsWaypoints": ["ordered locations from start to finish"]\n}\n\nRules:\n- Respect time window and optimize travel sequence.\n- Add tie objects whenever meaningful conflicts exist.\n- Tips must be realistic, concise, and safety-aware.\n- Never include markdown fences.`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.6,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Gemini response was not valid JSON. Try again with clearer preferences.');
  }
}

function renderPlan(plan) {
  const template = document.getElementById('itinerary-template');
  const clone = template.content.cloneNode(true);
  const stops = clone.getElementById('stops');
  const ties = clone.getElementById('ties');
  const advice = clone.getElementById('advice');
  const reviews = clone.getElementById('reviews');

  plan.itinerary.forEach((stop) => {
    const item = document.createElement('li');
    const time = createStrong(safeText(stop.time) || 'Time TBD');
    const place = createStrong(safeText(stop.place) || 'Unknown stop');
    const why = document.createElement('div');
    why.className = 'subtle';
    why.textContent = safeText(stop.why) || 'No description provided.';
    const tip = document.createElement('div');
    tip.textContent = safeText(stop.smartTip) || 'No specific tip.';

    item.append(time, document.createTextNode(' — '), place, document.createElement('br'), why, tip);
    stops.appendChild(item);
  });

  if (!plan.itinerary.length) {
    const item = document.createElement('li');
    item.textContent = 'No itinerary steps returned by Gemini.';
    stops.appendChild(item);
  }

  if (!plan.ties.length) {
    const item = document.createElement('li');
    item.textContent = 'No major conflicts detected for this plan.';
    ties.appendChild(item);
  } else {
    plan.ties.forEach((tie) => ties.appendChild(buildTieChoice(tie)));
  }

  plan.comfortAdvice.forEach((tip) => {
    const item = document.createElement('li');
    item.textContent = tip;
    advice.appendChild(item);
  });

  if (!plan.comfortAdvice.length) {
    const item = document.createElement('li');
    item.textContent = 'No additional comfort advice provided.';
    advice.appendChild(item);
  }

  plan.reviews.forEach((review) => {
    const card = document.createElement('article');
    card.className = 'card review-card';
    card.appendChild(withLabel('Destination', safeText(review.destination) || 'Unknown'));
    card.appendChild(withLabel('Crowd insight', safeText(review.crowdInsight) || 'Not provided'));
    card.appendChild(withLabel('Buying tip', safeText(review.buyingTip) || 'Not provided'));
    const avoid = withLabel('Avoid', safeText(review.avoid) || 'Not provided');
    avoid.classList.add('warning');
    card.appendChild(avoid);
    reviews.appendChild(card);
  });

  if (!plan.reviews.length) {
    const note = document.createElement('p');
    note.textContent = 'No destination-specific reviews were returned.';
    reviews.appendChild(note);
  }

  clone.getElementById('summary').textContent = plan.summary;
  resultEl.innerHTML = '';
  resultEl.appendChild(clone);
  resultEl.classList.remove('hidden');
}

function buildTieChoice(tie) {
  const item = document.createElement('li');
  item.className = 'tie-item';

  const title = document.createElement('p');
  title.className = 'tie-title';
  title.textContent = safeText(tie.title) || `${safeText(tie.optionA?.name) || 'Option A'} vs ${safeText(tie.optionB?.name) || 'Option B'}`;

  const reason = document.createElement('p');
  reason.className = 'subtle';
  reason.textContent = safeText(tie.reason) || 'These options overlap in schedule or travel efficiency.';

  const choice = document.createElement('p');
  choice.className = 'tie-choice';
  const defaultSelection = safeText(tie.defaultSelection).toUpperCase() === 'B' ? 'B' : 'A';
  choice.textContent = `Suggested default: Option ${defaultSelection}`;

  const a = document.createElement('button');
  a.type = 'button';
  a.className = defaultSelection === 'A' ? 'secondary active' : 'secondary';
  a.textContent = `A: ${safeText(tie.optionA?.name) || 'Option A'} (${safeText(tie.optionA?.bestFor) || 'balanced travelers'})`;

  const b = document.createElement('button');
  b.type = 'button';
  b.className = defaultSelection === 'B' ? 'secondary active' : 'secondary';
  b.textContent = `B: ${safeText(tie.optionB?.name) || 'Option B'} (${safeText(tie.optionB?.bestFor) || 'balanced travelers'})`;

  a.addEventListener('click', () => {
    a.classList.add('active');
    b.classList.remove('active');
    choice.textContent = 'You selected: Option A';
  });

  b.addEventListener('click', () => {
    b.classList.add('active');
    a.classList.remove('active');
    choice.textContent = 'You selected: Option B';
  });

  item.append(title, reason, choice, a, b);
  return item;
}

function withLabel(label, text) {
  const p = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  p.append(strong, document.createTextNode(text));
  return p;
}

function createStrong(text) {
  const strong = document.createElement('strong');
  strong.textContent = text;
  return strong;
}

function toGoogleTravelMode(mode) {
  const lowered = (mode || '').toLowerCase();
  if (lowered.includes('walk')) return 'walking';
  if (lowered.includes('taxi') || lowered.includes('ride')) return 'driving';
  if (lowered.includes('public')) return 'transit';
  return 'transit';
}

function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function value(id) {
  return document.getElementById(id).value.trim();
}

function status(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('warning', isError);
}
