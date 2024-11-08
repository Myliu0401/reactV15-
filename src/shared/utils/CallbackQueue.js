/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CallbackQueue
 */

"use strict";

var PooledClass = require("PooledClass");

var invariant = require("invariant");

/**
 * A specialized pseudo-event module to help keep track of components waiting to
 * be notified when their DOM representations are available for use.
 *
 * This implements `PooledClass`, so you should never need to instantiate this.
 * Instead, use `CallbackQueue.getPooled()`.
 *
 * @class ReactMountReady
 * @implements PooledClass
 * @internal
 */
function CallbackQueue() {
  this._callbacks = null;
  this._contexts = null;
}

Object.assign(CallbackQueue.prototype, {
  /**
   * 对调用`notifyAll`时要调用的回调进行排队。
   *
   * @param {function} callback 回调函数
   * @param {?object} context 事件信息的对象 里面包含  inst: inst, // 组件初始化实例
                                                     registrationName: registrationName, // 事件名 如： onClick
                                                     listener: listener, // 事件处理函数
   * @internal
   */
  enqueue: function (callback, context) {
    this._callbacks = this._callbacks || []; // 向实例中该属性注入为数组
    this._contexts = this._contexts || []; // 向实例中该属性注入为数组
    this._callbacks.push(callback); // 添加回调到数组中
    this._contexts.push(context); // 添加对象信息到数组中
  },

  /**
   * 调用所有排队的回调并清除队列。这是在组件的DOM表示已经创建或更新。
   *
   * @internal
   */
  notifyAll: function () {
    var callbacks = this._callbacks; // 取出注册事件时存储putListener函数的数组
    var contexts = this._contexts; // 取出注册事件时存储信息对象的数组

    // 判断是否有存储putListener函数的数组
    if (callbacks) {
      this._callbacks = null; // 重置为null
      this._contexts = null; // 重置为null

      // 循环该数组
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i].call(contexts[i]); // 执行存储的putListener函数，并且该函数的this置为对应的信息对象
      }

      callbacks.length = 0; // 数组长度重置为0
      contexts.length = 0; // 数组长度重置为0
    }
  },

  checkpoint: function () {
    return this._callbacks ? this._callbacks.length : 0;
  },

  rollback: function (len) {
    if (this._callbacks) {
      this._callbacks.length = len;
      this._contexts.length = len;
    }
  },

  /**
   * Resets the internal queue.
   *
   * @internal
   */
  reset: function () {
    this._callbacks = null;
    this._contexts = null;
  },

  /**
   * `PooledClass` looks for this.
   */
  destructor: function () {
    this.reset();
  },
});

PooledClass.addPoolingTo(CallbackQueue); // 对CallbackQueue函数的静态属性进行扩展
/* 
   扩展后该函数拥有以下静态属性
   instancePool为空数组
   getPooled为PooledClass模块中的oneArgumentPooler函数
   poolSize为10
   release为PooledClass模块中的standardReleaser函数


*/

module.exports = CallbackQueue;
