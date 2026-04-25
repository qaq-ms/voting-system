const EventEmitter = require('events');

class EventHub extends EventEmitter {
  constructor() {
    super();
    this.recent = [];
    this.maxRecent = 100;
  }

  emit(event, data) {
    this.recent.unshift({ event, data, timestamp: Date.now() });
    if (this.recent.length > this.maxRecent) {
      this.recent.pop();
    }
    super.emit(event, data);
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

  getRecentEvents(count = 20) {
    return this.recent.slice(0, count);
  }
}

const eventHub = new EventHub();
module.exports = eventHub;
