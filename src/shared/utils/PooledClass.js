/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule PooledClass
 */

'use strict';

var invariant = require('invariant');


/**
 * 
 * @param {Boolean} copyFieldsFrom 布尔值
 * @returns 
 */
var oneArgumentPooler = function(copyFieldsFrom) {

  var Klass = this; // ReactReconcileTransaction函数执行时，this为ReactReconcileTransaction
   
  // 判断数组中是否有值
  if (Klass.instancePool.length) {

    var instance = Klass.instancePool.pop(); // 截取数组的最后一项并返回，数组也会随着变化

    Klass.call(instance, copyFieldsFrom);  // 执行该函数，比将this修改为截取数组的最后哪一项

    return instance; // 返回截取数组的最后一项

  } else {

    return new Klass(copyFieldsFrom); // 该ReactReconcileTransaction函数会创建事务

  }
};


var twoArgumentPooler = function(a1, a2) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();  // 截取数组的最后一项，截取后，原数组会改变
    Klass.call(instance, a1, a2);
    return instance;
  } else {
    return new Klass(a1, a2);
  }
};

var threeArgumentPooler = function(a1, a2, a3) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3);
    return instance;
  } else {
    return new Klass(a1, a2, a3);
  }
};

/**
 * 
 * @param {*} a1 对应的事件类型块
 * @param {*} a2 组件初始化实例
 * @param {*} a3 原生事件对象
 * @param {*} a4 触发事件目标节点的dom
 * @returns 
 */
var fourArgumentPooler = function(a1, a2, a3, a4) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4);
  }
};

var fiveArgumentPooler = function(a1, a2, a3, a4, a5) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4, a5);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4, a5);
  }
};

var standardReleaser = function(instance) {
  var Klass = this;
  invariant(
    instance instanceof Klass,
    'Trying to release an instance into a pool of a different type.'
  );
  instance.destructor();
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};

var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;

/**
 * 向CopyConstructor函数的静态属性注入某些东西
 * @param {Function} CopyConstructor 函数
 * @param {Function} pooler 函数
 */
var addPoolingTo = function(CopyConstructor, pooler) {
  var NewKlass = CopyConstructor; // 先将第一个函数参数存到变量中

  NewKlass.instancePool = []; // 赋值为一个数组

  NewKlass.getPooled = pooler || DEFAULT_POOLER; // 是否有第二个参数，有就将该值属性赋值为第二参数函数

  // 判断第一个参数函数中是否没有有该poolSize属性
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE; // 默认为10
  }

  NewKlass.release = standardReleaser; // 将该函数添加到第一个参数函数的静态属性中

  return NewKlass; // 返回第一个参数函数
};

var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: oneArgumentPooler,
  twoArgumentPooler: twoArgumentPooler,
  threeArgumentPooler: threeArgumentPooler,
  fourArgumentPooler: fourArgumentPooler,
  fiveArgumentPooler: fiveArgumentPooler,
};

module.exports = PooledClass;
