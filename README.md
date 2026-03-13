# SmartTravel AI

SmartTravel AI is a lightweight web app that creates an optimized tourist itinerary using Gemini.

## Features

- Clean, professional single-page UI with minimal input fields.
- Users only provide:
  - Current location
  - Start and end time
  - Places/preferences in one text box
- Gemini returns:
  - Optimized itinerary order
  - Tie-break choices for conflicts (e.g., sunset vs another activity)
  - Comfort/safety and money-saving suggestions
  - Reviews and "avoid this" tips per destination
- One-click export to Google Maps with ordered waypoints.

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173

## Gemini setup

1. Get a Gemini API key.
2. Open the app and enter it in the Gemini section.
3. Generate your itinerary.
