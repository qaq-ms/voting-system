const EventEmitter = require('events');

class EventHub extends EventEmitter {
  constructor() {
    super();
    this.subscribers = [];
    this.recent = [];
    this.maxRecent = 100;
  }

  subscribe(fn) {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(f => f !== fn);
    };
  }

  emit(event, data) {
    this.recent.unshift({ event, data, timestamp: Date.now() });
    if (this.recent.length > this.maxRecent) {
      this.recent.pop();
    }
    super.emit(event, data);
    this.subscribers.forEach(fn => {
      try {
        fn(event, data);
      } catch (err) {
        console.error('[EventHub] Subscriber error:', err);
      }
    });
  }

  notifyNewPoll(pollData) {
    this.emit('poll:created', {
      type: 'new_poll',
      timestamp: Date.now(),
      data: pollData
    });
  }

  notifyPollStatusChanged(pollId, status) {
    this.emit('poll:status_changed', {
      type: 'poll_status_changed',
      timestamp: Date.now(),
      data: { pollId, status }
    });
  }

  notifyUserDeleted(userId) {
    this.emit('user:deleted', {
      type: 'user_deleted',
      timestamp: Date.now(),
      data: { userId }
    });
  }

  getRecentEvents(count = 20) {
    return this.recent.slice(0, count);
  }
}

const eventHub = new EventHub();
module.exports = eventHub;
