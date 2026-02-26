const form = document.getElementById('planner-form');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const exportBtn = document.getElementById('exportMaps');

let lastPlan = null;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status('Asking Gemini to build your optimized itinerary...');

  const payload = {
    location: value('location'),
    startTime: value('startTime'),
    endTime: value('endTime'),
    mustVisit: value('mustVisit'),
    preferences: value('preferences'),
    travelMode: value('travelMode'),
  };

  const apiKey = value('apiKey');
  const model = value('model') || 'gemini-1.5-flash';

  if (!apiKey) {
    status('Please provide your Gemini API key.', true);
    return;
  }

  try {
    const plan = await generatePlan(payload, apiKey, model);
    lastPlan = plan;
    renderPlan(plan);
    exportBtn.disabled = !plan?.googleMapsWaypoints?.length;
    status('Plan generated. Review and export to Google Maps when ready.');
  } catch (error) {
    console.error(error);
    status(error.message || 'Could not generate plan. Please try again.', true);
  }
});

exportBtn.addEventListener('click', () => {
  if (!lastPlan?.googleMapsWaypoints?.length) {
    status('No map waypoints are available to export.', true);
    return;
  }

  const waypoints = lastPlan.googleMapsWaypoints.filter(Boolean);
  const destination = encodeURIComponent(waypoints[waypoints.length - 1]);
  const origin = encodeURIComponent(waypoints[0]);
  const middle = waypoints.slice(1, -1).map(encodeURIComponent).join('|');
  const travel = (value('travelMode') || 'walking').toLowerCase();

  const mapUrl = new URL('https://www.google.com/maps/dir/');
  mapUrl.searchParams.set('api', '1');
  mapUrl.searchParams.set('origin', origin);
  mapUrl.searchParams.set('destination', destination);
  if (middle) mapUrl.searchParams.set('waypoints', middle);
  mapUrl.searchParams.set('travelmode', travel.includes('walk') ? 'walking' : 'transit');

  window.open(mapUrl.toString(), '_blank', 'noopener');
});

async function generatePlan(payload, apiKey, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are SmartTravel AI. Create a professional, easy itinerary for a tourist.
Use this user input:
${JSON.stringify(payload, null, 2)}

Return strict JSON matching this schema:
{
  "summary": "short paragraph",
  "itinerary": [
    {
      "time": "09:00 - 10:00",
      "place": "string",
      "why": "benefit/reason",
      "smartTip": "comfort or money-saving note"
    }
  ],
  "ties": [
    {
      "optionA": "string",
      "optionB": "string",
      "reason": "why this is a tie",
      "bestForA": "who should pick A",
      "bestForB": "who should pick B"
    }
  ],
  "comfortAdvice": ["array of practical warnings or tips"],
  "reviews": [
    {
      "destination": "string",
      "crowdInsight": "what tourists say",
      "buyingTip": "buy outside/inside etc",
      "avoid": "common mistake to avoid"
    }
  ],
  "googleMapsWaypoints": ["ordered locations from start to finish"]
}

Rules:
- Respect the time window and optimize travel flow.
- Add at least 1 tie if there is any possible conflict (e.g., sunset vs museum slot).
- Keep advice realistic and traveler friendly.
- Never include markdown fences.`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
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

  (plan.itinerary || []).forEach((stop) => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${stop.time}</strong> — <strong>${stop.place}</strong><br/><span class="subtle">${stop.why}</span><br/><span>${stop.smartTip}</span>`;
    stops.appendChild(item);
  });

  if ((plan.ties || []).length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No conflicts detected in this plan.';
    ties.appendChild(item);
  } else {
    (plan.ties || []).forEach((tie) => {
      const item = document.createElement('li');
      item.innerHTML = `<strong>${tie.optionA}</strong> vs <strong>${tie.optionB}</strong><br/><span class="subtle">${tie.reason}</span><br/>Pick A if: ${tie.bestForA}<br/>Pick B if: ${tie.bestForB}`;
      ties.appendChild(item);
    });
  }

  (plan.comfortAdvice || []).forEach((tip) => {
    const item = document.createElement('li');
    item.textContent = tip;
    advice.appendChild(item);
  });

  (plan.reviews || []).forEach((review) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <h4>${review.destination}</h4>
      <p><strong>Crowd insight:</strong> ${review.crowdInsight}</p>
      <p><strong>Buying tip:</strong> ${review.buyingTip}</p>
      <p class="warning"><strong>Avoid:</strong> ${review.avoid}</p>
    `;
    reviews.appendChild(card);
  });

  clone.getElementById('summary').textContent = plan.summary || 'No summary returned.';

  resultEl.innerHTML = '';
  resultEl.appendChild(clone);
  resultEl.classList.remove('hidden');
}

function value(id) {
  return document.getElementById(id).value.trim();
}

function status(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('warning', isError);
}
