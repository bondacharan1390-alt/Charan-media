# Charan-media

**Charan Media** is a modern, responsive Web Application and FastAPI backend for downloading and converting audio and video (MP3 & MP4) from YouTube and other media platforms.

---

## 🚀 Features

- **MP3 & MP4 Downloads**: High-speed audio extraction and video downloads.
- **URL Analysis**: Real-time media information analysis before downloading.
- **FastAPI Backend**: Clean, asynchronous API endpoints.
- **Modern Responsive UI**: Clean interface built with modern HTML5, CSS3, and JavaScript.
- **Cross-Platform**: Easy startup scripts for Windows (`start_server.bat` / `run.bat`).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, yt-dlp, FFmpeg
- **Frontend**: HTML5, Vanilla CSS, JavaScript
- **Packaging/Scripts**: Windows Batch scripts

---

## 📦 Getting Started

### 1. Prerequisites
- Python 3.10 or higher
- FFmpeg installed and added to PATH (optional, for audio conversions)

### 2. Setup Environment
Clone the repository and install dependencies:
```bash
git clone https://github.com/bondacharan1390-alt/Charan-media.git
cd Charan-media
python -m venv .venv
# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in any required keys:
```bash
cp .env.example .env
```

### 4. Running the Application
Run using the provided batch file (Windows):
```cmd
start_server.bat
```
Or directly via Python:
```bash
python server.py
```

Then open your browser at:
`http://localhost:8000`

---

## 📄 License
MIT License
