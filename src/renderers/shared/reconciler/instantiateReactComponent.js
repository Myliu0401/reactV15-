/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule instantiateReactComponent
 */

'use strict';

var ReactCompositeComponent = require('ReactCompositeComponent');
var ReactEmptyComponent = require('ReactEmptyComponent');
var ReactNativeComponent = require('ReactNativeComponent');

var invariant = require('invariant');
var warning = require('warning');

// 为了避免循环依赖，我们在这个模块中创建最后一个类
var ReactCompositeComponentWrapper = function(element) {
  this.construct(element);
};


// 将属性混进ReactCompositeComponentWrapper的原型中
Object.assign(
  ReactCompositeComponentWrapper.prototype,
  ReactCompositeComponent.Mixin,
  {
    _instantiateReactComponent: instantiateReactComponent,
  }
);

function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * Check if the type reference is a known internal type. I.e. not a user
 * provided composite type.
 *
 * @param {function} type
 * @return {boolean} Returns true if this is a valid internal type.
 */
function isInternalComponentType(type) {
  return (
    typeof type === 'function' &&
    typeof type.prototype !== 'undefined' &&
    typeof type.prototype.mountComponent === 'function' &&
    typeof type.prototype.receiveComponent === 'function'
  );
}

/**
 * 组件初始化的路口函数
 * @param {ReactNode} node   组件
 * @return {object} 返回组件初始化的实例
 * @protected
 */
function instantiateReactComponent(node) {
  var instance;

  // 判断是否是null或false，如果是，则表示空节点
  if (node === null || node === false) {

    instance = ReactEmptyComponent.create(instantiateReactComponent); // 初始化空节点

  } else if (typeof node === 'object') { // 判断是否是babel转义后的组件

    var element = node;
  

    // 判断是否是标签组件
    if (typeof element.type === 'string') {

      instance = ReactNativeComponent.createInternalComponent(element); // 标签组件如 div、span等

    } else if (isInternalComponentType(element.type)) { // 判断是否特殊的组件 函数原型上有mountComponent和receiveComponent函数的组件
       /* 
          这暂时适用于非字符串的自定义组件陈述。一、 e.艺术。一旦更新为使用字符串表示，我们可以删除此代码路径。
       */
      instance = new element.type(element);

    } else {

      instance = new ReactCompositeComponentWrapper(element); // 自定义组件

    }

  } else if (typeof node === 'string' || typeof node === 'number') { // 判断是否是文本组件

    instance = ReactNativeComponent.createInstanceForText(node);  // 初始化文本节点

  } else {
    
    // 匹配不到对应的类型
    invariant(
      false,
      'Encountered invalid React node of type %s',
      typeof node
    );
    
  }



  /* 
     DOM和ART区分算法使用这两个字段分别地与其在组件上使用expandos，我们应该将不同算法所需的状态存储在其他地方。   
  */

  instance._mountIndex = 0;
  instance._mountImage = null;

 

  return instance;
}

module.exports = instantiateReactComponent;
