'use strict';
/**
 * notifications handler for SockBot2.0
 * @module notifications
 * @author Accalia
 * @license MIT
 */
const async = require('async');
const config = require('./config'),
    utils = require('./utils'),
    commands = require('./commands');
const browser = require('./browser')();
const internals = {
        notifyTypes: {
            1: 'mentioned',
            2: 'replied',
            3: 'quoted',
            4: 'edited',
            5: 'liked',
            6: 'private_message',
            7: 'invited_to_private_message',
            8: 'invitee_accepted',
            9: 'posted',
            10: 'moved_post',
            11: 'linked',
            12: 'granted_badge',
            13: 'invited_to_topic',
            14: 'custom'
        }
    },
    privateFns = {
        onNotificationMessage: onNotificationMessage,
        handleTopicNotification: handleTopicNotification,
        onNotification: onNotification,
        removeNotification: removeNotification
    };

/**
 * Prepare notifications for bot start
 *
 * @param {EventEmitter} events EventEmitter that will be used for communication
 * @param {completionCallback} callback Completion Callback
 */
exports.prepare = function prepare(events, callback) {
    internals.events = events;
    events.onNotification = onNotification;
    events.removeNotification = removeNotification;
    callback();
};
/**
 * Prepare notifications for bot start
 *
 * @param {EventEmitter} events EventEmitter that will be used for communication
 * @param {completionCallback} callback Completion Callback
 */
exports.start = function start() {
    internals.events.onChannel('/notification/' + config.user.id, privateFns.onNotificationMessage);
};

/**
 * Poll for notifications
 *
 * @param {completionCallback} callback Completion callback
 */
exports.pollNotifications = function pollNotifications(callback) {
    utils.log('Polling Notifications');
    browser.getNotifications((err, notifications) => {
        if (err) {
            return callback(err);
        }
        notifications.notifications.filter((n) => !n.read).forEach((n) => {
            n.type = internals.notifyTypes[n.notification_type];
            if (!n.type) {
                n.type = 'UNKNOWN';
            }
            if (n.topic_id) {
                return privateFns.handleTopicNotification(n);
            }
            const handled = internals.events.emit('notification#' + n.type,
                n, null, null);
            if (!handled) {
                utils.warn(n.type + ' notification #' + n.id + ' was not handled!');
            }
        });
        callback(null);
    });
};

/**
 * Process a notification from a topic
 *
 * @param {external.notifications.notification} notification Notification to process
 */
function handleTopicNotification(notification) {
    async.parallel({
        topic: (cb) => browser.getTopic(notification.topic_id, cb),
        post: (cb) => browser.getPost(notification.data.original_post_id, cb)
    }, (err, result) => {
        if (err) {
            return;
        }
        async.series([(next) => {
            utils.filterIgnored(result.topic, result.post, next);
        }, (next) => {
            if (['mentioned', 'replied', 'quoted', 'private_message', 'posted'].indexOf(notification.type) > -1) {
                commands.parseCommands(result.post, result.topic, (err2, commands2) => {
                    next(err2 || (commands2 && commands2.length));
                });
            } else {
                next();
            }
        }, (next) => {
            const handled = internals.events.emit('notification#' + notification.type, notification, result.topic,
                result.post);
            if (!handled) {
                utils.warn(notification.type + ' notification #' + notification.id + ' was not handled!');
            }
            next();
        }]);
    });
}

/**
 * React to notifications message
 *
 * @param {external.messageBus.notificationsMessage} message Recieved message
 */
function onNotificationMessage(message) {
    if (message.unread_notifications > 0 || message.unread_private_messages > 0) {
        exports.pollNotifications(() => 0);
    }
}

/**
 * Add a notification listener
 *
 * @param {string} type Notification type
 * @param {notificationCallback} handler Notification handler
 * @returns {EventEmitter} EventEmitter for chainging calls
 */
function onNotification(type, handler) {
    const types = Object.keys(internals.notifyTypes).map((o) => internals.notifyTypes[o]);
    if (types.indexOf(type) < 0) {
        utils.warn('Notification type `' + type + '` is not recognized.');
    }
    internals.events.on('notification#' + type, handler);
    return internals.events;
}

/**
 * Remove a notification listener
 *
 * @param {string} type Notification type
 * @param {notificationCallback} handler Notification handler
 * @returns {EventEmitter} EventEmitter for chainging calls
 */
function removeNotification(type, handler) {
    internals.events.removeListener('notification#' + type, handler);
    return internals.events;
}

/**
 * Completion Callback
 *
 * @callback
 * @name completionCallback
 * @param {string|Error} err Filter Error state
 */

/**
 * Notification Callback
 *
 * @callback
 * @name notificationCallback
 * @param {external.notifications.notification} notification Received notification
 * @param {external.topics.Topic} [topic] Topic data for received notification
 * @param {external.posts.CleanedPost} [post] Post data for recieved notification
 */

/* istanbul ignore else */
if (typeof GLOBAL.describe === 'function') {
    //test is running
    exports.internals = internals;
    exports.privateFns = privateFns;
}
