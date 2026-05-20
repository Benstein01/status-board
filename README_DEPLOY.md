# Status Board split-file deployment

This package keeps the current dashboard behavior but splits the code into smaller files.

## Files

- `index.html` — page shell only
- `assets/styles.css` — all CSS
- `assets/config.js` — Apps Script URL
- `assets/js/api.js` — JSONP API calls
- `assets/js/lock-page.js` — pattern unlock logic
- `assets/js/components.js` — current dashboard renderer
- `assets/js/admin-actions.js` — text/audio command actions
- `assets/js/app.js` — app startup and navigation
- `assets/js/utils.js` — helper functions

## GitHub upload

1. Open your `status-board` repo on GitHub.
2. Upload `index.html` and the full `assets` folder.
3. Commit the changes.
4. Wait for GitHub Pages to redeploy.
5. Test the public page.

## Local test option

From this folder:

```bash
python3 -m http.server 8088 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8088
```
