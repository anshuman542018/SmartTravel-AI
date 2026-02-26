# SmartTravel AI

SmartTravel AI is a lightweight web app that creates an optimized tourist itinerary using Gemini.

## Features

- Professional single-page UI for travel planning.
- Collects current location, time interval, must-visit places, and traveler preferences.
- Uses Gemini to return:
  - Optimized itinerary order.
  - Tie-break choices for conflicts (e.g., sunset vs another activity) with in-app option selection.
  - Comfort/safety and money-saving suggestions.
  - Reviews and "avoid this" tips per destination.
- Exports route to Google Maps with ordered waypoints.
- Client-side validation for time windows and safer rendering for model output.

## Run locally

No build step is required.

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173

## Gemini setup

1. Get a Gemini API key.
2. Open the app and paste the key into the Gemini setup section.
3. Generate itinerary.

> The key is only used in your browser session and is not persisted by this app.
