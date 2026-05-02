# Article Reader

A small local web app that extracts readable article text from a pasted URL and reads it aloud with browser speech synthesis.

## Run

```powershell
node server.mjs
```

Then open `http://localhost:4173`.

For the easiest Windows launch, double-click `START ARTICLE READER.cmd`.

Try the built-in sample URL after the app opens:

```text
http://localhost:4173/sample-article.html
```

## Notes

- The server fetches the article because browsers often block direct article requests with CORS.
- The voice list comes from your browser and operating system.
- Some publishers block automated article fetching or render the article text only after JavaScript runs.
- The app filters common boilerplate, navigation, ads, and short section-number fragments before reading.
