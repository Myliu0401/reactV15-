/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultBatchingStrategy
 */

'use strict';

var ReactUpdates = require('ReactUpdates');
var Transaction = require('Transaction');


/*
  emptyFunction的源码

  function (_dereq_, module, exports) {
      "use strict";

      
       // Copyright (c) 2013-present, Facebook, Inc.
       // All rights reserved.
       //
       // This source code is licensed under the BSD-style license found in the
       // LICENSE file in the root directory of this source tree. An additional grant
       // of patent rights can be found in the PATENTS file in the same directory.
       
       

       function makeEmptyFunction(arg) {
        return function () {
          return arg;
        };
      }

      
       // This function accepts and discards inputs; it has no side effects. This is
       // primarily useful idiomatically for overridable function endpoints which
       // always need to be callable, since JS lacks a null-call idiom ala Cocoa.
      
      function emptyFunction() { }

      emptyFunction.thatReturns = makeEmptyFunction;
      emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
      emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
      emptyFunction.thatReturnsNull = makeEmptyFunction(null);
      emptyFunction.thatReturnsThis = function () {
        return this;
      };
      emptyFunction.thatReturnsArgument = function (arg) {
        return arg;
      };

      module.exports = emptyFunction;
    }



*/
var emptyFunction = require('emptyFunction');

// 第二个事务
var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function() {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;  // 将其设为false
  },
};

// 第一个事务
var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates),
};

var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];

function ReactDefaultBatchingStrategyTransaction() {
  this.reinitializeTransaction();
}

// 对ReactDefaultBatchingStrategyTransaction原型进行扩展
Object.assign(
  ReactDefaultBatchingStrategyTransaction.prototype,
  Transaction.Mixin,
  {
    getTransactionWrappers: function() {
      return TRANSACTION_WRAPPERS; // 返回数组，该数组每项为事务所需要的数据
    },
  }
);


/* 
   该事务中拥有 transactionWrappers、wrapperInitData、_isInTransaction，以及原型上的其他属性
   transactionWrappers为事务数组
   wrapperInitData目前为空数组
   _isInTransaction目前为false
   原型...

*/
var transaction = new ReactDefaultBatchingStrategyTransaction(); // 创建事务



var ReactDefaultBatchingStrategy = {
  isBatchingUpdates: false, // 该属性用来决定是否进行批量更新处理，false为立即更新，true为批量更新

  /**
   * 控制是否批量更新
   * @param {*} callback 回调函数  首次执行时该参数是 batchedMountComponentIntoNode函数
   * @param {*} a  首次是组件初始化的实例componentInstance
   * @param {*} b  首次是container要渲染到的容器
   * @param {*} c  首次是是否跳过该标记插入
   * @param {*} d  首次是上下文
   * @param {*} e  
   */
  batchedUpdates: function(callback, a, b, c, d, e) {

    // 这里是用于在修改isBatchingUpdates之前存储上次的isBatchingUpdates状态
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;

    // 只要调用batchedUpdates就会将isBatchingUpdates改为true
    ReactDefaultBatchingStrategy.isBatchingUpdates = true;

    // 判断是否批量更新  
    // 如果在我们改isBatchingUpdates为true之前它就已经是true了，那说明改之前就已经处于批量更新状态中了
    if (alreadyBatchingUpdates) {
      // 那既然已经在更新了，就直接等待更新结束
      callback(a, b, c, d, e);
    } else {
      // 启动事务开始进行更新
      transaction.perform(callback, null, a, b, c, d, e); // 进入事务阶段
    }
  },
};

module.exports = ReactDefaultBatchingStrategy;
