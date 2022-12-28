/**
 * Copyright 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactChildReconciler
 */

'use strict';

var ReactReconciler = require('ReactReconciler');

var instantiateReactComponent = require('instantiateReactComponent');
var KeyEscapeUtils = require('KeyEscapeUtils');
var shouldUpdateReactComponent = require('shouldUpdateReactComponent');
var traverseAllChildren = require('traverseAllChildren');
var warning = require('warning');


/**
 * 做子节点组件初始化并注入到对象中
 * @param {*} childInstances   存储子节点初始化实例的对象
 * @param {*} child            子节点 
 * @param {*} name             秘钥名称
 */
function instantiateChild(childInstances, child, name) {
  // We found a component instance.
  var keyUnique = (childInstances[name] === undefined);

  if (__DEV__) {
    warning(
      keyUnique,
      'flattenChildren(...): Encountered two children with the same key, ' +
      '`%s`. Child keys must be unique; when two children share a key, only ' +
      'the first child will be used.',
      KeyEscapeUtils.unescape(name)
    );
  }

  // 判断是否有子节点并且有对象中目前没有该实例
  if (child != null && keyUnique) {
    childInstances[name] = instantiateReactComponent(child); // 初始化子节点，并存储到对象中
  }
}

/**
 * ReactChildReconciler provides helpers for initializing or updating a set of
 * children. Its output is suitable for passing it onto ReactMultiChild which
 * does diffed reordering and insertion.
 */
var ReactChildReconciler = {
  /**
   * 
   * @param {*} nestedChildNodes 子节点
   * @param {*} transaction      事务
   * @param {*} context          上下文
   * @returns 
   */
  instantiateChildren: function(nestedChildNodes, transaction, context) {
    // 判断子节点是否为空，为空则直接结束
    if (nestedChildNodes == null) {
      return null;
    };

    // 创建一个对象，用来存储子节点初始化的实例
    var childInstances = {};

    /* 
         nestedChildNodes参数为子节点
         instantiateChild参数为回调，该回调会向childInstances对象注入子节点初始化的实例
         childInstances存储子节点初始化的实例对象

         如果子节点为null，则返回0，该子节点不会填充到childInstances对象中
         如果子节点为undefined或布尔，则返回1，该子节点不会填充到childInstances对象中
         如果子节点为文本节点，则返回1，会向childInstances对象中填充一个 '.0'属性，属性值为 组件初始化实例
         如果子节点为react元素，则返回1，会向childInstances对象中填充一个根据该子节点的key属性生成的一个属性，属性值为 组件初始化实例
         如果子节点为数组，则返回数组的长度，会向childInstances对象中填充满数组每一项的信息


    */
    traverseAllChildren(nestedChildNodes, instantiateChild, childInstances);  // 处理子节点

    return childInstances;  // 返回存储子节点初始化的实例的对象
  },




  /**
   * 更新渲染的子对象并返回一组新的子对象。
   * @param {*} prevChildren           以前初始化的子集。如 {[name]: 组件初始化的实例}
   * @param {*} nextChildren           子元素映射 如 {[name]: babel转义后的组件, [name]: 文本}
   * @param {*} removedNodes           空对象，会将要删除的dom节点，注入到该对象
   * @param {*} transaction            事务
   * @param {*} context                上下文
   * @returns 
   */
  updateChildren: function(
    prevChildren,
    nextChildren,
    removedNodes,
    transaction,
    context) {
    
    // 判断是否都没有，则直接结束
    if (!nextChildren && !prevChildren) {
      return;
    };


    var name;
    var prevChild;

    // 遍历映射的对象
    for (name in nextChildren) {

      // 如果该属性不存在则跳过本次循环
      if (!nextChildren.hasOwnProperty(name)) {
        continue;
      };


      // 如果有以前初始化的子集，则取出对应的属性
      prevChild = prevChildren && prevChildren[name]; 

      // 如果有以前初始化的子集，则取出对应组件初始化实例中存储的babel转义后的标签
      var prevElement = prevChild && prevChild._currentElement;

      // 取出子级映射对象中的属性
      var nextElement = nextChildren[name]; // 此时新children里该属性还是babel转义后的，还不是组件初始化实例

      // 判断以前初始化的子集的对应属性是否不为空，并且新旧节点一致（如：同是文本节点、dom标签类型一致、组件函数一致）
      if (prevChild != null && shouldUpdateReactComponent(prevElement, nextElement)) {
        // 进到这里来代表children数组中对比到相同的


        /* 
            对以前子集对应组件进行更新
            参数为，旧项的组件初始化实例、新项的babel转义、事务、上下文
        */
        ReactReconciler.receiveComponent( prevChild, nextElement, transaction, context );

        nextChildren[name] = prevChild; // 将以前子集对应的属性赋值到 对应的子元素映射属性

      } else {
        /* 
                进到这里来只有两种情况：
                    1. 新旧节点对比不一致
                    2. 该新组件，在旧组件中没有
        
        */


        if (prevChild) {
          // 进到这里来代表 新旧节点对比不一致

          // 旧dom节点添加到removedNodes对象中
          removedNodes[name] = ReactReconciler.getNativeNode(prevChild); 


          ReactReconciler.unmountComponent(prevChild, false); // 卸载旧组件,释放“mountComponent”分配的所有资源
        };



        // 子级必须在装入之前实例化。
        var nextChildInstance = instantiateReactComponent(nextElement);
        nextChildren[name] = nextChildInstance;
      };

      
    };



    // 卸载不再存在的子项。
    for (name in prevChildren) {

      //  以前初始化的子集有该组件，但是新children中没有该组件
      if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren.hasOwnProperty(name))) {

        prevChild = prevChildren[name];  // 从以前初始化的子集取出该组件

        removedNodes[name] = ReactReconciler.getNativeNode(prevChild); // 取出组件对应的dom节点

        ReactReconciler.unmountComponent(prevChild, false); // 对组件进行卸载操作
      }
    }
  },


  /**
   * 卸载所有渲染的子级。这应该用来清理孩子当卸载此组件时。
   * @param {*} renderedChildren 存储子节点初始化实例的对象
   * @param {*} safely  布尔值
   */
  unmountChildren: function(renderedChildren, safely) {

    // 遍历子节点初始化实例逐个释放资源
    for (var name in renderedChildren) {
      if (renderedChildren.hasOwnProperty(name)) {
        var renderedChild = renderedChildren[name];
        ReactReconciler.unmountComponent(renderedChild, safely);
      }
    }
  },

};

module.exports = ReactChildReconciler;
