# HVAC Scheduler - Complete File Export Guide

This document contains all the essential files needed to recreate the HVAC Scheduler project.

## Project Structure
```
hvac-scheduler/
├── app_simple.py              # Main Flask application
├── main.py                    # Application entry point
├── templates/
│   └── index.html            # Main HTML template
├── static/
│   ├── css/
│   │   └── styles.css        # Custom styling
│   └── js/
│       ├── scheduler.js      # Main scheduler logic
│       ├── action-handler-simple.js  # Action handling
│       ├── calendar-view.js  # Calendar functionality
│       └── list-view.js      # List view functionality
├── pyproject.toml            # Python dependencies
├── device_config.json        # Device configuration
├── user_schedule_recipe.json # Schedule data storage
└── replit.md                 # Project documentation
```

## Key Files to Download:

### Python Backend:
- `app_simple.py` - Flask application with JSON file storage
- `main.py` - Simple entry point for development

### Frontend:
- `templates/index.html` - Complete HTML interface with Bootstrap
- `static/css/styles.css` - Dark theme styling
- `static/js/scheduler.js` - Main application controller
- `static/js/action-handler-simple.js` - Centralized action handling
- `static/js/calendar-view.js` - FullCalendar integration
- `static/js/list-view.js` - Schedule list display

### Configuration:
- `pyproject.toml` - Python dependencies (Flask, etc.)
- `device_config.json` - Timezone and device settings
- `user_schedule_recipe.json` - Current schedule data
- `replit.md` - Complete project documentation

## How to Download:

1. **Individual Files**: Click each file in Replit's file explorer and use "Download" option
2. **GitHub**: Push to a GitHub repository and download as ZIP
3. **Copy Content**: Use the file viewer to copy and paste file contents

## Dependencies:
The project uses these main dependencies (from pyproject.toml):
- Flask (web framework)
- Flask-SQLAlchemy (database ORM)
- Gunicorn (production server)
- Bootstrap 5 (frontend framework, CDN)
- FullCalendar (calendar component, CDN)

## Running the Project:
1. Install Python dependencies: `pip install -r requirements.txt` or use the pyproject.toml
2. Run: `python main.py` for development or `gunicorn main:app` for production
3. Access at `http://localhost:5000`

## Features:
- Complete HVAC scheduling with calendar and list views
- Support for thermostat, lighting, humidistat, and combined schedules
- Drag and drop event editing
- Recurring schedule management with excluded dates
- Export/import functionality
- Overlap detection and manual conflict resolution
- JSON-based data storage for easy ThingsBoard integration