/**
 * HVAC Scheduler Widget - Display Controller
 * SIMPLIFIED: Only displays JSON data and passes user actions to ActionHandler
 * No business logic - ActionHandler handles all create/update/delete/drag/resize operations
 */
class HVACScheduler {
    constructor() {
        this.currentView = 'calendar';
        this.schedules = [];
        this.currentEditingId = null;
        this.currentStatus = null;
        this.modalOpening = false;
        this.savingEvent = false;
        this.isInitialized = false;
        
        // Initialize centralized action handler
        this.actionHandler = new SimpleActionHandler(this);
        
        // Calgary, AB coordinates for sunrise/sunset calculation
        this.latitude = 51.0447;
        this.longitude = -114.0719;
        
        this.init();
    }
    
    /**
     * Initialize the scheduler application
     */
    async init() {
        this.setupEventListeners();
        this.setupViewToggle();
        this.setupModal();
        
        // Load initial data
        await this.loadSchedules();
        this.calculateCurrentStatus();
        
        // Initialize action handler
        await this.actionHandler.initialize();
        
        // Initialize calendar view
        if (window.CalendarView) {
            this.calendarView = new CalendarView(this);
        }
        
        // Auto-refresh current status every 30 seconds
        setInterval(() => this.calculateCurrentStatus(), 30000);
        
        console.log('HVAC Scheduler initialized');
    }
    
    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Export recipe button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportRecipe();
        });
        
        // Import button
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
        
        // Import file input
        document.getElementById('importFileInput').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.importRecipe(e.target.files[0]);
                e.target.value = ''; // Reset file input
            }
        });
        
        // Add event button
        const addEventBtn = document.getElementById('addEventBtn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent multiple rapid clicks
                if (this.modalOpening) {
                    console.log('Modal already opening, ignoring click');
                    return;
                }
                
                console.log('Opening modal for new event');
                this.openEventModal('occupied'); // Default to occupied
            });
        }
        
        // Edit unoccupied button
        const editUnoccupiedBtn = document.getElementById('editUnoccupiedBtn');
        if (editUnoccupiedBtn) {
            editUnoccupiedBtn.addEventListener('click', () => {
                this.openUnoccupiedSettings();
            });
        }
        
        // Edit current setting button (was unoccupied settings)
        const editCurrentBtn = document.getElementById('unoccupiedSettingsBtn');
        if (editCurrentBtn) {
            editCurrentBtn.addEventListener('click', () => {
                this.editCurrentActiveSetting();
            });
        }
        
        // Clear all schedules button
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.handleClearAllSchedules();
            });
        }
        
        // Window resize handler
        window.addEventListener('resize', () => {
            if (this.calendarView) {
                this.calendarView.resize();
            }
        });
    }
    
    /**
     * Setup view - calendar only
     */
    setupViewToggle() {
        // Set calendar as the only view
        this.currentView = 'calendar';
        const calendarContainer = document.getElementById('calendarViewContainer');
        if (calendarContainer) {
            calendarContainer.classList.remove('d-none');
        }
    }
    
    /**
     * Setup event modal functionality
     */
    setupModal() {
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        const saveBtn = document.getElementById('saveEventBtn');
        const deleteBtn = document.getElementById('deleteEventBtn');
        const repeatSelect = document.getElementById('repeatFrequency');
        const customDaysContainer = document.getElementById('customDaysContainer');
        const neverEndingCheckbox = document.getElementById('neverEnding');
        const endTimeInput = document.getElementById('endTime');
        
        // Show/hide custom days and handle never option based on repeat frequency
        repeatSelect.addEventListener('change', () => {
            const scheduleEndDateContainer = document.querySelector('label[for="scheduleEndDate"]').closest('.col-md-6');
            const scheduleStartDateLabel = document.getElementById('scheduleStartDateLabel');
            const excludedDatesSection = document.getElementById('excludedDatesSection');
            
            if (repeatSelect.value === 'custom') {
                customDaysContainer.classList.remove('d-none');
            } else {
                customDaysContainer.classList.add('d-none');
            }
            
            if (repeatSelect.value === 'never') {
                // Hide schedule end date for one-time events
                scheduleEndDateContainer.style.display = 'none';
                // Change start date label to just "Date"
                scheduleStartDateLabel.textContent = 'Date *';
                // Hide excluded dates section for one-time events
                excludedDatesSection.style.display = 'none';
            } else {
                // Show schedule end date for recurring events
                scheduleEndDateContainer.style.display = 'block';
                // Use full "Schedule Start Date" label
                scheduleStartDateLabel.textContent = 'Schedule Start Date *';
                // Show excluded dates section for recurring events (if it has data)
                const scheduleId = document.getElementById('eventForm').dataset.scheduleId;
                if (scheduleId) {
                    const schedule = this.schedules.find(s => s.id === scheduleId);
                    if (schedule && schedule.exclude_dates && schedule.exclude_dates.length > 0) {
                        excludedDatesSection.style.display = 'block';
                    }
                }
            }
        });
        
        // Handle never ending checkbox
        neverEndingCheckbox.addEventListener('change', () => {
            const scheduleEndDateInput = document.getElementById('scheduleEndDate');
            scheduleEndDateInput.disabled = neverEndingCheckbox.checked;
            if (neverEndingCheckbox.checked) {
                scheduleEndDateInput.value = '';
            }
        });
        
        // Handle time setting changes for sunrise/sunset labels
        const timeSettingSelect = document.getElementById('timeSetting');
        timeSettingSelect.addEventListener('change', () => {
            this.updateTimeLabels(timeSettingSelect.value);
        });
        
        // Handle schedule type changes to show/hide appropriate settings
        const scheduleTypeSelect = document.getElementById('scheduleType');
        scheduleTypeSelect.addEventListener('change', () => {
            this.updateSettingsDisplay(scheduleTypeSelect.value);
        });
        
        // System mode changes for temperature setpoint visibility
        document.getElementById('systemMode').addEventListener('change', (e) => {
            this.updateTemperatureSetpoints(e.target.value);
        });
        
        document.getElementById('systemModeCombined').addEventListener('change', (e) => {
            this.updateTemperatureSetpointsCombined(e.target.value);
        });
        
        // Handle event name validation
        const eventNameInput = document.getElementById('eventName');
        eventNameInput.addEventListener('input', () => {
            if (eventNameInput.value.toLowerCase() === 'unoccupied') {
                eventNameInput.setCustomValidity('Cannot use "Unoccupied" as it is reserved for the default schedule');
                eventNameInput.classList.add('is-invalid');
            } else {
                eventNameInput.setCustomValidity('');
                eventNameInput.classList.remove('is-invalid');
            }
        });
        
        // Save event with double-click prevention
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                console.log('Save button clicked');
                if (!saveBtn.disabled && !this.savingEvent) {
                    this.savingEvent = true;
                    saveBtn.disabled = true;
                    try {
                        await this.saveEvent();
                    } catch (error) {
                        console.error('Error in saveEvent:', error);
                    } finally {
                        this.savingEvent = false;
                        setTimeout(() => {
                            saveBtn.disabled = false;
                        }, 1000);
                    }
                }
            });
        } else {
            console.error('Save button not found');
        }
        
        // Delete event
        deleteBtn.addEventListener('click', () => {
            if (this.currentEditingId) {
                const scheduleData = this.schedules.find(s => s.id === this.currentEditingId);
                if (scheduleData && scheduleData.repeat_frequency && scheduleData.repeat_frequency !== 'never') {
                    // For recurring events, show delete scope modal
                    this.showDeleteScopeModal(scheduleData, this.currentEventDate);
                } else {
                    // Direct delete for non-recurring events
                    this.deleteEvent(this.currentEditingId);
                }
            }
        });
        
        // Reset form when modal is hidden
        modal.addEventListener('hidden.bs.modal', () => {
            this.resetEventForm();
        });
    }
    
    /**
     * Update time input labels based on time setting
     */
    updateTimeLabels(timeSetting) {
        const startLabel = document.getElementById('startTimeLabel');
        const endLabel = document.getElementById('endTimeLabel');
        
        switch(timeSetting) {
            case 'sunrise':
                startLabel.textContent = 'Hours Before Sunrise *';
                endLabel.textContent = 'Hours After Sunrise *';
                break;
            case 'sunset':
                startLabel.textContent = 'Hours Before Sunset *';
                endLabel.textContent = 'Hours After Sunset *';
                break;
            case 'time':
            default:
                startLabel.textContent = 'Start Time *';
                endLabel.textContent = 'End Time *';
                break;
        }
    }
    
    /**
     * Update settings display based on schedule type
     */
    updateSettingsDisplay(scheduleType) {
        // Hide all settings sections first
        document.getElementById('thermostatSettings').style.display = 'none';
        document.getElementById('lightingSettings').style.display = 'none';
        document.getElementById('humidistatSettings').style.display = 'none';
        document.getElementById('thermostatHumidistatSettings').style.display = 'none';
        
        // Show the appropriate settings section
        switch(scheduleType) {
            case 'thermostat':
                document.getElementById('thermostatSettings').style.display = 'block';
                // Update temperature setpoints based on system mode
                this.updateTemperatureSetpoints(document.getElementById('systemMode').value);
                break;
            case 'thermostat+humidistat':
                document.getElementById('thermostatHumidistatSettings').style.display = 'block';
                // Update temperature setpoints for combined mode
                this.updateTemperatureSetpointsCombined(document.getElementById('systemModeCombined').value);
                break;
            case 'lighting':
                document.getElementById('lightingSettings').style.display = 'block';
                break;
            case 'humidistat':
                document.getElementById('humidistatSettings').style.display = 'block';
                break;
        }
    }
    
    /**
     * Update temperature setpoint visibility based on system mode
     */
    updateTemperatureSetpoints(systemMode) {
        const coolDiv = document.getElementById('coolSetpointDiv');
        const heatDiv = document.getElementById('heatSetpointDiv');
        const coolInput = document.getElementById('coolSetpoint');
        const heatInput = document.getElementById('heatSetpoint');
        
        // Reset visibility
        coolDiv.style.display = 'none';
        heatDiv.style.display = 'none';
        
        switch(systemMode) {
            case 'Cool':
                coolDiv.style.display = 'block';
                coolInput.required = true;
                heatInput.required = false;
                break;
            case 'Heat':
                heatDiv.style.display = 'block';
                heatInput.required = true;
                coolInput.required = false;
                break;
            case 'Auto':
                coolDiv.style.display = 'block';
                heatDiv.style.display = 'block';
                coolInput.required = true;
                heatInput.required = true;
                break;
            case 'Off':
                coolInput.required = false;
                heatInput.required = false;
                break;
        }
    }
    
    /**
     * Update temperature setpoint visibility for combined mode
     */
    updateTemperatureSetpointsCombined(systemMode) {
        const coolDiv = document.getElementById('coolSetpointDivCombined');
        const heatDiv = document.getElementById('heatSetpointDivCombined');
        const coolInput = document.getElementById('coolSetpointCombined');
        const heatInput = document.getElementById('heatSetpointCombined');
        
        // Reset visibility
        coolDiv.style.display = 'none';
        heatDiv.style.display = 'none';
        
        switch(systemMode) {
            case 'Cool':
                coolDiv.style.display = 'block';
                coolInput.required = true;
                heatInput.required = false;
                break;
            case 'Heat':
                heatDiv.style.display = 'block';
                heatInput.required = true;
                coolInput.required = false;
                break;
            case 'Auto':
                coolDiv.style.display = 'block';
                heatDiv.style.display = 'block';
                coolInput.required = true;
                heatInput.required = true;
                break;
            case 'Off':
                coolInput.required = false;
                heatInput.required = false;
                break;
        }
    }
    
    /**
     * Gather settings based on schedule type
     */
    gatherScheduleSettings(scheduleType) {
        let settings = {};
        
        switch(scheduleType) {
            case 'thermostat':
                settings = {
                    system_mode: document.getElementById('systemMode').value,
                    fan: document.getElementById('fanSetting').value
                };
                // Only include relevant setpoints based on system mode
                const systemMode = document.getElementById('systemMode').value;
                if (systemMode === 'Cool' || systemMode === 'Auto') {
                    settings.cool_setpoint = document.getElementById('coolSetpoint').value || null;
                }
                if (systemMode === 'Heat' || systemMode === 'Auto') {
                    settings.heat_setpoint = document.getElementById('heatSetpoint').value || null;
                }
                break;
                
            case 'thermostat+humidistat':
                settings = {
                    system_mode: document.getElementById('systemModeCombined').value,
                    fan: document.getElementById('fanSettingCombined').value,
                    humidity_low_setpoint: document.getElementById('humidityLowSetpointCombined').value || null,
                    humidity_high_setpoint: document.getElementById('humidityHighSetpointCombined').value || null
                };
                // Only include relevant setpoints based on system mode
                const systemModeCombined = document.getElementById('systemModeCombined').value;
                if (systemModeCombined === 'Cool' || systemModeCombined === 'Auto') {
                    settings.cool_setpoint = document.getElementById('coolSetpointCombined').value || null;
                }
                if (systemModeCombined === 'Heat' || systemModeCombined === 'Auto') {
                    settings.heat_setpoint = document.getElementById('heatSetpointCombined').value || null;
                }
                break;
                
            case 'lighting':
                settings = {
                    lighting_status: document.getElementById('lightingStatus').value
                };
                break;
                
            case 'humidistat':
                settings = {
                    humidity_low_setpoint: document.getElementById('humidityLowSetpoint').value || null,
                    humidity_high_setpoint: document.getElementById('humidityHighSetpoint').value || null
                };
                break;
        }
        
        // Remove null/empty values
        Object.keys(settings).forEach(key => {
            if (settings[key] === null || settings[key] === '') {
                delete settings[key];
            }
        });
        
        return settings;
    }
    
    /**
     * Calculate sunrise time for a given date (Calgary, AB)
     */
    calculateSunrise(date) {
        return this.calculateSunEvent(date, true);
    }
    
    /**
     * Calculate sunset time for a given date (Calgary, AB)
     */
    calculateSunset(date) {
        return this.calculateSunEvent(date, false);
    }
    
    /**
     * Calculate sun event (sunrise/sunset) for Calgary, AB coordinates
     */
    calculateSunEvent(date, isSunrise) {
        const lat = this.latitude * Math.PI / 180;
        const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
        
        // Solar declination
        const declination = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365) * Math.PI / 180;
        
        // Hour angle
        const hourAngle = Math.acos(-Math.tan(lat) * Math.tan(declination));
        
        // Time correction for longitude (Mountain Time)
        const timeCorrection = 4 * (this.longitude - (-105));
        
        // Calculate sunrise/sunset in minutes from midnight
        const sunEventMinutes = isSunrise ? 
            720 - 4 * hourAngle * 180 / Math.PI - timeCorrection :
            720 + 4 * hourAngle * 180 / Math.PI - timeCorrection;
        
        // Convert to hours and minutes
        const hours = Math.floor(sunEventMinutes / 60);
        const minutes = Math.floor(sunEventMinutes % 60);
        
        // Create time object
        const sunEventTime = new Date(date);
        sunEventTime.setHours(hours, minutes, 0, 0);
        
        return sunEventTime;
    }
    
    /**
     * Load all schedules from the API
     */
    async loadSchedules() {
        try {
            const response = await fetch('/api/schedules');
            if (!response.ok) {
                throw new Error(`Failed to load schedules: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Raw API response:', data);
            
            // Handle the JSON structure where schedules are in data.schedules array
            if (data && data.schedules && Array.isArray(data.schedules)) {
                this.schedules = data.schedules;
            } else if (Array.isArray(data)) {
                this.schedules = data;
            } else {
                console.warn('Unexpected data format, initializing empty schedules');
                this.schedules = [];
            }
            
            // Clean up any temporary properties that shouldn't persist
            this.schedules = this.schedules.map(schedule => {
                const cleanSchedule = { ...schedule };
                delete cleanSchedule._isSingleFromSeries;
                delete cleanSchedule._originalScheduleId;
                delete cleanSchedule._eventDate;
                return cleanSchedule;
            });
            
            this.schedulesData = data; // Store complete data structure for saving
            
            // Ensure unoccupied schedule always exists
            this.ensureUnoccupiedSchedule();
            
            console.log('Loaded schedules:', this.schedules.length);
            
            // Update views
            if (this.calendarView) {
                this.calendarView.refresh();
            }
            if (this.listView) {
                this.listView.refresh();
            }
            
            return this.schedules;
        } catch (error) {
            console.error('Error loading schedules:', error);
            this.showError('Failed to load schedules');
            this.schedules = [];
            this.schedulesData = { schedules: [], metadata: { version: "1.0", created_at: new Date().toISOString(), updated_at: new Date().toISOString() } };
            return [];
        }
    }
    


    /**
     * Ensure unoccupied default schedule always exists
     */
    ensureUnoccupiedSchedule() {
        const hasUnoccupied = this.schedules.some(s => s.is_default);
        if (!hasUnoccupied) {
            const unoccupiedSchedule = {
                id: "unoccupied-default",
                event_name: "Unoccupied",
                schedule_type: "thermostat",
                repeat_frequency: "daily",
                time_setting: "all_day",
                start_time: null,
                end_time: null,
                settings: {
                    system_mode: "Heat",
                    heat_setpoint: "65",
                    cool_setpoint: "78",
                    fan: "auto",
                    humidity_setpoint: "45",
                    ventilation_rate: "0"
                },
                days_of_week: [],
                is_default: true,
                exclude_dates: []
            };
            this.schedules.unshift(unoccupiedSchedule); // Add at beginning
        }
    }

    /**
     * Calculate current status from schedules - frontend only logic
     */
    calculateCurrentStatus() {
        try {
            const now = new Date();
            const activeSchedule = this.findActiveScheduleForTime(now);
            const nextEvent = this.findNextScheduledEvent();
            
            this.currentStatus = {
                current_time: now.toISOString(),
                active_schedule: activeSchedule,
                status: activeSchedule ? (activeSchedule.is_default ? 'unoccupied' : 'occupied') : 'unoccupied',
                next_event: nextEvent
            };
            
            this.updateCurrentStatusDisplay();
            return this.currentStatus;
        } catch (error) {
            console.error('Error calculating current status:', error);
            return null;
        }
    }

    /**
     * Find the active schedule for a given time - frontend logic
     */
    findActiveScheduleForTime(targetTime) {
        if (!this.schedules || this.schedules.length === 0) return null;
        
        // Find all schedules that are active at the target time
        const activeSchedules = this.schedules.filter(schedule => {
            return this.isScheduleActiveAtTime(schedule, targetTime);
        });
        
        // If no schedules found, return unoccupied default
        if (activeSchedules.length === 0) {
            return this.schedules.find(s => s.is_default) || null;
        }
        
        // Prioritize non-default schedules over default
        const nonDefaultSchedules = activeSchedules.filter(s => !s.is_default);
        if (nonDefaultSchedules.length > 0) {
            return nonDefaultSchedules[0]; // Return first non-default
        }
        
        return activeSchedules[0];
    }

    /**
     * Check if a schedule is active at a specific time
     */
    isScheduleActiveAtTime(schedule, targetTime) {
        if (!schedule.start_time) return false;
        
        const targetDate = new Date(targetTime);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // First check if target date is within schedule date range
        if (schedule.start_date && schedule.end_date) {
            const scheduleStartDate = schedule.start_date;
            const scheduleEndDate = schedule.end_date === 'never' ? '9999-12-31' : schedule.end_date;
            
            if (targetDateStr < scheduleStartDate || targetDateStr > scheduleEndDate) {
                return false;
            }
        }
        
        // For one-time events (repeat_frequency === 'never')
        if (schedule.repeat_frequency === 'never') {
            // Check if this is the exact date
            if (targetDateStr === schedule.start_date) {
                const eventTimes = this.calculateEventTimes(schedule, targetDate);
                if (!eventTimes) return false;
                return targetTime >= eventTimes.start && targetTime < eventTimes.end;
            }
            return false;
        }
        
        // For recurring events
        if (schedule.repeat_frequency === 'daily' || 
            (schedule.days_of_week && schedule.days_of_week.includes(dayName))) {
            
            // Calculate event times for this date
            const eventTimes = this.calculateEventTimes(schedule, targetDate);
            if (!eventTimes) return false;
            
            // Check if target time falls within the event
            return targetTime >= eventTimes.start && targetTime < eventTimes.end;
        }
        
        return false;
    }
    
    /**
     * Find the next scheduled event after the current time
     */
    findNextScheduledEvent() {
        const now = new Date();
        const maxDaysToCheck = 7; // Check up to 7 days ahead
        const endDate = new Date(now.getTime() + maxDaysToCheck * 24 * 60 * 60 * 1000);
        
        let nextEvent = null;
        let nextEventTime = null;
        
        // Check each day starting from today
        const checkDate = new Date(now);
        while (checkDate <= endDate) {
            // Check all non-default schedules
            for (const schedule of this.schedules.filter(s => !s.is_default)) {
                // Check if this schedule occurs on this day
                if (this.isScheduleValidForDate(schedule, checkDate)) {
                    const eventTimes = this.calculateEventTimes(schedule, checkDate);
                    if (eventTimes && eventTimes.start > now) {
                        // This event is in the future
                        if (!nextEventTime || eventTimes.start < nextEventTime) {
                            nextEvent = {
                                ...schedule,
                                start_time: eventTimes.start,
                                end_time: eventTimes.end
                            };
                            nextEventTime = eventTimes.start;
                        }
                    }
                }
            }
            
            // Move to next day
            checkDate.setDate(checkDate.getDate() + 1);
            checkDate.setHours(0, 0, 0, 0);
        }
        
        return nextEvent;
    }
    
    /**
     * Check if a schedule is valid for a specific date
     */
    isScheduleValidForDate(schedule, date) {
        const dateStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // Check date range
        if (schedule.start_date && schedule.end_date) {
            const scheduleStartDate = schedule.start_date;
            const scheduleEndDate = schedule.end_date === 'never' ? '9999-12-31' : schedule.end_date;
            
            if (dateStr < scheduleStartDate || dateStr > scheduleEndDate) {
                return false;
            }
        }
        
        // Check excluded dates
        if (schedule.exclude_dates && schedule.exclude_dates.includes(dateStr)) {
            return false;
        }
        
        // Check repeat pattern
        if (schedule.repeat_frequency === 'never') {
            return dateStr === schedule.start_date;
        } else if (schedule.repeat_frequency === 'custom' && schedule.days_of_week) {
            return schedule.days_of_week.includes(dayName);
        } else if (schedule.repeat_frequency === 'daily') {
            return true;
        }
        
        return false;
    }
    
    /**
     * Update current status display in the UI
     */
    updateCurrentStatusDisplay() {
        const currentStatusContent = document.getElementById('currentStatusContent');
        const nextEventContent = document.getElementById('nextEventContent');
        
        // Update calendar header
        const calendarCurrentName = document.getElementById('calendarCurrentName');
        const calendarNextText = document.getElementById('calendarNextText');
        
        if (!this.currentStatus) {
            if (currentStatusContent) currentStatusContent.innerHTML = '<span class="text-muted">No data available</span>';
            if (nextEventContent) nextEventContent.innerHTML = '<span class="text-muted">No upcoming events</span>';
            if (calendarCurrentName) calendarCurrentName.textContent = 'No data';
            if (calendarNextText) calendarNextText.textContent = 'No upcoming events';
            return;
        }
        
        // Current status  
        const current = this.currentStatus.active_schedule;
        if (!current) return;
        
        const statusIcon = current.is_default ? 'fas fa-clock' : 'fas fa-cog';
        const statusClass = current.is_default ? 'text-warning' : 'text-success';
        
        if (currentStatusContent) {
            currentStatusContent.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <i class="${statusIcon} ${statusClass} me-2"></i>
                    <strong>${current.event_name || 'Unknown'}</strong>
                </div>
                <div class="small text-muted">
                    ${current.schedule_type || 'thermostat'}
                </div>
                <div class="mt-2">
                    ${this.formatSettings(current.settings)}
                </div>
            `;
        }
        
        // Update calendar header current status
        if (calendarCurrentName) {
            calendarCurrentName.textContent = current.event_name || 'Unknown';
            calendarCurrentName.className = current.is_default ? 'text-warning' : 'text-success';
        }
        
        // Next event
        const next = this.currentStatus.next_event;
        if (next) {
            const nextTime = new Date(next.start_time);
            if (nextEventContent) {
                nextEventContent.innerHTML = `
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-clock text-info me-2"></i>
                        <strong>${next.event_name}</strong>
                    </div>
                    <div class="small text-muted">
                        ${nextTime.toLocaleString()}
                    </div>
                    <div class="mt-2">
                        ${this.formatSettings(next.settings)}
                    </div>
                `;
            }
            
            // Update calendar header next event
            if (calendarNextText) {
                const timeUntil = this.getTimeUntilText(nextTime);
                calendarNextText.textContent = `Next: ${next.event_name} ${timeUntil}`;
            }
        } else {
            if (nextEventContent) nextEventContent.innerHTML = '<span class="text-muted">No upcoming events</span>';
            if (calendarNextText) calendarNextText.textContent = 'No upcoming events';
        }
    }
    
    /**
     * Get text describing time until an event
     */
    getTimeUntilText(eventTime) {
        const now = new Date();
        const diffMs = eventTime - now;
        
        if (diffMs < 0) {
            return '(Started)';
        }
        
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `(in ${diffDays} day${diffDays > 1 ? 's' : ''})`;
        } else if (diffHours > 0) {
            return `(in ${diffHours} hour${diffHours > 1 ? 's' : ''})`;
        } else if (diffMinutes > 0) {
            return `(in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''})`;
        } else {
            return '(starting soon)';
        }
    }
    
    /**
     * Format settings object for display
     */
    formatSettings(settings) {
        if (!settings || typeof settings !== 'object') {
            return '<span class="text-muted">No settings</span>';
        }
        
        let html = '';
        for (const [key, value] of Object.entries(settings)) {
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            html += `<div class="setting-item mb-1">
                <span class="setting-label">${displayKey}:</span>
                <span class="setting-value">${value}</span>
            </div>`;
        }
        
        return html || '<span class="text-muted">No settings</span>';
    }
    
    /**
     * Open the event modal for creating/editing
     */
    openEventModal(eventType = null, scheduleData = null, eventDate = null) {
        console.log('openEventModal called with:', { eventType, scheduleData: !!scheduleData, eventDate });
        
        // Prevent multiple modals from causing freezing
        if (this.modalOpening) {
            console.log('Modal already opening, ignoring request');
            return;
        }
        this.modalOpening = true;
        
        try {
            const modalElement = document.getElementById('eventModal');
            if (!modalElement) {
                console.error('Modal element not found');
                this.modalOpening = false;
                return;
            }
            
            // Destroy any existing modal instance first
            const existingModal = bootstrap.Modal.getInstance(modalElement);
            if (existingModal) {
                existingModal.dispose();
            }
            
            const modal = new bootstrap.Modal(modalElement, {
                backdrop: 'static',
                keyboard: false
            });
            
            const modalTitleIcon = document.querySelector('#eventModalLabel i');
            const modalTitleText = document.getElementById('modalTitleText');
            const deleteBtn = document.getElementById('deleteEventBtn');
            
            // Clear any pending excluded date removals when opening modal
            this.pendingExcludedDateRemovals = new Set();
            
            if (scheduleData) {
                // Editing existing event
                if (scheduleData.is_default) {
                    modalTitleIcon.className = 'fas fa-cog me-2';
                    modalTitleText.textContent = 'Global Unoccupied Settings';
                    deleteBtn.style.display = 'none';
                } else {
                    modalTitleIcon.className = 'fas fa-edit me-2';
                    modalTitleText.textContent = 'Edit Current Setting';
                    deleteBtn.style.display = 'block';
                }
                this.currentEditingId = scheduleData.id;
                this.currentEventDate = eventDate;
                console.log('🔵 MODAL: Setting currentEditingId to:', this.currentEditingId);
                this.populateEventForm(scheduleData, eventDate);
            } else {
                // Creating new event
                modalTitleIcon.className = 'fas fa-plus-circle me-2';
                modalTitleText.textContent = 'Add Schedule Event';
                deleteBtn.style.display = 'none';
                this.currentEditingId = null;
                this.currentEventDate = null;
                this.resetEventForm();
                
                if (eventType) {
                    document.getElementById('eventName').value = eventType === 'occupied' ? 'Occupied' : 
                                                               eventType === 'unoccupied' ? 'Unoccupied' : 'Custom';
                }
            }
            
            // Clean up flag when modal is closed (with multiple fallbacks)
            const cleanupModal = () => {
                console.log('🔵 MODAL: Cleanup triggered');
                console.log('📊 Final state - currentScheduleData:', this.currentScheduleData);
                console.log('📊 Final state - currentEditingId:', this.currentEditingId);
                this.modalOpening = false;
                
                // Additional cleanup for unoccupied schedule
                if (scheduleData && scheduleData.is_default) {
                    // Re-enable all fields that were disabled
                    const fields = ['eventName', 'repeatFrequency', 'startTime', 'endTime', 'neverEnding', 'timeSetting', 'scheduleStartDate', 'scheduleEndDate'];
                    fields.forEach(fieldId => {
                        const field = document.getElementById(fieldId);
                        if (field) field.disabled = false;
                    });
                    
                    // Re-enable day checkboxes
                    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                        const checkbox = document.getElementById(`day${day.charAt(0).toUpperCase() + day.slice(1)}`);
                        if (checkbox) checkbox.disabled = false;
                    });
                    
                    // Show all hidden fields
                    const selectors = ['startTime', 'endTime', 'repeatFrequency', 'timeSetting', 'scheduleStartDate', 'scheduleEndDate'];
                    selectors.forEach(fieldId => {
                        const label = document.querySelector(`label[for="${fieldId}"]`);
                        if (label) {
                            const container = label.closest('.col-md-6') || label.closest('.mb-3');
                            if (container) container.style.display = 'block';
                        }
                    });
                }
                
                // Clear current editing state
                this.currentEditingId = null;
                this.currentEventDate = null;
                this.currentScheduleData = null;
            };
            
            modalElement.addEventListener('hidden.bs.modal', cleanupModal, { once: true });
            modalElement.addEventListener('hide.bs.modal', cleanupModal, { once: true });
            
            // Fallback cleanup after 2 seconds
            setTimeout(() => {
                if (this.modalOpening) {
                    console.log('Fallback modal cleanup after timeout');
                    this.modalOpening = false;
                }
            }, 2000);
            
            console.log('Showing modal');
            modal.show();
            
        } catch (error) {
            console.error('Error opening modal:', error);
            this.modalOpening = false;
        }
    }
    
    /**
     * Edit the currently active setting based on current time
     */
    editCurrentActiveSetting() {
        if (!this.currentStatus || !this.currentStatus.active_schedule) {
            this.showError('No active schedule found');
            return;
        }
        
        const activeSchedule = this.currentStatus.active_schedule;
        console.log('Editing currently active schedule:', activeSchedule.event_name);
        
        // Default unoccupied schedule should always open directly
        if (activeSchedule.is_default) {
            this.openEventModal(null, activeSchedule);
        } else if (activeSchedule.repeat_frequency && activeSchedule.repeat_frequency !== 'never') {
            // For recurring events, show edit scope modal
            const currentDate = new Date();
            this.showEditScopeModal(activeSchedule, currentDate);
        } else {
            // Direct edit for non-recurring events
            this.openEventModal(null, activeSchedule);
        }
    }
    
    /**
     * Open unoccupied settings modal
     */
    openUnoccupiedSettings() {
        const defaultSchedule = this.schedules.find(s => s.is_default);
        if (defaultSchedule) {
            this.openEventModal(null, defaultSchedule);
        }
    }
    
    /**
     * Handle "This Event Only" choice for edit operations - Used by edit scope modal
     */
    async handleSingleEventEditChoice(scheduleData, eventDate) {
        const excludeDate = eventDate.toISOString().split('T')[0];
        
        // Create new single event and open for editing
        const newSchedule = {
            ...scheduleData,
            id: Date.now().toString(),
            repeat_frequency: 'never',
            exclude_dates: [],
            days_of_week: [],
            // Mark this as a single event from series
            _isSingleFromSeries: true,
            _originalScheduleId: scheduleData.id,
            _eventDate: excludeDate
        };
        
        // Add to pending edits and open modal
        this.pendingSingleEventEdit = {
            originalSchedule: scheduleData,
            excludeDate: excludeDate,
            newSchedule: newSchedule
        };
        
        this.openEventModal(null, newSchedule, eventDate);
    }

    /**
     * Delete a single event from a recurring series by adding it to exclude_dates
     */
    async deleteSingleEvent(scheduleData, eventDate) {
        if (!confirm('Are you sure you want to delete this single event?')) {
            return;
        }
        
        try {
            // Add the event date to exclude_dates
            const excludeDateStr = eventDate.toISOString().split('T')[0];
            const updatedSchedule = { ...scheduleData };
            
            if (!updatedSchedule.exclude_dates) {
                updatedSchedule.exclude_dates = [];
            }
            
            // Add to exclude dates if not already there
            if (!updatedSchedule.exclude_dates.includes(excludeDateStr)) {
                updatedSchedule.exclude_dates.push(excludeDateStr);
            }
            
            // Update the schedule in the schedules array
            const scheduleIndex = this.schedules.findIndex(s => s.id === scheduleData.id);
            if (scheduleIndex !== -1) {
                this.schedules[scheduleIndex] = updatedSchedule;
            }
            
            // Save to backend
            const dataToSave = {
                schedules: this.schedules,
                metadata: {
                    version: "1.0",
                    created_at: this.schedulesData?.metadata?.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            };
            
            const response = await fetch('/api/schedules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSave)
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete single event');
            }
            
            // Close modal and refresh
            bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
            await this.loadSchedules();
            this.calculateCurrentStatus();
            
            // Refresh views
            if (this.currentView === 'calendar' && this.calendarView) {
                this.calendarView.refresh();
            } else if (this.currentView === 'list' && this.listView) {
                this.listView.refresh();
            }
            
            this.showSuccess('Single event deleted successfully');
            
        } catch (error) {
            console.error('Error deleting single event:', error);
            this.showError('Failed to delete single event');
        }
    }

    /**
     * Show the edit scope modal for recurring events
     */
    showEditScopeModal(scheduleData, eventDate, action = 'edit') {
        // Don't overwrite currentScheduleData if it's already set from populateEventForm
        if (!this.currentScheduleData || this.currentScheduleData.id !== scheduleData.id) {
            this.currentScheduleData = scheduleData;
        }
        this.currentEventDate = eventDate;
        this.currentAction = action;
        
        // Update modal content based on action
        const modalTitle = document.querySelector('#editScopeModal .modal-title');
        const modalText = document.querySelector('#editScopeModal .modal-body p');
        const singleBtn = document.getElementById('editSingleEventBtn');
        const allBtn = document.getElementById('editAllEventsBtn');
        
        if (action === 'drag') {
            if (modalTitle) modalTitle.textContent = 'Move Event';
            if (modalText) modalText.innerHTML = 'This is a recurring event. Do you want to move:';
            if (singleBtn) singleBtn.textContent = 'Just This Event';
            if (allBtn) allBtn.textContent = 'All Events in Series';
        } else if (action === 'resize') {
            if (modalTitle) modalTitle.textContent = 'Resize Event';
            if (modalText) modalText.innerHTML = 'This is a recurring event. Do you want to resize:';
            if (singleBtn) singleBtn.textContent = 'Just This Event';
            if (allBtn) allBtn.textContent = 'All Events in Series';
        } else if (action === 'delete') {
            if (modalTitle) modalTitle.textContent = 'Delete Event';
            if (modalText) modalText.innerHTML = 'This is a recurring event. Do you want to delete:';
            if (singleBtn) singleBtn.textContent = 'Just This Event';
            if (allBtn) allBtn.textContent = 'All Events in Series';
        } else {
            if (modalTitle) modalTitle.textContent = 'Edit Event';
            if (modalText) modalText.innerHTML = 'This is a recurring event. Do you want to edit:';
            if (singleBtn) singleBtn.textContent = 'This Event Only';
            if (allBtn) allBtn.textContent = 'All Events in Series';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('editScopeModal'));
        modal.show();
        
        // Set up button handlers with clean architecture
        singleBtn.onclick = () => {
            modal.hide();
            if (action === 'drag') {
                console.log('🔘 Modal: DRAG_SINGLE_FROM_SERIES button clicked');
                console.log('🔘 Modal: Current pendingPayload:', this.actionHandler.pendingPayload);
                this.actionHandler.handleUserAction('DRAG_SINGLE_FROM_SERIES', {});
            } else if (action === 'resize') {
                console.log('🔘 Modal: RESIZE_SINGLE_FROM_SERIES button clicked');
                console.log('🔘 Modal: Current pendingPayload:', this.actionHandler.pendingPayload);
                this.actionHandler.handleUserAction('RESIZE_SINGLE_FROM_SERIES', {});
            } else if (action === 'delete') {
                // Delete just this occurrence - add to exclude_dates
                const dateStr = eventDate ? eventDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                const updatedSchedule = { ...scheduleData };
                updatedSchedule.exclude_dates = updatedSchedule.exclude_dates || [];
                if (!updatedSchedule.exclude_dates.includes(dateStr)) {
                    updatedSchedule.exclude_dates.push(dateStr);
                }
                this.actionHandler.handleUserAction('UPDATE_EVENT', {
                    scheduleId: scheduleData.id,
                    updates: updatedSchedule
                });
            } else {
                this.handleSingleEventEditChoice(scheduleData, eventDate);
            }
        };
        
        allBtn.onclick = () => {
            modal.hide();
            if (action === 'drag') {
                this.actionHandler.handleUserAction('DRAG_WHOLE_SERIES', {});
            } else if (action === 'resize') {
                this.actionHandler.handleUserAction('RESIZE_WHOLE_SERIES', {});
            } else if (action === 'delete') {
                // Delete the entire series
                this.deleteEvent(scheduleData.id);
            } else {
                this.openEventModal(null, scheduleData, eventDate);
            }
        };
    }
    
    /**
     * Show delete scope modal for recurring events
     */
    showDeleteScopeModal(scheduleData, eventDate) {
        this.showEditScopeModal(scheduleData, eventDate, 'delete');
    }
    

    
    /**
     * Populate the event form with existing data
     */
    populateEventForm(scheduleData, eventDate = null) {
        console.log('📝 POPULATING FORM with schedule:', scheduleData.id);
        console.log('📊 Original exclude_dates:', scheduleData.exclude_dates);
        

        // Store schedule ID on form for all operations (not just excluded dates)
        document.getElementById('eventForm').dataset.scheduleId = scheduleData.id;
        
        // Make a deep copy for tracking changes during editing
        this.currentScheduleData = JSON.parse(JSON.stringify(scheduleData));
        console.log('📊 Deep copy created - currentScheduleData.exclude_dates:', this.currentScheduleData.exclude_dates);
        
        document.getElementById('eventName').value = scheduleData.event_name || '';
        document.getElementById('scheduleType').value = scheduleData.schedule_type || 'thermostat';
        
        // Update settings display based on schedule type
        this.updateSettingsDisplay(scheduleData.schedule_type || 'thermostat');
        
        document.getElementById('repeatFrequency').value = scheduleData.repeat_frequency || 'never';
        
        // Trigger change event to handle visibility of schedule end date and label updates
        document.getElementById('repeatFrequency').dispatchEvent(new Event('change'));
        document.getElementById('timeSetting').value = scheduleData.time_setting || 'time';
        
        // Show excluded dates for recurring schedules
        this.populateExcludedDates(scheduleData);
        
        // For default unoccupied settings, disable most fields
        if (scheduleData.is_default) {
            document.getElementById('eventName').disabled = true;
            document.getElementById('repeatFrequency').disabled = true;
            document.getElementById('startTime').disabled = true;
            document.getElementById('endTime').disabled = true;
            document.getElementById('neverEnding').disabled = true;
            document.getElementById('timeSetting').disabled = true;
            document.getElementById('scheduleStartDate').disabled = true;
            document.getElementById('scheduleEndDate').disabled = true;
            
            // Disable all day checkboxes for unoccupied settings
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                const checkbox = document.getElementById(day);
                if (checkbox) {
                    checkbox.disabled = true;
                }
            });
            
            // Hide date/time fields for unoccupied settings
            document.querySelector('label[for="startTime"]').closest('.col-md-6').style.display = 'none';
            document.querySelector('label[for="endTime"]').closest('.col-md-6').style.display = 'none';
            document.querySelector('label[for="repeatFrequency"]').closest('.mb-3').style.display = 'none';
            document.querySelector('label[for="timeSetting"]').closest('.mb-3').style.display = 'none';
            document.querySelector('label[for="scheduleStartDate"]').closest('.col-md-6').style.display = 'none';
            document.querySelector('label[for="scheduleEndDate"]').closest('.col-md-6').style.display = 'none';
        } else {
            // Enable all fields for regular events
            document.getElementById('eventName').disabled = false;
            document.getElementById('repeatFrequency').disabled = false;
            document.getElementById('startTime').disabled = false;
            document.getElementById('endTime').disabled = false;
            document.getElementById('neverEnding').disabled = false;
            document.getElementById('timeSetting').disabled = false;
            document.getElementById('scheduleStartDate').disabled = false;
            document.getElementById('scheduleEndDate').disabled = false;
            
            // Enable all day checkboxes for regular events
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                const checkbox = document.getElementById(day);
                if (checkbox) {
                    checkbox.disabled = false;
                }
            });
            
            // Show all fields
            document.querySelector('label[for="startTime"]').closest('.col-md-6').style.display = 'block';
            document.querySelector('label[for="endTime"]').closest('.col-md-6').style.display = 'block';
            document.querySelector('label[for="repeatFrequency"]').closest('.mb-3').style.display = 'block';
            document.querySelector('label[for="timeSetting"]').closest('.mb-3').style.display = 'block';
            document.querySelector('label[for="scheduleStartDate"]').closest('.col-md-6').style.display = 'block';
            document.querySelector('label[for="scheduleEndDate"]').closest('.col-md-6').style.display = 'block';
        }
        
        // Set dates and times using 4-value structure
        if (!scheduleData.is_default) {
            // Set dates from 4-value structure
            document.getElementById('scheduleStartDate').value = scheduleData.start_date || new Date().toISOString().split('T')[0];
            document.getElementById('startTime').value = scheduleData.start_time || '08:00';
            document.getElementById('endTime').value = scheduleData.end_time || '18:00';
            
            // Handle end date
            if (scheduleData.end_date && scheduleData.end_date !== 'never') {
                document.getElementById('scheduleEndDate').value = scheduleData.end_date;
                document.getElementById('neverEnding').checked = false;
                document.getElementById('scheduleEndDate').disabled = false;
            } else if (scheduleData.end_date === 'never') {
                document.getElementById('neverEnding').checked = true;
                document.getElementById('scheduleEndDate').disabled = true;
                document.getElementById('scheduleEndDate').value = '';
            } else {
                // For one-time events without explicit end date
                document.getElementById('scheduleEndDate').value = scheduleData.start_date || '';
                document.getElementById('neverEnding').checked = false;
                document.getElementById('scheduleEndDate').disabled = false;
            }
        }
        
        // Clear all day checkboxes first, then set the correct ones
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
            const checkbox = document.getElementById(`day${day.charAt(0).toUpperCase() + day.slice(1)}`);
            if (checkbox) checkbox.checked = false;
        });
        
        // Set custom days if applicable
        if (scheduleData.repeat_frequency === 'custom' && scheduleData.days_of_week) {
            document.getElementById('customDaysContainer').classList.remove('d-none');
            scheduleData.days_of_week.forEach(day => {
                const checkbox = document.getElementById(`day${day.charAt(0).toUpperCase() + day.slice(1)}`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // Set settings based on schedule type
        const settings = scheduleData.settings || {};
        
        if (scheduleData.schedule_type === 'thermostat') {
            document.getElementById('systemMode').value = settings.system_mode || 'Cool';
            document.getElementById('fanSetting').value = settings.fan || 'auto';
            document.getElementById('coolSetpoint').value = settings.cool_setpoint || '';
            document.getElementById('heatSetpoint').value = settings.heat_setpoint || '';
            // Update temperature setpoint visibility
            this.updateTemperatureSetpoints(settings.system_mode || 'Cool');
        } else if (scheduleData.schedule_type === 'thermostat+humidistat') {
            document.getElementById('systemModeCombined').value = settings.system_mode || 'Cool';
            document.getElementById('fanSettingCombined').value = settings.fan || 'auto';
            document.getElementById('coolSetpointCombined').value = settings.cool_setpoint || '';
            document.getElementById('heatSetpointCombined').value = settings.heat_setpoint || '';
            document.getElementById('humidityLowSetpointCombined').value = settings.humidity_low_setpoint || '30';
            document.getElementById('humidityHighSetpointCombined').value = settings.humidity_high_setpoint || '60';
            // Update temperature setpoint visibility
            this.updateTemperatureSetpointsCombined(settings.system_mode || 'Cool');
        } else if (scheduleData.schedule_type === 'lighting') {
            document.getElementById('lightingStatus').value = settings.lighting_status || 'on';
        } else if (scheduleData.schedule_type === 'humidistat') {
            document.getElementById('humidityLowSetpoint').value = settings.humidity_low_setpoint || '30';
            document.getElementById('humidityHighSetpoint').value = settings.humidity_high_setpoint || '60';
        }
        
        // Update time labels based on time setting
        this.updateTimeLabels(scheduleData.time_setting || 'time');
    }
    
    /**
     * Populate excluded dates section
     */
    populateExcludedDates(scheduleData) {
        const excludedDatesSection = document.getElementById('excludedDatesSection');
        const excludedDatesList = document.getElementById('excludedDatesList');
        const noExcludedDates = document.getElementById('noExcludedDates');
        
        // Only show for recurring schedules
        if (scheduleData.repeat_frequency === 'never' || scheduleData.is_default) {
            excludedDatesSection.style.display = 'none';
            return;
        }
        
        excludedDatesSection.style.display = 'block';
        
        // Store schedule ID on the form for later use
        document.getElementById('eventForm').dataset.scheduleId = scheduleData.id;
        
        const excludedDates = scheduleData.exclude_dates || [];
        
        if (excludedDates.length === 0) {
            excludedDatesList.innerHTML = '';
            noExcludedDates.style.display = 'block';
        } else {
            noExcludedDates.style.display = 'none';
            excludedDatesList.innerHTML = excludedDates.map(date => {
                const dateObj = new Date(date + 'T00:00:00');
                const formattedDate = dateObj.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                
                return `
                    <div class="d-flex justify-content-between align-items-center mb-1 p-2 bg-dark rounded" id="excluded-${date}">
                        <span>${formattedDate}</span>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="console.log('Button clicked for:', '${date}'); window.scheduler.removeExcludedDate('${date}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
    }
    
    /**
     * Remove an excluded date (direct action through ActionHandler)
     */
    removeExcludedDate(dateStr) {
        // Just remove from UI
        const excludedElement = document.getElementById(`excluded-${dateStr}`);
        if (excludedElement) {
            excludedElement.remove();
        }
        
        // Show "no excluded dates" message if needed
        const excludedDatesList = document.getElementById('excludedDatesList');
        const noExcludedDates = document.getElementById('noExcludedDates');
        
        if (excludedDatesList && excludedDatesList.children.length === 0) {
            if (noExcludedDates) noExcludedDates.style.display = 'block';
        }
    }
    
    /**
     * Show drag scope modal for recurring events
     */
    showDragScopeModal(scheduleData, eventDate) {
        this.currentScheduleData = scheduleData;
        this.currentEventDate = eventDate;
        this.currentAction = 'drag';
        
        // Update modal content for drag
        const modalTitle = document.querySelector('#editScopeModal .modal-title');
        const modalText = document.querySelector('#editScopeModal .modal-body p');
        const singleBtn = document.getElementById('editSingleEventBtn');
        const allBtn = document.getElementById('editAllEventsBtn');
        
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-arrows-alt me-2"></i>Move Event';
        if (modalText) modalText.innerHTML = 'This is a recurring event. Do you want to move:';
        if (singleBtn) {
            singleBtn.innerHTML = '<i class="fas fa-calendar-day me-2"></i>Just This Event<small class="d-block text-light opacity-75">Move only this specific occurrence</small>';
        }
        if (allBtn) {
            allBtn.innerHTML = '<i class="fas fa-calendar-alt me-2"></i>All Events in Series<small class="d-block text-light opacity-75">Move all occurrences of this recurring event</small>';
        }
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('editScopeModal'));
        modal.show();
        
        // Set up button handlers for drag operations
        singleBtn.onclick = async () => {
            modal.hide();
            try {
                // Get drag info from calendar view
                const dragInfo = this.calendarView.pendingDragInfo;
                if (dragInfo) {
                    await this.actionHandler.handleUserAction('DRAG_EVENT', {
                        scheduleId: dragInfo.scheduleId,
                        newStart: dragInfo.newStart,
                        eventDate: dragInfo.eventDate,
                        actionScope: 'single'
                    });
                    this.calendarView.pendingDragInfo = null;
                }
            } catch (error) {
                console.error('❌ Single drag failed:', error);
                this.showError('Failed to move event: ' + error.message);
                if (this.calendarView.lastRevertFunction) {
                    this.calendarView.lastRevertFunction();
                }
            }
        };
        
        allBtn.onclick = async () => {
            modal.hide();
            try {
                // Get drag info from calendar view
                const dragInfo = this.calendarView.pendingDragInfo;
                if (dragInfo) {
                    await this.actionHandler.handleUserAction('DRAG_EVENT', {
                        scheduleId: dragInfo.scheduleId,
                        newStart: dragInfo.newStart,
                        eventDate: dragInfo.eventDate,
                        actionScope: 'series'
                    });
                    this.calendarView.pendingDragInfo = null;
                }
            } catch (error) {
                console.error('❌ Series drag failed:', error);
                this.showError('Failed to move events: ' + error.message);
                if (this.calendarView.lastRevertFunction) {
                    this.calendarView.lastRevertFunction();
                }
            }
        };
    }
    
    /**
     * Find overlapping schedule without resolving
     */

    
    /**
     * Find overlapping schedule for drag operations (excludes current event)
     */

    
    /**
     * Calculate actual start/end times for an event on a specific date
     */
    calculateEventTimes(schedule, date) {
        if (!schedule.start_time) return null;
        
        let startTime, endTime;
        
        switch (schedule.time_setting) {
            case 'sunrise':
                const sunrise = this.calculateSunrise(date);
                const startHours = parseInt(schedule.start_time.split(':')[0]) || 0;
                const endHours = schedule.end_time ? parseInt(schedule.end_time.split(':')[0]) : startHours + 1;
                
                startTime = new Date(sunrise.getTime() - (startHours * 60 * 60 * 1000));
                endTime = new Date(sunrise.getTime() + (endHours * 60 * 60 * 1000));
                break;
                
            case 'sunset':
                const sunset = this.calculateSunset(date);
                const startHoursSunset = parseInt(schedule.start_time.split(':')[0]) || 0;
                const endHoursSunset = schedule.end_time ? parseInt(schedule.end_time.split(':')[0]) : startHoursSunset + 1;
                
                startTime = new Date(sunset.getTime() - (startHoursSunset * 60 * 60 * 1000));
                endTime = new Date(sunset.getTime() + (endHoursSunset * 60 * 60 * 1000));
                break;
                
            case 'time':
            default:
                // Handle both ISO datetime strings and time-only strings
                if (schedule.start_time.includes('T')) {
                    // Full ISO datetime string - extract time components directly
                    const [datePart, timePart] = schedule.start_time.split('T');
                    const [hours, minutes] = timePart.split(':').map(Number);
                    const baseDate = new Date(date);
                    startTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
                } else {
                    // Time-only string (HH:MM format)
                    const baseDate = new Date(date);
                    const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
                    startTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHour, startMinute);
                }
                
                if (schedule.end_time) {
                    if (schedule.end_time.includes('T')) {
                        // Full ISO datetime string - extract time components directly
                        const [datePart, timePart] = schedule.end_time.split('T');
                        const [hours, minutes] = timePart.split(':').map(Number);
                        const baseDate = new Date(date);
                        endTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
                        // Handle events that end the next day
                        if (endTime <= startTime) {
                            endTime.setDate(endTime.getDate() + 1);
                        }
                    } else {
                        // Time-only string (HH:MM format)
                        const baseDate = new Date(date);
                        const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
                        endTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMinute);
                        // Handle events that end the next day
                        if (endTime <= startTime) {
                            endTime.setDate(endTime.getDate() + 1);
                        }
                    }
                } else {
                    endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour duration
                }
                break;
        }
        
        return { start: startTime, end: endTime };
    }
    

    

    
    /**
     * Reset the event form to defaults
     */
    resetEventForm() {
        try {
            document.getElementById('eventForm').reset();
            document.getElementById('customDaysContainer').classList.add('d-none');
            document.getElementById('scheduleEndDate').disabled = false;
            document.getElementById('neverEnding').checked = false;
            this.currentEditingId = null;
            this.currentEventDate = null;
            this.currentScheduleData = null; // Clear current schedule data
            this.modalOpening = false; // Ensure modal flag is reset
            
            // Clear excluded dates section
            const excludedDatesSection = document.getElementById('excludedDatesSection');
            const excludedDatesList = document.getElementById('excludedDatesList');
            const noExcludedDates = document.getElementById('noExcludedDates');
            
            if (excludedDatesSection) {
                excludedDatesSection.style.display = 'none';
            }
            if (excludedDatesList) {
                excludedDatesList.innerHTML = '';
            }
            if (noExcludedDates) {
                noExcludedDates.style.display = 'block';
            }
            
            // Clear form dataset
            document.getElementById('eventForm').dataset.scheduleId = '';
            
            // Set default schedule start date to today and default times
            const today = new Date();
            document.getElementById('scheduleStartDate').value = today.toISOString().split('T')[0];
            document.getElementById('startTime').value = '08:00';
            document.getElementById('endTime').value = '18:00';
            
            // Set default repeat frequency to "custom"
            document.getElementById('repeatFrequency').value = 'custom';
            // Show custom days container by default
            document.getElementById('customDaysContainer').classList.remove('d-none');
            
            // Check all days by default
            ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach(day => {
                const checkbox = document.getElementById(`day${day.charAt(0).toUpperCase() + day.slice(1)}`);
                if (checkbox) checkbox.checked = true;
            });
            
            // Set "never ending" checkbox to checked by default
            document.getElementById('neverEnding').checked = true;
            document.getElementById('scheduleEndDate').disabled = true;
            
            // Set default schedule type and show appropriate settings
            document.getElementById('scheduleType').value = 'thermostat';
            this.updateSettingsDisplay('thermostat');
            
            // Reset time labels to default
            this.updateTimeLabels('time');
        
            // Re-enable all fields
        const fields = ['eventName', 'repeatFrequency', 'startTime', 'endTime', 'neverEnding', 'timeSetting', 'scheduleStartDate', 'scheduleEndDate'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.disabled = false;
        });
        
        // Show all fields
        const containers = [
            'label[for="startTime"]',
            'label[for="endTime"]', 
            'label[for="repeatFrequency"]',
            'label[for="timeSetting"]',
            'label[for="scheduleStartDate"]',
            'label[for="scheduleEndDate"]'
        ];
        containers.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                const container = element.closest('.col-md-6') || element.closest('.mb-3');
                if (container) container.style.display = 'block';
            }
        });
        } catch (error) {
            console.error('Error resetting form:', error);
        }
    }
    
    /**
     * Save the current event (create or update) - Using Action Handler
     */
    async saveEvent() {
        console.log('🔵 USER CLICKED: Save button');
        console.log('📊 Current state before save:');
        console.log('  - currentEditingId:', this.currentEditingId);
        console.log('  - currentScheduleData:', this.currentScheduleData);
        
        try {
            const formData = this.getEventFormData();
            if (!formData) return; // Validation failed
            
            console.log('📊 FINAL form data with excluded dates:', formData.exclude_dates);
            
            // Use action handler for save operations
            if (this.currentEditingId) {
                await this.actionHandler.handleUserAction('UPDATE_EVENT', {
                    scheduleId: this.currentEditingId,
                    updates: formData
                });
            } else {
                await this.actionHandler.handleUserAction('CREATE_EVENT', {
                    formData: formData
                });
            }
            

            // Only show success and close modal if we get here without errors
            this.showSuccess(this.currentEditingId ? 'Event updated successfully' : 'Event created successfully');
            
            // Close modal and reset after successful operation
            const modal = bootstrap.Modal.getInstance(document.getElementById('eventModal'));
            if (modal) modal.hide();
            this.resetEventForm();
            
        } catch (error) {
            console.error('Error saving event:', error);
            this.showError(error.message || 'Failed to save event');
            // Keep modal open on error so user can fix the issue
        }
    }
    

    
    /**
     * Format time for display
     */
    formatTime(timeString) {
        try {
            const date = new Date(timeString);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return timeString;
        }
    }
    
    /**
     * Delete an event
     */
    /**
     * Delete event using action handler
     */
    async deleteEvent(scheduleId) {
        if (!confirm('Are you sure you want to delete this event?')) {
            return;
        }
        
        // Check if this is a temporary single event (created from "Just This Event" but not saved)
        const scheduleInDatabase = this.schedules.find(s => s.id === scheduleId);
        const currentSchedule = this.currentScheduleData || {};
        
        if (!scheduleInDatabase) {
            // This is a temporary single event that hasn't been saved
            // Check if this is a single event from series
            if (currentSchedule._isSingleFromSeries && currentSchedule._originalScheduleId) {
                // Delete the single occurrence by adding to exclude_dates
                const originalSchedule = this.schedules.find(s => s.id === currentSchedule._originalScheduleId);
                if (originalSchedule) {
                    const excludeDate = currentSchedule._eventDate || currentSchedule.start_date;
                    const updatedExcludes = [...(originalSchedule.exclude_dates || [])];
                    
                    if (!updatedExcludes.includes(excludeDate)) {
                        updatedExcludes.push(excludeDate);
                    }
                    
                    await this.actionHandler.handleUserAction('UPDATE_EVENT', {
                        scheduleId: originalSchedule.id,
                        updates: {
                            ...originalSchedule,
                            exclude_dates: updatedExcludes
                        }
                    });
                    
                    this.showSuccess('Single event occurrence deleted successfully');
                }
            } else if (this.pendingSingleEventEdit && this.pendingSingleEventEdit.originalSchedule) {
                // Fallback to pending single event edit info
                const originalSchedule = this.pendingSingleEventEdit.originalSchedule;
                const excludeDate = this.pendingSingleEventEdit.excludeDate;
                
                await this.actionHandler.handleUserAction('UPDATE_EVENT', {
                    scheduleId: originalSchedule.id,
                    updates: {
                        ...originalSchedule,
                        exclude_dates: [...(originalSchedule.exclude_dates || []), excludeDate]
                    }
                });
                
                this.showSuccess('Single event occurrence deleted successfully');
            } else {
                // Just close the modal if no pending info
                console.log('Temporary event not saved, closing modal');
            }
            
            bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
            return;
        }
        
        // Prevent deletion of unoccupied default schedule
        if (scheduleInDatabase && scheduleInDatabase.is_default) {
            this.showError('Cannot delete the default unoccupied schedule');
            return;
        }
        
        // Use action handler for normal deletion
        await this.actionHandler.handleUserAction('DELETE_EVENT', {
            scheduleId: scheduleId
        });
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
        this.showSuccess('Event deleted successfully');
    }
    
    /**
     * Get form data for event creation/update
     */
    getEventFormData() {
        const form = document.getElementById('eventForm');
        
        // Basic validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return null;
        }
        
        // Combine date and time fields
        const scheduleStartDate = document.getElementById('scheduleStartDate').value;
        const startTime = document.getElementById('startTime').value;
        const scheduleEndDate = document.getElementById('scheduleEndDate').value;
        const endTime = document.getElementById('endTime').value;
        const neverEnding = document.getElementById('neverEnding').checked;
        
        // Build form data using 4-value structure
        const repeatFrequency = document.getElementById('repeatFrequency').value;
        
        const formData = {
            event_name: document.getElementById('eventName').value,
            schedule_type: document.getElementById('scheduleType').value,
            repeat_frequency: repeatFrequency,
            time_setting: document.getElementById('timeSetting').value,
            // 4-value structure: always separate date and time
            start_date: scheduleStartDate,
            // For one-time events, end_date MUST equal start_date (single day only)
            end_date: repeatFrequency === 'never' ? 
                      scheduleStartDate :  // One-time events are single day only
                      (neverEnding ? 'never' : (scheduleEndDate || scheduleStartDate)),
            start_time: startTime, // Always HH:MM format
            end_time: endTime,     // Always HH:MM format
            settings: this.gatherScheduleSettings(document.getElementById('scheduleType').value)
        };
        
        // Validate heat < cool when both are shown
        const scheduleType = formData.schedule_type;
        if (scheduleType === 'thermostat' || scheduleType === 'thermostat+humidistat') {
            const settings = formData.settings;
            const systemMode = settings.system_mode;
            
            if (systemMode === 'Auto' && settings.heat_setpoint && settings.cool_setpoint) {
                const heat = parseFloat(settings.heat_setpoint);
                const cool = parseFloat(settings.cool_setpoint);
                
                if (heat >= cool) {
                    this.showError('Heat setpoint must be less than cool setpoint when using Auto mode');
                    return null;
                }
                
                // Add a 2-degree deadband minimum
                if (cool - heat < 2) {
                    this.showError('Cool setpoint must be at least 2°F higher than heat setpoint');
                    return null;
                }
            }
        }
        
        // Handle custom days
        if (formData.repeat_frequency === 'custom') {
            const days = [];
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
                const checkbox = document.getElementById(`day${day.charAt(0).toUpperCase() + day.slice(1)}`);
                if (checkbox && checkbox.checked) {
                    days.push(day);
                }
            });
            formData.days_of_week = days;
        }
        
        // Read excluded dates directly from what's visible in the UI
        formData.exclude_dates = [];
        const excludedDatesList = document.getElementById('excludedDatesList');
        if (excludedDatesList) {
            excludedDatesList.querySelectorAll('[id^="excluded-"]').forEach(el => {
                const dateStr = el.id.replace('excluded-', '');
                if (dateStr) {
                    formData.exclude_dates.push(dateStr);
                }
            });
        }
        console.log('📊 FORM SAVE - Excluded dates from UI:', formData.exclude_dates);
        
        // Remove null/empty values from settings
        Object.keys(formData.settings).forEach(key => {
            if (formData.settings[key] === null || formData.settings[key] === '') {
                delete formData.settings[key];
            }
        });
        
        return formData;
    }
    
    /**
     * Export recipe JSON for ThingsBoard
     */
    async exportRecipe() {
        try {
            // Create export data with schedules
            const exportData = {
                schedules: this.schedules,
                metadata: {
                    version: "1.0",
                    exported_at: new Date().toISOString(),
                    total_schedules: this.schedules.length
                }
            };
            
            // Create download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hvac-schedule-recipe-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccess('Recipe exported successfully');
            
        } catch (error) {
            console.error('Error exporting recipe:', error);
            this.showError('Failed to export recipe');
        }
    }
    
    /**
     * Import recipe JSON and validate
     */
    async importRecipe(file) {
        try {
            const text = await file.text();
            let importData;
            
            try {
                importData = JSON.parse(text);
            } catch (parseError) {
                this.showError('Invalid JSON file format');
                return;
            }
            
            // Validate imported data
            const validation = this.validateImportData(importData);
            if (!validation.valid) {
                this.showError(`Import failed: ${validation.errors.join(', ')}`);
                return;
            }
            
            // Show confirmation dialog
            const confirmMessage = `Import ${validation.scheduleCount} schedules?\n\nThis will clear all existing schedules and replace them with imported ones.`;
            if (!confirm(confirmMessage)) {
                return;
            }
            
            // Clear all existing schedules first (keep only unoccupied default)
            await this.clearAllSchedules();
            
            // Add imported schedules
            for (const schedule of importData.schedules) {
                // Generate unique ID if not present
                if (!schedule.id) {
                    schedule.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                }
                
                // Add timestamps if missing
                if (!schedule.created_at) {
                    schedule.created_at = new Date().toISOString();
                }
                if (!schedule.updated_at) {
                    schedule.updated_at = new Date().toISOString();
                }
                
                this.schedules.push(schedule);
            }
            
            this.actionHandler.schedules = this.schedules;
            
            // Ensure unoccupied schedule exists
            this.ensureUnoccupiedSchedule();
            this.actionHandler.schedules = this.schedules;
            
            // Save to backend
            await this.actionHandler.saveSchedules();
            
            // Refresh all views
            this.calendarView.refresh();
            this.listView.refresh();
            
            this.showSuccess(`Successfully imported ${validation.scheduleCount} schedules`);
            
        } catch (error) {
            console.error('Error importing recipe:', error);
            this.showError('Failed to import recipe');
        }
    }
    
    /**
     * Handle clear all schedules button click
     */
    async handleClearAllSchedules() {
        // Show confirmation dialog
        const confirmMessage = `Clear all schedules?\n\nThis will remove all scheduled events except the default unoccupied schedule. This action cannot be undone.`;
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            await this.clearAllSchedules();
            
            // Refresh all views
            this.calendarView.refresh();
            this.listView.refresh();
            
            this.showSuccess('All schedules cleared successfully');
            
        } catch (error) {
            console.error('Error clearing schedules:', error);
            this.showError('Failed to clear schedules');
        }
    }

    /**
     * Clear all existing schedules except unoccupied default
     */
    async clearAllSchedules() {
        // Keep only the unoccupied default schedule
        this.schedules = this.schedules.filter(schedule => schedule.is_default);
        this.actionHandler.schedules = this.schedules;
        
        // Ensure we have an unoccupied schedule
        this.ensureUnoccupiedSchedule();
        this.actionHandler.schedules = this.schedules;
        
        // Save the cleared state
        await this.actionHandler.saveSchedules();
    }

    /**
     * Validate imported data structure and content
     */
    validateImportData(data) {
        const errors = [];
        let scheduleCount = 0;
        
        // Check if schedules array exists
        if (!data.schedules || !Array.isArray(data.schedules)) {
            errors.push('Missing or invalid schedules array');
            return { valid: false, errors, scheduleCount };
        }
        
        scheduleCount = data.schedules.length;
        
        if (scheduleCount === 0) {
            errors.push('No schedules found in import file');
            return { valid: false, errors, scheduleCount };
        }
        
        // Validate each schedule
        data.schedules.forEach((schedule, index) => {
            const scheduleErrors = this.validateSchedule(schedule, index);
            errors.push(...scheduleErrors);
        });
        
        // Check for duplicate IDs
        const ids = data.schedules.map(s => s.id).filter(id => id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
            errors.push('Duplicate schedule IDs found');
        }
        
        return {
            valid: errors.length === 0,
            errors,
            scheduleCount
        };
    }
    
    /**
     * Validate individual schedule
     */
    validateSchedule(schedule, index) {
        const errors = [];
        const prefix = `Schedule ${index + 1}`;
        
        // Required fields
        const requiredFields = ['event_name', 'schedule_type', 'repeat_frequency', 'start_date', 'end_date', 'start_time', 'end_time'];
        
        for (const field of requiredFields) {
            if (!schedule[field] && schedule[field] !== 0) {
                errors.push(`${prefix}: Missing required field '${field}'`);
            }
        }
        
        // Validate schedule type
        if (schedule.schedule_type && !['thermostat', 'lighting', 'humidistat', 'thermostat+humidistat'].includes(schedule.schedule_type)) {
            errors.push(`${prefix}: Invalid schedule type '${schedule.schedule_type}'`);
        }
        
        // Validate repeat frequency
        if (schedule.repeat_frequency && !['never', 'custom'].includes(schedule.repeat_frequency)) {
            errors.push(`${prefix}: Invalid repeat frequency '${schedule.repeat_frequency}'`);
        }
        
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (schedule.start_date && !dateRegex.test(schedule.start_date)) {
            errors.push(`${prefix}: Invalid start_date format (expected YYYY-MM-DD)`);
        }
        if (schedule.end_date && schedule.end_date !== 'never' && !dateRegex.test(schedule.end_date)) {
            errors.push(`${prefix}: Invalid end_date format (expected YYYY-MM-DD or 'never')`);
        }
        
        // Validate time format (HH:MM)
        const timeRegex = /^\d{2}:\d{2}$/;
        if (schedule.start_time && !timeRegex.test(schedule.start_time)) {
            errors.push(`${prefix}: Invalid start_time format (expected HH:MM)`);
        }
        if (schedule.end_time && !timeRegex.test(schedule.end_time)) {
            errors.push(`${prefix}: Invalid end_time format (expected HH:MM)`);
        }
        
        // Validate days_of_week if repeat_frequency is custom
        if (schedule.repeat_frequency === 'custom') {
            if (!schedule.days_of_week || !Array.isArray(schedule.days_of_week)) {
                errors.push(`${prefix}: Missing or invalid days_of_week for custom repeat`);
            } else {
                const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                for (const day of schedule.days_of_week) {
                    if (!validDays.includes(day)) {
                        errors.push(`${prefix}: Invalid day '${day}' in days_of_week`);
                    }
                }
            }
        }
        
        // Validate settings based on schedule type
        if (schedule.settings && typeof schedule.settings === 'object') {
            const settingsErrors = this.validateScheduleSettings(schedule.settings, schedule.schedule_type, prefix);
            errors.push(...settingsErrors);
        }
        
        return errors;
    }
    
    /**
     * Validate schedule settings based on type
     */
    validateScheduleSettings(settings, scheduleType, prefix) {
        const errors = [];
        
        switch(scheduleType) {
            case 'thermostat':
                // Validate system mode
                if (settings.system_mode && !['Heat', 'Cool', 'Auto', 'Off'].includes(settings.system_mode)) {
                    errors.push(`${prefix}: Invalid system_mode '${settings.system_mode}'`);
                }
                // Validate fan setting
                if (settings.fan && !['auto', '0', '5', '10', '15', '20', '30', '45', '60'].includes(settings.fan)) {
                    errors.push(`${prefix}: Invalid fan setting '${settings.fan}'`);
                }
                // Validate temperature setpoints
                if (settings.heat_setpoint) {
                    const heat = parseInt(settings.heat_setpoint);
                    if (isNaN(heat) || heat < 50 || heat > 90) {
                        errors.push(`${prefix}: Heat setpoint must be between 50-90°F`);
                    }
                }
                if (settings.cool_setpoint) {
                    const cool = parseInt(settings.cool_setpoint);
                    if (isNaN(cool) || cool < 60 || cool > 100) {
                        errors.push(`${prefix}: Cool setpoint must be between 60-100°F`);
                    }
                }
                break;
                
            case 'lighting':
                // Validate lighting status
                if (settings.lighting_status && !['on', 'off'].includes(settings.lighting_status)) {
                    errors.push(`${prefix}: Invalid lighting_status '${settings.lighting_status}'`);
                }
                break;
                
            case 'humidistat':
                // Validate humidity setpoints
                if (settings.humidity_low_setpoint) {
                    const low = parseInt(settings.humidity_low_setpoint);
                    if (isNaN(low) || low < 0 || low > 100) {
                        errors.push(`${prefix}: Humidity low setpoint must be between 0-100%`);
                    }
                }
                if (settings.humidity_high_setpoint) {
                    const high = parseInt(settings.humidity_high_setpoint);
                    if (isNaN(high) || high < 0 || high > 100) {
                        errors.push(`${prefix}: Humidity high setpoint must be between 0-100%`);
                    }
                }
                break;
                
            case 'thermostat+humidistat':
                // Validate system mode
                if (settings.system_mode && !['Heat', 'Cool', 'Auto', 'Off'].includes(settings.system_mode)) {
                    errors.push(`${prefix}: Invalid system_mode '${settings.system_mode}'`);
                }
                // Validate fan setting
                if (settings.fan && !['auto', '0', '5', '10', '15', '20', '30', '45', '60'].includes(settings.fan)) {
                    errors.push(`${prefix}: Invalid fan setting '${settings.fan}'`);
                }
                // Validate temperature setpoints
                if (settings.heat_setpoint) {
                    const heat = parseInt(settings.heat_setpoint);
                    if (isNaN(heat) || heat < 50 || heat > 90) {
                        errors.push(`${prefix}: Heat setpoint must be between 50-90°F`);
                    }
                }
                if (settings.cool_setpoint) {
                    const cool = parseInt(settings.cool_setpoint);
                    if (isNaN(cool) || cool < 60 || cool > 100) {
                        errors.push(`${prefix}: Cool setpoint must be between 60-100°F`);
                    }
                }
                // Validate heat < cool when both are present and mode is Auto
                if (settings.system_mode === 'Auto' && settings.heat_setpoint && settings.cool_setpoint) {
                    const heat = parseInt(settings.heat_setpoint);
                    const cool = parseInt(settings.cool_setpoint);
                    if (heat >= cool) {
                        errors.push(`${prefix}: Heat setpoint must be less than cool setpoint when using Auto mode`);
                    }
                    if (cool - heat < 2) {
                        errors.push(`${prefix}: Cool setpoint must be at least 2°F higher than heat setpoint`);
                    }
                }
                // Validate humidity setpoints
                if (settings.humidity_low_setpoint) {
                    const low = parseInt(settings.humidity_low_setpoint);
                    if (isNaN(low) || low < 0 || low > 100) {
                        errors.push(`${prefix}: Humidity low setpoint must be between 0-100%`);
                    }
                }
                if (settings.humidity_high_setpoint) {
                    const high = parseInt(settings.humidity_high_setpoint);
                    if (isNaN(high) || high < 0 || high > 100) {
                        errors.push(`${prefix}: Humidity high setpoint must be between 0-100%`);
                    }
                }
                // Validate humidity low < high
                if (settings.humidity_low_setpoint && settings.humidity_high_setpoint) {
                    const low = parseInt(settings.humidity_low_setpoint);
                    const high = parseInt(settings.humidity_high_setpoint);
                    if (low >= high) {
                        errors.push(`${prefix}: Humidity low setpoint must be less than high setpoint`);
                    }
                }
                break;
        }
        
        return errors;
    }
    
    /**
     * Format date for datetime-local input
     */
    formatDateTimeLocal(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.showToast(message, 'error');
    }
    
    /**
     * Show warning message
     */
    showWarning(message) {
        this.showToast(message, 'warning');
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Create toast element
        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'primary'} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        
        // Add to page
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        // Show toast
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();
        
        // Remove element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Initialize the scheduler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.hvacScheduler = new HVACScheduler();
});
