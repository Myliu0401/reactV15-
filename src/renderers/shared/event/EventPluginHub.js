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
 * 事件侦听器的内部存储
 * 该对象会存储对应的事件
 * 如
 * {
 *    onClick: {
 *       [dom组件初始化实例._rootNodeID]: 事件处理函数  
 *    } 
 * }
 */
var listenerBank = {};

/**
 * 已累计调度的事件的内部队列 等待执行他们的调度。
 */
var eventQueue = null;

/**
 * 
 * @param {*} event 合成事件对象
 * @param {*} simulated 布尔值
 */
var executeDispatchesAndRelease = function(event, simulated) {
  // 判断事件对象是否有值
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

/**
 * 
 * @param {*} e 合成事件对象
 * @returns 
 */
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
   * 存储事件处理函数
   *
   * @param {object} inst  组件初始化实例
   * @param {string} registrationName 事件名  如 onClick
   * @param {function} listener 事件处理函数
   */
  putListener: function(inst, registrationName, listener) {
    

    /* 
         判断是否有该事件属性有就直接取该属性对象，没有就赋值后取该对象
    
    
    */
    var bankForRegistrationName = listenerBank[registrationName] || (listenerBank[registrationName] = {});

    // 该组件初始化实例中有一个唯一id号，以该id号做为属性赋值为处理函数
    bankForRegistrationName[inst._rootNodeID] = listener;

    // 获取对应事件模块, 如 onclick 对应的事件模块为 简单事件模块 SimpleEventPlugin模块
    var PluginModule = EventPluginRegistry.registrationNameModules[registrationName];

    // 判断有没有该事件模块 并且 该事件模块中有didPutListener函数
    if (PluginModule && PluginModule.didPutListener) {
      PluginModule.didPutListener(inst, registrationName, listener);
    }
  },

  /**
   * @param {object} inst 组件初始化实例
   * @param {string} registrationName 冒泡或捕获的事件名 如： click的冒泡是 onClick   捕获是 onClickCapture
   * @return {?function} The stored callback.
   */
  getListener: function(inst, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName]; // 获取存储的事件对象 如： {onClick:{xxx}}
    return bankForRegistrationName && bankForRegistrationName[inst._rootNodeID];
  },

  /**
   * 从注册库中删除侦听器。
   *
   * @param {object} inst this 也就是组件初始化实例
   * @param {string} registrationName 事件名 如 onClick
   */
  deleteListener: function(inst, registrationName) {
    var PluginModule = EventPluginRegistry.registrationNameModules[registrationName]; // 取出事件库中对应的模块

    // 判断有没有对应的事件库 并且 该事件库中有willDeleteListener函数
    if (PluginModule && PluginModule.willDeleteListener) {

      // 参数为 组件初始化实例、事件名 如 onClick
      PluginModule.willDeleteListener(inst, registrationName); // 执行该对应事件库中的willDeleteListener函数
    }

    var bankForRegistrationName = listenerBank[registrationName]; // 取出存储对应事件函数的对象
  
    if (bankForRegistrationName) {
      delete bankForRegistrationName[inst._rootNodeID]; // 删除存储的对应事件函数
    }
  },

  /**
   * 卸载注册的事件
   * @param {*} inst 组件初始化实例
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
   * 根据事件类型生成合成事件对象
   * @param {*} topLevelType        映射的事件名  如： topClick
   * @param {*} targetInst          组件初始化实例
   * @param {*} nativeEvent         事件对象
   * @param {*} nativeEventTarget   触发事件目标节点的dom
   * @returns 
   */
  extractEvents: function(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget) {
    var events;

    // 获取事件模块
    var plugins = EventPluginRegistry.plugins;
    // [SimpleEventPlugin,EnterLeaveEventPlugin,ChangeEventPlugin,SelectEventPlugin,BeforeInputEventPlugin]

    // 循环事件模块
    for (var i = 0; i < plugins.length; i++) {
      
      var possiblePlugin = plugins[i]; // 获取事件模块
      
      // 判断该模块是否有值
      if (possiblePlugin) {

        // 执行事件模块中的extractEvents函数
        var extractedEvents = possiblePlugin.extractEvents(
          topLevelType,      // 映射的事件名  如： topClick
          targetInst,        // 组件初始化实例
          nativeEvent,       // 事件对象
          nativeEventTarget  // 触发事件目标节点的dom
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
   * @param {*} events 合成事件对象
   */
  enqueueEvents: function(events) {

    // 判断该参数是否有值
    if (events) {
      /* 
          参数为事件队列和合成事件对象
      */
      eventQueue = accumulateInto(eventQueue, events); 
    }
  },

  /**
   * 分发执行队列中的React合成事件。React事件是采用消息队列方式批处理的
   * simulated：为true表示React测试代码，我们一般都是false 
   * @param {*} simulated 布尔值
   */
  processEventQueue: function(simulated) {

   
    var processingEventQueue = eventQueue; // 将事件对象存到变量中

    eventQueue = null; // 再将该变量重新赋值为null

    // true表示测试代码，一般都为false
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
        processingEventQueue, // 合成事件对象
        executeDispatchesAndReleaseTopLevel
      );
    }
  
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
