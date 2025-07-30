/**
 * HVAC Scheduler - List View
 * Handles schedule list display and current status overview
 */
class ListView {
    constructor(scheduler) {
        this.scheduler = scheduler;
        this.init();
    }
    
    /**
     * Initialize the list view
     */
    init() {
        console.log('List view initialized');
        this.refresh();
    }
    
    /**
     * Refresh the list view
     */
    refresh() {
        this.renderScheduleList();
        this.renderCurrentSettings();
    }
    
    /**
     * Render the schedule list as simulation
     */
    renderScheduleList() {
        const container = document.getElementById('scheduleList');
        const schedules = this.scheduler.schedules || [];
        
        if (schedules.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-calendar-times fa-3x mb-3"></i>
                    <h5>No schedules found</h5>
                    <p>Create your first schedule to get started.</p>
                    <button class="btn btn-primary" onclick="window.hvacScheduler.openEventModal()">
                        <i class="fas fa-plus me-2"></i>
                        Add Schedule
                    </button>
                </div>
            `;
            return;
        }
        
        // Generate simulation for next 7 days
        const simulationEvents = this.generateScheduleSimulation(schedules);
        
        let html = '<div class="mb-3">';
        html += '<h6 class="text-light mb-3"><i class="fas fa-play me-2"></i>Schedule Simulation (Next 7 Days)</h6>';
        
        if (simulationEvents.length === 0) {
            const defaultSchedule = schedules.find(s => s.is_default);
            html += `
                <div class="schedule-item default fade-in">
                    <div class="schedule-header">
                        <div class="d-flex align-items-center">
                            <i class="fas fa-clock text-warning me-2"></i>
                            <span class="schedule-name">Unoccupied (Always Active)</span>
                            <span class="badge bg-warning text-dark ms-2">Default</span>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="schedule-type">thermostat</span>
                            <button class="btn btn-sm btn-outline-light ms-2" onclick="window.hvacScheduler.openUnoccupiedSettings()">
                                <i class="fas fa-cog"></i>
                            </button>
                        </div>
                    </div>
                    <div class="schedule-time">
                        <i class="fas fa-clock me-1"></i>Active when no other schedules are running
                    </div>
                    <div class="schedule-settings">
                        ${this.formatScheduleSettings(defaultSchedule && defaultSchedule.settings ? JSON.parse(defaultSchedule.settings) : {}, defaultSchedule ? defaultSchedule.schedule_type : 'thermostat')}
                    </div>
                </div>
            `;
        } else {
            simulationEvents.forEach(event => {
                html += this.renderSimulationEvent(event);
            });
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add event listeners
        this.addScheduleItemListeners();
    }
    
    /**
     * Generate simulation events for the next 7 days
     */
    generateScheduleSimulation(schedules) {
        const events = [];
        const now = new Date();
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        const defaultSchedule = schedules.find(s => s.is_default);
        
        // Get all active schedules (non-default)
        const activeSchedules = schedules.filter(s => !s.is_default);
        
        // Generate events for each day
        for (let date = new Date(now); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dayEvents = [];
            
            // Check each active schedule for this day
            activeSchedules.forEach(schedule => {
                if (this.isScheduleActiveOnDate(schedule, date)) {
                    const eventStart = new Date(date);
                    const originalStart = schedule.start_time ? new Date(schedule.start_time) : null;
                    const originalEnd = schedule.end_time ? new Date(schedule.end_time) : null;
                    
                    if (originalStart) {
                        eventStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
                        
                        let eventEnd = null;
                        if (originalEnd) {
                            eventEnd = new Date(date);
                            eventEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);
                            if (eventEnd <= eventStart) {
                                eventEnd.setDate(eventEnd.getDate() + 1);
                            }
                        }
                        
                        dayEvents.push({
                            schedule: schedule,
                            start: new Date(eventStart),
                            end: eventEnd,
                            isDefault: false
                        });
                    }
                }
            });
            
            // Sort events by start time
            dayEvents.sort((a, b) => a.start - b.start);
            
            // Add gaps filled with unoccupied schedule
            if (dayEvents.length === 0) {
                // Entire day is unoccupied
                events.push({
                    schedule: defaultSchedule,
                    start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0),
                    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59),
                    isDefault: true,
                    isAllDay: true
                });
            } else {
                // Add unoccupied periods between events
                let currentTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0);
                
                dayEvents.forEach((event, index) => {
                    // Add unoccupied period before this event
                    if (event.start > currentTime) {
                        events.push({
                            schedule: defaultSchedule,
                            start: new Date(currentTime),
                            end: new Date(event.start),
                            isDefault: true
                        });
                    }
                    
                    // Add the scheduled event
                    events.push(event);
                    
                    // Update current time
                    currentTime = event.end || new Date(event.start.getTime() + 60 * 60 * 1000); // Default 1 hour
                });
                
                // Add unoccupied period at end of day if needed
                const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59);
                if (currentTime < endOfDay) {
                    events.push({
                        schedule: defaultSchedule,
                        start: new Date(currentTime),
                        end: endOfDay,
                        isDefault: true
                    });
                }
            }
        }
        
        return events.filter(e => e.start > now).slice(0, 20); // Show next 20 events
    }
    
    /**
     * Check if a schedule is active on a specific date
     */
    isScheduleActiveOnDate(schedule, date) {
        if (!schedule) return false;
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        
        // Check if the date is within the schedule's validity period
        if (schedule.start_time) {
            const scheduleStart = new Date(schedule.start_time);
            scheduleStart.setHours(0, 0, 0, 0);
            if (checkDate < scheduleStart) return false;
        }
        
        if (schedule.end_time) {
            const scheduleEnd = new Date(schedule.end_time);
            scheduleEnd.setHours(0, 0, 0, 0);
            if (checkDate > scheduleEnd) return false;
        }
        
        switch (schedule.repeat_frequency) {
            case 'daily':
                return true;
            case 'weekly':
                // For weekly, check if it's the same day as the start date
                if (schedule.start_time) {
                    const startDate = new Date(schedule.start_time);
                    const startDay = startDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    return dayName === startDay;
                }
                return true;
            case 'custom':
                return schedule.days_of_week && schedule.days_of_week.includes(dayName);
            default:
                return false;
        }
    }
    
    /**
     * Render a simulation event
     */
    renderSimulationEvent(event) {
        const schedule = event.schedule;
        if (!schedule) return '';
        
        const isActive = event.start <= new Date() && (event.end ? event.end >= new Date() : false);
        const settings = schedule.settings && typeof schedule.settings === 'string' ? 
                         JSON.parse(schedule.settings) : 
                         schedule.settings || {};
        
        const activeClass = isActive ? 'active' : '';
        const defaultClass = event.isDefault ? 'default' : '';
        
        const statusIcon = event.isDefault ? 'fas fa-clock' :
                          isActive ? 'fas fa-play-circle' : 'fas fa-pause-circle';
        const statusColor = event.isDefault ? 'text-warning' :
                           isActive ? 'text-success' : 'text-muted';
        
        return `
            <div class="schedule-item ${activeClass} ${defaultClass} fade-in mb-2" style="font-size: 0.9rem; padding: 0.75rem;">
                <div class="schedule-header">
                    <div class="d-flex align-items-center">
                        <i class="${statusIcon} ${statusColor} me-2"></i>
                        <span class="schedule-name">${schedule.event_name}</span>
                        ${event.isDefault ? '<span class="badge bg-warning text-dark ms-2">Unoccupied</span>' : ''}
                        ${isActive ? '<span class="badge bg-success ms-2">Active Now</span>' : ''}
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="schedule-type">${schedule.schedule_type}</span>
                    </div>
                </div>
                
                <div class="schedule-time">
                    ${this.formatSimulationEventTime(event)}
                </div>
                
                <div class="schedule-settings">
                    ${this.formatScheduleSettings(settings, schedule.schedule_type)}
                </div>
            </div>
        `;
    }
    
    /**
     * Format simulation event time
     */
    formatSimulationEventTime(event) {
        if (event.isAllDay) {
            return `<i class="fas fa-calendar-day me-1"></i>All day - ${event.start.toDateString()}`;
        }
        
        const startStr = event.start.toLocaleString([], { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let endStr = '';
        if (event.end) {
            endStr = event.end.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
        
        const now = new Date();
        if (event.start <= now && (event.end ? event.end >= now : false)) {
            return `<i class="fas fa-play me-1"></i>Started: ${startStr}${endStr ? ` - ${endStr}` : ''}`;
        } else if (event.start > now) {
            const diffMs = event.start - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            let timeUntil = '';
            if (diffDays > 0) {
                timeUntil = ` (in ${diffDays} day${diffDays > 1 ? 's' : ''})`;
            } else if (diffHours > 0) {
                timeUntil = ` (in ${diffHours} hour${diffHours > 1 ? 's' : ''})`;
            } else {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                timeUntil = ` (in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''})`;
            }
            
            return `<i class="fas fa-clock me-1"></i>${startStr}${endStr ? ` - ${endStr}` : ''}${timeUntil}`;
        } else {
            return `<i class="fas fa-history me-1"></i>Ended: ${startStr}${endStr ? ` - ${endStr}` : ''}`;
        }
    }
    
    /**
     * Render a single schedule item
     */
    renderScheduleItem(schedule) {
        const isActive = this.isScheduleCurrentlyActive(schedule);
        const nextOccurrence = this.getNextOccurrence(schedule);
        const settings = schedule.settings || {};
        
        const activeClass = isActive ? 'active' : '';
        const defaultClass = schedule.is_default ? 'default' : '';
        
        const statusIcon = schedule.is_default ? 'fas fa-clock' :
                          isActive ? 'fas fa-play-circle' : 'fas fa-pause-circle';
        const statusColor = schedule.is_default ? 'text-warning' :
                           isActive ? 'text-success' : 'text-muted';
        
        return `
            <div class="schedule-item ${activeClass} ${defaultClass} fade-in" data-schedule-id="${schedule.id}">
                <div class="schedule-header">
                    <div class="d-flex align-items-center">
                        <i class="${statusIcon} ${statusColor} me-2"></i>
                        <span class="schedule-name">${schedule.event_name}</span>
                        ${schedule.is_default ? '<span class="badge bg-warning text-dark ms-2">Default</span>' : ''}
                        ${isActive ? '<span class="badge bg-success ms-2">Active</span>' : ''}
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="schedule-type">${schedule.schedule_type}</span>
                        ${!schedule.is_default ? `
                            <button class="btn btn-sm btn-outline-light ms-2" onclick="window.hvacScheduler.openEventModal(null, JSON.parse('${JSON.stringify(schedule).replace(/'/g, "\\'")}'))">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="schedule-time">
                    ${this.formatScheduleTime(schedule, nextOccurrence)}
                </div>
                
                <div class="schedule-settings">
                    ${this.formatScheduleSettings(settings, schedule.schedule_type)}
                </div>
                
                ${this.renderScheduleDetails(schedule)}
            </div>
        `;
    }
    
    /**
     * Format schedule time display
     */
    formatScheduleTime(schedule, nextOccurrence) {
        let timeStr = '';
        
        if (schedule.is_default) {
            timeStr = 'Always active when no other schedules are running';
        } else if (nextOccurrence) {
            const now = new Date();
            const diffMs = nextOccurrence - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffMs < 0) {
                timeStr = 'Currently running';
            } else if (diffDays > 0) {
                timeStr = `Next: ${nextOccurrence.toLocaleDateString()} at ${nextOccurrence.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (in ${diffDays} days)`;
            } else if (diffHours > 0) {
                timeStr = `Next: ${nextOccurrence.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (in ${diffHours} hours)`;
            } else {
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                timeStr = `Next: ${nextOccurrence.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (in ${diffMinutes} minutes)`;
            }
        } else {
            timeStr = 'No upcoming occurrences';
        }
        
        return `<i class="fas fa-clock me-1"></i>${timeStr}`;
    }
    
