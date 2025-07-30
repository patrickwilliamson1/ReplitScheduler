/**
 * HVAC Scheduler - Calendar View
 * Handles FullCalendar integration and drag-and-drop functionality
 */
class CalendarView {
    constructor(scheduler) {
        this.scheduler = scheduler;
        this.calendar = null;
        this.init();
    }
    
    /**
     * Get color for event based on schedule type
     */
    getEventColor(scheduleType) {
        const colors = {
            'thermostat': '#28a745',   // Green
            'humidistat': '#007bff',   // Blue  
            'lighting': '#ffc107',     // Yellow
            'thermostat+humidistat': '#17a2b8', // Teal/Cyan for combined
            'custom': '#6c757d'        // Gray
        };
        return colors[scheduleType] || colors.custom;
    }

    /**
     * Initialize the calendar view
     */
    init() {
        const calendarEl = document.getElementById('calendar');
        
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            buttonText: {
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day',
                list: 'List'
            },
            height: '100%',
            allDaySlot: false,
            slotMinTime: '00:00:00',
            slotMaxTime: '24:00:00',
            slotDuration: '00:30:00',
            snapDuration: '00:15:00',
            scrollTime: '06:00:00',
            nowIndicator: true,
            selectable: false,
            selectMirror: false,
            editable: true,
            dayMaxEvents: true,
            weekNumbers: true,
            timeZone: 'local',  // Use browser's local timezone
            
            // Event time formatting - prevent "nullnullnull" display
            eventTimeFormat: {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            },
            displayEventTime: true,
            displayEventEnd: true,
            
            // Event sources
            events: (info, successCallback, failureCallback) => {
                this.loadEvents(info, successCallback, failureCallback);
            },
            
            // Event handlers removed - no automatic event creation
            
            eventClick: (info) => {
                this.handleEventClick(info);
            },
            
            eventDrop: (info) => {
                this.handleEventDrop(info);
            },
            
            eventResize: (info) => {
                this.handleEventResize(info);
            },
            
            eventDidMount: (info) => {
                this.customizeEvent(info);
            },
            
            // Prevent overlaps during dragging
            eventOverlap: function(stillEvent, movingEvent) {
                // Allow overlapping with unoccupied events
                if (stillEvent.extendedProps.isUnoccupied || movingEvent.extendedProps.isUnoccupied) {
                    return true;
                }
                // Prevent overlapping between occupied events
                return false;
            },
            selectOverlap: (event) => {
                // Allow selection over unoccupied events only
                return event.extendedProps.isUnoccupied;
            }
        });
        
        this.calendar.render();
        console.log('Calendar view initialized');
    }
    
    /**
     * Check for overlaps after an event has been moved and notify user
     */

    
    /**
     * Find all schedules that overlap with the given event's schedule
     */
    findOverlappingEvents(targetEvent) {
        const overlappingSchedules = [];
        const targetScheduleData = targetEvent.extendedProps.scheduleData;
        
        if (!targetScheduleData) {
            return [];
        }
        
        // For recurring events, we need to check schedule-level overlaps, not just individual events
        const allSchedules = this.scheduler.schedules || [];
        
        for (const schedule of allSchedules) {
            // Skip self, unoccupied schedules, and invalid schedules
            if (schedule.id === targetScheduleData.id || 
                schedule.is_default || 
                !schedule.start_time) {
                continue;
            }
            
            // Check if schedules overlap across multiple days
            if (this.schedulesOverlap(targetScheduleData, schedule)) {
                // Find a representative event for this schedule to include in the overlap list
                const scheduleEvents = this.calendar.getEvents().filter(event => 
                    event.extendedProps.scheduleData?.id === schedule.id
                );
                
                if (scheduleEvents.length > 0) {
                    overlappingSchedules.push(scheduleEvents[0]); // Use first event as representative
                }
            }
        }
        
        return overlappingSchedules;
    }
    
    /**
     * Check if two schedules overlap in their time patterns
     */
    schedulesOverlap(schedule1, schedule2) {
        // Get time components for both schedules
        const start1 = new Date(schedule1.start_time);
        const end1 = schedule1.end_time ? new Date(schedule1.end_time) : start1;
        const start2 = new Date(schedule2.start_time);
        const end2 = schedule2.end_time ? new Date(schedule2.end_time) : start2;
        
        // Extract time of day (hours and minutes)
        const time1Start = start1.getHours() * 60 + start1.getMinutes();
        const time1End = end1.getHours() * 60 + end1.getMinutes();
        const time2Start = start2.getHours() * 60 + start2.getMinutes();
        const time2End = end2.getHours() * 60 + end2.getMinutes();
        
        // Check for time overlap
        const timeOverlaps = time1Start < time2End && time1End > time2Start;
        
        if (!timeOverlaps) {
            return false; // No time overlap, so no conflict
        }
        
        // Check if the schedules occur on the same days
        return this.schedulesOccurOnSameDays(schedule1, schedule2);
    }
    
    /**
     * Check if two schedules occur on the same days
     */
    schedulesOccurOnSameDays(schedule1, schedule2) {
        // Handle different repeat frequencies
        const freq1 = schedule1.repeat_frequency;
        const freq2 = schedule2.repeat_frequency;
        
        // If either is 'never' (one-time), check specific dates
        if (freq1 === 'never' || freq2 === 'never') {
            if (freq1 === 'never' && freq2 === 'never') {
                // Both are one-time events, check if same date
                const date1 = new Date(schedule1.start_time).toDateString();
                const date2 = new Date(schedule2.start_time).toDateString();
                return date1 === date2;
            }
            
            // One is recurring, one is not - check if one-time falls on recurring day
            const oneTime = freq1 === 'never' ? schedule1 : schedule2;
            const recurring = freq1 === 'never' ? schedule2 : schedule1;
            const oneTimeDate = new Date(oneTime.start_time);
            
            return this.doesDateMatchSchedule(oneTimeDate, recurring);
        }
        
        // Both are recurring - check for day overlap
        if (freq1 === 'custom' && freq2 === 'custom') {
            const days1 = schedule1.days_of_week || [];
            const days2 = schedule2.days_of_week || [];
            return days1.some(day => days2.includes(day));
        }
        
        // Different frequencies might still overlap
        return true; // Conservative approach - assume overlap for mixed frequencies
    }
    
    /**
     * Check if a specific date matches a recurring schedule
     */
    doesDateMatchSchedule(date, schedule) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[date.getDay()];
        
        switch (schedule.repeat_frequency) {
            case 'custom':
                const scheduleDays = schedule.days_of_week || [];
                return scheduleDays.length === 0 || scheduleDays.includes(dayName);
            default:
                return false;
        }
    }
    

    
    /**
     * Load events for the calendar
     */
    async loadEvents(info, successCallback, failureCallback) {
        try {
            const events = await this.convertSchedulesToEvents(info);
            console.log(`Calendar loading ${events.length} events for range ${info.startStr} to ${info.endStr}`);
            
            // Filter out any invalid events
            const validEvents = events.filter(event => {
                const isValid = event && event.start && event.end && event.title;
                if (!isValid) {
                    console.warn('Invalid event filtered out:', event);
                }
                // Also check if event times are within the requested range
                if (isValid) {
                    const eventStart = new Date(event.start);
                    const eventEnd = new Date(event.end);
                    const inRange = eventStart <= info.end && eventEnd >= info.start;
                    if (!inRange) {
                        console.log('Event outside range filtered out:', event.title, 'from', event.start, 'to', event.end);
                    }
                    return inRange;
                }
                return isValid;
            });
            
            console.log(`Filtered to ${validEvents.length} valid events`);
            successCallback(validEvents);
        } catch (error) {
            console.error('Error loading calendar events:', error);
            failureCallback(error);
        }
    }
    
    /**
     * Convert schedule data to FullCalendar events
     */
    async convertSchedulesToEvents(info) {
        const events = [];
        const schedules = this.scheduler.schedules || [];
        
        // Use the calendar's date range for generating events
        const startDate = info ? new Date(info.start) : new Date();
        const endDate = info ? new Date(info.end) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        // Only show non-default schedules in calendar
        for (const schedule of schedules) {
            if (!schedule.is_default && schedule.start_time) {
                console.log('Processing schedule:', schedule.event_name, 'start_time:', schedule.start_time, 'end_time:', schedule.end_time);
                const calendarEvents = this.generateEventsFromSchedule(schedule, startDate, endDate);
                console.log(`Schedule "${schedule.event_name}" generated ${calendarEvents.length} events`);
                events.push(...calendarEvents);
            }
        }
        
        // Generate unoccupied gap events for all views (limited for performance)
        const currentView = info && info.view ? info.view.type : 'timeGridWeek';
        console.log('Current view type:', currentView);
        console.log('Generating unoccupied events for date range:', startDate, 'to', endDate);
        this.generateUnoccupiedGapsLimited(events, startDate, endDate);
        
        console.log(`Total events after unoccupied generation: ${events.length}`);
        return events;
    }
    
    /**
     * Generate calendar events from a schedule
     */
    generateEventsFromSchedule(schedule, startDate = null, endDate = null) {
        const events = [];
        
        // Use provided dates or get current calendar view range
        if (!startDate || !endDate) {
            if (this.calendar && this.calendar.calendar) {
                const calendarApi = this.calendar.calendar;
                const currentView = calendarApi.view;
                startDate = new Date(currentView.currentStart);
                endDate = new Date(currentView.currentEnd);
            } else {
                // Fallback to default range if calendar not initialized
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 35);
            }
        }
        
        // Handle different repeat frequencies - smart rendering for calendar view
        switch (schedule.repeat_frequency) {
            case 'custom':
                events.push(...this.generateCustomEvents(schedule, startDate, endDate));
                break;
            case 'never':
            default:
                // One-time event using 4-value structure
                // CRITICAL: Use local date parsing to avoid timezone issues
                const [startYear, startMonth, startDay] = schedule.start_date.split('-').map(Number);
                const scheduleStartDate = new Date(startYear, startMonth - 1, startDay); // Month is 0-indexed
                
                let scheduleEndDate;
                if (schedule.end_date === "never") {
                    scheduleEndDate = new Date(startYear, startMonth - 1, startDay); // Same day for one-time events
                } else {
                    const [endYear, endMonth, endDay] = schedule.end_date.split('-').map(Number);
                    scheduleEndDate = new Date(endYear, endMonth - 1, endDay);
                }
                
                console.log(`📅 ONE-TIME EVENT - Schedule: ${schedule.event_name}`);
                console.log(`   start_date string: ${schedule.start_date}`);
                console.log(`   scheduleStartDate object: ${scheduleStartDate.toDateString()}`);
                console.log(`   end_date string: ${schedule.end_date}`);
                console.log(`   scheduleEndDate object: ${scheduleEndDate.toDateString()}`);
                
                // Generate events for each day in the date range
                const current = new Date(scheduleStartDate);
                while (current <= scheduleEndDate) {
                    console.log(`📅 ONE-TIME EVENT - Creating event for: ${current.toDateString()}`);
                    const event = this.createCalendarEvent(schedule, new Date(current));
                    if (event) events.push(event);
                    current.setDate(current.getDate() + 1);
                }
        }
        
        // Remove duplicate events (same schedule, same start datetime)
        const uniqueEvents = [];
        const eventMap = new Map();
        
        for (const event of events) {
            const key = `${event.extendedProps.scheduleId}-${event.start}`;
            if (!eventMap.has(key)) {
                eventMap.set(key, event);
                uniqueEvents.push(event);
            }
        }
        
        console.log(`Generated ${events.length} events, deduplicated to ${uniqueEvents.length}`);
        return uniqueEvents;
    }
    

    
    /**
     * Check if an event should be created for a specific date using 4-value structure
     */
    shouldCreateEventForDate(schedule, date) {
        // Check if this date is excluded
        if (schedule.exclude_dates && Array.isArray(schedule.exclude_dates)) {
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            if (schedule.exclude_dates.includes(dateStr)) {
                return false;
            }
        }
        
        // Check if date is within schedule date range
        const scheduleStartDate = new Date(schedule.start_date);
        let scheduleEndDate;
        if (schedule.end_date === "never") {
            scheduleEndDate = new Date('2099-12-31'); // Effectively infinite
        } else {
            scheduleEndDate = new Date(schedule.end_date);
        }
        
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        
        if (checkDate < scheduleStartDate || checkDate > scheduleEndDate) {
            return false;
        }
        
        // For custom schedules, check specific days
        if (schedule.repeat_frequency === 'custom' && schedule.days_of_week && schedule.days_of_week.length > 0) {
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            return schedule.days_of_week.includes(dayName);
        }
        
        return false;
    }
    

    
    /**
     * Generate custom day recurring events using 4-value structure
     */
    generateCustomEvents(schedule, calendarStartDate, calendarEndDate) {
        const events = [];
        const daysOfWeek = schedule.days_of_week || [];
        
        // Determine the actual date range to generate events for
        const scheduleStartDate = new Date(schedule.start_date);
        let scheduleEndDate;
        if (schedule.end_date === "never") {
            scheduleEndDate = new Date(calendarEndDate); // Use calendar range for infinite schedules
        } else {
            scheduleEndDate = new Date(schedule.end_date);
        }
        
        // Start from the later of schedule start or calendar start
        const current = new Date(Math.max(scheduleStartDate, calendarStartDate));
        const endDate = new Date(Math.min(scheduleEndDate, calendarEndDate));
        
        while (current <= endDate) {
            if (this.shouldCreateEventForDate(schedule, current)) {
                const event = this.createCalendarEvent(schedule, new Date(current));
                if (event) events.push(event);
            }
            current.setDate(current.getDate() + 1);
        }
        
        return events;
    }
    
    /**
     * Create a single calendar event from schedule  
     */
    createCalendarEvent(schedule, date) {
        // Skip default/unoccupied schedules or schedules without start times
        if (!schedule.start_time || schedule.is_default) {
            return null;
        }
        
        const eventDate = new Date(date);
        let startTime, endTime;
        
        if (schedule.time_setting === 'time') {
            // Always use HH:MM format with the 4-value structure
            const [startHours, startMinutes] = schedule.start_time.split(':').map(Number);
            const [endHours, endMinutes] = schedule.end_time.split(':').map(Number);
            
            // Create Date objects using local time constructor
            startTime = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), startHours, startMinutes);
            endTime = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), endHours, endMinutes);
            
            // Handle overnight events (end time < start time)
            if (endTime <= startTime) {
                endTime.setDate(endTime.getDate() + 1);
            }
        } else {
            // For sunrise/sunset events, calculate actual times
            const sunTime = schedule.time_setting === 'sunrise' ? 
                          this.scheduler.calculateSunrise(eventDate) : 
                          this.scheduler.calculateSunset(eventDate);
            
            const offsetHours = schedule.start_time ? parseInt(schedule.start_time.split(':')[0]) || 0 : 0;
            const endOffsetHours = schedule.end_time ? parseInt(schedule.end_time.split(':')[0]) || 1 : 1;
            
            startTime = new Date(sunTime.getTime() - (offsetHours * 60 * 60 * 1000));
            endTime = new Date(sunTime.getTime() + (endOffsetHours * 60 * 60 * 1000));
        }
        
        // CRITICAL: Store the exact date this event is supposed to appear on
        const originalDateStr = date.toISOString().split('T')[0];
        
        console.log(`📅 Creating calendar event for ${schedule.event_name}:`);
        console.log(`   Schedule date input: ${date.toDateString()}`);
        console.log(`   Original date string: ${originalDateStr}`);
        console.log(`   Event will display from: ${startTime.toISOString()}`);
        console.log(`   Event will display to: ${endTime.toISOString()}`);
        
        const event = {
            id: `${schedule.id}-${originalDateStr}`,
            title: schedule.event_name || 'Schedule Event',
            start: startTime,  // Use Date object directly - FullCalendar will handle timezone
            end: endTime,      // Use Date object directly - FullCalendar will handle timezone
            backgroundColor: this.getEventColor(schedule.schedule_type),
            borderColor: this.getEventColor(schedule.schedule_type),
            textColor: '#ffffff',
            extendedProps: {
                scheduleId: schedule.id,
                scheduleType: schedule.schedule_type,
                settings: schedule.settings || {},
                timeSetting: schedule.time_setting,
                isDefault: schedule.is_default || false,
                scheduleData: schedule,
                originalDate: originalDateStr  // Store the original scheduled date
            }
        };
        
        return event;
    }
    
    /**
     * Handle date selection for creating new events
     */
    handleDateSelect(info) {
        // Only allow deliberate drag selections for event creation
        const duration = info.end - info.start;
        if (duration < 30 * 60 * 1000) { // Less than 30 minutes, ignore
            this.calendar.unselect();
            return;
        }
        
        // Store the selection info for later use
        this.pendingSelection = {
            start: new Date(info.start),
            end: new Date(info.end)
        };
        
        // Open the event modal with pre-filled times but don't create anything yet
        setTimeout(() => {
            const scheduleStartDateField = document.getElementById('scheduleStartDate');
            const startTimeField = document.getElementById('startTime');
            const endTimeField = document.getElementById('endTime');
            
            if (scheduleStartDateField) {
                scheduleStartDateField.value = this.pendingSelection.start.toISOString().split('T')[0];
            }
            
            if (startTimeField) {
                startTimeField.value = this.pendingSelection.start.toTimeString().slice(0, 5);
            }
            
            if (endTimeField) {
                endTimeField.value = this.pendingSelection.end.toTimeString().slice(0, 5);
            }
            
            this.scheduler.openEventModal();
        }, 100);
        
        // Clear the selection
        this.calendar.unselect();
    }
    
    /**
     * Handle event click for editing
     */
    handleEventClick(info) {
        const scheduleData = info.event.extendedProps.scheduleData;
        const eventDate = new Date(info.event.start);
        
        // Don't allow clicking on unoccupied events
        if (info.event.extendedProps.isUnoccupied) {
            return;
        }
        
        if (!scheduleData) {
            console.error('No schedule data found for event');
            return;
        }
        
        if (window.hvacScheduler) {
            // Check if this is a recurring event
            if (scheduleData.repeat_frequency && scheduleData.repeat_frequency !== 'never') {
                // Show edit scope modal for recurring events
                window.hvacScheduler.showEditScopeModal(scheduleData, eventDate);
            } else {
                // Direct edit for non-recurring events
                window.hvacScheduler.openEventModal(null, scheduleData, eventDate);
            }
        }
    }
    
    /**
     * Handle event drag and drop - Action Handler Architecture
     */
    async handleEventDrop(info) {
        const scheduleData = info.event.extendedProps.scheduleData;
        
        // Block unoccupied/default events
        if (info.event.extendedProps.isUnoccupied || scheduleData?.is_default) {
            info.revert();
            this.scheduler.showError('Cannot move this event');
            return;
        }
        
        if (!scheduleData) {
            info.revert();
            return;
        }
        
        // Store revert function for error handling
        this.lastRevertFunction = () => info.revert();
        
        // Get the original scheduled date from event properties
        const originalDateString = info.event.extendedProps.originalDate;
        const originalEventDate = originalDateString ? new Date(originalDateString + 'T12:00:00.000Z') : new Date(info.oldEvent.start);
        
        console.log('🎯 DRAG DEBUG - Original scheduled date string:', originalDateString);
        console.log('🎯 DRAG DEBUG - Original event date object:', originalEventDate);
        console.log('🎯 DRAG DEBUG - Original event date formatted:', originalEventDate.toDateString());
        console.log('🎯 DRAG DEBUG - New position date:', new Date(info.event.start));
        console.log('🎯 DRAG DEBUG - New position date formatted:', new Date(info.event.start).toDateString());
        console.log('🎯 DRAG DEBUG - Schedule data:', scheduleData.event_name, scheduleData.repeat_frequency);
        
        // CRITICAL: Verify the originalEventDate is actually the day the event was originally scheduled for
        // For recurring events, this should be the day the user originally saw the event, not where they dragged it
        const draggedFromDate = new Date(info.oldEvent.start);
        console.log('🎯 DRAG DEBUG - Event was dragged FROM:', draggedFromDate.toDateString());
        console.log('🎯 DRAG DEBUG - Event was dragged TO:', new Date(info.event.start).toDateString());
        
        // Check if recurring event needs modal or direct action
        if (scheduleData.repeat_frequency !== 'never') {
            // For recurring events, store pending info in action handler and show scope modal
            this.scheduler.actionHandler.pendingPayload = {
                scheduleId: scheduleData.id,
                newStart: new Date(info.event.start),
                eventDate: originalEventDate
            };
            this.pendingDragInfo = {
                scheduleId: scheduleData.id,
                newStart: new Date(info.event.start),
                eventDate: originalEventDate
            };
            this.scheduler.showDragScopeModal(scheduleData, originalEventDate);
        } else {
            // Direct drag for one-time events - use 'series' scope to drag whole schedule
            await this.scheduler.actionHandler.handleUserAction('DRAG_EVENT', {
                scheduleId: scheduleData.id,
                newStart: new Date(info.event.start),
                eventDate: originalEventDate,
                actionScope: 'series'  // One-time events should be dragged as whole schedule
            });
        }
    }
    

    

    
    /**
     * Handle event resize
     */
    /**
     * Handle event resize - Action Handler Architecture
     */
    async handleEventResize(info) {
        const scheduleData = info.event.extendedProps.scheduleData;
        
        // Block unoccupied/default events
        if (info.event.extendedProps.isUnoccupied || scheduleData?.is_default) {
            info.revert();
            this.scheduler.showError('Cannot resize this event');
            return;
        }
        
        if (!scheduleData) {
            info.revert();
            return;
        }
        
        // Store revert function for error handling
        this.lastRevertFunction = () => info.revert();
        
        // For resize, the event date remains the same (start position didn't change)
        const eventDate = new Date(info.event.start);
        
        // For recurring events, show resize scope modal
        if (scheduleData.repeat_frequency !== 'never') {
            // Store pending info in action handler
            this.scheduler.actionHandler.pendingPayload = {
                scheduleId: scheduleData.id,
                newEnd: info.event.end ? new Date(info.event.end) : null
            };
            this.scheduler.showEditScopeModal(scheduleData, eventDate, 'resize');
        } else {
            // Direct resize for one-time events
            await this.scheduler.actionHandler.handleUserAction('RESIZE_EVENT', {
                scheduleId: scheduleData.id,
                newEnd: info.event.end ? new Date(info.event.end) : null,
                actionScope: 'single'
            });
        }
    }
    
    /**
     * Customize event appearance
     */
    customizeEvent(info) {
        const event = info.event;
        const element = info.el;
        const scheduleData = event.extendedProps.scheduleData;
        
        // Add tooltip
        element.title = this.createEventTooltip(scheduleData);
        
        // Add icon based on schedule type
        const iconClass = this.getScheduleTypeIcon(scheduleData.schedule_type);
        const titleElement = element.querySelector('.fc-event-title');
        if (iconClass && titleElement) {
            const icon = document.createElement('i');
            icon.className = `${iconClass} me-1`;
            titleElement.prepend(icon);
        }
        
        // Add special styling for default events
        if (scheduleData.is_default) {
            element.style.opacity = '0.7';
            element.style.borderStyle = 'dashed';
        }
    }
    
    /**
     * Create tooltip text for events
     */
    createEventTooltip(scheduleData) {
        const settings = scheduleData.settings || {};
        let tooltip = `${scheduleData.event_name}\n`;
        tooltip += `Type: ${scheduleData.schedule_type}\n`;
        tooltip += `Repeat: ${scheduleData.repeat_frequency}\n`;
        tooltip += '──────────────\n';
        
        // Different tooltip content based on schedule type
        switch(scheduleData.schedule_type) {
            case 'thermostat':
                // System mode
                if (settings.system_mode) {
                    tooltip += `Mode: ${settings.system_mode}\n`;
                }
                
                // Temperature setpoints
                if (settings.heat_setpoint || settings.cool_setpoint) {
                    if (settings.heat_setpoint) {
                        tooltip += `Heat: ${settings.heat_setpoint}°F\n`;
                    }
                    if (settings.cool_setpoint) {
                        tooltip += `Cool: ${settings.cool_setpoint}°F\n`;
                    }
                }
                
                // Fan setting
                if (settings.fan) {
                    tooltip += `Fan: ${settings.fan === 'auto' ? 'Auto' : settings.fan + ' min/hr'}\n`;
                }
                
                // Humidity
                if (settings.humidity_setpoint) {
                    tooltip += `Humidity: ${settings.humidity_setpoint}%\n`;
                }
                
                // Ventilation
                if (settings.ventilation_rate) {
                    tooltip += `Ventilation: ${settings.ventilation_rate} min/hr\n`;
                }
                break;
                
            case 'lighting':
                // Lighting status
                if (settings.lighting_status) {
                    tooltip += `Lights: ${settings.lighting_status === 'on' ? 'On' : 'Off'}\n`;
                }
                break;
                
            case 'humidistat':
                // Humidity setpoints
                if (settings.humidity_low_setpoint || settings.humidity_high_setpoint) {
                    tooltip += `Humidity Range: ${settings.humidity_low_setpoint || '30'}% - ${settings.humidity_high_setpoint || '60'}%\n`;
                }
                break;
                
            default:
                // Show all settings for unknown types
                for (const [key, value] of Object.entries(settings)) {
                    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    tooltip += `${formattedKey}: ${value}\n`;
                }
        }
        
        return tooltip;
    }
    
    /**
     * Get icon class for schedule type
     */
    getScheduleTypeIcon(scheduleType) {
        switch (scheduleType) {
            case 'thermostat':
                return 'fas fa-thermometer-half';
            case 'humidistat':
                return 'fas fa-tint';
            case 'lighting':
                return 'fas fa-lightbulb';
            default:
                return 'fas fa-cog';
        }
    }
    
    /**
     * Refresh the calendar view
     */
    refresh() {
        if (this.calendar) {
            console.log('Calendar refresh - refetching all events including unoccupied');
            this.calendar.refetchEvents();
            this.calendar.render();
            console.log('Calendar refresh complete');
        }
    }
    
    /**
     * Resize the calendar
     */
    resize() {
        if (this.calendar) {
            this.calendar.updateSize();
        }
    }
    
    /**
     * Navigate to a specific date
     */
    navigateToDate(date) {
        if (this.calendar) {
            this.calendar.gotoDate(date);
        }
    }
    
    /**
     * Change calendar view
     */
    changeView(viewName) {
        if (this.calendar) {
            this.calendar.changeView(viewName);
        }
    }
    
    /**
     * Generate unoccupied gap events between scheduled events (limited for performance)
     */
    generateUnoccupiedGapsLimited(events, startDate, endDate) {
        // Get the default unoccupied schedule
        const unoccupiedSchedule = this.scheduler.schedules.find(s => s.is_default);
        if (!unoccupiedSchedule) {
            console.log('No unoccupied schedule found!');
            return;
        }
        
        console.log('Generating unoccupied gaps for unoccupied schedule:', unoccupiedSchedule.event_name);
        
        // Limit to 7 days maximum for performance
        const current = new Date(startDate);
        current.setHours(0, 0, 0, 0);
        const limitedEndDate = new Date(Math.min(endDate.getTime(), startDate.getTime() + 7 * 24 * 60 * 60 * 1000));
        
        let dayCount = 0;
        let unoccupiedCount = 0;
        while (current <= limitedEndDate && dayCount < 7) {
            const beforeCount = events.length;
            this.generateUnoccupiedGapsForDay(events, current, unoccupiedSchedule);
            const added = events.length - beforeCount;
            unoccupiedCount += added;
            current.setDate(current.getDate() + 1);
            dayCount++;
        }
        console.log(`Generated ${unoccupiedCount} unoccupied events for ${dayCount} days`);
    }
    
    /**
     * Generate unoccupied gaps for a single day
     */
    generateUnoccupiedGapsForDay(events, date, unoccupiedSchedule) {
        // Show gaps for the full 24-hour day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0); // Start at midnight
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999); // End at 11:59:59 PM
        
        // Get all non-unoccupied scheduled events for this day, sorted by start time 
        const dayEvents = events.filter(event => {
            if (event.extendedProps && event.extendedProps.isUnoccupied) return false;
            const eventStart = new Date(event.start);
            return eventStart.toDateString() === date.toDateString();
        }).sort((a, b) => new Date(a.start) - new Date(b.start));
        
        const gaps = [];
        let currentTime = new Date(dayStart);
        
        // Find gaps between scheduled events
        for (const event of dayEvents) {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            
            // Gap before this event
            if (currentTime < eventStart) {
                gaps.push({
                    start: new Date(currentTime),
                    end: new Date(eventStart)
                });
            }
            
            // Move current time to end of this event
            if (eventEnd > currentTime) {
                currentTime = new Date(eventEnd);
            }
        }
        
        // Gap from last event to end of business hours
        if (currentTime < dayEnd) {
            gaps.push({
                start: new Date(currentTime),
                end: new Date(dayEnd)
            });
        }
        
        // Create unoccupied events for gaps (minimum 30 minutes)
        for (const gap of gaps) {
            const gapDuration = gap.end - gap.start;
            if (gapDuration >= 30 * 60 * 1000) { // At least 30 minutes
                const unoccupiedEvent = {
                    id: `unoccupied-${gap.start.getTime()}`,
                    title: 'Unoccupied',
                    start: gap.start.toISOString(),
                    end: gap.end.toISOString(),
                    backgroundColor: '#495057',
                    borderColor: '#495057',
                    textColor: '#ffffff',
                    display: 'block',
                    editable: false,
                    extendedProps: {
                        scheduleId: unoccupiedSchedule.id,
                        scheduleType: unoccupiedSchedule.schedule_type,
                        isUnoccupied: true,
                        settings: unoccupiedSchedule.settings,
                        scheduleData: unoccupiedSchedule
                    }
                };
                events.push(unoccupiedEvent);
            }
        }
    }
}

// Make CalendarView available globally
window.CalendarView = CalendarView;
