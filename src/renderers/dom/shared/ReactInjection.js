/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInjection
 */

'use strict';

var DOMProperty = require('DOMProperty');
var EventPluginHub = require('EventPluginHub');
var EventPluginUtils = require('EventPluginUtils');
var ReactComponentEnvironment = require('ReactComponentEnvironment');
var ReactClass = require('ReactClass');
var ReactEmptyComponent = require('ReactEmptyComponent');
var ReactBrowserEventEmitter = require('ReactBrowserEventEmitter');
var ReactNativeComponent = require('ReactNativeComponent');
var ReactPerf = require('ReactPerf');
var ReactUpdates = require('ReactUpdates');

var ReactInjection = {
  Component: ReactComponentEnvironment.injection,
  Class: ReactClass.injection,
  DOMProperty: DOMProperty.injection,
  EmptyComponent: ReactEmptyComponent.injection,

  /* 
     该对象中拥有 injectEventPluginOrder、injectEventPluginsByName 属性，
     这些属性都是EventPluginRegistry模块的
  */
  EventPluginHub: EventPluginHub.injection,
  
  EventPluginUtils: EventPluginUtils.injection,
  EventEmitter: ReactBrowserEventEmitter.injection,
  NativeComponent: ReactNativeComponent.injection,
  Perf: ReactPerf.injection,
  Updates: ReactUpdates.injection,
};

module.exports = ReactInjection;