    /**
     * Format schedule settings for display
     */
    formatScheduleSettings(settings, scheduleType) {
        if (!settings || Object.keys(settings).length === 0) {
            return '<span class="text-muted">No settings configured</span>';
        }
        
        let html = '';
        
        // Different display based on schedule type
        switch(scheduleType) {
            case 'thermostat':
                // System mode
                if (settings.system_mode) {
                    const modeIcon = this.getSystemModeIcon(settings.system_mode);
                    html += `
                        <div class="setting-item">
                            <i class="${modeIcon} me-1"></i>
                            <span class="setting-label">Mode:</span>
                            <span class="setting-value">${settings.system_mode}</span>
                        </div>
                    `;
                }
                
                // Temperature setpoints - only show what's relevant for the mode
                if (settings.system_mode === 'Heat' && settings.heat_setpoint) {
                    html += `<div class="setting-item"><i class="fas fa-fire text-danger me-1"></i>${settings.heat_setpoint}°</div>`;
                } else if (settings.system_mode === 'Cool' && settings.cool_setpoint) {
                    html += `<div class="setting-item"><i class="fas fa-snowflake text-info me-1"></i>${settings.cool_setpoint}°</div>`;
                } else if (settings.system_mode === 'Auto') {
                    html += '<div class="setting-item">';
                    if (settings.heat_setpoint) {
                        html += `<i class="fas fa-fire text-danger me-1"></i>${settings.heat_setpoint}°`;
                    }
                    if (settings.heat_setpoint && settings.cool_setpoint) {
                        html += ' / ';
                    }
                    if (settings.cool_setpoint) {
                        html += `<i class="fas fa-snowflake text-info me-1"></i>${settings.cool_setpoint}°`;
                    }
                    html += '</div>';
                }
                
                // Fan setting
                if (settings.fan) {
                    html += `
                        <div class="setting-item">
                            <i class="fas fa-fan me-1"></i>
                            <span class="setting-label">Fan:</span>
                            <span class="setting-value">${settings.fan === 'auto' ? 'Auto' : settings.fan + ' min/hr'}</span>
                        </div>
                    `;
                }
                break;
                
            case 'lighting':
                // Lighting status
                if (settings.lighting_status) {
                    const isOn = settings.lighting_status === 'on';
                    html += `
                        <div class="setting-item">
                            <i class="fas fa-lightbulb ${isOn ? 'text-warning' : 'text-muted'} me-1"></i>
                            <span class="setting-label">Lights:</span>
                            <span class="setting-value">${isOn ? 'On' : 'Off'}</span>
                        </div>
                    `;
                }
                break;
                
            case 'humidistat':
                // Humidity setpoints
                if (settings.humidity_low_setpoint || settings.humidity_high_setpoint) {
                    html += `
                        <div class="setting-item">
                            <i class="fas fa-tint me-1"></i>
                            <span class="setting-label">Humidity Range:</span>
                            <span class="setting-value">${settings.humidity_low_setpoint || '30'}% - ${settings.humidity_high_setpoint || '60'}%</span>
                        </div>
                    `;
                }
                break;
                
            case 'thermostat+humidistat':
                // System mode
                if (settings.system_mode) {
                    const modeIcon = this.getSystemModeIcon(settings.system_mode);
                    html += `
                        <div class="setting-item">
                            <i class="${modeIcon} me-1"></i>
                            <span class="setting-label">Mode:</span>
                            <span class="setting-value">${settings.system_mode}</span>
                        </div>
                    `;
                }
                
                // Temperature setpoints - only show what's relevant for the mode
                if (settings.system_mode === 'Heat' && settings.heat_setpoint) {
                    html += `<div class="setting-item"><i class="fas fa-fire text-danger me-1"></i>${settings.heat_setpoint}°</div>`;
                } else if (settings.system_mode === 'Cool' && settings.cool_setpoint) {
                    html += `<div class="setting-item"><i class="fas fa-snowflake text-info me-1"></i>${settings.cool_setpoint}°</div>`;
                } else if (settings.system_mode === 'Auto') {
                    html += '<div class="setting-item">';
                    if (settings.heat_setpoint) {
                        html += `<i class="fas fa-fire text-danger me-1"></i>${settings.heat_setpoint}°`;
                    }
                    if (settings.heat_setpoint && settings.cool_setpoint) {
                        html += ' / ';
                    }
                    if (settings.cool_setpoint) {
                        html += `<i class="fas fa-snowflake text-info me-1"></i>${settings.cool_setpoint}°`;
                    }
                    html += '</div>';
                }
                
                // Fan setting
                if (settings.fan) {
                    html += `
                        <div class="setting-item">
                            <i class="fas fa-fan me-1"></i>
                            <span class="setting-label">Fan:</span>
                            <span class="setting-value">${settings.fan === 'auto' ? 'Auto' : settings.fan + ' min/hr'}</span>
                        </div>
                    `;
                }
                
                // Humidity
                if (settings.humidity_low_setpoint || settings.humidity_high_setpoint) {
                    html += `
                        <div class="setting-item">
                            <i class="fas fa-tint me-1"></i>
                            <span class="setting-label">Humidity Range:</span>
                            <span class="setting-value">${settings.humidity_low_setpoint || '30'}% - ${settings.humidity_high_setpoint || '60'}%</span>
                        </div>
                    `;
                }
                break;
        }
        
        return html || '<span class="text-muted">No settings configured</span>';
    }
    
