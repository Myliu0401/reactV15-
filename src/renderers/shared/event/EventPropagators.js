/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPropagators
 */

'use strict';

var EventConstants = require('EventConstants');
var EventPluginHub = require('EventPluginHub');
var EventPluginUtils = require('EventPluginUtils');

var accumulateInto = require('accumulateInto');
var forEachAccumulated = require('forEachAccumulated');
var warning = require('warning');

var PropagationPhases = EventConstants.PropagationPhases;
var getListener = EventPluginHub.getListener;



/**
 * 
 * @param {*} inst     组件初始化实例
 * @param {*} event    合成事件对象
 * @param {*} propagationPhase 冒泡还是捕获
 * @returns 
 */
function listenerAtPhase(inst, event, propagationPhase) {
  var registrationName = event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(inst, registrationName); // 获取对应注册的事件处理函数
}


/**
 * 
 * @param {*} inst      标签组件初始化实例
 * @param {*} upwards   布尔值
 * @param {*} event     合成事件对象
 */
function accumulateDirectionalDispatches(inst, upwards, event) {
  if (__DEV__) {
    warning(
      inst,
      'Dispatching inst must not be null'
    );
  }
  var phase = upwards ? PropagationPhases.bubbled : PropagationPhases.captured; // 根据布尔值来获取冒泡还是捕获


  var listener = listenerAtPhase(inst, event, phase); // 返回注册的对应的事件处理函数

  // 判断是否该函数
  if (listener) {
    event._dispatchListeners = accumulateInto(event._dispatchListeners, listener); // 将处理函数存到该属性中
    event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);  // 将实例的到该属性中
  }
}


/**
 * 
 * @param {*} event 合成事件对象
 */
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    EventPluginUtils.traverseTwoPhase(
      event._targetInst,   // 目标节点组件初始化实例 
      accumulateDirectionalDispatches, // 回调函数
      event  // 合成事件对象
    );
  }
}

/**
 * Same as `accumulateTwoPhaseDispatchesSingle`, but skips over the targetID.
 */
function accumulateTwoPhaseDispatchesSingleSkipTarget(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    var targetInst = event._targetInst;
    var parentInst =
      targetInst ? EventPluginUtils.getParentInstance(targetInst) : null;
    EventPluginUtils.traverseTwoPhase(
      parentInst,
      accumulateDirectionalDispatches,
      event
    );
  }
}


/**
 * Accumulates without regard to direction, does not look for phased
 * registration names. Same as `accumulateDirectDispatchesSingle` but without
 * requiring that the `dispatchMarker` be the same as the dispatched ID.
 */
function accumulateDispatches(inst, ignoredDirection, event) {
  if (event && event.dispatchConfig.registrationName) {
    var registrationName = event.dispatchConfig.registrationName;
    var listener = getListener(inst, registrationName);
    if (listener) {
      event._dispatchListeners =
        accumulateInto(event._dispatchListeners, listener);
      event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);
    }
  }
}

/**
 * Accumulates dispatches on an `SyntheticEvent`, but only for the
 * `dispatchMarker`.
 * @param {SyntheticEvent} event
 */
function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event._targetInst, null, event);
  }
}


/**
 * 
 * @param {*} events 合成事件对象
 */
function accumulateTwoPhaseDispatches(events) {
  // 会将处理函数存到合成事件对象中，并将实例存到合成事件对象中
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}

function accumulateTwoPhaseDispatchesSkipTarget(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingleSkipTarget);
}

function accumulateEnterLeaveDispatches(leave, enter, from, to) {
  EventPluginUtils.traverseEnterLeave(
    from,
    to,
    accumulateDispatches,
    leave,
    enter
  );
}


function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}



/**
 * A small set of propagation patterns, each of which will accept a small amount
 * of information, and generate a set of "dispatch ready event objects" - which
 * are sets of events that have already been annotated with a set of dispatched
 * listener functions/ids. The API is designed this way to discourage these
 * propagation strategies from actually executing the dispatches, since we
 * always want to collect the entire set of dispatches before executing event a
 * single one.
 *
 * @constructor EventPropagators
 */
var EventPropagators = {
  accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
  accumulateTwoPhaseDispatchesSkipTarget: accumulateTwoPhaseDispatchesSkipTarget,
  accumulateDirectDispatches: accumulateDirectDispatches,
  accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches,
};

module.exports = EventPropagators;
