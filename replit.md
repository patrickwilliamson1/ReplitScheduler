# HVAC Scheduler Widget

## Overview

This is a Flask-based web application for managing HVAC (Heating, Ventilation, and Air Conditioning) scheduling. The application provides a user-friendly interface for creating, viewing, and managing HVAC schedule events with support for both calendar and list views. It's designed as a widget that can be embedded or used standalone for automated HVAC system control.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a traditional Flask MVC architecture with a SQLite database backend and modern frontend components. The system is designed to be lightweight and easily deployable while providing a rich user interface for schedule management.

### Backend Architecture
- **Framework**: Flask web framework with JSON file storage
- **Data Storage**: JSON files (user_schedule_recipe.json) for persistent data
- **Models**: Schedule objects in JSON format with full HVAC configuration
- **API**: RESTful endpoints for schedule CRUD operations

### Frontend Architecture
- **UI Framework**: Bootstrap 5 with dark theme
- **Calendar Component**: FullCalendar library for interactive scheduling
- **JavaScript Architecture**: Modular class-based approach with separate view controllers
- **Styling**: Custom CSS with CSS variables for theming

## Key Components

### Backend Components

1. **app_simple.py** - Main Flask application with JSON file storage and routing
2. **main.py** - Application entry point for development server
3. **user_schedule_recipe.json** - JSON data storage file
4. **device_config.json** - Device configuration including timezone settings

### Frontend Components

1. **templates/index.html** - Main HTML template with Bootstrap UI
2. **static/css/styles.css** - Custom styling with dark theme variables
3. **static/js/scheduler.js** - Main application controller
4. **static/js/calendar-view.js** - Calendar view implementation
5. **static/js/list-view.js** - List view implementation

### Data Schema

The application uses JSON-based data storage with the following structure:

- **Primary Fields**: id, event_name, repeat_frequency, start_time, end_time
- **Configuration**: schedule_type, settings (object), time_setting
- **Scheduling**: days_of_week (array), exclude_dates (array), is_default
- **Metadata**: version, created_at, updated_at

This flexible schema supports multiple schedule types (thermostat, humidistat, lighting) and various repeat patterns (daily, weekly, custom, never).

## Data Flow

1. **User Interaction**: Users interact through Bootstrap UI components
2. **Frontend Processing**: JavaScript controllers handle view logic and API calls
3. **API Layer**: Flask routes process requests and interact with JSON storage
4. **File Operations**: Direct JSON file read/write for data persistence
5. **Response Rendering**: JSON API responses or template rendering for initial load

The application supports both real-time calendar manipulation and list-based schedule management, with automatic synchronization between views.

## External Dependencies

### Frontend Dependencies (CDN-based)
- **Bootstrap 5.3.0**: UI framework and styling
- **Font Awesome 6.4.0**: Icon library
- **FullCalendar 6.1.8**: Calendar component for schedule visualization

### Backend Dependencies
- **Flask**: Web framework
- **Flask-SQLAlchemy**: Database ORM
- **Werkzeug**: WSGI utilities (ProxyFix for deployment)

### Runtime Dependencies
- Python 3.x runtime environment
- SQLite database (default) or PostgreSQL (configurable)

## Deployment Strategy

The application is configured for flexible deployment:

### Development Setup
- Uses SQLite database with file-based storage
- Debug mode enabled via main.py entry point
- Environment variables for configuration

### Production Considerations
- **Database**: Configurable via DATABASE_URL environment variable
- **Security**: Session secret from SESSION_SECRET environment variable
- **Proxy Handling**: ProxyFix middleware for reverse proxy deployments
- **Connection Management**: Database connection pooling with health checks

### Configuration Options
- **Database URL**: Supports PostgreSQL, MySQL, or SQLite
- **Session Security**: Configurable secret key
- **Proxy Setup**: X-Forwarded-Proto and X-Forwarded-Host support

The application includes proper logging configuration and database initialization on startup, making it suitable for containerized deployments or traditional server hosting.

### Default Data
The system automatically creates a default "Unoccupied" schedule on first run, ensuring the application has baseline functionality immediately after deployment.