    /**
     * Render additional schedule details
     */
    renderScheduleDetails(schedule) {
        let details = '';
        
        // Repeat frequency details
        if (schedule.repeat_frequency === 'custom' && schedule.days_of_week) {
            const days = schedule.days_of_week.map(day => 
                day.charAt(0).toUpperCase() + day.slice(1, 3)
            ).join(', ');
            details += `
                <div class="mt-2 small text-muted">
                    <i class="fas fa-repeat me-1"></i>
                    Repeats: ${days}
                </div>
            `;
        } else if (schedule.repeat_frequency !== 'custom') {
            details += `
                <div class="mt-2 small text-muted">
                    <i class="fas fa-repeat me-1"></i>
                    Repeats: ${schedule.repeat_frequency}
                </div>
            `;
        }
        
        // Duration
        if (schedule.start_time && schedule.end_time) {
            const start = new Date(schedule.start_time);
            const end = new Date(schedule.end_time);
            const duration = Math.round((end - start) / (1000 * 60 * 60 * 100)) / 100;
            
            if (duration > 0) {
                details += `
                    <div class="mt-1 small text-muted">
                        <i class="fas fa-hourglass-half me-1"></i>
                        Duration: ${duration} hours
                    </div>
                `;
            }
        }
        
        return details;
    }
    
