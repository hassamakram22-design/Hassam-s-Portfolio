"""
Astro Portfolio Chatbot
Flask + OpenRouter
Production-ready for Render and local development.
"""

import logging
import os
import time
from collections import defaultdict, deque
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from knowledge import build_system_prompt

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

# OpenRouter configuration. Keep the real API key in Render Environment
# Variables (or in a local .env file); never commit it to GitHub.
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini").strip()

SITE_URL = os.getenv("SITE_URL", "http://127.0.0.1:10000").strip()
SITE_NAME = os.getenv("SITE_NAME", "Hassam's Portfolio").strip()

# Render supplies PORT automatically. The fallback is for local testing.
PORT = int(os.getenv("PORT", "10000"))

# If the frontend and API are served by this same Flask app, CORS is not
# needed. These origins are useful if you later host the frontend separately.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://127.0.0.1:10000,http://localhost:10000,"
        "http://127.0.0.1:5000,http://localhost:5000,"
        "http://127.0.0.1:5500,http://localhost:5500",
    ).split(",")
    if origin.strip()
]

MAX_HISTORY = 12
MAX_MESSAGE_CHARS = 1000
RATE_LIMIT = 20
RATE_WINDOW = 60

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("astro")

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024  # 64 KB request limit

CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

SYSTEM_PROMPT = build_system_prompt()
_hits = defaultdict(deque)


def rate_limited(ip: str) -> bool:
    now = time.time()
    hits = _hits[ip]

    while hits and now - hits[0] > RATE_WINDOW:
        hits.popleft()

    if len(hits) >= RATE_LIMIT:
        return True

    hits.append(now)
    return False


def clean_messages(raw):
    """Validate and trim the conversation history."""
    if not isinstance(raw, list):
        return None

    messages = []
    for message in raw:
        if not isinstance(message, dict):
            continue

        role = message.get("role")
        content = message.get("content")

        if (
            role in ("user", "assistant")
            and isinstance(content, str)
            and content.strip()
        ):
            messages.append({
                "role": role,
                "content": content.strip()[:MAX_MESSAGE_CHARS],
            })

    messages = messages[-MAX_HISTORY:]
    if not messages or messages[-1]["role"] != "user":
        return None

    return messages


@app.get("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename):
    return send_from_directory(PUBLIC_DIR, filename)


@app.get("/api/health")
def health():
    return jsonify(
        status="ok",
        assistant="Astro",
        model=MODEL,
        key_configured=bool(API_KEY),
    )


@app.post("/api/chat")
def chat():
    if not API_KEY:
        log.error("OPENROUTER_API_KEY is not configured.")
        return jsonify(
            error="Astro isn't configured yet. The server API key is missing."
        ), 500

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Please send a valid JSON request."), 400

    messages = clean_messages(data.get("messages"))
    if messages is None:
        return jsonify(
            error="Please send a valid message to start the chat."
        ), 400

    # Render runs behind a proxy and supplies X-Forwarded-For.
    ip = (
        request.headers.get("X-Forwarded-For")
        or request.remote_addr
        or "unknown"
    ).split(",")[0].strip()

    if rate_limited(ip):
        return jsonify(
            error="You're sending messages too fast. Please wait."
        ), 429

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages,
        ],
        "temperature": 0.5,
        "max_tokens": 500,
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
    }

    try:
        response = requests.post(
            OPENROUTER_URL,
            json=payload,
            headers=headers,
            timeout=(10, 45),
        )
    except requests.Timeout:
        log.warning("OpenRouter request timed out.")
        return jsonify(error="Request timed out. Please try again."), 504
    except requests.RequestException:
        log.exception("OpenRouter connection failed.")
        return jsonify(error="Couldn't connect to the AI service."), 502

    if response.status_code != 200:
        log.error(
            "OpenRouter returned HTTP %s: %s",
            response.status_code,
            response.text[:500],
        )

        if response.status_code in (401, 403):
            message = "API key rejected. Check the Render environment variable."
        elif response.status_code == 402:
            message = "AI credits are unavailable."
        elif response.status_code == 429:
            message = "AI service is busy. Try again shortly."
        else:
            message = "Something went wrong with the AI service. Please try again."

        return jsonify(error=message), 502

    try:
        result = response.json()
        reply = result["choices"][0]["message"]["content"]
        if not isinstance(reply, str):
            raise TypeError("OpenRouter reply content was not text.")
        reply = reply.strip()
    except (KeyError, IndexError, TypeError, ValueError):
        log.exception("Unexpected OpenRouter response.")
        return jsonify(error="Received an unexpected AI response."), 502

    return jsonify(reply=reply or "Please rephrase your message.")


if __name__ == "__main__":
    if not API_KEY:
        log.warning("OPENROUTER_API_KEY is not configured.")

    log.info("Astro starting on port %s", PORT)
    app.run(host="0.0.0.0", port=PORT, debug=False)
