/**
 * ELMALHY.3D Workshop Manager - Events Bus
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorkshopEvents = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const listeners = {};

  return {
    on(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
      return () => this.off(event, callback);
    },
    off(event, callback) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    },
    emit(event, data) {
      if (!listeners[event]) return;
      listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in event handler for "${event}":`, err);
        }
      });
    }
  };
});
