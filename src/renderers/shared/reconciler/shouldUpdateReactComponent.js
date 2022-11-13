/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule shouldUpdateReactComponent
 */

'use strict';

/**
 * 判断 新旧组件信息是否一致
 * @param {?object} prevElement   旧节点
 * @param {?object} nextElement   新节点
 * @return {boolean} 布尔值
 * @protected
 */
function shouldUpdateReactComponent(prevElement, nextElement) {

  // 条件一 判断 新旧某一方是否为null或false
  var prevEmpty = prevElement === null || prevElement === false;
  var nextEmpty = nextElement === null || nextElement === false;
  if (prevEmpty || nextEmpty) {
    return prevEmpty === nextEmpty;
  }

  // 条件二
  var prevType = typeof prevElement;
  var nextType = typeof nextElement;
  if (prevType === 'string' || prevType === 'number') {
    return (nextType === 'string' || nextType === 'number');  // 判断 新旧 文本节点是否一致
  } else {

    // 判断 新旧组件类型和key值是否相同
    // 自定义组件类型有 类函数、函数。  dom组件类型为 字符串（标签名）
    return (
      nextType === 'object' &&
      prevElement.type === nextElement.type &&
      prevElement.key === nextElement.key
    );
  }
}

module.exports = shouldUpdateReactComponent;
