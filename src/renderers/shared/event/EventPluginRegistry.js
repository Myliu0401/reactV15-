/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginRegistry
 */

'use strict';

var invariant = require('invariant');

/**
 * Injectable ordering of event plugins.
 */
var EventPluginOrder = null;

/**
 * 从名称到事件插件模块的可注入映射。
 */
var namesToPlugins = {};

/**
 * 使用注入的插件和插件顺序重新计算插件列表。
 *
 * @private
 */
function recomputePluginOrdering() {
  if (!EventPluginOrder) {
    // 等待注入`EventPluginOrder`。
    return;
  }
  for (var pluginName in namesToPlugins) {
    var PluginModule = namesToPlugins[pluginName];
    var pluginIndex = EventPluginOrder.indexOf(pluginName);
    invariant(
      pluginIndex > -1,
      'EventPluginRegistry: Cannot inject event plugins that do not exist in ' +
      'the plugin ordering, `%s`.',
      pluginName
    );
    if (EventPluginRegistry.plugins[pluginIndex]) {
      continue;
    }
    invariant(
      PluginModule.extractEvents,
      'EventPluginRegistry: Event plugins must implement an `extractEvents` ' +
      'method, but `%s` does not.',
      pluginName
    );
    EventPluginRegistry.plugins[pluginIndex] = PluginModule;
    var publishedEvents = PluginModule.eventTypes;
    for (var eventName in publishedEvents) {
      invariant(
        publishEventForPlugin(
          publishedEvents[eventName],
          PluginModule,
          eventName
        ),
        'EventPluginRegistry: Failed to publish event `%s` for plugin `%s`.',
        eventName,
        pluginName
      );
    }
  }
}

/**
 * Publishes an event so that it can be dispatched by the supplied plugin.
 *
 * @param {object} dispatchConfig Dispatch configuration for the event.
 * @param {object} PluginModule Plugin publishing the event.
 * @return {boolean} True if the event was successfully published.
 * @private
 */
function publishEventForPlugin(dispatchConfig, PluginModule, eventName) {
  invariant(
    !EventPluginRegistry.eventNameDispatchConfigs.hasOwnProperty(eventName),
    'EventPluginHub: More than one plugin attempted to publish the same ' +
    'event name, `%s`.',
    eventName
  );
  EventPluginRegistry.eventNameDispatchConfigs[eventName] = dispatchConfig;

  var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;

  if (phasedRegistrationNames) {
    for (var phaseName in phasedRegistrationNames) {
      if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
        var phasedRegistrationName = phasedRegistrationNames[phaseName];
        publishRegistrationName(
          phasedRegistrationName,
          PluginModule,
          eventName
        );
      }
    }
    return true;
  } else if (dispatchConfig.registrationName) {
    publishRegistrationName(
      dispatchConfig.registrationName,
      PluginModule,
      eventName
    );
    return true;
  }
  return false;
}

/**
 * Publishes a registration name that is used to identify dispatched events and
 * can be used with `EventPluginHub.putListener` to register listeners.
 *
 * @param {string} registrationName Registration name to add.
 * @param {object} PluginModule Plugin publishing the event.
 * @private
 */
function publishRegistrationName(registrationName, PluginModule, eventName) {
  invariant(
    !EventPluginRegistry.registrationNameModules[registrationName],
    'EventPluginHub: More than one plugin attempted to publish the same ' +
    'registration name, `%s`.',
    registrationName
  );

  // 建立合成事件名与事件插件的映射
  EventPluginRegistry.registrationNameModules[registrationName] = PluginModule; 

  // 建立合成事件名与原生事件的映射
  EventPluginRegistry.registrationNameDependencies[registrationName] = PluginModule.eventTypes[eventName].dependencies;

  if (__DEV__) {
    var lowerCasedName = registrationName.toLowerCase();
    EventPluginRegistry.possibleRegistrationNames[lowerCasedName] =
      registrationName;
  }
}

/**
 * Registers plugins so that they can extract and dispatch events.
 *
 * @see {EventPluginHub}
 */