## Recent Changes (July 25, 2025)

### Form Restructuring
- **Time/Date Fields**: Separated time inputs (type="time") from date inputs for better user experience
- **Schedule Date Range**: Added separate start/end date fields for schedule validity periods
- **Field Organization**: Moved time fields below time setting, reorganized form flow for better usability
- **Never Ending**: Updated checkbox to control schedule end date instead of event end time

### Calendar Integration
- **Event Creation**: Updated drag-and-drop event creation to work with new form structure
- **Event Editing**: Fixed event clicking to allow editing start/end times for specific dates
- **Drag Update**: Modified event dragging to properly update schedule with complete data structure

### List View Simulation
- **Schedule Timeline**: Implemented 7-day schedule simulation showing when events will occur
- **Unoccupied Periods**: Shows unoccupied settings during gaps between scheduled events
- **Real-time Status**: Displays current active schedule and upcoming events with time calculations
- **Event Status**: Visual indicators for active, upcoming, and past events

### Unoccupied Settings Management
- **Global Access**: Added unoccupied settings button to both calendar and list views
- **Modal Integration**: Unoccupied settings open in same modal with disabled scheduling fields
- **Always Available**: Unoccupied schedule serves as fallback when no other events are active

### Single Event vs Series Editing
- **Edit Scope Modal**: Recurring events show choice between editing single occurrence or entire series
- **Single Event Creation**: "This Event Only" creates separate schedule for specific date modification
- **Series Editing**: "All Events in Series" modifies the original recurring schedule
- **Event Splitting**: Single event instances preserve all original settings and HVAC configurations

### Calendar Interaction Fixes
- **Disabled Auto-Creation**: Removed automatic event creation on calendar clicks/selections
- **Manual Event Creation**: Events only created through modal form submission
- **Duplicate Prevention**: Added deduplication logic to prevent multiple events for same schedule/date
- **Click vs Drag**: Eliminated accidental event creation from simple calendar interactions

### UI Improvements (July 25, 2025)
- **Header Button Redesign**: Replaced "Add Event" dropdown with three individual buttons: Export, Add Event, Edit Unoccupied
- **Dynamic Edit Current Setting**: "Edit Current Setting" button now edits whichever schedule is currently active based on real-time status
- **Modal Title Updates**: Changed "Edit Event" to "Edit Current Setting" for better user clarity
- **Contextual Editing**: Edit Current Setting button intelligently opens either direct edit or edit scope modal based on schedule type
- **Never Repeat Option**: Added "Never (One-time)" repeat frequency that hides schedule end date and simplifies start date label to "Date"
- **Full 24-Hour Calendar**: Updated calendar to show complete 24-hour timeline (00:00-24:00) with 6am scroll default
- **Complete Unoccupied Coverage**: Fixed unoccupied period generation to cover entire day instead of just business hours

### Excluded Dates Management (July 25, 2025)
- **Excluded Dates Section**: Added collapsible section in event form showing excluded dates for recurring schedules
- **Visual Date Management**: Display excluded dates with formatted date display and remove buttons
- **Instant UI Updates**: Excluded dates remove immediately from form when X button clicked for instant feedback
- **Minimized by Default**: Excluded dates section starts collapsed to reduce form clutter
- **Automatic Visibility**: Section only shows for recurring schedules, automatically hidden for one-time events
- **Error Recovery**: If API call fails, excluded dates are restored to prevent data loss

