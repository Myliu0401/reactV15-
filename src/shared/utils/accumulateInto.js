/**
 * Copyright 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule accumulateInto
 */

'use strict';

var invariant = require('invariant');

/**
 *
 * Accumulates items that must not be null or undefined into the first one. This
 * is used to conserve memory by avoiding array allocations, and thus sacrifices
 * API cleanness. Since `current` can be null before being passed in and not
 * null after this function, make sure to assign it back to `current`:
 *
 * `a = accumulateInto(a, b);`
 *
 * This API should be sparingly used. Try `accumulate` for something cleaner.
 *
 * @return {*|array<*>} An accumulation of items.
 */


/**
 *
 * @param {*} current    事件队列/null ...
 * @param {*} next       合成事件对象
 * @return {*} 
 */
function accumulateInto(current, next) {
  invariant(
    next != null,
    'accumulateInto(...): Accumulated items must not be null or undefined.'
  );

  // 如果是首次则直接返回合成事件对象
  if (current == null) {
    return next;
  }

  // Both are not empty. Warning: Never call x.concat(y) when you are not
  // certain that x is an Array (x could be a string with concat method).
  var currentIsArray = Array.isArray(current);  // 判断是否是数组
  var nextIsArray = Array.isArray(next); // 判断是否是数组

  // 判断事件队列和合成事件对象是否都是数组
  if (currentIsArray && nextIsArray) {
    current.push.apply(current, next);
    return current;
  }

  // 判断事件对象是否是数组
  if (currentIsArray) {
    current.push(next);
    return current;
  }

  // 判断合成对象是否是数组
  if (nextIsArray) {
    // A bit too dangerous to mutate `next`.
    return [current].concat(next);
  }

  return [current, next];  // 返回一个数组，第一项为事件队列、第二项为合成事件对象
}

module.exports = accumulateInto;
