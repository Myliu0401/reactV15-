/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactRef
 */

'use strict';

var ReactOwner = require('ReactOwner');

var ReactRef = {};

function attachRef(ref, component, owner) {
  if (typeof ref === 'function') {
    ref(component.getPublicInstance());
  } else {
    // Legacy ref
    ReactOwner.addComponentAsRefTo(component, ref, owner);
  }
}


/**
 * 
 * @param {*} ref   ref对象/函数
 * @param {*} component 
 * @param {*} owner 
 */
function detachRef(ref, component, owner) {

  // 判断是否为函数
  if (typeof ref === 'function') {
    ref(null);
  } else {
    // Legacy ref
    ReactOwner.removeComponentAsRefFrom(component, ref, owner);
  }
}

ReactRef.attachRefs = function(instance, element) {
  if (element === null || element === false) {
    return;
  }
  var ref = element.ref;
  if (ref != null) {
    attachRef(ref, instance, element._owner);
  }
};


/**
 * 
 * @param {*} prevElement 旧react元素
 * @param {*} nextElement 新react元素
 * @returns 
 */
ReactRef.shouldUpdateRefs = function(prevElement, nextElement) {


  var prevEmpty = prevElement === null || prevElement === false;
  var nextEmpty = nextElement === null || nextElement === false;

  return (
    prevEmpty || nextEmpty || nextElement._owner !== prevElement._owner || nextElement.ref !== prevElement.ref
  );
};



/**
 * 
 * @param {*} instance 组件初始化实例
 * @param {*} element  babel转义
 * @returns 
 */
ReactRef.detachRefs = function(instance, element) {

  // 判断是否为空和false
  if (element === null || element === false) {
    return;
  }

  var ref = element.ref; // 获取ref属性，该属性 对象/函数 存储着dom节点

  // 判断该属性是否有值
  if (ref != null) {

    // 参数为 ref对象/函数 、组件初始化实例、
    detachRef(ref, instance, element._owner);
  }
};


module.exports = ReactRef;
