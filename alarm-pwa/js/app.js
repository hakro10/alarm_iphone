class AlarmApp {
    constructor() {
        this.alarms = [];
        this.currentEditingAlarm = null;
        this.activeAlarmTimeout = null;
        this.audioContext = null;
        this.currentAlarmAudio = null;
        this.notificationPermission = false;
        this.sounds = {
            default: this.createBeepSound.bind(this),
            gentle: this.createGentleSound.bind(this),
            loud: this.createLoudSound.bind(this),
            beep: this.createBeepSound.bind(this)
        };
        
        this.init();
    }
    
    async init() {
        // Initialize audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load alarms from localStorage
        this.loadAlarms();
        
        // Request notification permission
        await this.requestNotificationPermission();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Render alarms
        this.renderAlarms();
        
        // Schedule existing alarms
        this.scheduleAllAlarms();
        
        // Check for missed alarms
        this.checkMissedAlarms();
        
        // Set up interval to check alarms
        setInterval(() => this.checkAlarms(), 1000);
        
        // Set up day change detection
        this.setupDayChangeDetection();
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Day buttons in modal
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                btn.classList.toggle('active');
            });
        });
        
        // Time input change
        document.getElementById('alarm-time').addEventListener('change', () => {
            this.updateTimeRemaining();
        });
        
        // Prevent form submission
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.closest('.modal')) {
                e.preventDefault();
            }
        });
    }
    
    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission === 'granted';
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    loadAlarms() {
        const saved = localStorage.getItem('alarms');
        if (saved) {
            this.alarms = JSON.parse(saved);
            // Convert string dates back to Date objects
            this.alarms.forEach(alarm => {
                if (alarm.nextTrigger) {
                    alarm.nextTrigger = new Date(alarm.nextTrigger);
                }
            });
        }
    }
    
    saveAlarms() {
        localStorage.setItem('alarms', JSON.stringify(this.alarms));
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    renderAlarms() {
        const container = document.getElementById('alarms-container');
        const noAlarmsDiv = document.getElementById('no-alarms');
        
        if (this.alarms.length === 0) {
            container.innerHTML = '';
            noAlarmsDiv.style.display = 'flex';
            return;
        }
        
        noAlarmsDiv.style.display = 'none';
        
        container.innerHTML = this.alarms.map(alarm => {
            const timeStr = this.formatTime(alarm.time);
            const scheduleStr = this.getScheduleText(alarm);
            
            return `
                <div class="alarm-item ${alarm.enabled ? 'active' : ''}" data-id="${alarm.id}">
                    <div class="alarm-info">
                        <div class="alarm-time">${timeStr}</div>
                        <div class="alarm-label">${alarm.label}</div>
                        <div class="alarm-schedule">${scheduleStr}</div>
                    </div>
                    <div class="alarm-actions">
                        <button class="alarm-toggle ${alarm.enabled ? 'active' : ''}" 
                                onclick="alarmApp.toggleAlarm('${alarm.id}')"></button>
                        <button class="alarm-menu-btn" onclick="alarmApp.editAlarm('${alarm.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    formatTime(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }
    
    getScheduleText(alarm) {
        if (!alarm.repeatDays || alarm.repeatDays.length === 0) {
            return 'One time';
        }
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = alarm.repeatDays.map(day => dayNames[day]);
        
        if (alarm.repeatDays.length === 7) {
            return 'Every day';
        } else if (alarm.repeatDays.length === 5 && 
                   alarm.repeatDays.includes(1) && alarm.repeatDays.includes(2) && 
                   alarm.repeatDays.includes(3) && alarm.repeatDays.includes(4) && 
                   alarm.repeatDays.includes(5)) {
            return 'Weekdays';
        } else if (alarm.repeatDays.length === 2 && 
                   alarm.repeatDays.includes(0) && alarm.repeatDays.includes(6)) {
            return 'Weekends';
        } else {
            return selectedDays.join(', ');
        }
    }
    
    toggleAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = !alarm.enabled;
            if (alarm.enabled) {
                this.scheduleAlarm(alarm);
            } else {
                this.cancelAlarm(alarm);
            }
            this.saveAlarms();
            this.renderAlarms();
        }
    }
    
    editAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            this.currentEditingAlarm = alarm;
            this.populateModal(alarm);
            this.showModal('Edit Alarm');
        }
    }
    
    deleteAlarm(id) {
        if (confirm('Delete this alarm?')) {
            const index = this.alarms.findIndex(a => a.id === id);
            if (index > -1) {
                this.cancelAlarm(this.alarms[index]);
                this.alarms.splice(index, 1);
                this.saveAlarms();
                this.renderAlarms();
            }
        }
    }
    
    populateModal(alarm) {
        document.getElementById('alarm-time').value = alarm.time;
        document.getElementById('alarm-label').value = alarm.label;
        document.getElementById('alarm-sound').value = alarm.sound;
        
        // Reset day buttons
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Set repeat days
        if (alarm.repeatDays) {
            alarm.repeatDays.forEach(day => {
                const btn = document.querySelector(`[data-day="${day}"]`);
                if (btn) btn.classList.add('active');
            });
        }
    }
    
    showModal(title = 'Add Alarm') {
        document.querySelector('.modal-title').textContent = title;
        document.getElementById('alarm-modal').classList.add('show');
        
        // Set default time if adding new alarm
        if (!this.currentEditingAlarm) {
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            document.getElementById('alarm-time').value = timeStr;
        }
        
        this.updateTimeRemaining();
    }
    
    closeModal() {
        document.getElementById('alarm-modal').classList.remove('show');
        this.currentEditingAlarm = null;
        this.resetModal();
    }
    
    resetModal() {
        document.getElementById('alarm-time').value = '';
        document.getElementById('alarm-label').value = '';
        document.getElementById('alarm-sound').value = 'default';
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    updateTimeRemaining() {
        const timeInput = document.getElementById('alarm-time');
        if (!timeInput.value) return;
        
        const [hours, minutes] = timeInput.value.split(':');
        const alarmTime = new Date();
        alarmTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        const now = new Date();
        let timeDiff = alarmTime - now;
        
        if (timeDiff <= 0) {
            alarmTime.setDate(alarmTime.getDate() + 1);
            timeDiff = alarmTime - now;
        }
        
        const hours_remaining = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes_remaining = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeText = '';
        if (hours_remaining > 0) {
            timeText = `${hours_remaining} hour${hours_remaining > 1 ? 's' : ''} and ${minutes_remaining} minute${minutes_remaining > 1 ? 's' : ''}`;
        } else {
            timeText = `${minutes_remaining} minute${minutes_remaining > 1 ? 's' : ''}`;
        }
        
        document.getElementById('time-remaining-text').textContent = timeText;
    }
    
    saveAlarm() {
        const time = document.getElementById('alarm-time').value;
        const label = document.getElementById('alarm-label').value || 'Alarm';
        const sound = document.getElementById('alarm-sound').value;
        
        if (!time) {
            alert('Please select a time');
            return;
        }
        
        const repeatDays = Array.from(document.querySelectorAll('.day-btn.active'))
            .map(btn => parseInt(btn.dataset.day));
        
        const alarmData = {
            id: this.currentEditingAlarm ? this.currentEditingAlarm.id : this.generateId(),
            time,
            label,
            sound,
            repeatDays,
            enabled: true
        };
        
        if (this.currentEditingAlarm) {
            // Update existing alarm
            const index = this.alarms.findIndex(a => a.id === this.currentEditingAlarm.id);
            this.cancelAlarm(this.alarms[index]);
            this.alarms[index] = alarmData;
        } else {
            // Add new alarm
            this.alarms.push(alarmData);
        }
        
        this.scheduleAlarm(alarmData);
        this.saveAlarms();
        this.renderAlarms();
        this.closeModal();
        
        // Show time remaining modal
        this.showTimeRemainingModal();
    }
    
    showTimeRemainingModal() {
        this.updateTimeRemaining();
        document.getElementById('time-remaining-modal').classList.add('show');
    }
    
    closeTimeRemainingModal() {
        document.getElementById('time-remaining-modal').classList.remove('show');
    }
    
    scheduleAlarm(alarm) {
        const nextTrigger = this.getNextTriggerTime(alarm);
        alarm.nextTrigger = nextTrigger;
        
        console.log(`Alarm scheduled for: ${nextTrigger}`);
        
        // Schedule notification
        this.scheduleNotification(alarm);
    }
    
    getNextTriggerTime(alarm) {
        const [hours, minutes] = alarm.time.split(':');
        const now = new Date();
        let nextTrigger = new Date();
        nextTrigger.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (!alarm.repeatDays || alarm.repeatDays.length === 0) {
            // One-time alarm
            if (nextTrigger <= now) {
                nextTrigger.setDate(nextTrigger.getDate() + 1);
            }
        } else {
            // Repeating alarm
            const currentDay = now.getDay();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const alarmTime = parseInt(hours) * 60 + parseInt(minutes);
            
            let daysToAdd = 0;
            let found = false;
            
            // Check if alarm should trigger today
            if (alarm.repeatDays.includes(currentDay) && alarmTime > currentTime) {
                found = true;
            }
            
            // Look for next day
            if (!found) {
                for (let i = 1; i <= 7; i++) {
                    const checkDay = (currentDay + i) % 7;
                    if (alarm.repeatDays.includes(checkDay)) {
                        daysToAdd = i;
                        found = true;
                        break;
                    }
                }
            }
            
            nextTrigger.setDate(nextTrigger.getDate() + daysToAdd);
        }
        
        return nextTrigger;
    }
    
    scheduleNotification(alarm) {
        if (!this.notificationPermission) return;
        
        const delay = alarm.nextTrigger - new Date();
        if (delay <= 0) return;
        
        // Cancel existing timeout
        if (alarm.timeoutId) {
            clearTimeout(alarm.timeoutId);
        }
        
        alarm.timeoutId = setTimeout(() => {
            this.triggerAlarm(alarm);
        }, delay);
    }
    
    cancelAlarm(alarm) {
        if (alarm.timeoutId) {
            clearTimeout(alarm.timeoutId);
            alarm.timeoutId = null;
        }
        alarm.nextTrigger = null;
    }
    
    checkAlarms() {
        const now = new Date();
        
        this.alarms.forEach(alarm => {
            if (alarm.enabled && alarm.nextTrigger && now >= alarm.nextTrigger) {
                this.triggerAlarm(alarm);
            }
        });
    }
    
    triggerAlarm(alarm) {
        console.log('Triggering alarm:', alarm.label);
        
        // Show alarm modal
        this.showActiveAlarmModal(alarm);
        
        // Play sound
        this.playAlarmSound(alarm.sound);
        
        // Show notification
        this.showNotification(alarm);
        
        // Schedule next occurrence if repeating
        if (alarm.repeatDays && alarm.repeatDays.length > 0) {
            this.scheduleAlarm(alarm);
        } else {
            // One-time alarm - disable it
            alarm.enabled = false;
            this.saveAlarms();
            this.renderAlarms();
        }
    }
    
    showActiveAlarmModal(alarm) {
        document.querySelector('.active-alarm-time').textContent = this.formatTime(alarm.time);
        document.querySelector('.active-alarm-label').textContent = alarm.label;
        document.getElementById('active-alarm-modal').classList.add('show');
        
        // Store current alarm for snooze/stop actions
        this.currentActiveAlarm = alarm;
    }
    
    playAlarmSound(soundType) {
        if (this.currentAlarmAudio) {
            this.currentAlarmAudio.stop();
        }
        
        const soundGenerator = this.sounds[soundType] || this.sounds.default;
        this.currentAlarmAudio = soundGenerator();
        
        // Play for 30 seconds or until stopped
        setTimeout(() => {
            if (this.currentAlarmAudio) {
                this.currentAlarmAudio.stop();
            }
        }, 30000);
    }
    
    createBeepSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        
        oscillator.start();
        
        return {
            stop: () => {
                try {
                    oscillator.stop();
                } catch (e) {
                    // Oscillator already stopped
                }
            }
        };
    }
    
    createGentleSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.2, this.audioContext.currentTime + 1);
        
        oscillator.start();
        
        return {
            stop: () => {
                try {
                    oscillator.stop();
                } catch (e) {
                    // Oscillator already stopped
                }
            }
        };
    }
    
    createLoudSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        
        oscillator.start();
        
        return {
            stop: () => {
                try {
                    oscillator.stop();
                } catch (e) {
                    // Oscillator already stopped
                }
            }
        };
    }
    
    showNotification(alarm) {
        if (!this.notificationPermission) return;
        
        const notification = new Notification(`Alarm: ${alarm.label}`, {
            body: `Time: ${this.formatTime(alarm.time)}`,
            icon: 'icons/icon-192x192.svg',
            tag: 'alarm',
            requireInteraction: true
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
    
    snoozeAlarm() {
        if (this.currentAlarmAudio) {
            this.currentAlarmAudio.stop();
        }
        
        document.getElementById('active-alarm-modal').classList.remove('show');
        
        // Schedule snooze (5 minutes)
        if (this.currentActiveAlarm) {
            const snoozeTime = new Date();
            snoozeTime.setMinutes(snoozeTime.getMinutes() + 5);
            this.currentActiveAlarm.nextTrigger = snoozeTime;
            this.scheduleNotification(this.currentActiveAlarm);
        }
    }
    
    stopAlarm() {
        if (this.currentAlarmAudio) {
            this.currentAlarmAudio.stop();
        }
        
        document.getElementById('active-alarm-modal').classList.remove('show');
        this.currentActiveAlarm = null;
    }
    
    scheduleAllAlarms() {
        this.alarms.forEach(alarm => {
            if (alarm.enabled) {
                this.scheduleAlarm(alarm);
            }
        });
    }
    
    checkMissedAlarms() {
        const now = new Date();
        
        this.alarms.forEach(alarm => {
            if (alarm.enabled && alarm.nextTrigger && now > alarm.nextTrigger) {
                // Reschedule missed alarm
                this.scheduleAlarm(alarm);
            }
        });
    }
    
    setupDayChangeDetection() {
        // Check for day change every minute
        setInterval(() => {
            const now = new Date();
            const lastCheck = this.lastDayCheck || now;
            
            if (now.getDate() !== lastCheck.getDate()) {
                // Day changed, reschedule all alarms
                console.log('Day changed, rescheduling alarms');
                this.scheduleAllAlarms();
                this.saveAlarms();
                this.renderAlarms();
            }
            
            this.lastDayCheck = now;
        }, 60000);
    }
}

// Global functions for HTML onclick handlers
function showAddAlarmModal() {
    alarmApp.showModal();
}

function closeModal() {
    alarmApp.closeModal();
}

function saveAlarm() {
    alarmApp.saveAlarm();
}

function closeTimeRemainingModal() {
    alarmApp.closeTimeRemainingModal();
}

function snoozeAlarm() {
    alarmApp.snoozeAlarm();
}

function stopAlarm() {
    alarmApp.stopAlarm();
}

// Initialize app
let alarmApp;

document.addEventListener('DOMContentLoaded', () => {
    alarmApp = new AlarmApp();
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && alarmApp) {
        // App became visible, check for alarms
        alarmApp.checkAlarms();
    }
});

// Handle page focus
window.addEventListener('focus', () => {
    if (alarmApp) {
        alarmApp.checkAlarms();
    }
});

// Handle beforeunload
window.addEventListener('beforeunload', () => {
    if (alarmApp) {
        alarmApp.saveAlarms();
    }
});