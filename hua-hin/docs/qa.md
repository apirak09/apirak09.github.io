# Validation — 18 November 2026

## Automated checks

`node --test tests/*.test.mjs`: **14 passed, 0 failed**.

The checks cover protected train times; Bangkok timezone boundaries; ordered, continuous events; real route geometry and snapped endpoints; the >2 km ride rule; transfer budgets; four hours of Sunday hotel rest; noon checkout; the 51-minute return station buffer; countdown states; Google Maps modes/coordinates; calendar UTC conversion; photo files and attribution; offline asset availability; deep-link cache fallbacks; and service-worker isolation from other apps and map tiles.

`node --check` passed for application modules and the service worker. The static ICS file was compared with the data-generated calendar.

## Browser checks

Chrome responsive frame sizes: **320×740, 390×844, 768×1024, 1024×768, 1440×900, 844×390**. These are browser viewport checks, not tests on six physical devices. Each viewport had no horizontal content overflow, no broken local image, and no unnamed visible button. The inner document width excludes the browser's 15-pixel scrollbar.

Verified interactions:

- Day selection updates the timetable, route and URL.
- Timeline, map-only and overview views work; overview has all three days.
- Day 3 displays the protected 14:56–19:20 train and the 14:05 station arrival.
- Transfer detail shows all waiting/drive/slack components and the correct Google Maps route URL.
- Real map tiles render; map controls and stop details work.
- Close Cicada/Tamarind markers expand to separate, correctly clickable places.
- Checklist and Thai notes persist through a frame reload; test values were cleared afterward.
- Local images render, including the correct Tamarind article photograph.
- The cache-ready status appears after installation.
- The static calendar download was observed in Chrome; the downloaded file contains two events and the correct four UTC start/end timestamps.
- All-days map colours are labelled, and opening Cicada from the combined view correctly selects its Sunday visit context.
- Source links were checked. Two obsolete 404 links were replaced with confirmed working primary pages/documents; Booking.com returns its usual 202 response in automated retrieval.

## Corrections made during QA

- Replaced an initial basemap provider that rendered an API-key notice with normal OSM tiles.
- Clustered close map markers to prevent taps opening the neighbouring market.
- Corrected an unrelated generic header image on the TAT page to the actual Tamarind article photograph.
- Adjusted small-phone title wrapping, countdown, copy size, button targets and map height.
- Fixed overview deep-link initialization, modal focus return and the all-days legend/reset.
- Kept a static calendar download alongside the data generator for browser compatibility.

## Practical limits

Travel time is a labelled planning estimate, not live traffic. Map backgrounds and external links need connectivity. Geolocation depends on browser permission and signal. Offline fallback behavior is covered by service-worker tests; a physical-device offline journey and live Grab/Bolt wait times were not tested. Calendar import behavior ultimately depends on the calendar app.
