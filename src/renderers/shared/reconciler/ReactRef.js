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
 * 释放ref资源
 * @param {Object/Function} ref   ref对象/ref函数
 * @param {*} component           组件初始化实例
 * @param {*} owner               null
 */
function detachRef(ref, component, owner) {

  // 判断ref是否为函数
  if (typeof ref === 'function') {
    ref(null); // 执行该函数，参数为null
  } else {

    ReactOwner.removeComponentAsRefFrom(component, ref, owner); // 释放ref资源

  }
};



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
 * 释放ref资源
 * @param {*} instance    组件初始化实例
 * @param {*} element     babel转义
 * @returns 
 */
ReactRef.detachRefs = function(instance, element) {
  if (element === null || element === false) {
    return;
  }
  var ref = element.ref;
  if (ref != null) {

    /* 
       释放ref
       参数为 ref对象/ref函数、组件初始化实例、null
    */
    detachRef(ref, instance, element._owner);
  }
};

module.exports = ReactRef;