var EventPluginRegistry = {

  /**
   * Ordered list of injected plugins.
   */
  plugins: [],

  /**
   * Mapping from event name to dispatch config
   */
  eventNameDispatchConfigs: {},

  /**
   * 用于保存合成事件名与事件插件的映射，比如某个合成事件属于哪个事件插件
   * 如：onClick: {
   *      eventTypes: {},
   *      extractEvents: func
   * }
   */
  registrationNameModules: {},

  /**
   * 用于保存合成事件与原生事件的映射关系，比如某个合成事件是由哪些原生事件组合模拟的
   * 如: {
   *    onClick: ['click'],
   *    onChange: ['input','change',...]
   * }
   */
  registrationNameDependencies: {},

  /**
   * Mapping from lowercase registration names to the properly cased version,
   * used to warn in the case of missing event handlers. Available
   * only in __DEV__.
   * @type {Object}
   */
  possibleRegistrationNames: __DEV__ ? {} : null,

  /**
   * Injects an ordering of plugins (by plugin name). This allows the ordering
   * to be decoupled from injection of the actual plugins so that ordering is
   * always deterministic regardless of packaging, on-the-fly injection, etc.
   *
   * @param {array} InjectedEventPluginOrder
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginOrder}
   */
  injectEventPluginOrder: function(InjectedEventPluginOrder) {
    invariant(
      !EventPluginOrder,
      'EventPluginRegistry: Cannot inject event plugin ordering more than ' +
      'once. You are likely trying to load more than one copy of React.'
    );
    // Clone the ordering so it cannot be dynamically mutated.
    EventPluginOrder = Array.prototype.slice.call(InjectedEventPluginOrder);
    recomputePluginOrdering();
  },

  /**
   * 注入要由`EventPluginHub`使用的插件。插件名称必须为在“injectEventPluginOrder”注入的顺序中。
   *
   * 插件可以作为页面初始化的一部分注入，也可以动态注入。
   *  
   * @param {object} injectedNamesToPlugins 从名称映射到插件模块。
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginsByName}
   */
  injectEventPluginsByName: function(injectedNamesToPlugins) {
    var isOrderingDirty = false;

    // 遍历该参数对象
    for (var pluginName in injectedNamesToPlugins) {

      // 判断参数对象中属性是否在原型上，如果是则跳过本次循环
      if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
        continue;
      }

      // 获取参数对象中的属性值
      var PluginModule = injectedNamesToPlugins[pluginName];

      // 判断namesToPlugins对象中是否没有该属性 或者 namesToPlugins对象中该属性值不等于PluginModule
      if (!namesToPlugins.hasOwnProperty(pluginName) || namesToPlugins[pluginName] !== PluginModule) {
        invariant(
          !namesToPlugins[pluginName],
          'EventPluginRegistry: Cannot inject two different event plugins ' +
          'using the same name, `%s`.',
          pluginName
        );
        namesToPlugins[pluginName] = PluginModule; // 将该属性值存到namesToPlugins对象中
        isOrderingDirty = true; // 设置为true
      }
    }

    // 只要有进入存储 该属性就为true
    if (isOrderingDirty) {
      recomputePluginOrdering();
    }
  },

  /**
   * Looks up the plugin for the supplied event.
   *
   * @param {object} event A synthetic event.
   * @return {?object} The plugin that created the supplied event.
   * @internal
   */
  getPluginModuleForEvent: function(event) {
    var dispatchConfig = event.dispatchConfig;
    if (dispatchConfig.registrationName) {
      return EventPluginRegistry.registrationNameModules[
        dispatchConfig.registrationName
      ] || null;
    }
    for (var phase in dispatchConfig.phasedRegistrationNames) {
      if (!dispatchConfig.phasedRegistrationNames.hasOwnProperty(phase)) {
        continue;
      }
      var PluginModule = EventPluginRegistry.registrationNameModules[
        dispatchConfig.phasedRegistrationNames[phase]
      ];
      if (PluginModule) {
        return PluginModule;
      }
    }
    return null;
  },

  /**
   * Exposed for unit testing.
   * @private
   */
  _resetEventPlugins: function() {
    EventPluginOrder = null;
    for (var pluginName in namesToPlugins) {
      if (namesToPlugins.hasOwnProperty(pluginName)) {
        delete namesToPlugins[pluginName];
      }
    }
    EventPluginRegistry.plugins.length = 0;

    var eventNameDispatchConfigs = EventPluginRegistry.eventNameDispatchConfigs;
    for (var eventName in eventNameDispatchConfigs) {
      if (eventNameDispatchConfigs.hasOwnProperty(eventName)) {
        delete eventNameDispatchConfigs[eventName];
      }
    }

    var registrationNameModules = EventPluginRegistry.registrationNameModules;
    for (var registrationName in registrationNameModules) {
      if (registrationNameModules.hasOwnProperty(registrationName)) {
        delete registrationNameModules[registrationName];
      }
    }

    if (__DEV__) {
      var possibleRegistrationNames =
        EventPluginRegistry.possibleRegistrationNames;
      for (var lowerCasedName in possibleRegistrationNames) {
        if (possibleRegistrationNames.hasOwnProperty(lowerCasedName)) {
          delete possibleRegistrationNames[lowerCasedName];
        }
      }
    }
  },

};

module.exports = EventPluginRegistry;
