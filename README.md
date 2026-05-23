# Custom Transaction Logger

A fresh, customizable transaction logger for a new user. It is separate from the original `E:\Transaction Logger Site` folder and stores its own data in `data/state.json`.

## Run

1. Install Node.js 18 or newer if it is not already installed.
2. Double-click `start_server.bat`, or run:

```powershell
npm start
```

3. Open the local URL shown in the terminal:

```text
http://127.0.0.1:8500
```

For another tester on the same Wi-Fi, keep the server window open and share the `Network testing URL` printed by the server. It will look like:

```text
http://192.168.x.x:8500
```

Windows may ask to allow Node.js through the firewall the first time.

## Customize

Open `Settings` in the app to change:

- app name, user name, currency symbol, and drawer label
- drawer balance and bank accounts
- credit categories, including which one is used for tuition/student credits
- debit categories
- student names and optional tuition cycles

## Testing Tools

In `Settings`, use:

- `Load demo data` for a quick tester-ready sample
- `Reset blank` for a clean new-user state
- `Export JSON` and `Import JSON` to move test data between machines

## GitHub Pages Hosting

This repo includes a GitHub Pages workflow at `.github/workflows/pages.yml`.
When pushed to GitHub, it deploys the static app from the `public` folder.

GitHub Pages mode uses browser local storage, so each tester has their own test data in their own browser. Use `Export JSON` and `Import JSON` to move a test dataset between people.

For shared live data, run the Node server version instead.

## Data

The app writes data only inside this new app folder:

```text
data/state.json
```

The original transaction logger folder is not read from or written to by this app.
