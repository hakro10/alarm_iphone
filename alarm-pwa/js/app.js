class AlarmApp {
    constructor() {
        this.alarms = [];
        this.currentEditingAlarm = null;
        this.activeAlarmTimeout = null;
        this.audioContext = null;
        this.currentAlarmAudio = null;
        this.notificationPermission = false;
        this.audioContextInitialized = false;
        this.checkAlarmInterval = null;
        this.wakeLock = null;
        this.isVisible = true;
        this.sounds = {
            default: this.createBeepSound.bind(this),
            gentle: this.createGentleSound.bind(this),
            loud: this.createLoudSound.bind(this),
            beep: this.createBeepSound.bind(this)
        };
        
        this.init();
    }
    
    async init() {
        this.loadAlarms();
        this.loadCustomSounds();
        await this.requestNotificationPermission();
        await this.registerServiceWorker();
        this.setupVisibilityHandling();
        this.setupWakeLock();
        this.renderAlarms();
        this.scheduleAllAlarms();
        this.checkMissedAlarms();
        this.startAlarmChecking();
        this.setupDayChangeDetection();
        this.setupEventListeners();
        this.setupServiceWorkerMessages();
    }
    
    setupEventListeners() {
        document.querySelector('.add-alarm-btn').addEventListener('click', () => {
            this.initializeAudioContext();
            this.showModal();
        });
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        document.querySelector('.modal-save').addEventListener('click', () => this.saveAlarm());
        document.querySelector('.ok-btn').addEventListener('click', () => this.closeTimeRemainingModal());
        document.querySelector('.snooze-btn').addEventListener('click', () => this.snoozeAlarm());
        document.querySelector('.stop-btn').addEventListener('click', () => this.stopAlarm());

        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                btn.classList.toggle('active');
            });
        });
        
        document.getElementById('alarm-time').addEventListener('change', () => {
            this.updateTimeRemaining();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.closest('.modal')) {
                e.preventDefault();
            }
        });

        document.getElementById('upload-sound-btn').addEventListener('click', () => {
            document.getElementById('sound-upload-input').click();
        });

        document.getElementById('sound-upload-input').addEventListener('change', (e) => {
            this.handleSoundUpload(e.target.files[0]);
        });

        document.getElementById('alarms-container').addEventListener('click', (e) => {
            const target = e.target;
            const alarmItem = target.closest('.alarm-item');
            if (!alarmItem) return;

            const alarmId = alarmItem.dataset.id;

            if (target.classList.contains('alarm-toggle')) {
                this.initializeAudioContext();
                this.toggleAlarm(alarmId);
            } else if (target.classList.contains('alarm-menu-btn')) {
                this.showAlarmOptions(alarmId);
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
                await navigator.serviceWorker.register('sw.js');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    loadAlarms() {
        const saved = localStorage.getItem('alarms');
        if (saved) {
            this.alarms = JSON.parse(saved);
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
                        <button class="alarm-toggle ${alarm.enabled ? 'active' : ''}"></button>
                        <button class="alarm-menu-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
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
                   alarm.repeatDays.every(day => [1,2,3,4,5].includes(day))) {
            return 'Weekdays';
        } else if (alarm.repeatDays.length === 2 && 
                   alarm.repeatDays.every(day => [0,6].includes(day))) {
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
                // Show time remaining popup when alarm is turned on
                this.showTimeRemainingModalForAlarm(alarm);
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
        this.showConfirmModal('Delete this alarm?', () => {
            const index = this.alarms.findIndex(a => a.id === id);
            if (index > -1) {
                this.cancelAlarm(this.alarms[index]);
                this.alarms.splice(index, 1);
                this.saveAlarms();
                this.renderAlarms();
            }
        });
    }
    
    populateModal(alarm) {
        document.getElementById('alarm-time').value = alarm.time;
        document.getElementById('alarm-label').value = alarm.label;
        document.getElementById('alarm-sound').value = alarm.sound;
        
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
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
    
    updateTimeRemainingForAlarm(alarm) {
        if (!alarm.nextTrigger) return;
        
        const now = new Date();
        const timeDiff = alarm.nextTrigger - now;
        
        if (timeDiff <= 0) {
            document.getElementById('time-remaining-text').textContent = 'Alarm time has passed';
            return;
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
            const index = this.alarms.findIndex(a => a.id === this.currentEditingAlarm.id);
            this.cancelAlarm(this.alarms[index]);
            this.alarms[index] = alarmData;
        } else {
            this.alarms.push(alarmData);
        }
        
        this.scheduleAlarm(alarmData);
        this.saveAlarms();
        this.renderAlarms();
        this.closeModal();
        
        this.showTimeRemainingModal();
    }
    
    showTimeRemainingModal() {
        this.updateTimeRemaining();
        document.getElementById('time-remaining-modal').classList.add('show');
    }
    
    showTimeRemainingModalForAlarm(alarm) {
        this.updateTimeRemainingForAlarm(alarm);
        document.getElementById('time-remaining-modal').classList.add('show');
    }
    
    closeTimeRemainingModal() {
        document.getElementById('time-remaining-modal').classList.remove('show');
    }
    
    scheduleAlarm(alarm) {
        const nextTrigger = this.getNextTriggerTime(alarm);
        alarm.nextTrigger = nextTrigger;
        this.scheduleNotification(alarm);
    }
    
    getNextTriggerTime(alarm) {
        const [hours, minutes] = alarm.time.split(':');
        const now = new Date();
        let nextTrigger = new Date();
        nextTrigger.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (!alarm.repeatDays || alarm.repeatDays.length === 0) {
            if (nextTrigger <= now) {
                nextTrigger.setDate(nextTrigger.getDate() + 1);
            }
        } else {
            const currentDay = now.getDay();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const alarmTime = parseInt(hours) * 60 + parseInt(minutes);
            
            let daysToAdd = 0;
            let found = false;
            
            if (alarm.repeatDays.includes(currentDay) && alarmTime > currentTime) {
                found = true;
            }
            
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
        this.showActiveAlarmModal(alarm);
        this.playAlarmSound(alarm.sound);
        this.showNotification(alarm);
        
        if (alarm.repeatDays && alarm.repeatDays.length > 0) {
            this.scheduleAlarm(alarm);
        } else {
            alarm.enabled = false;
            this.saveAlarms();
            this.renderAlarms();
        }
    }
    
    showActiveAlarmModal(alarm) {
        document.querySelector('.active-alarm-time').textContent = this.formatTime(alarm.time);
        document.querySelector('.active-alarm-label').textContent = alarm.label;
        document.getElementById('active-alarm-modal').classList.add('show');
        
        this.currentActiveAlarm = alarm;
    }
    
    playAlarmSound(soundType) {
        if (this.currentAlarmAudio) {
            this.currentAlarmAudio.stop();
        }

        if (soundType.startsWith('custom_')) {
            const soundName = soundType.replace('custom_', '');
            const soundData = localStorage.getItem(`custom_sound_${soundName}`);
            if (soundData) {
                const audio = new Audio(soundData);
                audio.loop = true;
                audio.volume = 0.8;
                audio.play().catch(e => console.error('Audio play failed:', e));
                this.currentAlarmAudio = {
                    stop: () => {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                };
            } else {
                // Fallback to default if custom sound not found
                this.currentAlarmAudio = this.sounds.default();
            }
        } else {
            const soundGenerator = this.sounds[soundType] || this.sounds.default;
            this.currentAlarmAudio = soundGenerator();
        }

        // Stop alarm after 60 seconds for iOS PWA compatibility
        setTimeout(() => {
            if (this.currentAlarmAudio) {
                this.currentAlarmAudio.stop();
            }
        }, 60000);
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
                } catch (e) {}
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
                } catch (e) {}
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
                } catch (e) {}
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

    handleSoundUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const soundName = file.name;
            const soundData = e.target.result;

            try {
                localStorage.setItem(`custom_sound_${soundName}`, soundData);
                this.addCustomSoundToSelect(soundName);
            } catch (error) {
                console.error('Error saving sound to local storage:', error);
                alert('Could not save sound. Storage may be full.');
            }
        };
        reader.readAsDataURL(file);
    }

    addCustomSoundToSelect(soundName) {
        const select = document.getElementById('alarm-sound');
        const option = document.createElement('option');
        option.value = `custom_${soundName}`;
        option.textContent = soundName;
        select.appendChild(option);
    }

    loadCustomSounds() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('custom_sound_')) {
                const soundName = key.replace('custom_sound_', '');
                this.addCustomSoundToSelect(soundName);
            }
        }
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
                this.scheduleAlarm(alarm);
            }
        });
    }
    
    initializeAudioContext() {
        if (this.audioContextInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioContextInitialized = true;
        } catch (error) {
            console.error('AudioContext initialization failed:', error);
            // Fallback to HTML5 Audio API
            this.audioContext = null;
        }
    }
    
    startAlarmChecking() {
        if (this.checkAlarmInterval) {
            clearInterval(this.checkAlarmInterval);
        }
        
        // Check every 5 seconds for iOS PWA compatibility
        this.checkAlarmInterval = setInterval(() => {
            this.checkAlarms();
        }, 5000);
        
        // Also check when the app becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkAlarms();
            }
        });
    }
    
    showAlarmOptions(alarmId) {
        const alarm = this.alarms.find(a => a.id === alarmId);
        if (!alarm) return;
        
        const options = [
            { text: 'Edit', action: () => this.editAlarm(alarmId) },
            { text: 'Delete', action: () => this.deleteAlarm(alarmId) },
            { text: 'Duplicate', action: () => this.duplicateAlarm(alarmId) }
        ];
        
        this.showActionSheet(options);
    }
    
    duplicateAlarm(alarmId) {
        const alarm = this.alarms.find(a => a.id === alarmId);
        if (!alarm) return;
        
        const duplicatedAlarm = {
            ...alarm,
            id: this.generateId(),
            label: `${alarm.label} (Copy)`,
            enabled: false,
            nextTrigger: null,
            timeoutId: null
        };
        
        this.alarms.push(duplicatedAlarm);
        this.saveAlarms();
        this.renderAlarms();
    }
    
    showActionSheet(options) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content action-sheet">
                <div class="action-sheet-options">
                    ${options.map(option => `
                        <button class="action-option" data-action="${option.text}">${option.text}</button>
                    `).join('')}
                    <button class="action-option action-cancel">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-option')) {
                const action = e.target.dataset.action;
                const option = options.find(o => o.text === action);
                if (option) {
                    option.action();
                }
                document.body.removeChild(modal);
            } else if (e.target.classList.contains('action-cancel') || e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    setupDayChangeDetection() {
        setInterval(() => {
            const now = new Date();
            const lastCheck = this.lastDayCheck || now;
            
            if (now.getDate() !== lastCheck.getDate()) {
                this.scheduleAllAlarms();
                this.saveAlarms();
                this.renderAlarms();
            }
            
            this.lastDayCheck = now;
        }, 60000);
    }

    showConfirmModal(message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-body" style="text-align: center;">
                    <p>${message}</p>
                    <div style="margin-top: 20px;">
                        <button class="ok-btn" id="confirm-yes">Yes</button>
                        <button class="modal-close" id="confirm-no" style="background: #333; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">No</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirm-yes').onclick = () => {
            onConfirm();
            document.body.removeChild(modal);
        };
        document.getElementById('confirm-no').onclick = () => {
            document.body.removeChild(modal);
        };
    }
    
    // iOS PWA Optimization Methods
    
    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
            if (this.isVisible) {
                this.checkAlarms();
                this.requestWakeLock();
            } else {
                this.releaseWakeLock();
            }
        });

        // Handle iOS specific events
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                this.checkAlarms();
                this.requestWakeLock();
            }
        });

        window.addEventListener('pagehide', () => {
            this.releaseWakeLock();
        });
    }
    
    setupWakeLock() {
        if ('wakeLock' in navigator) {
            this.requestWakeLock();
        }
    }
    
    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock acquired');
            }
        } catch (err) {
            console.error('Wake lock request failed:', err);
        }
    }
    
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake lock released');
        }
    }
    
    setupServiceWorkerMessages() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'sync-alarms') {
                    this.scheduleAllAlarms();
                } else if (event.data.type === 'snooze-alarm') {
                    this.snoozeAlarm();
                } else if (event.data.type === 'stop-alarm') {
                    this.stopAlarm();
                }
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AlarmApp();
});