### Overlap Prevention (July 25, 2025)
- **Removed Automatic Resolution**: Eliminated complex automatic overlap resolution logic that was causing issues
- **Manual Conflict Detection**: System now detects overlapping schedules and prevents creation with clear error message
- **User-Controlled Resolution**: Users must manually remove or modify conflicting schedules before creating overlapping ones
- **Simplified Workflow**: Clear feedback tells users exactly which schedule conflicts and requires attention
- **Duplicate Prevention**: Enhanced similar schedule detection to prevent accidental duplicates within 5-minute windows
- **Drag Overlap Prevention**: Fixed drag operations to check for overlaps before allowing position changes
- **Enhanced Time Parsing**: Improved time calculation to handle both ISO datetime and time-only formats
- **Complete Overlap Blocking**: Both event creation and drag operations now properly prevent overlapping schedules
- **Smart Overlap Prevention**: Using FullCalendar's eventOverlap function to allow overlapping with unoccupied events while preventing overlaps between occupied schedules
- **Priority-based Overlaps**: Unoccupied events can be overlapped by occupied events, maintaining scheduling hierarchy
- **Manual Overlap Resolution**: After moving events, system detects overlapping schedules and notifies user with specific event names that need manual cleanup
- **User-Controlled Conflict Handling**: Clear warning messages identify exactly which schedules conflict, allowing users to manually resolve overlaps as needed

### Codebase Cleanup (July 27, 2025)
- **Removed Unused Files**: Deleted app.py, storage.py, time-utils.js, timezone-utils.js, test-scheduler.js, and action-handler.js
- **Simplified Architecture**: Now using only app_simple.py for JSON file operations and action-handler-simple.js for all logic
- **Updated Documentation**: Modified replit.md to reflect current JSON-only architecture
- **Multi-day One-time Events**: Fixed one-time events spanning multiple days to display as separate daily events instead of single long events
- **Embedded Time Functions**: All time calculation functions now embedded directly in action-handler-simple.js
- **API Persistence**: Every action immediately saves to backend via API call, no RAM-only storage

### Centralized Action Handler Architecture (July 27, 2025)
- **Complete Redesign**: Rebuilt entire architecture around centralized ActionHandler class following user requirements
- **Exact Sequence Implementation**: user action → singleton/series check → event case → date logic → overlap check → refresh
- **Clean Event Cases**: DRAG_ONE_TIME, DRAG_SINGLE_FROM_SERIES, DRAG_WHOLE_SERIES, RESIZE_ONE_TIME, RESIZE_SINGLE_FROM_SERIES, RESIZE_WHOLE_SERIES
- **Eliminated Complex Logic**: Removed all old drag/resize methods, overlap resolution, and scattered handling code
- **Single Point of Control**: All user actions (create, update, delete, drag, resize) flow through ActionHandler.handleUserAction()
- **JSON Memory Management**: ActionHandler maintains schedules in memory, saves to file, checks overlaps, refreshes views
- **Manual Overlap Resolution**: System detects and warns about overlaps but requires manual user resolution as requested
- **Error Recovery**: Built-in revert functionality when actions fail, with proper error handling throughout
- **Simple Case Logic**: Each action type has clearly defined logic for handling dates, splitting schedules, creating/modifying events

### Export/Import Functionality (July 27, 2025)
- **Fixed Export**: Changed from non-existent `/api/recipe` endpoint to direct JSON export of schedules data
- **Export Format**: Includes schedules array and metadata (version, export timestamp, total count)
- **Import Feature**: Added import button and file upload functionality with comprehensive validation
- **Import Validation**: Checks for required fields, valid formats, proper date/time patterns, and schedule type settings
- **Validation Rules**: Validates all 4 required values (start_date, end_date, start_time, end_time) with format checking
- **Settings Validation**: Type-specific validation for thermostat, lighting, and humidistat settings with range checks
- **Error Reporting**: Detailed error messages showing which schedule and field has issues during import
- **Replace Strategy**: Import replaces all existing schedules after user confirmation
- **Unoccupied Preservation**: Always ensures unoccupied default schedule exists after import

### Drag "Just This Event" Fix (July 27, 2025)
- **Fixed Date Display Issue**: Resolved timezone bug where single events created from recurring series displayed on wrong dates
- **Exact Date Parsing**: Changed from `new Date(string)` to `new Date(year, month, day)` construction to avoid UTC timezone issues
- **Original Date Tracking**: Added originalDate property to calendar events to properly track which date an event was originally scheduled for
- **Correct Behavior**: "Just This Event" now creates single events on the original scheduled date with the new dragged time, exactly as expected
- **Debug Enhancement**: Added comprehensive logging to track date calculations and verify correct behavior

