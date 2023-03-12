/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Transaction
 */

'use strict';

var invariant = require('invariant');

/**
 * `Transaction` creates a black box that is able to wrap any method such that
 * certain invariants are maintained before and after the method is invoked
 * (Even if an exception is thrown while invoking the wrapped method). Whoever
 * instantiates a transaction can provide enforcers of the invariants at
 * creation time. The `Transaction` class itself will supply one additional
 * automatic invariant for you - the invariant that any transaction instance
 * should not be run while it is already being run. You would typically create a
 * single instance of a `Transaction` for reuse multiple times, that potentially
 * is used to wrap several different methods. Wrappers are extremely simple -
 * they only require implementing two methods.
 *
 * <pre>
 *                       wrappers (injected at creation time)
 *                                      +        +
 *                                      |        |
 *                    +-----------------|--------|--------------+
 *                    |                 v        |              |
 *                    |      +---------------+   |              |
 *                    |   +--|    wrapper1   |---|----+         |
 *                    |   |  +---------------+   v    |         |
 *                    |   |          +-------------+  |         |
 *                    |   |     +----|   wrapper2  |--------+   |
 *                    |   |     |    +-------------+  |     |   |
 *                    |   |     |                     |     |   |
 *                    |   v     v                     v     v   | wrapper
 *                    | +---+ +---+   +---------+   +---+ +---+ | invariants
 * perform(anyMethod) | |   | |   |   |         |   |   | |   | | maintained
 * +----------------->|-|---|-|---|-->|anyMethod|---|---|-|---|-|-------->
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | +---+ +---+   +---------+   +---+ +---+ |
 *                    |  initialize                    close    |
 *                    +-----------------------------------------+
 * </pre>
 *
 * Use cases:
 * - Preserving the input selection ranges before/after reconciliation.
 *   Restoring selection even in the event of an unexpected error.
 * - Deactivating events while rearranging the DOM, preventing blurs/focuses,
 *   while guaranteeing that afterwards, the event system is reactivated.
 * - Flushing a queue of collected DOM mutations to the main UI thread after a
 *   reconciliation takes place in a worker thread.
 * - Invoking any collected `componentDidUpdate` callbacks after rendering new
 *   content.
 * - (Future use case): Wrapping particular flushes of the `ReactWorker` queue
 *   to preserve the `scrollTop` (an automatic scroll aware DOM).
 * - (Future use case): Layout calculations before and after DOM updates.
 *
 * Transactional plugin API:
 * - A module that has an `initialize` method that returns any precomputation.
 * - and a `close` method that accepts the precomputation. `close` is invoked
 *   when the wrapped process is completed, or has failed.
 *
 * @param {Array<TransactionalWrapper>} transactionWrapper Wrapper modules
 * that implement `initialize` and `close`.
 * @return {Transaction} Single transaction for reuse in thread.
 *
 * @class Transaction
 */
var Mixin = {
  /**
   * Sets up this instance so that it is prepared for collecting metrics. Does
   * so such that this setup method may be used on an instance that is already
   * initialized, in a way that does not consume additional memory upon reuse.
   * That can be useful if you decide to make your subclass of this mixin a
   * "PooledClass".
   */
  reinitializeTransaction: function() {

    this.transactionWrappers = this.getTransactionWrappers(); // 获取事务的数组

    //  判断是否有该属性
    if (this.wrapperInitData) {

      this.wrapperInitData.length = 0; // 将该数组长度置为0

    } else {

      this.wrapperInitData = []; // 该属性会在事务处理时存储东西

    }

    this._isInTransaction = false;

  },

  _isInTransaction: false,

  /**
   * @abstract
   * @return {Array<TransactionWrapper>} Array of transaction wrappers.
   */
  getTransactionWrappers: null,

  isInTransaction: function() {
    return !!this._isInTransaction;
  },

  /**
   *
   * @param {function} method 回调函数  首次执行时该参数是 batchedMountComponentIntoNode函数
   * @param {Object} scope 首次时为null  
   * @param {Object?=} a 首次是组件初始化的实例componentInstance
   * @param {Object?=} b 首次是container要渲染到的容器
   * @param {Object?=} c 首次是是否跳过该标记插入
   * @param {Object?=} d 首次是上下文
   * @param {Object?=} e Argument to pass to the method.
   * @param {Object?=} f Argument to pass to the method.
   *
   * @return {*} Return value from `method`.
   */
  perform: function(method, scope, a, b, c, d, e, f) {


    var errorThrown; // 存储是否出错
    var ret;

    // 捕获是否出错
    try {
      this._isInTransaction = true;

      errorThrown = true; // 设为true,如果以下捕获到错误，后面才将有用

      this.initializeAll(0); // 执行事务的initialize

      ret = method.call(scope, a, b, c, d, e, f); // 执行回调，首次时该回调的this为null

      errorThrown = false; // 还原为false
    } finally {
      try {
        if (errorThrown) {
          
          try {
            this.closeAll(0);
          } catch (err) {
          }
        } else {
          
          this.closeAll(0);
        }
      } finally {
        this._isInTransaction = false;
      }
    }
    return ret;
  },

  /**
   * 
   * @param {*} startIndex 索引，从哪一项开始处理
   */
  initializeAll: function(startIndex) {
    var transactionWrappers = this.transactionWrappers; // 获取事务数组

    // 循环事务数组
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i]; // 数组中的每一项
      
      try {     
    
        this.wrapperInitData[i] = Transaction.OBSERVED_ERROR; // 将该对象赋值给它
        
        // 判断是否有该函数，有就绑定this执行，并将返回值存进去
        this.wrapperInitData[i] = wrapper.initialize ? wrapper.initialize.call(this) : null; 
      
      } finally {

        // 判断是否是同一个对象
        if (this.wrapperInitData[i] === Transaction.OBSERVED_ERROR) {
        
          try {

            this.initializeAll(i + 1);

          } catch (err) {
          
          }
        
        }
      
      }
    }
  },


  closeAll: function(startIndex) {
    invariant(
      this.isInTransaction(),
      'Transaction.closeAll(): Cannot close transaction when none are open.'
    );
    var transactionWrappers = this.transactionWrappers; // 存储事务的数组

    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i]; // 每一项事务
      var initData = this.wrapperInitData[i]; // 获取initializeAll函数中存储的东西
      var errorThrown; // 存储是否发生错误 false代表发生错误
      
      try {
       
        errorThrown = true;

        // 是否不等于OBSERVED_ERROR 并且有close函数
        if (initData !== Transaction.OBSERVED_ERROR && wrapper.close) {

          wrapper.close.call(this, initData); //initData为initializeAll函数的返回值
        }

        errorThrown = false;

      } finally {
        if (errorThrown) {
          try {
            this.closeAll(i + 1);
          } catch (e) {
          }
        }
      }
    }
    this.wrapperInitData.length = 0;
  },
};

var Transaction = {

  Mixin: Mixin,

  /**
   * 要查找以确定是否发生错误的标记.
   */
  OBSERVED_ERROR: {},

};

module.exports = Transaction;
