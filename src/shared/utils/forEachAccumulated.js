/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule forEachAccumulated
 */

'use strict';

/**
 * 
 * @param {*} arr 事件队列/事件对象 ...
 * @param {*} cb  回调函数
 * @param {*} scope 
 */
var forEachAccumulated = function(arr, cb, scope) {
  
  // 判断事件队列是否是数组
  if (Array.isArray(arr)) {
    arr.forEach(cb, scope); // 执行注册的事件处理函数
  } else if (arr) {
    cb.call(scope, arr); // 执行回调并且将回调值this修改成第三个参数
  }
};

module.exports = forEachAccumulated;