### JSON 4-Value Structure Implementation (July 27, 2025)
- **Mandatory 4-Value Structure**: ALL schedules must have start_date, end_date, start_time, end_time
- **Consistent Date Format**: start_date/end_date use YYYY-MM-DD format for all schedule types
- **Special "never" Case**: end_date can be "never" for infinite duration schedules (especially unoccupied default)
- **Consistent Time Format**: start_time/end_time use HH:MM format for all schedule types
- **Date Range Logic**: Overlap detection uses start_date/end_date to determine valid date ranges, with "never" handled as infinite
- **Calendar Population**: Events generated based on date ranges and days_of_week patterns
- **Simplified Overlap Detection**: Check date range overlap first, then time overlap within matching dates
- **Simplified Repeat Options**: Removed "daily" and "weekly" options - only "never" (one-time) and "custom" (with days_of_week) remain

### Day Calculation and Error Message Improvements (July 27, 2025)
- **Fixed Day-of-Week Calculation**: Replaced locale-dependent date formatting with reliable getDay() method to prevent timezone issues
- **Enhanced Error Messages**: Overlap detection now shows both the conflicting event name AND the specific date of conflict
- **Clear Conflict Information**: Error messages display format like "conflicts with 'Event Name' on Thu Jul 31 (03:45-09:00)"
- **Prevents User Confusion**: Addresses issue where event names don't match their actual dates (e.g., "Occupied (Jul 30)" running on July 31st)
- **Fixed Date Parsing**: Corrected timezone issue in event name generation by using local date components instead of Date constructor
- **One-Time Event Drag Fix**: Fixed bug where one-time events were incorrectly treated as recurring events during drag, now properly uses dragWholeSchedule

### HVAC System Mode and Combined Schedule Type (July 27, 2025)
- **New Schedule Type**: Added "thermostat+humidistat" schedule type that combines HVAC and humidity controls
- **Conditional Temperature Setpoints**: Temperature setpoints now shown conditionally based on system mode:
  - Heat mode: Only shows heat setpoint
  - Cool mode: Only shows cool setpoint
  - Auto mode: Shows both heat and cool setpoints with validation
- **Heat < Cool Validation**: Added validation requiring heat setpoint to be less than cool setpoint in Auto mode
- **Minimum Deadband**: Enforces 2°F minimum difference between heat and cool setpoints
- **Removed Fields from Thermostat**: Removed humidity_setpoint and ventilation_rate from basic thermostat type
- **Combined Type UI**: New combined type has separate form fields for both HVAC and humidity settings
- **Import Validation**: Updated import validation to handle new schedule type and enforce all validations
- **List View Updates**: Updated formatScheduleSettings to show appropriate temperature values based on system mode
- **Calendar Color**: Added teal/cyan color (#17a2b8) for the new thermostat+humidistat schedule type

### Clear All Schedules Enhancement (July 27, 2025)
- **Clear All Button**: Added red "Clear All" button to header toolbar for removing all schedules
- **Pre-Import Clearing**: Import functionality now automatically clears all existing schedules before importing new ones
- **Safe Clearing**: Clear operations preserve the unoccupied default schedule to maintain system baseline
- **Confirmation Dialogs**: Both manual clear and import operations require user confirmation before proceeding
- **Enhanced Import Process**: Import now generates unique IDs and timestamps for imported schedules automatically
- **Error Handling**: Added comprehensive error handling and user feedback for clear and import operations

### Date Display Fix in Overlap Error Messages (July 27, 2025)
- **Fixed Date Parsing**: Corrected timezone issue in overlap error messages that showed wrong day of week
- **UTC Date Issue**: Replaced `new Date(dateString)` which creates UTC dates with proper local date parsing
- **Correct Pattern**: Now uses `new Date(year, month - 1, day)` to create dates in local timezone
- **Accurate Error Messages**: Overlap conflicts now show correct day of week (e.g., "Sun, Jul 27" instead of "Sat, Jul 26")
- **Applied Fix**: Updated all three overlap error message locations (create, update, and single event creation)