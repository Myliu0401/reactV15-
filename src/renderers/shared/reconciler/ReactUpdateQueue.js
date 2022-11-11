/**
 * Copyright 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactUpdateQueue
 */

'use strict';

var ReactCurrentOwner = require('ReactCurrentOwner');
var ReactInstanceMap = require('ReactInstanceMap');
var ReactUpdates = require('ReactUpdates');

var invariant = require('invariant');
var warning = require('warning');

/**
 * 更新队列
 * @param {*} internalInstance 类组件初始化实例
 */
function enqueueUpdate(internalInstance) {
  ReactUpdates.enqueueUpdate(internalInstance); // 进行更新操作
}


/**
 * 
 * @param {*} arg  函数
 * @returns  参数类型
 */
function formatUnexpectedArgument(arg) {

  var type = typeof arg;  // 获取该参数的类型

  // 因为typeof的验证受限，所以 null 数组 对象 类型都为 object
  if (type !== 'object') {
    return type; // 如果不是对象类型，则直接返回该参数类型
  }

  /* 
       获取该参数的类型
       创建该类型的函数的名称，如果没有则返回上面的type
  
  */
  var displayName = arg.constructor && arg.constructor.name || type;  

  /* 
      转为数组,会将添加给函数的静态属性的key装进数组中并返回
  
  */
  var keys = Object.keys(arg); 

  // 判断该数组有没有值，并且长度不能大于20
  if (keys.length > 0 && keys.length < 20) {

    return `${displayName} (keys: ${keys.join(', ')})`; // 拼接后返回

  };
 
  return displayName; // 返回参数的类型
}


/**
 * 获取类组件初始化的实例
 * @param {*} publicInstance 实例
 * @param {*} callerName 名称
 * @returns 实例中组件的实例 
 */
function getInternalInstanceReadyForUpdate(publicInstance, callerName) {
  var internalInstance = ReactInstanceMap.get(publicInstance);  // 获取类组件初始化的实例
  if (!internalInstance) {
    if (__DEV__) {
      // Only warn when we have a callerName. Otherwise we should be silent.
      // We're probably calling from enqueueCallback. We don't want to warn
      // there because we already warned for the corresponding lifecycle method.
      warning(
        !callerName,
        '%s(...): Can only update a mounted or mounting component. ' +
        'This usually means you called %s() on an unmounted component. ' +
        'This is a no-op. Please check the code for the %s component.',
        callerName,
        callerName,
        publicInstance.constructor.displayName
      );
    }
    return null;
  }

  if (__DEV__) {
    warning(
      ReactCurrentOwner.current == null,
      '%s(...): Cannot update during an existing state transition (such as ' +
      'within `render` or another component\'s constructor). Render methods ' +
      'should be a pure function of props and state; constructor ' +
      'side-effects are an anti-pattern, but can be moved to ' +
      '`componentWillMount`.',
      callerName
    );
  }

  return internalInstance;
}

/**
 * ReactUpdateQueue allows for state updates to be scheduled into a later
 * reconciliation step.
 */
var ReactUpdateQueue = {

  /**
   * Checks whether or not this composite component is mounted.
   * @param {ReactClass} publicInstance The instance we want to test.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function(publicInstance) {
    if (__DEV__) {
      var owner = ReactCurrentOwner.current;
      if (owner !== null) {
        warning(
          owner._warnedAboutRefsInRender,
          '%s is accessing isMounted inside its render() function. ' +
          'render() should be a pure function of props and state. It should ' +
          'never access something that requires stale data from the previous ' +
          'render, such as refs. Move this logic to componentDidMount and ' +
          'componentDidUpdate instead.',
          owner.getName() || 'A component'
        );
        owner._warnedAboutRefsInRender = true;
      }
    }
    var internalInstance = ReactInstanceMap.get(publicInstance);
    if (internalInstance) {
      // During componentWillMount and render this will still be null but after
      // that will always render to something. At least for now. So we can use
      // this hack.
      return !!internalInstance._renderedComponent;
    } else {
      return false;
    }
  },

  /**
   * Enqueue a callback that will be executed after all the pending updates
   * have processed.
   *
   * @param {ReactClass} publicInstance The instance to use as `this` context.
   * @param {?function} callback Called after state is updated.
   * @param {string} callerName Name of the calling function in the public API.
   * @internal
   */
  enqueueCallback: function(publicInstance, callback, callerName) {
    ReactUpdateQueue.validateCallback(callback, callerName);
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance);

    // Previously we would throw an error if we didn't have an internal
    // instance. Since we want to make it a no-op instead, we mirror the same
    // behavior we have in other enqueue* methods.
    // We also need to ignore callbacks in componentWillMount. See
    // enqueueUpdates.
    if (!internalInstance) {
      return null;
    }

    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    // TODO: The callback here is ignored when setState is called from
    // componentWillMount. Either fix it or disallow doing so completely in
    // favor of getInitialState. Alternatively, we can disallow
    // componentWillMount during server-side rendering.
    enqueueUpdate(internalInstance);
  },

  enqueueCallbackInternal: function(internalInstance, callback) {
    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    enqueueUpdate(internalInstance);
  },

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldComponentUpdate`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @internal
   */
  enqueueForceUpdate: function(publicInstance) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'forceUpdate'
    );

    if (!internalInstance) {
      return;
    }

    internalInstance._pendingForceUpdate = true;

    enqueueUpdate(internalInstance);
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} completeState Next state.
   * @internal
   */
  enqueueReplaceState: function(publicInstance, completeState) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'replaceState'
    );

    if (!internalInstance) {
      return;
    }

    internalInstance._pendingStateQueue = [completeState];
    internalInstance._pendingReplaceState = true;

    enqueueUpdate(internalInstance);
  },


  /**
   * 更新状态
   * @param {ReactClass} publicInstance 类实例 
   * @param {object} partialState 新状态
   * @internal
   */
  enqueueSetState: function(publicInstance, partialState) {

    // 获取组件初始化的实例
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance, 'setState');

    if (!internalInstance) {
      return;
    }

    // 判断组件初始化实例中该状态队列有没有值如果没有值，则赋值为空数组
    var queue = internalInstance._pendingStateQueue || (internalInstance._pendingStateQueue = []);
    
    queue.push(partialState); // 将新状态对象加进状态队列中

    // 更新队列   参数为类组件初始化实例 
    enqueueUpdate(internalInstance);
  },

  enqueueElementInternal: function(internalInstance, newElement) {
    internalInstance._pendingElement = newElement;
    enqueueUpdate(internalInstance);
  },


  /**
   * 
   * @param {*} callback      回调
   * @param {*} callerName    回调名
   */
  validateCallback: function(callback, callerName) {
    invariant(
      !callback || typeof callback === 'function',
      '%s(...): Expected the last optional `callback` argument to be a ' +
      'function. Instead received: %s.',
      callerName,
      formatUnexpectedArgument(callback) // 参数类型
    );
  },

};

module.exports = ReactUpdateQueue;
