import os
import json
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "hvac-scheduler-dev-key")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# JSON file path
SCHEDULES_FILE = 'user_schedule_recipe.json'

def load_schedules():
    """Load schedules from JSON file"""
    try:
        with open(SCHEDULES_FILE, 'r') as f:
            content = json.load(f)
            # Handle both old single schedule format and new schedules array format
            if isinstance(content, dict) and 'schedules' not in content:
                # Old format - single schedule object, convert to new format
                if 'event_name' in content:
                    # This is a single schedule, wrap it in the expected structure
                    content['id'] = '1'  # Give it an ID
                    return {
                        "schedules": [content],
                        "metadata": {
                            "version": "1.0",
                            "created_at": "2025-07-25T21:30:00.000000",
                            "updated_at": "2025-07-25T21:30:00.000000"
                        }
                    }
            return content
    except FileNotFoundError:
        # Create default structure with unoccupied schedule
        default_data = {
            "schedules": [
                {
                    "id": "unoccupied-default",
                    "event_name": "Unoccupied",
                    "schedule_type": "thermostat",
                    "repeat_frequency": "daily",
                    "time_setting": "all_day",
                    "start_time": None,
                    "end_time": None,
                    "settings": {
                        "system_mode": "Heat",
                        "heat_setpoint": "65",
                        "cool_setpoint": "78", 
                        "fan": "auto",
                        "humidity_setpoint": "45",
                        "ventilation_rate": "0"
                    },
                    "days_of_week": [],
                    "is_default": True,
                    "exclude_dates": []
                }
            ],
            "metadata": {
                "version": "1.0",
                "created_at": "2025-07-25T21:30:00.000000",
                "updated_at": "2025-07-25T21:30:00.000000"
            }
        }
        save_schedules(default_data)
        return default_data

def save_schedules(data):
    """Save schedules to JSON file"""
    with open(SCHEDULES_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/')
def index():
    """Main widget interface"""
    return render_template('index.html')

@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    """Get all schedule data"""
    try:
        data = load_schedules()
        return jsonify(data)
    except Exception as e:
        logging.error(f"Error getting schedules: {str(e)}")
        return jsonify({'error': 'Failed to retrieve schedules'}), 500

@app.route('/api/schedules', methods=['POST'])
def save_schedules_data():
    """Save complete schedule data"""
    try:
        data = request.get_json()
        save_schedules(data)
        return jsonify({'success': True, 'message': 'Schedules saved successfully'})
    except Exception as e:
        logging.error(f"Error saving schedules: {str(e)}")
        return jsonify({'error': 'Failed to save schedules'}), 500

@app.route('/api/device/config', methods=['GET'])
def get_device_config():
    """Get device configuration including timezone"""
    try:
        with open('device_config.json', 'r') as f:
            config = json.load(f)
        return jsonify(config)
    except FileNotFoundError:
        # Default configuration
        config = {
            "device": {
                "timezone": "America/New_York",
                "location": {"name": "Default Location", "latitude": 40.7128, "longitude": -74.0060},
                "id": "hvac-device-default",
                "name": "HVAC Controller"
            }
        }
        return jsonify(config)
    except Exception as e:
        logging.error(f"Error getting device config: {str(e)}")
        return jsonify({'error': 'Failed to get device configuration'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)