/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginHub
 */

'use strict';

var EventPluginRegistry = require('EventPluginRegistry');
var EventPluginUtils = require('EventPluginUtils');
var ReactErrorUtils = require('ReactErrorUtils');

var accumulateInto = require('accumulateInto');
var forEachAccumulated = require('forEachAccumulated');
var invariant = require('invariant');

/**
 * Internal store for event listeners
 */
var listenerBank = {};

/**
 * Internal queue of events that have accumulated their dispatches and are
 * waiting to have their dispatches executed.
 */
var eventQueue = null;

/**
 * Dispatches an event and releases it back into the pool, unless persistent.
 *
 * @param {?object} event Synthetic event to be dispatched.
 * @param {boolean} simulated If the event is simulated (changes exn behavior)
 * @private
 */
var executeDispatchesAndRelease = function(event, simulated) {
  if (event) {
    // 进行事件分发,
    EventPluginUtils.executeDispatchesInOrder(event, simulated);

    if (!event.isPersistent()) {
      // 处理完,则release掉event对象,采用对象池方式,减少GC
      // React帮我们处理了合成事件的回收机制，不需要我们关心。但要注意，如果使用了DOM原生事件，则要自己回收
      event.constructor.release(event);
    }
  }
};

var executeDispatchesAndReleaseSimulated = function(e) {
  return executeDispatchesAndRelease(e, true);
};


var executeDispatchesAndReleaseTopLevel = function(e) {
  return executeDispatchesAndRelease(e, false);
};



/**
 * This is a unified interface for event plugins to be installed and configured.
 *
 * Event plugins can implement the following properties:
 *
 *   `extractEvents` {function(string, DOMEventTarget, string, object): *}
 *     Required. When a top-level event is fired, this method is expected to
 *     extract synthetic events that will in turn be queued and dispatched.
 *
 *   `eventTypes` {object}
 *     Optional, plugins that fire events must publish a mapping of registration
 *     names that are used to register listeners. Values of this mapping must
 *     be objects that contain `registrationName` or `phasedRegistrationNames`.
 *
 *   `executeDispatch` {function(object, function, string)}
 *     Optional, allows plugins to override how an event gets dispatched. By
 *     default, the listener is simply invoked.
 *
 * Each plugin that is injected into `EventsPluginHub` is immediately operable.
 *
 * @public
 */
