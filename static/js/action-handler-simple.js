/**
 * Simple Action Handler for HVAC Scheduler
 * Clean, concrete logic with minimal complexity
 */
class SimpleActionHandler {
    constructor(scheduler) {
        this.scheduler = scheduler;
        this.schedules = [];
        this.pendingPayload = null;
    }
    
    /**
     * Initialize - load schedules from server
     */
    async initialize() {
        await this.loadSchedules();
    }
    
    /**
     * Load schedules from server
     */
    async loadSchedules() {
        try {
            const response = await fetch('/api/schedules');
            const data = await response.json();
            this.schedules = data.schedules || [];
            console.log('✅ Loaded', this.schedules.length, 'schedules');
        } catch (error) {
            console.error('❌ Failed to load schedules:', error);
            this.schedules = [];
        }
    }
    
    /**
     * Save schedules to server
     */
    async saveSchedules() {
        try {
            const response = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedules: this.schedules })
            });
            
            if (!response.ok) throw new Error('Save failed');
            console.log('✅ Schedules saved');
            return true;
        } catch (error) {
            console.error('❌ Failed to save:', error);
            throw error;
        }
    }
    
    /**
     * Refresh calendar view with proper data synchronization
     */
    refreshView() {
        try {
            // Update scheduler's schedules array to match ActionHandler's
            if (this.scheduler) {
                this.scheduler.schedules = [...this.schedules];
                
                // Refresh the active view
                if (this.scheduler.currentView === 'calendar' && this.scheduler.calendarView) {
                    this.scheduler.calendarView.refresh();
                } else if (this.scheduler.currentView === 'list' && this.scheduler.listView) {
                    this.scheduler.listView.refresh();
                }
                
                // Recalculate current status for proper unoccupied display
                this.scheduler.calculateCurrentStatus();
            }
            console.log('✅ View refreshed');
        } catch (error) {
            console.error('❌ View refresh failed:', error);
        }
    }
    
    /**
     * Main entry point for all user actions
     */
    async handleUserAction(actionType, payload) {
        console.log('🔄 Action:', actionType, payload);
        
        try {
            switch (actionType) {
                case 'CREATE_EVENT':
                    await this.createEvent(payload);
                    break;
                    
                case 'UPDATE_EVENT':
                    await this.updateEvent(payload);
                    break;
                    
                case 'DELETE_EVENT':
                    await this.deleteEvent(payload);
                    break;
                    
                case 'DRAG_EVENT':
                    await this.dragEvent(payload);
                    break;
                    
                case 'RESIZE_EVENT':
                    await this.resizeEvent(payload);
                    break;
                    
                case 'REMOVE_EXCLUDED_DATE':
                    await this.removeExcludedDate(payload);
                    break;
                    
                case 'DRAG_SINGLE_FROM_SERIES':
                    // Use pendingPayload that was set by drag operation
                    if (this.pendingPayload) {
                        await this.dragEvent({
                            ...this.pendingPayload,
                            actionScope: 'single'
                        });
                        this.pendingPayload = null;
                    }
                    break;
                    
                case 'DRAG_WHOLE_SERIES':
                    // Use pendingPayload that was set by drag operation
                    if (this.pendingPayload) {
                        await this.dragEvent({
                            ...this.pendingPayload,
                            actionScope: 'series'
                        });
                        this.pendingPayload = null;
                    }
                    break;
                    
                case 'RESIZE_SINGLE_FROM_SERIES':
                    // Use pendingPayload that was set by resize operation
                    if (this.pendingPayload) {
                        await this.resizeEvent({
                            ...this.pendingPayload,
                            actionScope: 'single'
                        });
                        this.pendingPayload = null;
                    }
                    break;
                    
                case 'RESIZE_WHOLE_SERIES':
                    // Use pendingPayload that was set by resize operation
                    if (this.pendingPayload) {
                        await this.resizeEvent({
                            ...this.pendingPayload,
                            actionScope: 'series'
                        });
                        this.pendingPayload = null;
                    }
                    break;
                    
                default:
                    throw new Error(`Unknown action: ${actionType}`);
            }
            
            // Save and refresh after any action
            await this.saveSchedules();
            await this.loadSchedules(); // Reload to ensure consistency
            this.refreshView();
            
        } catch (error) {
            console.error('❌ Action failed:', error.message || error);
            console.error('❌ Full error:', error);
            throw error;
        }
    }
    
    /**
     * Normalize form data to consistent 4-value structure
     */
    normalizeScheduleData(formData) {
        console.log('🔧 Normalizing form data:', formData);
        
        // Ensure we have clean date and time separation
        let start_date, end_date, start_time, end_time;
        
        // Extract start_date (always YYYY-MM-DD format)
        if (formData.start_date) {
            start_date = formData.start_date.split('T')[0]; // Remove time if present
        } else {
            start_date = new Date().toISOString().split('T')[0]; // Default to today
        }
        
        // Extract end_date (YYYY-MM-DD or "never")
        if (formData.repeat_frequency === 'never') {
            end_date = start_date; // One-time events have same start/end date
        } else if (formData.end_date && formData.end_date !== '') {
            end_date = formData.end_date === 'never' ? 'never' : formData.end_date.split('T')[0];
        } else {
            end_date = 'never'; // Default for recurring events
        }
        
        // Extract start_time (always HH:MM format)
        if (formData.start_time) {
            start_time = formData.start_time.includes(':') ? formData.start_time.slice(0, 5) : formData.start_time;
        } else {
            start_time = '09:00'; // Default
        }
        
        // Extract end_time (always HH:MM format)
        if (formData.end_time) {
            end_time = formData.end_time.includes(':') ? formData.end_time.slice(0, 5) : formData.end_time;
        } else {
            // Default to 1 hour after start
            const duration = 60; // minutes
            end_time = this.addMinutesToTime(start_time, duration);
        }
        
        const normalized = {
            ...formData,
            start_date,
            end_date,
            start_time,
            end_time
        };
        
        console.log('✅ Normalized data:', {
            start_date: normalized.start_date,
            end_date: normalized.end_date,
            start_time: normalized.start_time,
            end_time: normalized.end_time
        });
        
        return normalized;
    }
    
    /**
     * Create new event
     */
    async createEvent(payload) {
        const { formData } = payload;
        
        // Basic validation
        if (!formData.event_name || !formData.start_time || !formData.end_time) {
            throw new Error('Missing required fields: event_name, start_time, end_time');
        }
        
        // Normalize data to consistent 4-value structure
        const normalizedData = this.normalizeScheduleData(formData);
        
        // Create new schedule with normalized data
        const newSchedule = {
            id: Date.now().toString(),
            ...normalizedData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Validate time range
        const duration = this.calculateDuration(newSchedule.start_time, newSchedule.end_time);
        if (duration <= 0) {
            throw new Error('End time must be after start time');
        }
        
        // Check for overlaps using comprehensive detection
        const overlap = this.checkForOverlaps(newSchedule);
        if (overlap) {
            // Format the date nicely - parse properly to avoid timezone issues
            const [year, month, day] = overlap.date.split('-').map(Number);
            const conflictDate = new Date(year, month - 1, day); // month is 0-indexed
            const dateStr = conflictDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const message = `Cannot create schedule - conflicts with "${overlap.schedule.event_name}" on ${dateStr} (${overlap.times.existing}). Please choose different times or remove the conflicting schedule first.`;
            console.log('⚠️ Overlap detected:', message);
            throw new Error(message);
        }
        
        this.schedules.push(newSchedule);
        console.log('✅ Created event:', newSchedule.event_name);
    }
    
    /**
     * Update existing event
     */
    async updateEvent(payload) {
        const { scheduleId, formData, updates } = payload;
        
        const index = this.schedules.findIndex(s => s.id === scheduleId);
        if (index === -1) {
            // Smart detection: If the schedule doesn't exist but we have all the data,
            // this is likely a "Just This Event" edit - create it instead
            const dataToUse = updates || formData;
            if (dataToUse && dataToUse.event_name) {
                console.log('⚠️ Schedule not found for update, creating new event instead');
                return await this.createEvent({ formData: dataToUse });
            }
            throw new Error('Schedule not found');
        }
        
        // Use 'updates' if provided (new format), otherwise fall back to 'formData' (old format)
        const dataToNormalize = updates || formData;
        if (!dataToNormalize) {
            throw new Error('No update data provided');
        }
        

        // Normalize the form data
        const normalizedData = this.normalizeScheduleData(dataToNormalize);
        
        // Create updated schedule with normalized data
        const updatedSchedule = {
            ...this.schedules[index],
            ...normalizedData,
            updated_at: new Date().toISOString()
        };
        
        // Validate time range
        const duration = this.calculateDuration(updatedSchedule.start_time, updatedSchedule.end_time);
        if (duration <= 0) {
            throw new Error('End time must be after start time');
        }
        
        // Check for overlaps using comprehensive detection (excluding self)
        const overlap = this.checkForOverlaps(updatedSchedule, scheduleId);
        if (overlap) {
            // Format the date nicely - parse properly to avoid timezone issues
            const [year, month, day] = overlap.date.split('-').map(Number);
            const conflictDate = new Date(year, month - 1, day); // month is 0-indexed
            const dateStr = conflictDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const message = `Cannot update schedule - conflicts with "${overlap.schedule.event_name}" on ${dateStr} (${overlap.times.existing}). Please choose different times or remove the conflicting schedule first.`;
            console.log('⚠️ Overlap detected:', message);
            throw new Error(message);
        }
        
        this.schedules[index] = updatedSchedule;
        console.log('✅ Updated event:', updatedSchedule.event_name);
    }
    
    /**
     * Delete event
     */
    async deleteEvent(payload) {
        const { scheduleId } = payload;
        
        // Reload schedules to ensure we have latest data
        await this.loadSchedules();
        
        const index = this.schedules.findIndex(s => s.id === scheduleId);
        if (index === -1) {
            console.error('❌ Schedule not found. Available IDs:', this.schedules.map(s => s.id));
            throw new Error('Schedule not found');
        }
        
        const deleted = this.schedules.splice(index, 1)[0];
        console.log('✅ Deleted event:', deleted.event_name);
    }
    
    /**
     * Drag event to new time
     */
    async dragEvent(payload) {
        const { scheduleId, newStart, eventDate, actionScope } = payload;
        
        const originalSchedule = this.schedules.find(s => s.id === scheduleId);
        if (!originalSchedule) {
            throw new Error('Schedule not found');
        }
        
        if (actionScope === 'single' && originalSchedule.repeat_frequency !== 'never') {
            // Drag single instance from recurring series
            await this.dragSingleInstance(originalSchedule, newStart, eventDate);
        } else {
            // Drag entire schedule
            await this.dragWholeSchedule(originalSchedule, newStart);
        }
    }
    
    /**
     * Drag single instance from recurring series
     */
    async dragSingleInstance(originalSchedule, newStart, eventDate) {
        console.log('🔄 Drag single instance');
        
        // 1. Calculate new event details
        const excludeDate = this.dateToDateString(eventDate);
        const newStartTime = this.dateToTimeString(newStart);
        const originalDuration = this.calculateDuration(originalSchedule.start_time, originalSchedule.end_time);
        const newEndTime = this.addDuration(newStartTime, originalDuration);
        
        console.log('🔧 Single instance drag calculation:', {
            excludeDate,
            originalTime: `${originalSchedule.start_time}-${originalSchedule.end_time}`,
            newTime: `${newStartTime}-${newEndTime}`,
            duration: originalDuration
        });
        
        // 2. Create new single event with unique name
        const newDate = this.dateToDateString(newStart); // Use the NEW date where it was dragged to
        // Parse the date properly to avoid timezone issues
        const [year, month, day] = excludeDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day); // month is 0-indexed
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
        
        const singleEvent = {
            ...originalSchedule,
            id: Date.now().toString(),
            event_name: `${originalSchedule.event_name} (${formattedDate})`,
            repeat_frequency: 'never',
            start_date: newDate,  // Use the NEW date, not the original date
            end_date: newDate,    // Use the NEW date, not the original date
            start_time: newStartTime,
            end_time: newEndTime,
            exclude_dates: [],
            days_of_week: []
        };
        
        // 3. Create temporary updated original schedule for overlap checking
        const tempOriginalWithExclusion = {
            ...originalSchedule,
            exclude_dates: [...(originalSchedule.exclude_dates || []), excludeDate]
        };
        
        // 4. Check for overlaps with temporary state - replace original in memory temporarily
        const originalIndex = this.schedules.findIndex(s => s.id === originalSchedule.id);
        const tempSchedules = [...this.schedules];
        tempSchedules[originalIndex] = tempOriginalWithExclusion;
        
        // 5. Check overlap using temporary state
        const overlap = this.checkForOverlapsWithSchedules(singleEvent, tempSchedules);
        if (overlap) {
            // Format the date nicely - parse properly to avoid timezone issues
            const [year, month, day] = overlap.date.split('-').map(Number);
            const conflictDate = new Date(year, month - 1, day); // month is 0-indexed
            const dateStr = conflictDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const message = `Cannot create single event here - conflicts with "${overlap.schedule.event_name}" on ${dateStr} (${overlap.times.existing}). Please choose a different time.`;
            console.log('⚠️ Overlap detected:', message);
            throw new Error(message);
        }
        
        // 6. Apply changes - add exclude date and create single event
        this.schedules[originalIndex] = tempOriginalWithExclusion;
        this.schedules.push(singleEvent);
        console.log('✅ Created single event from drag');
    }
    
    /**
     * Drag whole schedule to new time
     */
    async dragWholeSchedule(originalSchedule, newStart) {
        console.log('🔄 Drag whole schedule');
        
        try {
            // Calculate new times
            const originalDuration = this.calculateDuration(originalSchedule.start_time, originalSchedule.end_time);
            const newStartTime = this.dateToTimeString(newStart);
            const newEndTime = this.addDuration(newStartTime, originalDuration);
            
            // Also update the date for one-time events
            const newDateString = this.dateToDateString(newStart);
            
            const updatedSchedule = {
                ...originalSchedule,
                start_time: newStartTime,
                end_time: newEndTime,
                updated_at: new Date().toISOString()
            };
            
            // For one-time events, update the date as well
            if (originalSchedule.repeat_frequency === 'never') {
                updatedSchedule.start_date = newDateString;
                updatedSchedule.end_date = newDateString;
            }
            
            console.log('🔧 Drag calculation:', {
                original: `${originalSchedule.start_time}-${originalSchedule.end_time}`,
                new: `${newStartTime}-${newEndTime}`,
                duration: originalDuration
            });
            
            // Check for overlaps using comprehensive detection
            const overlap = this.checkForOverlaps(updatedSchedule, originalSchedule.id);
            if (overlap) {
                const message = `Cannot move here - conflicts with "${overlap.event_name}" schedule. Please choose a different time or remove the conflicting schedule first.`;
                console.log('⚠️ Overlap detected:', message);
                throw new Error(message);
            }
            
            const index = this.schedules.findIndex(s => s.id === originalSchedule.id);
            this.schedules[index] = updatedSchedule;
            console.log('✅ Dragged whole schedule');
        } catch (error) {
            console.error('❌ Drag whole schedule failed:', error);
            throw error;
        }
    }
    
    /**
     * Resize event
     */
    async resizeEvent(payload) {
        const { scheduleId, newEnd, actionScope } = payload;
        
        const originalSchedule = this.schedules.find(s => s.id === scheduleId);
        if (!originalSchedule) {
            throw new Error('Schedule not found');
        }
        
        try {
            // Handle single instance resize from recurring series
            if (actionScope === 'single' && originalSchedule.repeat_frequency !== 'never') {
                // For single instance resize, create a new one-time event
                console.log('🔄 Resize single instance from series');
                
                // TODO: Implement single instance resize by creating new event with different end time
                // For now, just resize the whole series
                console.log('⚠️ Single instance resize not fully implemented, resizing whole series');
            }
            
            // Calculate new end time
            const newEndTime = this.dateToTimeString(newEnd);
            
            const updatedSchedule = {
                ...originalSchedule,
                end_time: newEndTime,
                updated_at: new Date().toISOString()
            };
            
            console.log('🔧 Resize calculation:', {
                original: `${originalSchedule.start_time}-${originalSchedule.end_time}`,
                new: `${originalSchedule.start_time}-${newEndTime}`
            });
            
            // Validate time range
            const duration = this.calculateDuration(updatedSchedule.start_time, updatedSchedule.end_time);
            if (duration <= 0) {
                throw new Error('End time must be after start time');
            }
            
            // Check for overlaps using comprehensive detection
            const overlap = this.checkForOverlaps(updatedSchedule, scheduleId);
            if (overlap) {
                const message = `Cannot resize to this time - conflicts with "${overlap.event_name}" schedule. Please choose a different end time.`;
                console.log('⚠️ Overlap detected:', message);
                throw new Error(message);
            }
            
            const index = this.schedules.findIndex(s => s.id === scheduleId);
            this.schedules[index] = updatedSchedule;
            console.log('✅ Resized event');
        } catch (error) {
            console.error('❌ Resize event failed:', error);
            throw error;
        }
    }
    
    /**
     * Simple time duration calculation
     */
    calculateDuration(startTime, endTime) {
        // Convert HH:MM to minutes since midnight
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        // Handle overnight schedules
        if (endTotalMinutes < startTotalMinutes) {
            return (24 * 60 - startTotalMinutes) + endTotalMinutes;
        }
        
        return endTotalMinutes - startTotalMinutes;
    }
    
    /**
     * Extract time from date or datetime string
     */
    extractTime(dateTimeStr) {
        if (dateTimeStr.includes('T')) {
            const date = new Date(dateTimeStr);
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        return dateTimeStr; // Already in HH:MM format
    }
    
    /**
     * Convert date to YYYY-MM-DD string
     */
    dateToDateString(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    
    /**
     * Convert date to HH:MM string
     */
    dateToTimeString(date) {
        const d = new Date(date);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    
    /**
     * Add minutes to time string
     */
    addMinutesToTime(timeStr, minutes) {
        const [hours, mins] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + mins + minutes;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMinutes = totalMinutes % 60;
        return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    }
    
    /**
     * Add duration in minutes to time
     */
    addDuration(timeStr, durationMinutes) {
        return this.addMinutesToTime(timeStr, durationMinutes);
    }
    
    /**
     * Check if two time ranges overlap
     */
    timeRangesOverlap(start1, end1, start2, end2) {
        // Convert times to minutes for comparison
        const toMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        
        const start1Min = toMinutes(start1);
        const end1Min = toMinutes(end1);
        const start2Min = toMinutes(start2);
        const end2Min = toMinutes(end2);
        
        // Check for overlap
        return (start1Min < end2Min && end1Min > start2Min);
    }
    
    /**
     * Remove excluded date
     */
    async removeExcludedDate(payload) {
        const { scheduleId, excludeDate } = payload;
        
        console.log('🔧 Removing excluded date:', { scheduleId, excludeDate });
        console.log('🔧 Current schedules:', this.schedules.map(s => ({ id: s.id, name: s.event_name })));
        
        // Reload schedules to ensure we have latest data
        await this.loadSchedules();
        
        const index = this.schedules.findIndex(s => s.id === scheduleId);
        if (index === -1) {
            console.error('❌ Schedule not found. Available IDs:', this.schedules.map(s => s.id));
            throw new Error('Schedule not found');
        }
        
        const schedule = this.schedules[index];
        const updatedExcludes = (schedule.exclude_dates || []).filter(date => date !== excludeDate);
        
        this.schedules[index] = {
            ...schedule,
            exclude_dates: updatedExcludes
        };
        
        console.log('✅ Removed excluded date:', excludeDate);
    }
    
    /**
     * Comprehensive overlap detection for all schedule types and patterns
     * Examines complete date ranges, days of week, repetition, and excluded dates
     */
    checkForOverlaps(targetSchedule, excludeId = null) {
        return this.checkForOverlapsWithSchedules(targetSchedule, this.schedules, excludeId);
    }
    
    /**
     * Check for overlaps using a specific set of schedules (for temporary state checking)
     */
    checkForOverlapsWithSchedules(targetSchedule, schedulesList, excludeId = null) {
        console.log('🔍 Comprehensive overlap check for:', targetSchedule.event_name);
        
        const overlaps = [];
        
        for (const existingSchedule of schedulesList) {
            // Skip self and unoccupied default schedules
            if (existingSchedule.id === excludeId || existingSchedule.is_default) {
                continue;
            }
            
            // Get all actual event dates for both schedules within a reasonable range
            const checkStartDate = new Date('2025-01-01');
            const checkEndDate = new Date('2026-12-31');
            
            const targetEvents = this.generateEventDates(targetSchedule, checkStartDate, checkEndDate);
            const existingEvents = this.generateEventDates(existingSchedule, checkStartDate, checkEndDate);
            
            // Check each target event against each existing event
            for (const targetEvent of targetEvents) {
                for (const existingEvent of existingEvents) {
                    // Same date - check time overlap
                    if (targetEvent.date === existingEvent.date) {
                        if (this.timeRangesOverlap(
                            targetEvent.start_time, targetEvent.end_time,
                            existingEvent.start_time, existingEvent.end_time
                        )) {
                            overlaps.push({
                                conflictingSchedule: existingSchedule,
                                date: targetEvent.date,
                                targetTime: `${targetEvent.start_time}-${targetEvent.end_time}`,
                                existingTime: `${existingEvent.start_time}-${existingEvent.end_time}`
                            });
                        }
                    }
                }
            }
        }
        
        if (overlaps.length > 0) {
            console.log('⚠️ Overlaps found:', overlaps);
            // Return both the conflicting schedule and the date for better error messaging
            return {
                schedule: overlaps[0].conflictingSchedule,
                date: overlaps[0].date,
                times: {
                    target: overlaps[0].targetTime,
                    existing: overlaps[0].existingTime
                }
            };
        }
        
        console.log('✅ No overlaps found');
        return null;
    }
    
    /**
     * Generate all actual event dates for a schedule within a date range
     * Handles all repetition patterns, excluded dates, and days of week
     */
    generateEventDates(schedule, startDate, endDate) {
        const events = [];
        
        // Determine schedule's active date range
        const scheduleStart = new Date(schedule.start_date);
        const scheduleEnd = schedule.end_date === 'never' ? endDate : new Date(schedule.end_date);
        
        // Use the overlap of check range and schedule range
        const effectiveStart = new Date(Math.max(scheduleStart, startDate));
        const effectiveEnd = new Date(Math.min(scheduleEnd, endDate));
        
        console.log(`📅 Generating events for ${schedule.event_name}:`, {
            scheduleRange: `${schedule.start_date} to ${schedule.end_date}`,
            effectiveRange: `${effectiveStart.toISOString().split('T')[0]} to ${effectiveEnd.toISOString().split('T')[0]}`,
            repeatFreq: schedule.repeat_frequency
        });
        
        if (schedule.repeat_frequency === 'never') {
            // One-time event
            if (effectiveStart <= effectiveEnd) {
                const eventDate = effectiveStart.toISOString().split('T')[0];
                if (!this.isExcludedDate(schedule, eventDate)) {
                    events.push({
                        date: eventDate,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time
                    });
                }
            }
        } else if (schedule.repeat_frequency === 'custom' && schedule.days_of_week) {
            // Recurring events with specific days
            const current = new Date(effectiveStart);
            
            while (current <= effectiveEnd) {
                // Get date string in YYYY-MM-DD format
                const year = current.getFullYear();
                const month = current.getMonth() + 1;
                const day = current.getDate();
                const eventDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Calculate day of week reliably (0 = Sunday, 1 = Monday, etc.)
                const dayOfWeek = current.getDay();
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayName = dayNames[dayOfWeek];
                
                if (schedule.days_of_week.includes(dayName) && !this.isExcludedDate(schedule, eventDate)) {
                    events.push({
                        date: eventDate,
                        start_time: schedule.start_time,
                        end_time: schedule.end_time
                    });
                }
                
                current.setDate(current.getDate() + 1);
            }
        }
        
        console.log(`🎯 Generated ${events.length} events for ${schedule.event_name}`);
        return events;
    }
    
    /**
     * Check if a date is excluded from a schedule
     */
    isExcludedDate(schedule, dateStr) {
        return schedule.exclude_dates && schedule.exclude_dates.includes(dateStr);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleActionHandler;
} else {
    window.SimpleActionHandler = SimpleActionHandler;
}