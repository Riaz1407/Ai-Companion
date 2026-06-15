# WakuWaku Anime Catgirl Chat Companion 🐱✨

An interactive web application featuring an anime-style AI companion. This project leverages the Google Gemini API for natural conversation and the Web Speech API for voice synthesis with synchronized lip-sync animations.

## 🚀 Features

- **Intelligent Chat:** Engaging conversations powered by Gemini.
- **Voice & Lip-Sync:** Real-time mouth animations that sync with the browser's Text-to-Speech.
- **High-Quality Voices:** Automatically filters for premium Google TTS voices when available.
- **Advanced UI:** Includes a robust typewriter effect that correctly handles emojis and complex characters using `Intl.Segmenter`.
- **Session Management:** Unique session IDs to maintain conversation context during a single visit.

## 🛠️ Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Riaz1407/companion-python.git
   cd companion-python
   ```

2. **Install requirements:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_google_ai_studio_key_here
   ```

4. **Launch:**
   ```bash
   python app.py
   ```