    /**
     * Render current settings panel
     */
    renderCurrentSettings() {
        const container = document.getElementById('currentSettings');
        const currentStatus = this.scheduler.currentStatus;
        
        if (!currentStatus) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p class="mt-2">Loading current settings...</p>
                </div>
            `;
            return;
        }
        
        const current = currentStatus.current_schedule;
        const next = currentStatus.next_event;
        
        let html = `
            <div class="current-settings">
                <div class="setting-group">
                    <div class="setting-group-title">Current Schedule</div>
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-${current.is_default ? 'clock' : 'cog'} text-${current.is_default ? 'warning' : 'success'} me-2"></i>
                        <strong>${current.event_name || 'Unknown'}</strong>
                    </div>
                    ${this.formatCurrentSettings(current.settings)}
                </div>
        `;
        
        if (next) {
            const nextTime = new Date(next.start_time);
            const timeUntil = this.getTimeUntilText(nextTime);
            
            html += `
                <div class="setting-group">
                    <div class="setting-group-title">Next Event</div>
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-clock text-info me-2"></i>
                        <strong>${next.event_name}</strong>
                    </div>
                    <div class="small text-muted mb-2">
                        ${nextTime.toLocaleString()} ${timeUntil}
                    </div>
                    ${this.formatCurrentSettings(next.settings)}
                </div>
            `;
        } else {
            html += `
                <div class="setting-group">
                    <div class="setting-group-title">Next Event</div>
                    <div class="text-muted">No upcoming events</div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    /**
     * Format current settings for display
     */
    formatCurrentSettings(settings) {
        if (!settings || Object.keys(settings).length === 0) {
            return '<div class="text-muted small">No settings configured</div>';
        }
        
        let html = '';
        
        Object.entries(settings).forEach(([key, value]) => {
            const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const icon = this.getSettingIcon(key);
            
            html += `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="text-muted">
                        <i class="${icon} me-1"></i>
                        ${displayKey}:
                    </span>
                    <span class="text-light">${this.formatSettingValue(key, value)}</span>
                </div>
            `;
        });
        
        return html;
    }
    
    /**
     * Get icon for setting type
     */
    getSettingIcon(settingKey) {
        switch (settingKey.toLowerCase()) {
            case 'system_mode':
                return 'fas fa-thermometer-half';
            case 'fan':
                return 'fas fa-fan';
            case 'temperature':
                return 'fas fa-temperature-high';
            case 'humidity':
                return 'fas fa-tint';
            default:
                return 'fas fa-cog';
        }
    }
    
    /**
     * Format setting value for display
     */
    formatSettingValue(key, value) {
        if (key === 'fan' && value !== 'auto') {
            return value + ' min/hr';
        }
        return value;
    }
    
    /**
     * Get icon for system mode
     */
    getSystemModeIcon(mode) {
        switch (mode.toLowerCase()) {
            case 'cool':
                return 'fas fa-snowflake text-info';
            case 'heat':
                return 'fas fa-fire text-danger';
            case 'auto':
                return 'fas fa-adjust text-warning';
            case 'off':
                return 'fas fa-power-off text-muted';
            default:
                return 'fas fa-thermometer-half';
        }
    }
    
    /**
     * Check if a schedule is currently active
     */
    isScheduleCurrentlyActive(schedule) {
        const currentStatus = this.scheduler.currentStatus;
        return currentStatus && 
               currentStatus.current_schedule && 
               currentStatus.current_schedule.id === schedule.id;
    }
    
    /**
     * Get next occurrence of a schedule
     */
    getNextOccurrence(schedule) {
        if (schedule.is_default || !schedule.start_time) {
            return null;
        }
        
        const now = new Date();
        const startTime = new Date(schedule.start_time);
        
        // Simple implementation - just check if start time is in the future
        if (startTime > now) {
            return startTime;
        }
        
        // For recurring schedules, calculate next occurrence
        // This is a simplified implementation
        const nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        
        return nextDay;
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
     * Add event listeners to schedule items
     */
    addScheduleItemListeners() {
        const scheduleItems = document.querySelectorAll('.schedule-item');
        
        scheduleItems.forEach(item => {
            const scheduleId = item.dataset.scheduleId;
            const schedule = this.scheduler.schedules.find(s => s.id == scheduleId);
            
            if (schedule && !schedule.is_default) {
                item.addEventListener('click', (e) => {
                    // Don't trigger if clicking on a button
                    if (e.target.closest('button')) return;
                    
                    window.hvacScheduler.openEventModal(null, schedule);
                });
                
                item.style.cursor = 'pointer';
            }
        });
    }
    
    /**
     * Filter schedules by type
     */
    filterSchedules(type) {
        const items = document.querySelectorAll('.schedule-item');
        
        items.forEach(item => {
            const scheduleId = item.dataset.scheduleId;
            const schedule = this.scheduler.schedules.find(s => s.id == scheduleId);
            
            if (type === 'all' || !type || schedule.schedule_type === type) {
                item.style.display = 'block';
                item.classList.add('fade-in');
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    /**
     * Search schedules by name
     */
    searchSchedules(query) {
        const items = document.querySelectorAll('.schedule-item');
        const searchTerm = query.toLowerCase();
        
        items.forEach(item => {
            const scheduleId = item.dataset.scheduleId;
            const schedule = this.scheduler.schedules.find(s => s.id == scheduleId);
            const scheduleName = schedule.event_name.toLowerCase();
            
            if (!searchTerm || scheduleName.includes(searchTerm)) {
                item.style.display = 'block';
                item.classList.add('fade-in');
            } else {
                item.style.display = 'none';
            }
        });
    }
}

// Make ListView available globally
window.ListView = ListView;