var EventPluginHub = {

  /**
   * Methods for injecting dependencies.
   */
  injection: {

    /**
     * @param {array} InjectedEventPluginOrder
     * @public
     * 为EventPluginRegistry模块的injectEventPluginOrder属性
     */
    injectEventPluginOrder: EventPluginRegistry.injectEventPluginOrder,  

    /**
     * @param {object} injectedNamesToPlugins Map from names to plugin modules.
     * 为EventPluginRegistry模块的injectEventPluginsByName属性
     */
    injectEventPluginsByName: EventPluginRegistry.injectEventPluginsByName,

  },

  /**
   * Stores `listener` at `listenerBank[registrationName][id]`. Is idempotent.
   *
   * @param {object} inst The instance, which is the source of events.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @param {function} listener The callback to store.
   */
  putListener: function(inst, registrationName, listener) {
    invariant(
      typeof listener === 'function',
      'Expected %s listener to be a function, instead got type %s',
      registrationName, typeof listener
    );

    var bankForRegistrationName =
      listenerBank[registrationName] || (listenerBank[registrationName] = {});
    bankForRegistrationName[inst._rootNodeID] = listener;

    var PluginModule =
      EventPluginRegistry.registrationNameModules[registrationName];
    if (PluginModule && PluginModule.didPutListener) {
      PluginModule.didPutListener(inst, registrationName, listener);
    }
  },

  /**
   * @param {object} inst The instance, which is the source of events.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @return {?function} The stored callback.
   */
  getListener: function(inst, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    return bankForRegistrationName && bankForRegistrationName[inst._rootNodeID];
  },

  /**
   * 从注册库中删除侦听器。
   *
   * @param {object} inst this 也就是组件初始化实例
   * @param {string} registrationName 事件名
   */
  deleteListener: function(inst, registrationName) {
    var PluginModule = EventPluginRegistry.registrationNameModules[registrationName]; // 取出事件库中对应的模块

    // 判断有没有对应的事件库 并且 该事件库中有willDeleteListener函数
    if (PluginModule && PluginModule.willDeleteListener) {

      PluginModule.willDeleteListener(inst, registrationName); // 执行该对应事件库中的willDeleteListener函数
    }

    var bankForRegistrationName = listenerBank[registrationName];
    // TODO: This should never be null -- when is it?
    if (bankForRegistrationName) {
      delete bankForRegistrationName[inst._rootNodeID];
    }
  },

  /**
   * Deletes all listeners for the DOM element with the supplied ID.
   *
   * @param {object} inst The instance, which is the source of events.
   */
  deleteAllListeners: function(inst) {
    for (var registrationName in listenerBank) {
      if (!listenerBank[registrationName][inst._rootNodeID]) {
        continue;
      }

      var PluginModule =
        EventPluginRegistry.registrationNameModules[registrationName];
      if (PluginModule && PluginModule.willDeleteListener) {
        PluginModule.willDeleteListener(inst, registrationName);
      }

      delete listenerBank[registrationName][inst._rootNodeID];
    }
  },

  /**
   * Allows registered plugins an opportunity to extract events from top-level
   * native browser events.
   *
   * @return {*} An accumulation of synthetic events.
   * @internal
   */
  extractEvents: function(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget) {
    var events;

    var plugins = EventPluginRegistry.plugins;
    // [SimpleEventPlugin,EnterLeaveEventPlugin,ChangeEventPlugin,SelectEventPlugin,BeforeInputEventPlugin]

    for (var i = 0; i < plugins.length; i++) {
      // Not every plugin in the ordering may be loaded at runtime.
      var possiblePlugin = plugins[i];
      if (possiblePlugin) {
        var extractedEvents = possiblePlugin.extractEvents(
          topLevelType,
          targetInst,
          nativeEvent,
          nativeEventTarget
        );
        if (extractedEvents) {
          events = accumulateInto(events, extractedEvents);
        }
      }
    }
    return events;
  },

  /**
   * syntheticEvent放入队列中,等到processEventQueue再获得执行
   */
  enqueueEvents: function(events) {
    if (events) {
      eventQueue = accumulateInto(eventQueue, events);
    }
  },

  /**
   * 分发执行队列中的React合成事件。React事件是采用消息队列方式批处理的
   *
   * simulated：为true表示React测试代码，我们一般都是false 
   */
  processEventQueue: function(simulated) {

    // 先将eventQueue重置为空
    var processingEventQueue = eventQueue;

    eventQueue = null;
    if (simulated) {
      forEachAccumulated(
        processingEventQueue,
        executeDispatchesAndReleaseSimulated
      );
    } else {
      // 遍历处理队列中的事件,
      // 如果只有一个元素,则直接executeDispatchesAndReleaseTopLevel(processingEventQueue)
      // 否则遍历队列中事件,调用executeDispatchesAndReleaseTopLevel处理每个元素
      forEachAccumulated(
        processingEventQueue,
        executeDispatchesAndReleaseTopLevel
      );
    }
    invariant(
      !eventQueue,
      'processEventQueue(): Additional events were enqueued while processing ' +
      'an event queue. Support for this has not yet been implemented.'
    );
    // This would be a good time to rethrow if any of the event handlers threw.
    ReactErrorUtils.rethrowCaughtError();
  },

  
  /* 
     合成事件处理也分为两步，先将我们要处理的events队列放入eventQueue中，因为之前可能就存在还没处理完的合成事件。
     然后再执行eventQueue中的事件。可见，如果之前有事件未处理完，这里就又有得到执行的机会了。
  
  
  
  */



  /**
   * These are needed for tests only. Do not use!
   */
  __purge: function() {
    listenerBank = {};
  },

  __getListenerBank: function() {
    return listenerBank;
  },

};

module.exports = EventPluginHub;
