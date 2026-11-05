
# Hassam-s-Portfolio
=======
# Astro: portfolio chatbot (Python 3.11.9 + OpenRouter)

## 1. Add your remaining portfolio files
Put your own `script.js` and your `assets/` folder inside `public/` (next to `index.html`).
`index.html`, `style.css`, `chatbot.css` and `chatbot.js` are already there.

## 2. Set up (VS Code terminal)
```powershell
py -3.11 -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
```
Open `.env` and paste your OpenRouter key (https://openrouter.ai/keys).
In VS Code choose the `.venv` interpreter (Ctrl+Shift+P > "Python: Select Interpreter").

## 3. Run
```powershell
python app.py
```
Open http://127.0.0.1:5000 (or press F5 in VS Code: "Run Astro (Flask)").

## Customise
- `knowledge.py`: everything Astro knows. Fill in `CONTACT` (email, Facebook, Instagram, LinkedIn); blank entries are never shared.
- `public/chatbot.js` > `CONFIG`: reminder timing (default every 8-9 minutes), API URL.
- `.env`: `OPENROUTER_MODEL` to switch models.

